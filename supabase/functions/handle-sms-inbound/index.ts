import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "supabase";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";

const FUNCTION_NAME = "handle-sms-inbound";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  let currentAccountId: string | null = null;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Parse Twilio/VAPI webhook
    const body = await req.text();
    const params = new URLSearchParams(body);
    
    const from = params.get('From') || '';
    const to = params.get('To') || '';
    const messageBody = params.get('Body') || '';

    logInfo('Inbound SMS received', {
      ...baseLogOptions,
      context: { from, to, messageLength: messageBody.length }
    });

    // Find account by phone number
    const { data: phoneNumber } = await supabase
      .from('phone_numbers')
      .select('account_id, id')
      .eq('phone_number', to)
      .eq('status', 'active')
      .maybeSingle();

    if (!phoneNumber) {
      logWarn('Inbound SMS phone number not found', {
        ...baseLogOptions,
        context: { to }
      });
      return new Response('OK', { status: 200 });
    }

    currentAccountId = phoneNumber.account_id;

    // Check if SMS is enabled
    const { data: account } = await supabase
      .from('accounts')
      .select('sms_enabled, daily_sms_sent, daily_sms_quota')
      .eq('id', phoneNumber.account_id)
      .single();

    if (!account?.sms_enabled) {
      logInfo('SMS inbound received for disabled account', {
        ...baseLogOptions,
        accountId: currentAccountId
      });
      return new Response('OK', { status: 200 });
    }

    // Store inbound message
    await supabase.from('sms_messages').insert({
      account_id: phoneNumber.account_id,
      phone_number_id: phoneNumber.id,
      from_number: from,
      to_number: to,
      message_body: messageBody,
      direction: 'inbound',
      status: 'received',
    });

    // Generate AI response via VAPI (placeholder)
    const responseText = 'Thank you for your message. We will get back to you shortly.';
    
    if (VAPI_API_KEY) {
      // TODO: Integrate with VAPI for AI-generated responses
      logInfo('AI response generation placeholder', {
        ...baseLogOptions,
        accountId: currentAccountId
      });
    }

    // Check daily quota
    if (account.daily_sms_sent >= account.daily_sms_quota) {
      logWarn('Daily SMS quota exceeded for inbound response', {
        ...baseLogOptions,
        accountId: currentAccountId,
        context: {
          dailySmsSent: account.daily_sms_sent,
          dailySmsQuota: account.daily_sms_quota
        }
      });
      return new Response('OK', { status: 200 });
    }

    // Send response (placeholder - actual implementation depends on SMS provider)
    logInfo('Sending inbound SMS response', {
      ...baseLogOptions,
      accountId: currentAccountId,
      context: { to: from, messageLength: responseText.length }
    });
    
    // Store outbound message
    await supabase.from('sms_messages').insert({
      account_id: phoneNumber.account_id,
      phone_number_id: phoneNumber.id,
      from_number: to,
      to_number: from,
      message_body: responseText,
      direction: 'outbound',
      status: 'sent',
    });

    // Increment daily counter
    await supabase
      .from('accounts')
      .update({ daily_sms_sent: account.daily_sms_sent + 1 })
      .eq('id', phoneNumber.account_id);

    return new Response('OK', { status: 200 });

  } catch (error) {
    logError('SMS inbound error', {
      ...baseLogOptions,
      accountId: currentAccountId,
      error
    });
    return new Response('OK', { status: 200 }); // Always return 200 to Twilio
  }
});
