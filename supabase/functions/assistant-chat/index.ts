
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { currentConfig, messages } = await req.json();

        const systemPrompt = `
    You are an AI Setup Assistant for RingSnap, helping a small business owner configure their AI receptionist.
    Your goal is to understand their business, their tone preferences, and their operational rules, and then UPDATE the configuration JSON object.

    Current Configuration:
    ${JSON.stringify(currentConfig, null, 2)}

    Process:
    1. Analyze the user's latest message and the conversation history.
    2. Suggest a conversational reply to the user.
    3. Update the configuration object based on what the user wants. 
       - If the user says "Change tone to friendly", update tone.style to "friendly".
       - If they say "We are a plumbing company", update business.services.
    4. RETURN JSON format ONLY:
       {
         "reply": "Your conversational reply here...",
         "proposedConfig": { ... the full updated config object ... }
       }
    
    If no config changes are needed based on the last message, return "proposedConfig": null.
    ALWAYS maintain the structure of the AssistantConfig interface.
    Default to "proposedConfig": null if you are just chatting or verifying.
    Only propose a config change when the user explicitly or implicitly requests a change or provides new info.
    `;

        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                response_format: { type: "json_object" }
            }),
        });

        const aiData = await openAIResponse.json();

        if (aiData.error) {
            throw new Error("OpenAI API Error: " + aiData.error.message);
        }

        const aiContent = aiData.choices[0].message.content;
        const result = JSON.parse(aiContent);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
