import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, ringSnapNumber, name, accountId, vapiPhoneId } = await req.json();

    if (!phone || !ringSnapNumber || !name || !vapiPhoneId) {
      console.error('Missing required fields for SMS');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number for display: (720) 555-1234
    const formatPhone = (phone: string) => {
      const cleaned = phone.replace(/\D/g, '');
      const match = cleaned.match(/^1?(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
      }
      return phone;
    };

    // Clean number for dial code: 7205551234
    const cleanNumber = ringSnapNumber.replace(/\D/g, '').slice(-10);

    // Build SMS message
    const smsMessage = `Hey ${name}, your RingSnap line's ready: ${formatPhone(ringSnapNumber)} 📞

Forward now (*72${cleanNumber}) — takes 60 sec.

Start catching every call 🔥

Reply STOP to opt out`;

    console.log('Sending SMS to:', phone);
    console.log('Message length:', smsMessage.length, 'characters');

    // Send SMS via VAPI API
    const vapiApiKey = Deno.env.get('VAPI_API_KEY');
    const vapiResponse = await fetch(`https://api.vapi.ai/phone-number/${vapiPhoneId}/send-message`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: smsMessage,
        toNumber: phone,
      }),
    });

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text();
      console.error('VAPI SMS API error:', vapiResponse.status, errorText);
      throw new Error(`VAPI SMS failed: ${errorText}`);
    }

    const vapiData = await vapiResponse.json();
    console.log('SMS sent successfully via VAPI:', vapiData);

    // Log to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get phone_number record ID
    const { data: phoneRecord } = await supabase
      .from('phone_numbers')
      .select('id')
      .eq('phone_number', ringSnapNumber)
      .single();

    if (phoneRecord) {
      await supabase.from('sms_messages').insert({
        account_id: accountId,
        phone_number_id: phoneRecord.id,
        from_number: ringSnapNumber,
        to_number: phone,
        message_body: smsMessage,
        direction: 'outbound',
        status: 'sent',
        vapi_message_id: vapiData.id || null,
      });
      console.log('SMS logged to database');
    }

    return new Response(
      JSON.stringify({ success: true, messageId: vapiData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('SMS send error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return success to not block provisioning, but log the failure
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
