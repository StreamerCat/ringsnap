import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
    if (!VAPI_API_KEY) {
      throw new Error('VAPI_API_KEY not configured');
    }

    console.log('Fetching available area codes from VAPI...');

    // Query VAPI for available phone numbers without area code restriction
    const response = await fetch('https://api.vapi.ai/phone-number', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'vapi',
        name: 'Area Code Check',
        fallbackDestination: {
          type: 'number',
          number: '+14155551234',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VAPI error response:', errorText);
      
      // Try to extract area codes from error message
      const match = errorText.match(/available area codes: ([\d,\s]+)/i);
      if (match) {
        const areaCodes = match[1]
          .split(',')
          .map(code => code.trim())
          .filter(code => code.length === 3);
        
        console.log('Extracted area codes from error:', areaCodes);
        
        return new Response(
          JSON.stringify({ 
            areaCodes,
            source: 'error_extraction'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }
      
      throw new Error(`VAPI API error: ${errorText}`);
    }

    const data = await response.json();
    
    // If we got a phone number, delete it and extract the area code
    if (data.id) {
      console.log('Created test number, deleting:', data.id);
      
      // Delete the test number
      await fetch(`https://api.vapi.ai/phone-number/${data.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
        },
      });
      
      // Extract area code from the number
      const phoneNumber = data.number || '';
      const areaCode = phoneNumber.replace(/\D/g, '').substring(1, 4);
      
      return new Response(
        JSON.stringify({ 
          areaCodes: [areaCode],
          source: 'test_number'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Fallback: return common area codes
    console.log('Using fallback area codes');
    return new Response(
      JSON.stringify({ 
        areaCodes: ['212', '310', '415', '720', '303', '512', '617'],
        source: 'fallback'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in get-available-area-codes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        areaCodes: ['212', '310', '415', '720', '303', '512', '617'],
        source: 'error_fallback'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
