import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractCorrelationId, logError, logInfo } from "../_shared/logging.ts";

const FUNCTION_NAME = "test-vapi-integration";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const correlationId = extractCorrelationId(req);
  const baseLogOptions = { functionName: FUNCTION_NAME, correlationId };
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
  
  if (!VAPI_API_KEY) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'VAPI_API_KEY not configured',
        recommendation: 'Configure VAPI_API_KEY secret in Supabase'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  const { testLevel = 'minimal', skipCleanup = false } = await req.json().catch(() => ({}));
  
  const tests = {
    apiKey: { success: false, details: '', error: '', skipped: false },
    phoneNumber: { success: false, phoneId: '', phoneNumber: '', details: '', error: '', skipped: false },
    assistant: { success: false, assistantId: '', details: '', error: '', skipped: false },
    linking: { success: false, details: '', error: '', skipped: false },
    cleanup: { success: false, details: '', skipped: false }
  };

  let phoneId: string | null = null;
  let assistantId: string | null = null;

  // Test 1: API Key Validation (always runs - free)
  logInfo('Test 1: Validating API Key', { ...baseLogOptions });
  try {
    const accountResponse = await fetch('https://api.vapi.ai/assistant?limit=1', {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });

    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      tests.apiKey.success = true;
      tests.apiKey.details = `Valid API key (${Array.isArray(accountData) ? accountData.length : 0} assistants found)`;
      logInfo('API key validated', {
        ...baseLogOptions,
        context: { assistantsFound: Array.isArray(accountData) ? accountData.length : 0 }
      });
    } else {
      const errorText = await accountResponse.text();
      tests.apiKey.error = `Status ${accountResponse.status}: ${errorText}`;
      logError('API key invalid', {
        ...baseLogOptions,
        error: new Error(tests.apiKey.error)
      });
    }
  } catch (error) {
    tests.apiKey.error = error instanceof Error ? error.message : 'Unknown error';
    logError('API key test failed', {
      ...baseLogOptions,
      error: new Error(tests.apiKey.error)
    });
  }

  // Test 2: Phone Number Creation (only if testLevel allows)
  if (tests.apiKey.success && ['phone', 'full'].includes(testLevel)) {
    logInfo('Test 2: Creating test phone number', { ...baseLogOptions });
    try {
      const phoneResponse = await fetch('https://api.vapi.ai/phone-number', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'vapi',
          name: 'RingSnap Test Number',
          numberDesiredAreaCode: '720',
          fallbackDestination: {
            type: 'number',
            number: '+14155551234'
          }
        })
      });

      if (phoneResponse.ok) {
        const phoneData = await phoneResponse.json();
        phoneId = phoneData.id;
        tests.phoneNumber.success = true;
        tests.phoneNumber.phoneId = phoneData.id;
        tests.phoneNumber.phoneNumber = phoneData.number;
        tests.phoneNumber.details = `Created phone: ${phoneData.number}`;
        logInfo('Phone created during test', {
          ...baseLogOptions,
          context: { phoneId: phoneData.id, phoneNumber: phoneData.number }
        });
      } else {
        const errorText = await phoneResponse.text();
        tests.phoneNumber.error = `Status ${phoneResponse.status}: ${errorText}`;
        logError('Phone creation failed during test', {
          ...baseLogOptions,
          error: new Error(tests.phoneNumber.error)
        });
      }
    } catch (error) {
      tests.phoneNumber.error = error instanceof Error ? error.message : 'Unknown error';
      logError('Phone creation error during test', {
        ...baseLogOptions,
        error: new Error(tests.phoneNumber.error)
      });
    }
  } else if (tests.apiKey.success) {
    tests.phoneNumber.skipped = true;
    tests.phoneNumber.details = `Skipped (testLevel: ${testLevel})`;
    logInfo('Phone number test skipped', {
      ...baseLogOptions,
      context: { testLevel }
    });
  } else {
    tests.phoneNumber.skipped = true;
    tests.phoneNumber.error = 'Skipped due to API key failure';
  }

  // Test 3: Assistant Creation (only if testLevel allows)
  if (tests.apiKey.success && ['assistant', 'full'].includes(testLevel)) {
    logInfo('Test 3: Creating test assistant', { ...baseLogOptions });
    try {
      const assistantResponse = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'RingSnap Test Assistant',
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.7,
            messages: [{
              role: 'system',
              content: 'You are a test assistant for RingSnap.'
            }]
          },
          voice: {
            provider: '11labs',
            voiceId: 'sarah'
          },
          firstMessage: 'This is a test assistant.'
        })
      });

      if (assistantResponse.ok) {
        const assistantData = await assistantResponse.json();
        assistantId = assistantData.id;
        tests.assistant.success = true;
        tests.assistant.assistantId = assistantData.id;
        tests.assistant.details = `Created assistant: ${assistantData.name}`;
        logInfo('Assistant created during test', {
          ...baseLogOptions,
          context: { assistantId: assistantData.id }
        });
      } else {
        const errorText = await assistantResponse.text();
        tests.assistant.error = `Status ${assistantResponse.status}: ${errorText}`;
        logError('Assistant creation failed during test', {
          ...baseLogOptions,
          error: new Error(tests.assistant.error)
        });
      }
    } catch (error) {
      tests.assistant.error = error instanceof Error ? error.message : 'Unknown error';
      logError('Assistant creation error during test', {
        ...baseLogOptions,
        error: new Error(tests.assistant.error)
      });
    }
  } else if (tests.apiKey.success) {
    tests.assistant.skipped = true;
    tests.assistant.details = `Skipped (testLevel: ${testLevel})`;
    logInfo('Assistant test skipped', {
      ...baseLogOptions,
      context: { testLevel }
    });
  } else {
    tests.assistant.skipped = true;
    tests.assistant.error = 'Skipped due to API key failure';
  }

  // Test 4: Linking Assistant to Phone (only for full test)
  if (testLevel === 'full' && tests.phoneNumber.success && tests.assistant.success && phoneId && assistantId) {
    logInfo('Test 4: Linking assistant to phone', { ...baseLogOptions });
    try {
      const linkResponse = await fetch(`https://api.vapi.ai/phone-number/${phoneId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assistantId: assistantId
        })
      });

      if (linkResponse.ok) {
        tests.linking.success = true;
        tests.linking.details = `Successfully linked assistant ${assistantId} to phone ${phoneId}`;
        logInfo('Assistant linked to phone during test', {
          ...baseLogOptions,
          context: { assistantId, phoneId }
        });
      } else {
        const errorText = await linkResponse.text();
        tests.linking.error = `Status ${linkResponse.status}: ${errorText}`;
        logError('Assistant to phone linking failed during test', {
          ...baseLogOptions,
          error: new Error(tests.linking.error)
        });
      }
    } catch (error) {
      tests.linking.error = error instanceof Error ? error.message : 'Unknown error';
      logError('Assistant to phone linking error during test', {
        ...baseLogOptions,
        error: new Error(tests.linking.error)
      });
    }
  } else if (testLevel !== 'full') {
    tests.linking.skipped = true;
    tests.linking.details = `Skipped (testLevel: ${testLevel})`;
    logInfo('Linking test skipped', {
      ...baseLogOptions,
      context: { testLevel }
    });
  } else {
    tests.linking.skipped = true;
    tests.linking.error = 'Skipped due to phone or assistant creation failure';
  }

  // Test 5: Cleanup
  if (!skipCleanup) {
    logInfo('Test 5: Cleaning up test resources', { ...baseLogOptions });
    const cleanupResults = [];

    if (phoneId) {
      try {
        const deletePhoneResponse = await fetch(`https://api.vapi.ai/phone-number/${phoneId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
        });
        
        if (deletePhoneResponse.ok) {
          cleanupResults.push(`Deleted phone ${phoneId}`);
          logInfo('Test phone resource deleted', {
            ...baseLogOptions,
            context: { phoneId }
          });
        } else {
          cleanupResults.push(`Failed to delete phone: ${deletePhoneResponse.status}`);
        }
      } catch (error) {
        cleanupResults.push(`Phone deletion error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    if (assistantId) {
      try {
        const deleteAssistantResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
        });
        
        if (deleteAssistantResponse.ok) {
          cleanupResults.push(`Deleted assistant ${assistantId}`);
          logInfo('Test assistant resource deleted', {
            ...baseLogOptions,
            context: { assistantId }
          });
        } else {
          cleanupResults.push(`Failed to delete assistant: ${deleteAssistantResponse.status}`);
        }
      } catch (error) {
        cleanupResults.push(`Assistant deletion error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    tests.cleanup.success = cleanupResults.length > 0;
    tests.cleanup.details = cleanupResults.join('; ') || 'No resources to clean up';
  } else {
    tests.cleanup.details = 'Cleanup skipped as requested';
    tests.cleanup.success = true;
  }

  // Generate summary and recommendations
  const passedTests = Object.values(tests).filter(t => t.success).length;
  const totalTests = skipCleanup ? 4 : 5;
  const summary = passedTests === totalTests 
    ? `✓ All ${totalTests} tests passed!` 
    : `✗ ${totalTests - passedTests} of ${totalTests} tests failed`;

  // Determine credit usage
  let creditsUsed = 'none';
  if (testLevel === 'full') creditsUsed = 'high';
  else if (testLevel === 'phone' || testLevel === 'assistant') creditsUsed = 'low';

  const recommendations = [];
  const nextSteps = [];

  if (!tests.apiKey.success) {
    recommendations.push('CRITICAL: Verify VAPI_API_KEY is correct and has proper permissions');
    nextSteps.push('Fix API key before running any other tests (saves credits)');
  } else {
    // API key is valid
    if (testLevel === 'minimal') {
      nextSteps.push('✓ API key validated successfully (0 credits used)');
      nextSteps.push('Run with {"testLevel": "phone"} to test phone number creation');
      nextSteps.push('Run with {"testLevel": "assistant"} to test assistant creation');
      nextSteps.push('Run with {"testLevel": "full"} to test complete integration');
    }
    
    if (testLevel === 'phone' && tests.phoneNumber.success) {
      nextSteps.push('✓ Phone number creation successful');
      nextSteps.push('Run with {"testLevel": "full"} to test linking');
    } else if (testLevel === 'phone' && !tests.phoneNumber.success && !tests.phoneNumber.skipped) {
      recommendations.push('Phone number creation failed - check VAPI account limits and billing');
    }
    
    if (testLevel === 'assistant' && tests.assistant.success) {
      nextSteps.push('✓ Assistant creation successful');
      nextSteps.push('Run with {"testLevel": "full"} to test linking');
    } else if (testLevel === 'assistant' && !tests.assistant.success && !tests.assistant.skipped) {
      recommendations.push('Assistant creation failed - verify API permissions');
    }
    
    if (testLevel === 'full') {
      if (tests.phoneNumber.success && tests.assistant.success && tests.linking.success) {
        nextSteps.push('✓ Full integration test passed - VAPI is configured correctly');
      } else if (tests.phoneNumber.success && tests.assistant.success && !tests.linking.success) {
        recommendations.push('Linking failed - check VAPI phone-assistant configuration');
      }
    }
  }

  logInfo('Test summary generated', {
    ...baseLogOptions,
    context: {
      summary,
      testLevel,
      creditsUsed,
      recommendations,
      nextSteps
    }
  });

  return new Response(
    JSON.stringify({
      success: tests.apiKey.success && 
               (testLevel === 'minimal' || 
                (testLevel === 'phone' && tests.phoneNumber.success) ||
                (testLevel === 'assistant' && tests.assistant.success) ||
                (testLevel === 'full' && tests.phoneNumber.success && tests.assistant.success && tests.linking.success)),
      testLevel,
      creditsUsed,
      tests,
      summary,
      recommendations,
      nextSteps,
      metadata: {
        skipCleanup,
        timestamp: new Date().toISOString(),
        apiKeyConfigured: !!VAPI_API_KEY,
        createdResources: {
          phoneId,
          assistantId
        }
      }
    }, null, 2),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
});
