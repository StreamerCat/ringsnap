import { useState, useEffect, useRef } from "react";
import Vapi from "@vapi-ai/web";

export const VapiDemoWidget = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [vapiConfig, setVapiConfig] = useState<{ publicKey: string; assistantId: string } | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => {
    // Fetch Vapi configuration from server
    const loadVapiConfig = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vapi-demo-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Failed to load Vapi config:', errorData);
          setConfigError(errorData.error || 'Failed to load demo configuration');
          return;
        }

        const data = await response.json();

        if (!data.publicKey || !data.assistantId) {
          setConfigError('Demo not configured - missing credentials');
          return;
        }

        setVapiConfig(data);

        // Initialize Vapi instance with server-provided key
        vapiRef.current = new Vapi(data.publicKey);

        // Event listeners
        const handleCallStart = () => setIsCallActive(true);
        const handleCallEnd = () => setIsCallActive(false);
        vapiRef.current.on("call-start", handleCallStart);
        vapiRef.current.on("call-end", handleCallEnd);
      } catch (error) {
        console.error('Error loading Vapi config:', error);
        setConfigError('Failed to initialize demo');
      }
    };

    loadVapiConfig();

    return () => {
      vapiRef.current?.stop();
    };
  }, []);

  const startCall = () => {
    if (vapiConfig && vapiRef.current) {
      vapiRef.current.start(vapiConfig.assistantId);
    }
  };

  const endCall = () => {
    vapiRef.current?.stop();
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
      {configError ? (
        <div className="space-y-3">
          <div className="text-destructive text-base font-semibold">Demo Unavailable</div>
          <p className="text-sm text-muted-foreground">{configError}</p>
          <p className="text-xs text-muted-foreground">
            Please contact support to configure the demo environment.
          </p>
        </div>
      ) : !isCallActive ? (
        <div className="space-y-5 w-full">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold leading-tight text-foreground">
              Live AI Demo
            </h3>
            <p className="text-sm text-muted-foreground">
              Let customers experience the AI receptionist. They can ask about services, pricing, or book appointments.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={startCall}
              disabled={!vapiConfig}
              className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg text-base font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span>Start Demo Call</span>
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground italic">
              <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span>Microphone access required</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-14 h-14 bg-primary rounded-full mx-auto mb-3 flex items-center justify-center animate-pulse">
              <svg className="w-7 h-7 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-foreground">Call in Progress</p>
            <p className="text-sm text-muted-foreground mt-1">AI is listening...</p>
          </div>
          <button
            onClick={endCall}
            className="bg-destructive text-destructive-foreground px-6 py-3 rounded-lg text-base font-semibold hover:bg-destructive/90 transition-colors shadow-md"
          >
            End Call
          </button>
        </div>
      )}
    </div>
  );
};
