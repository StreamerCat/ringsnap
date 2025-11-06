import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { extractCorrelationId, logError, logInfo } from "../_shared/logging.ts";

const FUNCTION_NAME = "create-sales-account";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let currentAccountId: string | null = null;

  try {
    // Initialize Stripe with secret key
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
    });

    // Initialize Supabase with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse request body
    const { customerInfo, paymentMethodId } = await req.json();

    if (!paymentMethodId) {
      logError('Missing payment method', {
        ...baseLogOptions,
        context: { email: customerInfo?.email }
      });
      return new Response(
        JSON.stringify({ error: 'Payment method is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    logInfo('Creating sales account', {
      ...baseLogOptions,
      context: {
        email: customerInfo.email,
        hasPlanType: !!customerInfo.planType
      }
    });

    let stripeCustomerId = null;
    let subscriptionId = null;

    // Step 1: Create Stripe customer and subscription
    const customer = await stripe.customers.create({
      email: customerInfo.email,
      name: customerInfo.name,
      phone: customerInfo.phone,
      metadata: {
        company_name: customerInfo.companyName,
        trade: customerInfo.trade,
        sales_rep: customerInfo.salesRepName,
        source: 'sales-team'
      }
    });
    stripeCustomerId = customer.id;
    logInfo('Stripe customer created', {
      ...baseLogOptions,
      context: { stripeCustomerId, email: customerInfo.email }
    });

    // Attach payment method
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    // Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create subscription based on plan_type
    const priceId = getPriceIdForPlan(customerInfo.planType);
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      metadata: {
        sales_rep: customerInfo.salesRepName,
        plan_type: customerInfo.planType
      }
    });
    subscriptionId = subscription.id;
    logInfo('Subscription created', {
      ...baseLogOptions,
      context: { subscriptionId, planType: customerInfo.planType, status: subscription.status }
    });

    if (subscription.status !== 'active') {
      throw new Error(`Subscription not active. Status: ${subscription.status}`);
    }

    // Step 2: Generate secure temporary password
    const tempPassword = generateSecurePassword();

    // Step 3: Create Supabase auth user with metadata
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: customerInfo.email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: customerInfo.name,
        phone: customerInfo.phone,
        company_name: customerInfo.companyName,
        trade: customerInfo.trade,
        service_area: customerInfo.serviceArea,
        business_hours: customerInfo.businessHours,
        emergency_policy: customerInfo.emergencyPolicy,
        sales_rep_name: customerInfo.salesRepName,
        plan_type: customerInfo.planType,
        source: 'sales-team',
        stripe_customer_id: stripeCustomerId,
        wants_advanced_voice: false
      }
    });

    if (authError) {
      logError('Auth user creation failed', {
        ...baseLogOptions,
        error: authError,
        context: { email: customerInfo.email }
      });
      throw authError;
    }

    logInfo('Auth user created', {
      ...baseLogOptions,
      context: { userId: authData.user.id, email: customerInfo.email }
    });

    // Step 4: Database trigger will automatically create:
    // - accounts table entry
    // - profiles table entry
    // - user_roles table entry (owner role)

    // Wait brief moment for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 5: Update account with sales-specific fields
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('account_id')
      .eq('id', authData.user.id)
      .single();

    if (profile?.account_id) {
      currentAccountId = profile.account_id;
      await supabaseAdmin
        .from('accounts')
        .update({
          sales_rep_name: customerInfo.salesRepName,
          service_area: customerInfo.serviceArea,
          business_hours: customerInfo.businessHours,
          emergency_policy: customerInfo.emergencyPolicy,
          plan_type: customerInfo.planType,
          subscription_status: 'active'
        })
        .eq('id', profile.account_id);

      logInfo('Account updated with sales data', {
        ...baseLogOptions,
        accountId: currentAccountId,
        context: {
          salesRepName: customerInfo.salesRepName,
          planType: customerInfo.planType,
          subscriptionStatus: 'active'
        }
      });
    }

    if (!profile?.account_id) {
      throw new Error('Account record not found after user creation');
    }

    const { data: accountDetails, error: accountDetailsError } = await supabaseAdmin
      .from('accounts')
      .select('id, plan_type, phone_number_e164, vapi_numbers (phone_e164)')
      .eq('id', profile.account_id)
      .single();

    if (accountDetailsError) {
      logError('Failed to fetch account details', {
        ...baseLogOptions,
        accountId: profile?.account_id ?? undefined,
        error: accountDetailsError
      });
      throw accountDetailsError;
    }

    const vapiNumberRelation = accountDetails?.vapi_numbers;
    let vapiPhoneNumber = Array.isArray(vapiNumberRelation) && vapiNumberRelation.length > 0
      ? vapiNumberRelation[0]?.phone_e164 ?? null
      : accountDetails?.phone_number_e164 ?? null;

    if (!vapiPhoneNumber) {
      const { data: vapiRecord, error: vapiError } = await supabaseAdmin
        .from('vapi_numbers')
        .select('phone_e164')
        .eq('account_id', profile.account_id)
        .maybeSingle();

      if (vapiError) {
        logError('Failed to fetch VAPI number', {
          ...baseLogOptions,
          accountId: profile.account_id,
          error: vapiError
        });
      }

      vapiPhoneNumber = vapiRecord?.phone_e164 ?? null;
    }

    const planType = accountDetails?.plan_type ?? customerInfo.planType;

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        userId: authData.user.id,
        accountId: profile?.account_id,
        planType,
        stripeCustomerId,
        subscriptionId,
        tempPassword,
        subscriptionStatus: 'active',
        vapiPhoneNumber
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    logError('Sales account creation error', {
      ...baseLogOptions,
      accountId: currentAccountId,
      error
    });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// Helper: Map plan type to Stripe price ID
function getPriceIdForPlan(planType: string): string {
  const priceMap: Record<string, string> = {
    'starter': Deno.env.get('STRIPE_PRICE_STARTER') || 'price_starter_placeholder',
    'professional': Deno.env.get('STRIPE_PRICE_PROFESSIONAL') || 'price_professional_placeholder',
    'premium': Deno.env.get('STRIPE_PRICE_PREMIUM') || 'price_premium_placeholder'
  };
  return priceMap[planType] || priceMap['starter'];
}

// Helper: Generate secure random password
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
