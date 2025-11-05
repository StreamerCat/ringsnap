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
          provider: 'twilio',
          numberType: 'local',
          areaCode: areaCode,
        }),
      });

      if (!phoneResponse.ok) {
        const errorText = await phoneResponse.text();
        console.error('VAPI phone creation failed:', errorText);
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

    // 8. Send welcome email
    if (RESEND_API_KEY && email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'RingSnap <welcome@ringsnap.com>',
          to: email,
          subject: 'Welcome to RingSnap! Your AI Assistant is Ready',
          html: `
            <h1>Welcome to RingSnap, ${name}!</h1>
            <p>Your AI phone assistant is ready to start taking calls.</p>
            ${phoneNumber ? `<p><strong>Your phone number:</strong> ${phoneNumber}</p>` : ''}
            <p><strong>Referral code:</strong> ${referralCode}</p>
            <p>Share your code and earn $50 for each referral!</p>
            <p>Next steps:</p>
            <ol>
              <li>Forward your business line to your new RingSnap number</li>
              <li>Make a test call to hear your assistant in action</li>
              <li>Customize your assistant in the dashboard</li>
            </ol>
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
