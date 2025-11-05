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

    // Update status to provisioning
    await supabase
      .from('accounts')
      .update({ provisioning_status: 'provisioning' })
      .eq('id', accountId);

    // TODO: Add Stripe customer creation when STRIPE_SECRET_KEY is configured
    // TODO: Add VAPI assistant creation when VAPI_API_KEY is configured
    
    // For now, mark as completed (will be updated in Batch 3)
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ 
        provisioning_status: 'completed',
        onboarding_completed: true
      })
      .eq('id', accountId);

    if (updateError) {
      console.error('Error updating account:', updateError);
      await supabase
        .from('accounts')
        .update({ 
          provisioning_status: 'failed',
          provisioning_error: updateError.message
        })
        .eq('id', accountId);

      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Provisioning completed for account: ${accountId}`);

    return new Response(
      JSON.stringify({ 
        ok: true,
        message: 'Resources provisioned successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Provisioning error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
