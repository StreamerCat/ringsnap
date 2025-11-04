import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { customerInfo, paymentMethodId, skipPayment } = await req.json();

    console.log('Creating sales account:', {
      email: customerInfo.email,
      skipPayment,
      hasPlanType: !!customerInfo.planType
    });

    let stripeCustomerId = null;
    let subscriptionId = null;

    // Step 1: Create Stripe customer (if payment not skipped)
    if (!skipPayment && paymentMethodId) {
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
      console.log('Stripe customer created:', stripeCustomerId);

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
      console.log('Subscription created:', subscriptionId);
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
      console.error('Auth user creation failed:', authError);
      throw authError;
    }

    console.log('Auth user created:', authData.user.id);

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
      await supabaseAdmin
        .from('accounts')
        .update({
          sales_rep_name: customerInfo.salesRepName,
          service_area: customerInfo.serviceArea,
          business_hours: customerInfo.businessHours,
          emergency_policy: customerInfo.emergencyPolicy,
          plan_type: customerInfo.planType,
          subscription_status: skipPayment ? 'trial' : 'active',
          trial_start_date: skipPayment ? new Date().toISOString() : null,
          trial_end_date: skipPayment ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() : null
        })
        .eq('id', profile.account_id);

      console.log('Account updated with sales data');
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        userId: authData.user.id,
        accountId: profile?.account_id,
        stripeCustomerId,
        subscriptionId,
        tempPassword,
        subscriptionStatus: skipPayment ? 'trial' : 'active'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Sales account creation error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error instanceof Error ? error.stack : 'Unknown error'
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
  const priceMap = {
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
