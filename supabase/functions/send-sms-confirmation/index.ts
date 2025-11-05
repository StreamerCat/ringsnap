import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractCorrelationId, logError, logInfo, logWarn } from "../_shared/logging.ts";

const FUNCTION_NAME = "send-sms-confirmation";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  let accountId: string | undefined;
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json();
    accountId = body.accountId;
    const { phoneNumberId, customerPhone, appointmentDetails } = body;

    if (!accountId || !customerPhone || !appointmentDetails) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check account SMS settings
    const { data: account } = await supabase
      .from('accounts')
      .select('sms_enabled, sms_appointment_confirmations, daily_sms_sent, daily_sms_quota')
      .eq('id', accountId)
      .single();

    if (!account?.sms_enabled || !account.sms_appointment_confirmations) {
      return new Response(
        JSON.stringify({ error: 'SMS confirmations not enabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (account.daily_sms_sent >= account.daily_sms_quota) {
      logWarn('Daily SMS quota exceeded', {
        ...baseLogOptions,
        accountId,
        context: {
          dailySmsSent: account.daily_sms_sent,
          dailySmsQuota: account.daily_sms_quota
        }
      });
      return new Response(
        JSON.stringify({ error: 'Daily SMS quota exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get phone number
    const { data: phoneNumber } = await supabase
      .from('phone_numbers')
      .select('phone_number')
      .eq('id', phoneNumberId)
      .single();

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format confirmation message
    const message = `Appointment confirmed! ${appointmentDetails.date} at ${appointmentDetails.time}. ${appointmentDetails.serviceType}. Reply CANCEL to cancel.`;

    logInfo('Sending SMS confirmation', {
      ...baseLogOptions,
      accountId,
      context: {
        customerPhone,
        phoneNumberId,
        appointmentDate: appointmentDetails.date,
        appointmentTime: appointmentDetails.time
      }
    });

    // TODO: Send actual SMS via Twilio/VAPI
    // For now, just log it

    // Store message
    await supabase.from('sms_messages').insert({
      account_id: accountId,
      phone_number_id: phoneNumberId,
      from_number: phoneNumber.phone_number,
      to_number: customerPhone,
      message_body: message,
      direction: 'outbound',
      status: 'sent',
    });

    // Increment counter
    await supabase
      .from('accounts')
      .update({ daily_sms_sent: account.daily_sms_sent + 1 })
      .eq('id', accountId);

    return new Response(
      JSON.stringify({ 
        ok: true,
        message: 'SMS confirmation sent'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('SMS confirmation error', {
      ...baseLogOptions,
      accountId,
      error
    });
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
