import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
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
  let phase = "start";

  try {
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    // Initialize Stripe with secret key
    phase = "initialization";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
    });

    // Initialize Supabase with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    phase = "clients-initialized";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

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
    phase = "body-parsed";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
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

    phase = "input-validated";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    const { customerInfo, paymentMethodId } = validatedData;

    // Normalize plan_type to match SQL constraint (starter|professional|premium)
    const rawPlan = (customerInfo.planType || "starter")
      .toString()
      .trim()
      .toLowerCase();

    customerInfo.planType =
      rawPlan === "pro" ? "professional" :
      rawPlan === "professional" ? "professional" :
      rawPlan === "premium" ? "premium" :
      "starter";

    // Normalize assistant_gender to match SQL constraint (male|female)
    const rawGender = (customerInfo.assistantGender || "female")
      .toString()
      .trim()
      .toLowerCase();

    customerInfo.assistantGender =
      rawGender === "male" ? "male" : "female";

    // Log normalized values
    console.log(`[${FUNCTION_NAME}] normalized plan_type =`, customerInfo.planType);
    console.log(`[${FUNCTION_NAME}] normalized assistant_gender =`, customerInfo.assistantGender);

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
    phase = "stripe-customer-creating";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

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

    phase = "stripe-customer-created";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo('Stripe customer created', {
      ...baseLogOptions,
      context: { stripeCustomerId, email: customerInfo.email }
    });

    // Attach payment method
    phase = "payment-method-attaching";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    });

    // Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    phase = "payment-method-attached";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    // Create subscription based on plan_type
    phase = "stripe-subscription-creating";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

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

    phase = "stripe-subscription-created";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo('Subscription created', {
      ...baseLogOptions,
      context: { subscriptionId, planType: customerInfo.planType, status: subscription.status }
    });

    if (subscription.status !== 'active') {
      throw new Error(`Subscription not active. Status: ${subscription.status}`);
    }

    // Step 2: Generate secure temporary password
    phase = "generate-password";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
    const tempPassword = generateSecurePassword();

    // Step 3: Create Supabase auth user with metadata
    phase = "auth-user-creating";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

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
      phase = "auth-user-creation-failed";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
      logError('Auth user creation failed', {
        ...baseLogOptions,
        error: authError,
        context: { email: customerInfo.email }
      });
      throw authError;
    }

    phase = "auth-user-created";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo('Auth user created', {
      ...baseLogOptions,
      context: { userId: authData.user.id, email: customerInfo.email }
    });

    // Step 4: Database trigger will automatically create:
    // - accounts table entry
    // - profiles table entry
    // - account_members table entry (owner role)
    // However, we need to verify this succeeds and create manually if it fails

    phase = "wait-for-trigger";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo('Waiting for database trigger to complete', {
      ...baseLogOptions,
      context: {
        userId: authData.user.id,
        email: customerInfo.email,
        hasPhone: !!customerInfo.phone,
        phoneValue: customerInfo.phone
      }
    });

    // Wait longer for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 5: Fetch profile and check if account was created by trigger
    phase = "profile-fetching";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('account_id, id, name')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      phase = "profile-fetch-failed";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
      logError('Failed to fetch profile after user creation', {
        ...baseLogOptions,
        error: profileError,
        context: { userId: authData.user.id }
      });
      throw new Error(`Profile fetch failed: ${profileError.message}`);
    }

    if (!profile) {
      logError('Profile not found after user creation', {
        ...baseLogOptions,
        context: { userId: authData.user.id }
      });
      throw new Error('Profile record not found - database trigger failed completely');
    }

    phase = "profile-fetched";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    // Check if trigger created the account
    if (!profile.account_id) {
      phase = "account-creating-manual";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

      logWarn('Trigger did not create account - creating manually', {
        ...baseLogOptions,
        context: {
          userId: authData.user.id,
          profileData: profile,
          phone: customerInfo.phone,
          companyName: customerInfo.companyName
        }
      });

      // Manually create the account since trigger didn't
      const areaCode = (customerInfo.zipCode && customerInfo.zipCode.trim())
        ? getAreaCodeFromZip(customerInfo.zipCode.trim())
        : '212';
      const billingState = (customerInfo.zipCode && customerInfo.zipCode.trim())
        ? getStateFromZip(customerInfo.zipCode.trim())
        : null;

      const { data: newAccount, error: accountCreateError } = await supabaseAdmin
        .from('accounts')
        .insert({
          company_name: customerInfo.companyName,
          company_domain: null,
          trade: customerInfo.trade,
          assistant_gender: customerInfo.assistantGender,
          wants_advanced_voice: false,
          subscription_status: 'active',
          trial_start_date: null,
          trial_end_date: null,
          provisioning_status: 'pending',
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscriptionId,
          sales_rep_name: customerInfo.salesRepName,
          service_area: customerInfo.serviceArea,
          business_hours: customerInfo.businessHours,
          emergency_policy: customerInfo.emergencyPolicy,
          plan_type: customerInfo.planType,
          phone_number_area_code: areaCode,
          billing_state: billingState
        })
        .select('id')
        .single();

      if (accountCreateError || !newAccount) {
        logError('Failed to manually create account', {
          ...baseLogOptions,
          error: accountCreateError,
          context: {
            userId: authData.user.id,
            companyName: customerInfo.companyName,
            planType: customerInfo.planType,
            errorDetails: JSON.stringify(accountCreateError)
          }
        });
        throw new Error(`Account creation failed: ${accountCreateError?.message || 'Unknown error'}`);
      }

      currentAccountId = newAccount.id;

      phase = "account-created";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

      logInfo('Account created manually', {
        ...baseLogOptions,
        accountId: currentAccountId
      });

      // Update profile with the new account_id
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ account_id: currentAccountId, is_primary: true })
        .eq('id', authData.user.id);

      if (profileUpdateError) {
        logError('Failed to link profile to manually created account', {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: profileUpdateError
        });
      }

      // Create account_members entry
      const { error: memberError } = await supabaseAdmin
        .from('account_members')
        .insert({
          user_id: authData.user.id,
          account_id: currentAccountId,
          role: 'owner'
        });

      if (memberError) {
        logWarn('Failed to create account_members entry', {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: memberError
        });
      }
    } else {
      // Trigger successfully created the account
      currentAccountId = profile.account_id;

      phase = "account-exists-from-trigger";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

      logInfo('Account created by trigger', {
        ...baseLogOptions,
        accountId: currentAccountId
      });
    }

    // If trigger created the account, we need to update it with sales-specific fields
    if (profile.account_id) {
      phase = "account-updating";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);
      const areaCode = (customerInfo.zipCode && customerInfo.zipCode.trim())
        ? getAreaCodeFromZip(customerInfo.zipCode.trim())
        : '212';
      const billingState = (customerInfo.zipCode && customerInfo.zipCode.trim())
        ? getStateFromZip(customerInfo.zipCode.trim())
        : null;

      logInfo('Updating trigger-created account with sales-specific fields', {
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
          assistant_gender: customerInfo.assistantGender,
          plan_type: customerInfo.planType,
          subscription_status: 'active',  // Override trigger's 'trial' status
          phone_number_area_code: areaCode,
          billing_state: billingState,
          trial_start_date: null,  // Sales accounts don't have trials
          trial_end_date: null
        })
        .eq('id', currentAccountId);

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

      phase = "account-updated";
      console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

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

    // Step 5.5: Handle referral code if provided
    phase = "referral-processing";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

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
              referee_account_id: currentAccountId,
              referral_code: customerInfo.referralCode,
              referee_email: customerInfo.email,
              referee_phone: customerInfo.phone,
              status: 'converted', // Sales signups are immediately converted
              converted_at: new Date().toISOString()
            });

          logInfo('Referral tracked', {
            ...baseLogOptions,
            accountId: currentAccountId,
            context: {
              referralCode: customerInfo.referralCode,
              referrerAccountId: referralCodeData.account_id
            }
          });
        } else {
          logInfo('Referral code not found, skipping tracking', {
            ...baseLogOptions,
            accountId: currentAccountId,
            context: { referralCode: customerInfo.referralCode }
          });
        }
      } catch (referralError) {
        // Log but don't fail the signup
        logError('Referral tracking failed (non-critical)', {
          ...baseLogOptions,
          accountId: currentAccountId,
          error: referralError
        });
      }
    }

    // Step 6: Queue provisioning for async processing
    // Phone number provisioning takes 1-2 minutes, so we don't wait for it
    // Instead, mark account as pending and let background job handle it
    phase = "provisioning-queued";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo('Queueing async provisioning for sales account', {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        email: customerInfo.email,
        phone: customerInfo.phone,
        areaCode: customerInfo.zipCode ? getAreaCodeFromZip(customerInfo.zipCode.trim()) : '212'
      }
    });

    // Account is already marked with provisioning_status='pending' during creation
    // No synchronous provisioning - return success immediately
    const provisioningMessage = 'Phone number provisioning is in progress. You will be notified when your RingSnap number is ready.';

    phase = "completed";
    console.log(`[${FUNCTION_NAME}] phase: ${phase}`);

    logInfo('Sales account created successfully - provisioning queued', {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        email: customerInfo.email,
        planType: customerInfo.planType,
        subscriptionStatus: 'active'
      }
    });

    // Return success response - provisioning will complete asynchronously
    const responsePayload = {
      success: true,
      userId: authData.user.id,
      accountId: currentAccountId,
      planType: customerInfo.planType,
      stripeCustomerId,
      subscriptionId,
      tempPassword,
      subscriptionStatus: 'active',
      ringSnapNumber: null,  // Will be populated when provisioning completes
      vapiAssistantId: null,
      provisioned: false,
      provisioningMessage
    };

    logInfo('Sales account creation completed successfully', {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: {
        provisioned: false,
        provisioningQueued: true
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
    console.error(`[${FUNCTION_NAME}] fatal error`, error);
    logError('Sales account creation error', {
      ...baseLogOptions,
      accountId: currentAccountId,
      error
    });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: String(errorMessage),
        phase
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
