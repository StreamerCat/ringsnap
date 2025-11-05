import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAreaCodeFromZip } from "../_shared/area-code-lookup.ts";
import { buildVapiPrompt } from "../_shared/template-builder.ts";
import { generateReferralCode } from "../_shared/validators.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { accountId, email, name, phone } = await req.json();

    if (!accountId) {
      return new Response(
        JSON.stringify({ error: 'Account ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting provisioning for account: ${accountId}`);

    await supabase
      .from('accounts')
      .update({ provisioning_status: 'provisioning' })
      .eq('id', accountId);

    // Fetch account details
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      throw new Error(`Account not found: ${accountError?.message}`);
    }

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
    
    if (VAPI_API_KEY && account.zip_code) {
      const areaCode = getAreaCodeFromZip(account.zip_code);
      console.log(`Requesting phone number with area code: ${areaCode}`);

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
          ...(areaCode && { areaCode: areaCode })
        }),
      });

      if (!phoneResponse.ok) {
        const errorText = await phoneResponse.text();
        console.error('VAPI phone creation failed:', errorText);
        console.error('Request payload:', JSON.stringify({
          provider: 'vapi',
          areaCode: areaCode,
          companyName: account.company_name
        }));
        throw new Error(`Failed to create phone number: ${errorText}`);
      }

      const phoneData = await phoneResponse.json();
      vapiPhoneId = phoneData.id;
      phoneNumber = phoneData.number;
      console.log(`Phone created: ${phoneNumber} (${vapiPhoneId})`);
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
            provider: 'elevenlabs',
            voiceId: voiceId,
          },
          firstMessage: `Thank you for calling ${account.company_name}. How can I help you today?`,
        }),
      });

      if (!assistantResponse.ok) {
        const errorText = await assistantResponse.text();
        console.error('VAPI assistant creation failed:', errorText);
        throw new Error(`Failed to create assistant: ${errorText}`);
      }

      const assistantData = await assistantResponse.json();
      vapiAssistantId = assistantData.id;
      console.log(`Assistant created: ${vapiAssistantId}`);

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
        console.log(`Stripe customer created: ${stripeCustomerId}`);
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

    // 8. Send welcome email with carrier instructions
    if (RESEND_API_KEY && email) {
      const formatPhone = (phone: string) => {
        const cleaned = phone.replace(/\D/g, "");
        if (cleaned.length === 11 && cleaned.startsWith("1")) {
          return cleaned.substring(1).replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
        }
        return phone;
      };

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'RingSnap <welcome@ringsnap.com>',
          to: email,
          subject: `🎉 ${name}, Your RingSnap Number is Ready: ${formatPhone(phoneNumber)}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #D95F3C 0%, #B4483C 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .phone-hero { background: #f9f5f2; border: 3px solid #D95F3C; padding: 30px; text-align: center; border-radius: 8px; margin: 20px 0; }
                .phone-number { font-size: 42px; font-weight: bold; color: #D95F3C; margin: 15px 0; letter-spacing: 1px; }
                .carrier-section { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .carrier-title { font-size: 20px; font-weight: bold; color: #D95F3C; margin-bottom: 15px; }
                .code-block { background: #2d3748; color: #48bb78; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 14px; margin: 10px 0; }
                .step { margin: 15px 0; padding-left: 10px; border-left: 3px solid #D95F3C; }
                .cta-button { display: inline-block; background: #48bb78; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                @media only screen and (max-width: 600px) {
                  .phone-number { font-size: 32px; }
                  .container { padding: 10px; }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0; font-size: 28px;">🎉 Welcome to RingSnap!</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Your AI Phone Assistant is Ready</p>
                </div>

                <div class="phone-hero">
                  <p style="margin: 0; font-size: 14px; color: #666;">Your RingSnap Number</p>
                  <div class="phone-number">${formatPhone(phoneNumber)}</div>
                  <p style="margin: 0; font-size: 14px; color: #666;">Forward your business line to start receiving calls</p>
                </div>

                <p style="font-size: 16px; margin: 20px 0;">Hi ${name},</p>
                <p style="margin: 10px 0;">Your AI assistant is live and ready to answer calls for ${account.company_name}! Here's how to forward your business phone:</p>

                <div class="carrier-section">
                  <div class="carrier-title">📱 AT&T Instructions</div>
                  <div class="step">
                    <strong>1. Dial this code:</strong>
                    <div class="code-block">*72${phoneNumber}</div>
                    <p style="margin: 5px 0; font-size: 14px; color: #666;">Press Call and listen for the confirmation tone</p>
                  </div>
                  <div class="step">
                    <strong>2. Turn off forwarding:</strong>
                    <div class="code-block">*73</div>
                  </div>
                </div>

                <div class="carrier-section">
                  <div class="carrier-title">📱 Verizon Instructions</div>
                  <div class="step">
                    <strong>1. Dial this code:</strong>
                    <div class="code-block">*72${phoneNumber}</div>
                    <p style="margin: 5px 0; font-size: 14px; color: #666;">Wait for the confirmation tone before hanging up</p>
                  </div>
                  <div class="step">
                    <strong>2. Turn off forwarding:</strong>
                    <div class="code-block">*73</div>
                  </div>
                </div>

                <div class="carrier-section">
                  <div class="carrier-title">📱 T-Mobile Instructions</div>
                  <div class="step">
                    <strong>1. Dial this code:</strong>
                    <div class="code-block">**21*${phoneNumber}#</div>
                    <p style="margin: 5px 0; font-size: 14px; color: #666;">Example: **21*${phoneNumber}#</p>
                  </div>
                  <div class="step">
                    <strong>2. Turn off forwarding:</strong>
                    <div class="code-block">##21#</div>
                  </div>
                </div>

                <div class="carrier-section">
                  <div class="carrier-title">📱 U.S. Cellular Instructions</div>
                  <div class="step">
                    <strong>1. Dial this code:</strong>
                    <div class="code-block">*72${phoneNumber}</div>
                  </div>
                  <div class="step">
                    <strong>2. Turn off forwarding:</strong>
                    <div class="code-block">*73 or *720</div>
                  </div>
                </div>

                <div style="background: #f9f5f2; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0; color: #D95F3C;">🚀 Quick Reference</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background: white;">
                      <td style="padding: 10px; border: 1px solid #ddd;"><strong>AT&T / Verizon</strong></td>
                      <td style="padding: 10px; border: 1px solid #ddd;">*72 + number</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border: 1px solid #ddd;"><strong>T-Mobile</strong></td>
                      <td style="padding: 10px; border: 1px solid #ddd;">**21*number#</td>
                    </tr>
                    <tr style="background: white;">
                      <td style="padding: 10px; border: 1px solid #ddd;"><strong>Turn Off</strong></td>
                      <td style="padding: 10px; border: 1px solid #ddd;">*73 or ##21#</td>
                    </tr>
                  </table>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="tel:${phoneNumber}" class="cta-button" style="color: white;">📞 Test Call Your Assistant Now</a>
                  <br><br>
                  <a href="https://ringsnap.com/onboarding" style="color: #D95F3C; text-decoration: none; font-weight: bold;">View Full Setup Guide →</a>
                </div>

                <div style="background: #e6f7ff; border-left: 4px solid #1890ff; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <strong>💡 Pro Tip:</strong> Make a test call to ${formatPhone(phoneNumber)} right now to hear your assistant in action!
                </div>

                <div style="background: #fff7e6; border-left: 4px solid #faad14; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <strong>🎁 Share & Earn $50!</strong><br>
                  <p style="margin: 10px 0 5px 0;">Your referral code: <strong style="color: #D95F3C; font-size: 18px;">${referralCode}</strong></p>
                  <p style="margin: 5px 0;">Share with other contractors and earn $50 credit when they sign up!</p>
                </div>

                <div class="footer">
                  <p>Need help? Reply to this email or contact us at <a href="mailto:support@ringsnap.com" style="color: #D95F3C;">support@ringsnap.com</a></p>
                  <p style="margin: 10px 0 0 0; color: #999;">© 2025 RingSnap. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `,
        }),
      });
    }

    console.log(`Provisioning completed for account: ${accountId}`);

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
    console.error('Provisioning error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    const { accountId } = await req.json().catch(() => ({}));
    if (accountId) {
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
        .eq('id', accountId);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
