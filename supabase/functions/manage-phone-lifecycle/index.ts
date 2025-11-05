import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Running phone lifecycle management cron...');

    // Find phone numbers that should be released (held for 7 days)
    const now = new Date().toISOString();
    const { data: numbersToRelease, error } = await supabase
      .from('phone_numbers')
      .select('*')
      .eq('status', 'held')
      .lte('held_until', now);

    if (error) {
      console.error('Error fetching phone numbers:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Found ${numbersToRelease?.length || 0} numbers to release`);

    let releasedCount = 0;
    let savedCostCents = 0;

    for (const phoneNumber of numbersToRelease || []) {
      try {
        console.log(`Releasing phone number ${phoneNumber.phone_number}`);

        // Call VAPI API to release the phone number
        if (phoneNumber.vapi_phone_id) {
          const vapiResponse = await fetch(
            `https://api.vapi.ai/phone-number/${phoneNumber.vapi_phone_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('VAPI_API_KEY')}`,
              },
            }
          );

          if (!vapiResponse.ok) {
            console.error(`VAPI release failed for ${phoneNumber.phone_number}:`, await vapiResponse.text());
          } else {
            console.log(`VAPI phone number ${phoneNumber.vapi_phone_id} released successfully`);
          }
        }

        // Update database status
        await supabase
          .from('phone_numbers')
          .update({
            status: 'released',
            held_until: null
          })
          .eq('id', phoneNumber.id);

        releasedCount++;
        savedCostCents += 500; // Estimate $5/month per number

        console.log(`Phone number ${phoneNumber.phone_number} released successfully`);

      } catch (phoneError) {
        console.error(`Error releasing phone ${phoneNumber.phone_number}:`, phoneError);
      }
    }

    const savedCostDollars = (savedCostCents / 100).toFixed(2);
    console.log(`Released ${releasedCount} phone numbers, saving ~$${savedCostDollars}/month`);

    return new Response(
      JSON.stringify({ 
        success: true,
        released: releasedCount,
        saved_cost_monthly_cents: savedCostCents
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Phone lifecycle cron error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
