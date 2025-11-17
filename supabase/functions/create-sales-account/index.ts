import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getAreaCodeFromZip, getStateFromZip } from "../_shared/area-code-lookup.ts";

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

    // Define validation schema
    const customerInfoSchema = z.object({
      name: z.string().trim().min(1).max(100),
      email: z.string().email().max(255),
      phone: z.string().min(1),
      companyName: z.string().trim().min(1).max(200),
      trade: z.string().max(100).optional(),
      zipCode: z.string().optional(),
      serviceArea: z.string().max(200).optional(),
      businessHours: z.record(z.string()).optional(),
      emergencyPolicy: z.string().max(1000).optional(),
      assistantGender: z.enum(['female', 'male']).optional(),
      salesRepName: z.string().max(100).optional(),
      planType: z.string(),
      referralCode: z.string().max(8).optional(),
    });

    const salesAccountSchema = z.object({
      customerInfo: customerInfoSchema,
      paymentMethodId: z.string().min(1),
    });

    // Parse and validate request body
    const rawData = await req.json();
    let validatedData;
    try {
      validatedData = salesAccountSchema.parse(rawData);
    } catch (zodError: any) {
      return new Response(
        JSON.stringify({ error: 'Invalid input data', details: zodError.errors }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    const { customerInfo, paymentMethodId } = validatedData;

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
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('account_id')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      logError('Failed to fetch profile after user creation', {
        ...baseLogOptions,
        error: profileError,
        context: { userId: authData.user.id }
      });
      throw new Error(`Profile fetch failed: ${profileError.message}`);
    }

    if (!profile?.account_id) {
      logError('Account ID not found on profile', {
        ...baseLogOptions,
        context: {
          userId: authData.user.id,
          profileData: profile
        }
      });
      throw new Error('Account record not found after user creation - database trigger may have failed');
    }

    currentAccountId = profile.account_id;

    // Convert ZIP code to area code and extract state
    // Use a default area code (212 - New York) if ZIP not provided
    const areaCode = (customerInfo.zipCode && customerInfo.zipCode.trim())
      ? getAreaCodeFromZip(customerInfo.zipCode.trim())
      : '212';
    const billingState = (customerInfo.zipCode && customerInfo.zipCode.trim())
      ? getStateFromZip(customerInfo.zipCode.trim())
      : null;

    logInfo('Updating account with sales-specific fields', {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        salesRepName: customerInfo.salesRepName,
        planType: customerInfo.planType,
        areaCode,
        billingState
      }
    });

    const { error: updateError } = await supabaseAdmin
      .from('accounts')
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscriptionId,
        sales_rep_name: customerInfo.salesRepName,
        service_area: customerInfo.serviceArea,
        business_hours: customerInfo.businessHours,
        emergency_policy: customerInfo.emergencyPolicy,
        plan_type: customerInfo.planType,
        subscription_status: 'active',
        phone_number_area_code: areaCode,
        billing_state: billingState
      })
      .eq('id', profile.account_id);

    if (updateError) {
      logError('Failed to update account with sales data', {
        ...baseLogOptions,
        accountId: currentAccountId,
        error: updateError,
        context: {
          stripeCustomerId,
          subscriptionId,
          planType: customerInfo.planType
        }
      });
      throw new Error(`Account update failed: ${updateError.message}`);
    }

    logInfo('Account updated with sales data', {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        salesRepName: customerInfo.salesRepName,
        planType: customerInfo.planType,
        subscriptionStatus: 'active'
      }
    });

    // Step 5.5: Handle referral code if provided
    if (customerInfo.referralCode && customerInfo.referralCode.trim().length === 8) {
      try {
        // Look up the referral code to find the referrer
        const { data: referralCodeData } = await supabaseAdmin
          .from('referral_codes')
          .select('account_id, code')
          .eq('code', customerInfo.referralCode)
          .single();

        if (referralCodeData) {
          // Create referral tracking record
          await supabaseAdmin
            .from('referrals')
            .insert({
              referrer_account_id: referralCodeData.account_id,
              referee_account_id: profile.account_id,
              referral_code: customerInfo.referralCode,
              referee_email: customerInfo.email,
              referee_phone: customerInfo.phone,
              status: 'converted', // Sales signups are immediately converted
              converted_at: new Date().toISOString()
            });

          logInfo('Referral tracked', {
            ...baseLogOptions,
            accountId: profile.account_id,
            context: {
              referralCode: customerInfo.referralCode,
              referrerAccountId: referralCodeData.account_id
            }
          });
        } else {
          logInfo('Referral code not found, skipping tracking', {
            ...baseLogOptions,
            accountId: profile.account_id,
            context: { referralCode: customerInfo.referralCode }
          });
        }
      } catch (referralError) {
        // Log but don't fail the signup
        logError('Referral tracking failed (non-critical)', {
          ...baseLogOptions,
          accountId: profile.account_id,
          error: referralError
        });
      }
    }

    // Step 6: Provision resources immediately (phone number + assistant)
    // This is separate from vapi-demo-call which is only for demos
    logInfo('Starting immediate provisioning for sales account', {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        email: customerInfo.email,
        areaCode: areaCode
      }
    });

    let vapiPhoneNumber = null;
    let vapiAssistantId = null;
    let provisioningSucceeded = false;
    let provisioningMessage = null;

    try {
      const { data: provisionData, error: provisionError } = await supabaseAdmin.functions.invoke(
        'provision-resources',
        {
          body: {
            accountId: currentAccountId,
            email: customerInfo.email,
            name: customerInfo.name,
            phone: customerInfo.phone,
            areaCode: areaCode  // Pass the area code we already computed
          }
        }
      );

      if (provisionError) {
        logError('Provisioning edge function returned error', {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: provisionError,
          context: {
            errorMessage: provisionError.message,
            errorDetails: JSON.stringify(provisionError)
          }
        });
        provisioningMessage = `Provisioning failed: ${provisionError.message}. Account created but phone number needs manual setup.`;
        // Don't fail the whole signup - provisioning can be retried
        // Customer has already paid, so we create the account regardless
      } else if (!provisionData) {
        logError('Provisioning returned no data', {
          ...baseLogOptions,
          accountId: currentAccountId
        });
        provisioningMessage = 'Provisioning returned no data. Account created but phone number needs manual setup.';
      } else {
        provisioningSucceeded = true;
        logInfo('Provisioning succeeded for sales account', {
          ...baseLogOptions,
          accountId: currentAccountId,
          context: {
            phoneNumber: provisionData.phoneNumber,
            responseKeys: Object.keys(provisionData)
          }
        });

        // Wait briefly then fetch updated account with provisioned resources
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: updatedAccount, error: fetchError } = await supabaseAdmin
          .from('accounts')
          .select('vapi_phone_number, vapi_assistant_id, provisioning_status')
          .eq('id', currentAccountId)
          .single();

        if (fetchError) {
          logWarn('Failed to fetch updated account after provisioning', {
            ...baseLogOptions,
            accountId: currentAccountId,
            error: fetchError
          });
        } else {
          vapiPhoneNumber = updatedAccount?.vapi_phone_number;
          vapiAssistantId = updatedAccount?.vapi_assistant_id;

          logInfo('Retrieved provisioned resources from account', {
            ...baseLogOptions,
            accountId: currentAccountId,
            context: {
              hasPhoneNumber: !!vapiPhoneNumber,
              hasAssistantId: !!vapiAssistantId,
              provisioningStatus: updatedAccount?.provisioning_status
            }
          });
        }
      }
    } catch (provisioningError) {
      logError('Exception during provisioning invocation', {
        ...baseLogOptions,
        accountId: currentAccountId,
        error: provisioningError,
        context: {
          errorType: provisioningError instanceof Error ? provisioningError.constructor.name : typeof provisioningError,
          errorMessage: provisioningError instanceof Error ? provisioningError.message : String(provisioningError)
        }
      });
      provisioningMessage = `Provisioning exception: ${provisioningError instanceof Error ? provisioningError.message : 'Unknown error'}. Account created but phone number needs manual setup.`;
      // Continue - don't fail the signup
    }

    // Return success response with detailed provisioning status
    const responsePayload = {
      success: true,
      userId: authData.user.id,
      accountId: currentAccountId,
      planType: customerInfo.planType,
      stripeCustomerId,
      subscriptionId,
      tempPassword,
      subscriptionStatus: 'active',
      ringSnapNumber: vapiPhoneNumber,
      vapiAssistantId,
      provisioned: provisioningSucceeded && !!vapiPhoneNumber,
      ...(provisioningMessage && { provisioningMessage })
    };

    logInfo('Sales account creation completed successfully', {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        provisioned: responsePayload.provisioned,
        hasPhoneNumber: !!vapiPhoneNumber,
        hasProvisioningWarning: !!provisioningMessage
      }
    });

    return new Response(
      JSON.stringify(responsePayload),
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
