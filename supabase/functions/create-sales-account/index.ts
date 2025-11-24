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
  const request_id = crypto.randomUUID();
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = {
    functionName: FUNCTION_NAME,
    correlationId,
    request_id,
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let currentAccountId: string | null = null;
  let currentUserId: string | null = null;
  let stripeCustomerId: string | null = null;
  let stripeSubscriptionId: string | null = null;
  let phase = "start";

  try {
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    // Initialize Stripe with secret key
    let stripe: Stripe;
    try {
      stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
        apiVersion: '2023-10-16',
      });
    } catch (err: any) {
      console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
      return new Response(
        JSON.stringify({ success: false, request_id, phase, message: err.message ?? "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase with service role key (bypasses RLS)
    let supabaseAdmin: any;
    try {
      supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
    } catch (err: any) {
      console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
      return new Response(
        JSON.stringify({ success: false, request_id, phase, message: err.message ?? "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    phase = "validate_input";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    let rawData: any;
    try {
      rawData = await req.json();
    } catch (err: any) {
      console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
      return new Response(
        JSON.stringify({ success: false, request_id, phase, message: "Invalid JSON body" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Step 1: Create Stripe customer and subscription
    phase = "stripe_customer";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    let customer: Stripe.Customer;
    try {
      customer = await stripe.customers.create({
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
    } catch (err: any) {
      console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
      return new Response(
        JSON.stringify({ success: false, request_id, phase, message: err.message ?? "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Attach payment method
    phase = "stripe_payment_method";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      // Set as default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (err: any) {
      console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
      return new Response(
        JSON.stringify({ success: false, request_id, phase, message: err.message ?? "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create subscription based on plan_type
    phase = "stripe_subscription";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    let subscription: Stripe.Subscription;
    try {
      const priceId = getPriceIdForPlan(customerInfo.planType);
      subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        metadata: {
          sales_rep: customerInfo.salesRepName,
          plan_type: customerInfo.planType
        }
      });
      stripeSubscriptionId = subscription.id;

      logInfo('Subscription created', {
        ...baseLogOptions,
        context: { subscriptionId: subscription.id, planType: customerInfo.planType, status: subscription.status }
      });

      if (subscription.status !== 'active') {
        throw new Error(`Subscription not active. Status: ${subscription.status}`);
      }
    } catch (err: any) {
      console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
      return new Response(
        JSON.stringify({ success: false, request_id, phase, message: err.message ?? "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Generate secure temporary password
    const tempPassword = generateSecurePassword();

    // Step 3: Create Supabase auth user with metadata
    phase = "auth_user";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    let authData: any;
    try {
      const { data: authResult, error: authError } = await supabaseAdmin.auth.admin.createUser({
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
        console.error(JSON.stringify({ request_id, phase, message: authError.message, stack: "", raw: authError }));
        logError('Auth user creation failed', {
          ...baseLogOptions,
          error: authError,
          context: { email: customerInfo.email }
        });
        throw authError;
      }

      authData = authResult;
      currentUserId = authData.user.id;

      logInfo('Auth user created', {
        ...baseLogOptions,
        context: { userId: authData.user.id, email: customerInfo.email }
      });
    } catch (err: any) {
      console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
      return new Response(
        JSON.stringify({ success: false, request_id, phase, message: err.message ?? "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Database trigger will automatically create:
    // - accounts table entry
    // - profiles table entry
    // - account_members table entry (owner role)
    // However, we need to verify this succeeds and create manually if it fails

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
    phase = "profile_insert";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    let profile: any;
    try {
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('account_id, id, name')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        console.error(JSON.stringify({ request_id, phase, message: profileError.message, stack: "", raw: profileError }));
        logError('Failed to fetch profile after user creation', {
          ...baseLogOptions,
          error: profileError,
          context: { userId: authData.user.id }
        });
        throw new Error(`Profile fetch failed: ${profileError.message}`);
      }

      if (!profileData) {
        logError('Profile not found after user creation', {
          ...baseLogOptions,
          context: { userId: authData.user.id }
        });
        throw new Error('Profile record not found - database trigger failed completely');
      }

      profile = profileData;
    } catch (err: any) {
      console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
      return new Response(
        JSON.stringify({ success: false, request_id, phase, message: err.message ?? "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if trigger created the account
    if (!profile.account_id) {
      phase = "account_insert";
      console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

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

      try {
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
            stripe_subscription_id: stripeSubscriptionId,
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
          console.error(JSON.stringify({ request_id, phase, message: accountCreateError?.message ?? "Unknown", stack: "", raw: accountCreateError }));
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

        logInfo('Account created manually', {
          ...baseLogOptions,
          accountId: currentAccountId
        });

        // Update profile with the new account_id
        phase = "role_assign";
        console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

        try {
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
        } catch (err: any) {
          console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
          logWarn("Role assignment error (non-critical)", { ...baseLogOptions, error: err });
        }
      } catch (err: any) {
        console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
        return new Response(
          JSON.stringify({ success: false, request_id, phase, message: err.message ?? "Unknown error" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Trigger successfully created the account
      currentAccountId = profile.account_id;

      logInfo('Account created by trigger', {
        ...baseLogOptions,
        accountId: currentAccountId
      });
    }

    // If trigger created the account, we need to update it with sales-specific fields
    if (profile.account_id) {
      phase = "account_insert";
      console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

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

      try {
        const { error: updateError } = await supabaseAdmin
          .from('accounts')
          .update({
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
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
          console.error(JSON.stringify({ request_id, phase, message: updateError.message, stack: "", raw: updateError }));
          logError('Failed to update account with sales data', {
            ...baseLogOptions,
            accountId: currentAccountId,
            error: updateError,
            context: {
              stripeCustomerId,
              subscriptionId: stripeSubscriptionId,
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
      } catch (err: any) {
        console.error(JSON.stringify({ request_id, phase, message: err.message, stack: err.stack, raw: err }));
        return new Response(
          JSON.stringify({ success: false, request_id, phase, message: err.message ?? "Unknown error" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 5.5: Handle referral code if provided
    phase = "lead_link";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

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
      } catch (referralError: any) {
        // Log but don't fail the signup
        console.error(JSON.stringify({ request_id, phase: "lead_link", message: referralError.message, stack: referralError.stack, raw: referralError }));
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
    phase = "vapi_provision_start";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

    // Check for VAPI kill switch
    const disableVapiProvisioning = Deno.env.get("DISABLE_VAPI_PROVISIONING") === "true";

    let provisioningMessage = 'Phone number provisioning is in progress. You will be notified when your RingSnap number is ready.';

    if (disableVapiProvisioning) {
      console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=vapi_skipped (DISABLE_VAPI_PROVISIONING=true)`);
      logInfo("VAPI provisioning disabled by env var", {
        ...baseLogOptions,
        accountId: currentAccountId,
      });
    } else {
      logInfo('Queueing async provisioning for sales account', {
        ...baseLogOptions,
        accountId: currentAccountId,
        context: {
          email: customerInfo.email,
          phone: customerInfo.phone,
          areaCode: customerInfo.zipCode ? getAreaCodeFromZip(customerInfo.zipCode.trim()) : '212'
        }
      });
    }

    // Account is already marked with provisioning_status='pending' during creation
    // No synchronous provisioning - return success immediately

    phase = "done";
    console.log(`[${FUNCTION_NAME}] request_id=${request_id} phase=${phase}`);

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
      subscriptionId: stripeSubscriptionId,
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

  } catch (error: any) {
    console.error(JSON.stringify({
      request_id,
      phase,
      message: error?.message ?? "Unknown error",
      stack: error?.stack ?? "",
      raw: error,
      account_id: currentAccountId,
      user_id: currentUserId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
    }));

    logError('Sales account creation error', {
      ...baseLogOptions,
      accountId: currentAccountId,
      error
    });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        request_id,
        phase,
        message: String(errorMessage),
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
