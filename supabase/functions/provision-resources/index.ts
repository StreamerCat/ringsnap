import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAreaCodeFromZip } from "../_shared/area-code-lookup.ts";
import { buildVapiPrompt } from "../_shared/template-builder.ts";
import { generateReferralCode } from "../_shared/validators.ts";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";

const FUNCTION_NAME = "provision-resources";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_PROD_KEY');

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let currentAccountId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const requestPayload = await req.json();
    const { accountId, email, name, phone, zipCode, areaCode: requestedAreaCode } = requestPayload;
    currentAccountId = accountId;

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'Account ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logInfo('Starting provisioning workflow', {
      ...baseLogOptions,
      accountId,
      context: {
        requestOrigin: req.headers.get('origin') || undefined
      }
    });

    await supabase
      .from('accounts')
      .update({ provisioning_status: 'provisioning' })
      .eq('id', accountId);

    // Fetch account details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*, phone_number_area_code')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      throw new Error(`Account not found: ${accountError?.message}`);
    }

    let areaCode = requestedAreaCode;
    if (!areaCode && zipCode) {
      areaCode = getAreaCodeFromZip(zipCode);
    }

    if (!areaCode) {
      throw new Error('Area code could not be determined from zip code or request');
    }

    logInfo('Using selected area code', {
      ...baseLogOptions,
      accountId,
      context: { areaCode: sanitizedAreaCode, requestedAreaCode: normalizedRequestAreaCode }
    });

    // Get plan limits
    const { data: planDef } = await supabase
      .from('plan_definitions')
      .select('*')
      .eq('plan_type', account.plan_type || 'starter')
      .single();

    const monthlyMinutesLimit = planDef?.monthly_minutes_limit || 150;

    // 1. Create VAPI Phone Number
    let vapiPhoneId = null;
    let phoneNumber = null;
    
    if (VAPI_API_KEY && areaCode) {
      logInfo('Requesting VAPI phone number', {
        ...baseLogOptions,
        accountId,
        context: { areaCode }
      });

      const phoneResponse = await fetch('https://api.vapi.ai/phone-number', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'vapi',
          name: `${account.company_name} - Primary`,
          fallbackDestination: {
            type: 'number',
            number: phone || '+14155551234',
          },
          ...(areaCode && { numberDesiredAreaCode: areaCode })
        }),
      });

      if (!phoneResponse.ok) {
        const errorText = await phoneResponse.text();
        await supabase
          .from('accounts')
          .update({
            provisioning_status: 'failed',
            provisioning_error: `VAPI phone creation failed: ${errorText}`,
          })
          .eq('id', accountId);
        throw new Error(`Failed to create phone number: ${errorText}`);
      }

      const phoneData = await phoneResponse.json();
      vapiPhoneId = phoneData.id;
      phoneNumber = phoneData.number;
      logInfo('VAPI phone number created', {
        ...baseLogOptions,
        accountId,
        context: {
          vapiPhoneId,
          phoneDigits: phoneNumber
        }
      });
    }

    // 2. Create VAPI Assistant
    let vapiAssistantId = null;
    
    if (VAPI_API_KEY) {
      const voiceId = account.assistant_gender === 'male' ? 'michael' : 'sarah';
      
      const { data: recordingLaw } = await supabase
        .from('state_recording_laws')
        .select('*')
        .eq('state_code', account.billing_state || 'CA')
        .single();

      const prompt = await buildVapiPrompt({
        company_name: account.company_name,
        trade: account.trade,
        service_area: account.service_area,
        business_hours: account.business_hours,
        custom_instructions: account.custom_instructions,
        service_specialties: account.service_specialties,
        company_website: account.company_website,
      }, recordingLaw);

      const assistantResponse = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${account.company_name} Assistant`,
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.7,
            systemPrompt: prompt,
          },
          voice: {
            provider: '11labs',
            voiceId: voiceId,
          },
          firstMessage: `Thank you for calling ${account.company_name}. How can I help you today?`,
        }),
      });

      if (!assistantResponse.ok) {
        const errorText = await assistantResponse.text();
        await supabase
          .from('accounts')
          .update({
            provisioning_status: 'failed',
            provisioning_error: `VAPI assistant creation failed: ${errorText}`,
          })
          .eq('id', accountId);
        throw new Error(`Failed to create assistant: ${errorText}`);
      }

      const assistantData = await assistantResponse.json();
      vapiAssistantId = assistantData.id;
      logInfo('Assistant created', {
        ...baseLogOptions,
        accountId,
        context: { vapiAssistantId }
      });

      // Link assistant to phone number
      if (vapiPhoneId) {
        await fetch(`https://api.vapi.ai/phone-number/${vapiPhoneId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assistantId: vapiAssistantId,
          }),
        });
      }
    }

    // 3. Create Stripe Customer (trial mode)
    let stripeCustomerId = null;
    
    if (STRIPE_SECRET_KEY) {
      const stripeResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: email,
          name: name,
          phone: phone,
          'metadata[account_id]': accountId,
          'metadata[company_name]': account.company_name,
        }),
      });

      if (stripeResponse.ok) {
        const stripeData = await stripeResponse.json();
        stripeCustomerId = stripeData.id;
        logInfo('Stripe customer created', {
          ...baseLogOptions,
          accountId,
          context: { stripeCustomerId }
        });
      }
    }

    // 4. Generate referral code
    const referralCode = generateReferralCode();
    await supabase.from('referral_codes').insert({
      account_id: accountId,
      code: referralCode,
    });

    // 5. Insert phone number record
    let phoneNumberId = null;
    if (phoneNumber && vapiPhoneId) {
      const { data: phoneRecord } = await supabase
        .from('phone_numbers')
        .insert({
          account_id: accountId,
          phone_number: phoneNumber,
          vapi_phone_id: vapiPhoneId,
          area_code: phoneNumber.slice(2, 5),
          is_primary: true,
          status: 'active',
          label: 'Primary',
        })
        .select()
        .single();
      
      phoneNumberId = phoneRecord?.id;
    }

    // 6. Insert assistant record
    if (vapiAssistantId) {
      await supabase.from('assistants').insert({
        account_id: accountId,
        phone_number_id: phoneNumberId,
        vapi_assistant_id: vapiAssistantId,
        name: `${account.company_name} Assistant`,
        voice_id: account.assistant_gender === 'male' ? 'michael' : 'sarah',
        voice_gender: account.assistant_gender,
        is_primary: true,
        status: 'active',
      });
    }

    // 7. Update account with provisioning results
    await supabase
      .from('accounts')
      .update({
        provisioning_status: 'completed',
        onboarding_completed: true,
        vapi_phone_number: phoneNumber,
        vapi_assistant_id: vapiAssistantId,
        stripe_customer_id: stripeCustomerId,
        monthly_minutes_limit: monthlyMinutesLimit,
        phone_number_status: phoneNumber ? 'active' : 'pending',
      })
      .eq('id', accountId);

    logInfo('Account updated successfully', {
      ...baseLogOptions,
      accountId
    });

    // 8. Send onboarding SMS if phone is provided (non-blocking)
    if (phone && phoneNumber && vapiPhoneId) {
      supabase.functions.invoke('send-onboarding-sms', {
        body: { 
          phone: phone,
          ringSnapNumber: phoneNumber, 
          name: name || 'there',
          accountId: accountId,
          vapiPhoneId: vapiPhoneId
        }
      }).catch(err =>
        logWarn('SMS notification failed (non-critical)', {
          ...baseLogOptions,
          accountId,
          context: { error: err instanceof Error ? err.message : String(err) }
        })
      );
      logInfo('SMS notification triggered', {
        ...baseLogOptions,
        accountId
      });
    }

    // 9. Send welcome email with setup instructions
    if (RESEND_API_KEY && email) {
      const userName = name || 'there';

      if (phoneNumber) {
        const formatPhone = (phone: string) => {
          const cleaned = phone.replace(/\D/g, "");
          if (cleaned.length === 11 && cleaned.startsWith("1")) {
            return cleaned.substring(1).replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
          }
          if (cleaned.length === 10) {
            return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
          }
          return phone;
        };

        const formattedPhone = formatPhone(phoneNumber);
        const cleanNumber = phoneNumber.replace(/\D/g, '').slice(-10);

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'RingSnap <welcome@getringsnap.com>',
            to: email,
            subject: 'Your RingSnap line is live - start catching every call',
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your RingSnap Line Is Ready</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="display: none; max-height: 0; overflow: hidden;">Forward your number in 60 seconds and you're all set.</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827; line-height: 1.3;">Your RingSnap Line Is Ready</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 0 40px 40px 40px; color: #374151; font-size: 16px; line-height: 1.6;">
              <p style="margin: 0 0 20px 0;">Hey ${userName},</p>
              
              <p style="margin: 0 0 20px 0;">Your RingSnap line is ready to roll: <strong style="color: #D95F3C; font-size: 18px;">${formattedPhone}</strong></p>
              
              <p style="margin: 0 0 20px 0;">Here's how to forward your existing business number so calls ring your new line:</p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #D95F3C; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 12px 0;"><strong>👉 Step 1:</strong> On your phone, dial <strong style="font-family: 'Courier New', monospace; font-size: 18px; color: #111827;">*72${cleanNumber}</strong></p>
                <p style="margin: 0 0 12px 0;"><strong>👉 Step 2:</strong> Wait for the confirmation tone, then hang up.</p>
                <p style="margin: 0;"><strong>👉 Step 3:</strong> Call your old number to test it - you're live!</p>
              </div>
              
              <p style="margin: 20px 0;">Takes less than a minute. Once it's done, RingSnap starts answering, booking, and qualifying leads, automatically.</p>
              
              <p style="margin: 20px 0; font-weight: 600; color: #111827;">Catch every call. Close more jobs. Sleep easy.</p>
              
              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px;">
                - The RingSnap Team
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Questions? Reply to this email or visit your dashboard.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `,
          }),
        });

        logInfo('Welcome email sent', {
          ...baseLogOptions,
          accountId,
          context: { email }
        });
      } else {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'RingSnap <welcome@getringsnap.com>',
            to: email,
            subject: 'Your RingSnap account setup is underway',
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your RingSnap Account</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827; line-height: 1.3;">We're getting your RingSnap line ready</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px 40px; color: #374151; font-size: 16px; line-height: 1.6;">
              <p style="margin: 0 0 20px 0;">Hey ${userName},</p>
              <p style="margin: 0 0 20px 0;">Thanks for joining RingSnap! We're finishing up the setup of your new forwarding line.</p>
              <p style="margin: 0 0 20px 0;">We'll send you another email with forwarding instructions as soon as your number is assigned. In the meantime, feel free to reply to this message if you have any questions.</p>
              <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px;">- The RingSnap Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
            `,
          }),
        });

        logInfo('Welcome email skipped phone-specific content', {
          ...baseLogOptions,
          accountId,
          context: { email }
        });
      }
    }

    logInfo('Provisioning completed', {
      ...baseLogOptions,
      accountId
    });

    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Resources provisioned successfully',
        phoneNumber,
        referralCode,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('Provisioning error', {
      ...baseLogOptions,
      accountId: currentAccountId,
      error
    });
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    if (currentAccountId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await supabase
        .from('accounts')
        .update({
          provisioning_status: 'failed',
          provisioning_error: errorMessage,
        })
        .eq('id', currentAccountId);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
