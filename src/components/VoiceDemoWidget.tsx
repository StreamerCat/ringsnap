import Vapi from "@vapi-ai/web";
import { useEffect, useRef, useState } from "react";

// State machine for demo widget
type DemoState = 'initializing' | 'ready' | 'connecting' | 'active' | 'error';

// Utility to sanitize error messages and remove internal service names
const sanitizeErrorMessage = (message: string): string => {
  return message
    .replace(/vapi/gi, 'voice demo')
    .replace(/assistant/gi, 'demo');
};

export const VoiceDemoWidget = () => {
  const [demoState, setDemoState] = useState<DemoState>('initializing');
  const [vapiConfig, setVapiConfig] = useState<{ publicKey: string; assistantId: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => {
    const loadVapiConfig = async (retryCount = 0) => {
      try {
        setDemoState('initializing');
        const fetchUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vapi-demo-call`;
        console.log('[Voice Demo] Loading configuration...', { retryCount, url: fetchUrl });

        const response = await fetch(
          fetchUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('[Voice Demo] Response received:', {
          status: response.status,
          ok: response.ok
        });

        if (!response.ok) {
          // Parse error response
          const errorData = await response.json().catch(() => ({
            error: 'Unable to connect to voice demo service'
          }));

          console.error('[Voice Demo] Failed to load config:', {
            status: response.status,
            error: errorData.error,
            message: errorData.message,
            missingKeys: errorData.missingKeys
          });

          // Don't retry on configuration errors (MissingConfig)
          if (errorData.error === 'MissingConfig') {
            console.error('[Voice Demo] Configuration error - missing keys:', errorData.missingKeys);
            setErrorMessage('The live demo is not configured correctly right now. Please try again later or contact support.');
            setDemoState('error');
            return;
          }

          // Retry on 500+ errors (server issues) but not on config errors
          if (response.status >= 500 && retryCount < 2) {
            console.log('[Voice Demo] Server error, retrying...', { retryCount });
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return loadVapiConfig(retryCount + 1);
          }

          const sanitizedError = sanitizeErrorMessage(errorData.message || errorData.error || 'Demo temporarily unavailable.');
          setErrorMessage(sanitizedError);
          setDemoState('error');
          return;
        }

        const data = await response.json();
        console.log('[Voice Demo] Configuration loaded successfully', {
          hasPublicKey: !!data.publicKey,
          hasAssistantId: !!data.assistantId
        });

        // Validate response
        if (!data.publicKey || !data.assistantId) {
          console.error('[Voice Demo] Missing credentials in response');
          setErrorMessage('Demo configuration error.');
          setDemoState('error');
          return;
        }

        setVapiConfig(data);
        console.log('[Voice Demo] Config loaded:', {
          assistantId: data.assistantId,
          publicKey: data.publicKey
        });

        // Initialize voice demo client with fetched credentials
        vapiRef.current = new Vapi(data.publicKey);
        console.log('[Voice Demo] Client initialized');

        // Add error event handler
        vapiRef.current.on("error", (error) => {
          console.error('[Voice Demo] Error:', error);
          setDemoState('error');
          const errorMsg = sanitizeErrorMessage(error?.message || 'Connection failed');
          if (errorMsg.toLowerCase().includes('microphone') || errorMsg.toLowerCase().includes('permission')) {
            setErrorMessage('Microphone access required.');
          } else {
            setErrorMessage('Connection failed. Please try again.');
          }
        });

        const handleCallStart = () => {
          console.log('[Voice Demo] Call started');
          setDemoState('active');
        };
        const handleCallEnd = () => {
          console.log('[Voice Demo] Call ended');
          setDemoState('ready');
        };

        vapiRef.current.on("call-start", handleCallStart);
        vapiRef.current.on("call-end", handleCallEnd);

        console.log('[Voice Demo] Initialization complete');
        setDemoState('ready');
      } catch (error) {
        // Retry on network errors
        if (retryCount < 2) {
          console.log('[Voice Demo] Network error, retrying...', { retryCount, error });
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return loadVapiConfig(retryCount + 1);
        }
        console.error('[Voice Demo] Error loading config:', error);
        setErrorMessage('Unable to initialize demo. Please refresh the page.');
        setDemoState('error');
      }
    };

    loadVapiConfig();

    return () => {
      vapiRef.current?.stop();
    };
  }, []);

  // Timeout protection for connecting state
  useEffect(() => {
    if (demoState === 'connecting') {
      const timeout = setTimeout(() => {
        if (demoState === 'connecting') {
          console.error('[Voice Demo] Connection timeout');
          setDemoState('error');
          setErrorMessage('Connection timeout. Please try again.');
          vapiRef.current?.stop();
        }
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [demoState]);

  const startCall = async () => {
    if (!vapiConfig || !vapiRef.current) {
      setErrorMessage('Demo not ready. Please refresh the page.');
      setDemoState('error');
      return;
    }

    console.log('[Voice Demo] Starting call...');
    setDemoState('connecting');
    setErrorMessage(null);
    try {
      await vapiRef.current.start(vapiConfig.assistantId);
      console.log('[Voice Demo] Call start request sent');
    } catch (error) {
      console.error('[Voice Demo] Failed to start call:', error);
      setDemoState('error');
      const rawMsg = error instanceof Error ? error.message : '';
      const errorMsg = sanitizeErrorMessage(rawMsg);
      if (errorMsg.toLowerCase().includes('microphone') || errorMsg.toLowerCase().includes('permission')) {
        setErrorMessage('Microphone access required.');
      } else {
        setErrorMessage('Failed to start demo. Please check your microphone permissions.');
      }
    }
  };

  const endCall = () => {
    console.log('[Voice Demo] Ending call...');
    vapiRef.current?.stop();
    setDemoState('ready');
  };

  // Determine button state
  const isButtonDisabled = demoState === 'initializing' || demoState === 'connecting' || demoState === 'error';
  const buttonText = demoState === 'connecting' ? 'Connecting...' : 'Hear It in Action';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
      {/* Active call state - full screen replacement */}
      {demoState === 'active' ? (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#D97757] rounded-full mx-auto mb-4 flex items-center justify-center animate-pulse">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-[#2C3639]">Call in Progress</p>
            <p className="text-sm text-muted-foreground mt-2">AI receptionist is listening...</p>
          </div>
          <button
            onClick={endCall}
            className="bg-red-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-red-700 transition-colors shadow-lg"
          >
            End Conversation
          </button>
        </div>
      ) : (
        /* Demo card - ALWAYS renders for non-active states */
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Headline - Benefit-Driven */}
          <div className="text-center space-y-3">
            <h3 className="text-3xl sm:text-4xl font-bold leading-tight text-[#2C3639]">
              Stop Turning Away Calls.
              <br />
              Start Capturing Leads 24/7.
            </h3>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">
              Meet your 24/7 receptionist who never takes time off, never forgets a detail, and never lets a call go to
              voicemail. Watch how it handles a customer asking about your services, wanting to book, or reporting an
              emergency - naturally, professionally, and instantly.
            </p>
          </div>

          {/* Inline status indicators - ONLY show connecting and error states */}
          {demoState === 'connecting' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-center gap-2 text-sm text-blue-900 mb-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="font-medium">Connecting to demo...</span>
              </div>
              <p className="text-xs text-blue-800 text-center">Please allow microphone access if prompted</p>
            </div>
          )}

          {demoState === 'error' && errorMessage && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-amber-900">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1 text-left">
                  <p className="font-medium">{errorMessage}</p>
                  <p className="text-xs text-amber-800 mt-1">Please try refreshing the page or contact support if the issue persists.</p>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Button with Visual Cue */}
          <div className="space-y-4">
            <button
              onClick={startCall}
              disabled={isButtonDisabled}
              className="w-full bg-[#D97757] text-white px-8 py-5 rounded-2xl text-xl font-semibold hover:opacity-90 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] transform duration-200 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                {demoState === 'connecting' ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
              <span>{buttonText}</span>
            </button>

            {/* Microphone Instruction */}
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground/80 italic">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span>Enable your microphone to start talking to RingSnap</span>
            </div>

            {/* Friction Reducers */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5 font-medium">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                No signup
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                60 seconds
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Free demo
              </span>
            </div>

            {/* Social Proof - Compact */}
            <div className="bg-gradient-to-r from-[#D97757]/10 to-transparent rounded-xl p-3 sm:p-4 border border-[#D97757]/20">
              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm flex-wrap">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#D97757] flex items-center justify-center text-white text-[10px] sm:text-xs font-bold border-2 border-white">
                    JM
                  </div>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#2C3639] flex items-center justify-center text-white text-[10px] sm:text-xs font-bold border-2 border-white">
                    SK
                  </div>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#D97757] flex items-center justify-center text-white text-[10px] sm:text-xs font-bold border-2 border-white">
                    RB
                  </div>
                </div>
                <span className="text-[#2C3639] font-semibold">Join 5,000+ businesses</span>
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
