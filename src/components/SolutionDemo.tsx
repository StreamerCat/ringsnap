import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Calendar, PhoneForwarded, MessageCircle, Clock, Brain, Shield, DollarSign } from "lucide-react";
import Vapi from "@vapi-ai/web";
import { useEffect, useRef, useState } from "react";
import { UnifiedSignupRouter } from "./signup/UnifiedSignupRouter";
const VapiWidget = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [vapiConfig, setVapiConfig] = useState<{ publicKey: string; assistantId: string } | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => {
    const loadVapiConfig = async (retryCount = 0) => {
      try {
        setIsLoading(true);
        console.log('[Voice Demo] Loading configuration...', { retryCount });

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vapi-demo-call`,
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
          // Retry on 500+ errors (server issues)
          if (response.status >= 500 && retryCount < 2) {
            console.log('[Voice Demo] Server error, retrying...', { retryCount });
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return loadVapiConfig(retryCount + 1);
          }

          const errorData = await response.json().catch(() => ({
            error: 'Unable to connect to voice demo service'
          }));
          console.error('[Voice Demo] Failed to load config:', errorData);
          setConfigError(errorData.error || 'Voice demo temporarily unavailable. Please try again in a moment.');
          setIsLoading(false);
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
          setConfigError('Voice demo configuration error. Please refresh or contact support.');
          setIsLoading(false);
          return;
        }

        setVapiConfig(data);
        // Initialize voice demo client with fetched credentials
        // TODO: Legacy client-side usage. Provisioning now happens server-side; migrate when backend tokens are available.
        vapiRef.current = new Vapi(data.publicKey);

        // Add error event handler
        vapiRef.current.on("error", (error) => {
          console.error('[Voice Demo] Connection error:', error);
          setIsConnecting(false);
          setIsCallActive(false);
          const errorMsg = error?.message || 'Connection failed';
          if (errorMsg.toLowerCase().includes('microphone') || errorMsg.toLowerCase().includes('permission')) {
            setConfigError('Microphone access required. Please allow microphone access to use the voice demo.');
          } else {
            setConfigError('Voice demo connection failed. Please try again.');
          }
        });

        const handleCallStart = () => {
          console.log('[Voice Demo] Call started');
          setIsCallActive(true);
          setIsConnecting(false);
        };
        const handleCallEnd = () => {
          console.log('[Voice Demo] Call ended');
          setIsCallActive(false);
          setIsConnecting(false);
        };

        vapiRef.current.on("call-start", handleCallStart);
        vapiRef.current.on("call-end", handleCallEnd);

        console.log('[Voice Demo] Initialization complete');
        setIsLoading(false);
      } catch (error) {
        // Retry on network errors
        if (retryCount < 2) {
          console.log('[Voice Demo] Network error, retrying...', { retryCount, error });
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return loadVapiConfig(retryCount + 1);
        }
        console.error('[Voice Demo] Error loading config:', error);
        setConfigError('Unable to initialize voice demo. Please check your connection and try again.');
        setIsLoading(false);
      }
    };

    loadVapiConfig();

    return () => {
      vapiRef.current?.stop();
    };
  }, []);

  // Timeout protection for connecting state
  useEffect(() => {
    if (isConnecting) {
      const timeout = setTimeout(() => {
        if (isConnecting) {
          console.error('[Voice Demo] Connection timeout');
          setIsConnecting(false);
          setConfigError('Connection took too long. Please check your internet connection and try again.');
          vapiRef.current?.stop();
        }
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [isConnecting]);

  const startCall = async () => {
    if (!vapiConfig || !vapiRef.current) {
      setConfigError('Voice demo not ready. Please refresh the page.');
      return;
    }

    console.log('[Voice Demo] Starting call...');
    setIsConnecting(true);
    setConfigError(null);
    try {
      await vapiRef.current.start(vapiConfig.assistantId);
      console.log('[Voice Demo] Call start request sent');
    } catch (error) {
      console.error('[Voice Demo] Failed to start call:', error);
      setIsConnecting(false);
      const errorMsg = error instanceof Error ? error.message : '';
      if (errorMsg.toLowerCase().includes('microphone') || errorMsg.toLowerCase().includes('permission')) {
        setConfigError('Microphone access required. Please allow microphone access and try again.');
      } else {
        setConfigError('Failed to start voice demo. Please check your microphone permissions and try again.');
      }
    }
  };

  const endCall = () => {
    console.log('[Voice Demo] Ending call...');
    vapiRef.current?.stop();
    setIsConnecting(false);
  };
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
      {/* Loading state - initial config fetch */}
      {isLoading && (
        <div className="space-y-4">
          <div className="w-16 h-16 border-4 border-[#D97757] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-lg text-muted-foreground">Loading demo...</p>
        </div>
      )}

      {/* Error state */}
      {configError && !isLoading && (
        <div className="space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="text-red-600 text-lg font-semibold">Demo Unavailable</div>
          <p className="text-muted-foreground">{configError}</p>
          <p className="text-sm text-muted-foreground">
            Please contact support or try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-[#D97757] text-white px-6 py-3 rounded-xl text-base font-semibold hover:opacity-90 transition-all"
          >
            Refresh Page
          </button>
        </div>
      )}

      {/* Connecting state - after button click, before call starts */}
      {isConnecting && !isCallActive && !configError && (
        <div className="space-y-6 max-w-md mx-auto">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-[#D97757] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-10 h-10 text-[#D97757]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xl font-semibold text-[#2C3639]">Connecting...</p>
            <p className="text-sm text-muted-foreground">Setting up your demo call with the AI receptionist</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
            <svg className="w-5 h-5 text-blue-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Please allow microphone access if prompted
          </div>
        </div>
      )}

      {/* Ready state - show button */}
      {!isCallActive && !isConnecting && !configError && !isLoading && (
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

          {/* Enhanced Button with Visual Cue */}
          <div className="space-y-4">
            <button
              onClick={startCall}
              disabled={!vapiConfig}
              className="w-full bg-[#D97757] text-white px-8 py-5 rounded-2xl text-xl font-semibold hover:opacity-90 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] transform duration-200 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <span>Hear It in Action</span>
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

      {/* Active call state */}
      {isCallActive && (
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
      )}
    </div>
  );
};
export const SolutionDemo = () => {
  const [showSignupForm, setShowSignupForm] = useState(false);
  const scrollToVapiDemo = () => {
    document.getElementById("vapi-chat-container")?.scrollIntoView({
      behavior: "smooth",
    });
  };
  return (
    <section id="demo" className="section-spacer bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-8 sm:mb-12" />
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full"></div>
          <h2 className="text-h2 mb-4 uppercase tracking-tight">
            Hear How Your Customers{" "}
            <span
              style={{
                color: "hsl(var(--primary))",
              }}
            >
              Will Be Greeted
            </span>
          </h2>
          <p className="text-body-default max-w-3xl mx-auto">
            Hear your new 24/7 receptionist in action. Friendly, fast, and always on. It answers, qualifies, and books
            customers before your competitors ever pick up.
          </p>
        </div>

        {/* Pre-Demo Tip */}
        <div className="max-w-3xl mx-auto mb-6">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-sm text-blue-900">
            <span className="font-bold">💡 Pro Tip:</span> Try saying "What's your pricing for an AC tune-up?" or "Can I
            schedule an emergency visit for tomorrow morning?"
          </div>
        </div>

        {/* Interactive Demo */}
        <div className="max-w-3xl mx-auto mb-16">
          <div
            id="vapi-chat-container"
            className="rounded-xl overflow-hidden border-2 shadow-xl min-h-[400px] sm:min-h-[500px] bg-[#FAF9F6] flex items-center justify-center relative"
            style={{
              borderColor: "rgba(44, 54, 57, 0.2)",
            }}
          >
            <VapiWidget />
          </div>
        </div>

        {/* Proof Points Grid */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto mb-8 sm:mb-12">
          <Card className="card-tier-2 text-center">
            <CardContent className="space-y-3 p-0">
              <Zap className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">Built for your industry</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Books jobs. Routes emergencies. Answers FAQs.</p>
            </CardContent>
          </Card>
          <Card className="card-tier-2 text-center">
            <CardContent className="space-y-3 p-0">
              <Clock className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">24/7 coverage at a flat price</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">No after hours fees. $297-$797/month.</p>
            </CardContent>
          </Card>
          <Card className="card-tier-2 text-center">
            <CardContent className="space-y-3 p-0">
              <Brain className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">Live in 10 minutes</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">No training. No contracts. Keep your number.</p>
            </CardContent>
          </Card>
          <Card className="card-tier-2 text-center">
            <CardContent className="space-y-3 p-0">
              <DollarSign className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">Affordable for any size</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Plans from $297 to $1,497 per month.</p>
            </CardContent>
          </Card>
          <Card className="card-tier-2 text-center">
            <CardContent className="space-y-3 p-0">
              <MessageCircle className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">Sounds human</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">89% of callers cannot tell it's AI.</p>
            </CardContent>
          </Card>
          <Card className="card-tier-2 text-center">
            <CardContent className="space-y-3 p-0">
              <Shield className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">Zero risk</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Free trial. Cancel anytime.</p>
            </CardContent>
          </Card>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-xl mx-auto mb-16">
          <Button
            size="lg"
            variant="gradient"
            className="text-lg h-14 px-8 rounded-full"
            onClick={() => setShowSignupForm(true)}
          >
            Start Free Trial
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-lg h-14 px-8 rounded-full border-2 border-foreground/10 hover:border-foreground/30 transition-all"
            onClick={scrollToVapiDemo}
          >
            Hear How It Works
          </Button>
        </div>

        <UnifiedSignupRouter mode="trial" open={showSignupForm} onOpenChange={setShowSignupForm} source="solution-demo" />

        {/* Outcome Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <Card className="card-tier-2">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg">Answers in &lt;1 Second</h3>
              <p className="text-sm text-muted-foreground">
                No hold times, no missed calls. Customers connect instantly while you're under a sink or on a ladder.
              </p>
              <div className="pt-2 border-t">
                <div className="text-2xl font-bold text-primary">23 sec</div>
                <div className="text-xs text-muted-foreground">Average booking time</div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-tier-2">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg">Smart Call Routing</h3>
              <p className="text-sm text-muted-foreground">
                Life-threatening emergencies transferred instantly. Routine calls and quotes booked automatically with
                instant confirmation.
              </p>
              <div className="pt-2 border-t">
                <div className="text-2xl font-bold text-primary">$1,200</div>
                <div className="text-xs text-muted-foreground">Avg emergency value</div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-tier-2">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg">Books Appointments Automatically</h3>
              <p className="text-sm text-muted-foreground">
                Syncs with your calendar. Checks availability in real-time. Sends confirmations via SMS and email
                instantly.
              </p>
              <div className="pt-2 border-t">
                <div className="text-2xl font-bold text-primary">24/7</div>
                <div className="text-xs text-muted-foreground">Never offline</div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-tier-2">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <PhoneForwarded className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg">Transfers Critical Calls</h3>
              <p className="text-sm text-muted-foreground">
                Gas leaks, electrical fires, or customer insists on speaking to you? AI transfers immediately with full
                context.
              </p>
              <div className="pt-2 border-t">
                <div className="text-2xl font-bold text-primary">5 sec</div>
                <div className="text-xs text-muted-foreground">Transfer time</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Benefits Bar */}
        <div className="max-w-4xl mx-auto mt-12 p-6 rounded-xl bg-muted/50 border">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <Clock className="w-6 h-6 text-primary" />
              <div className="font-semibold">10-Minute Setup</div>
              <div className="text-sm text-muted-foreground">Your phone number stays the same</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <div className="font-semibold">HIPAA Compliant</div>
              <div className="text-sm text-muted-foreground">Your customer data is secure</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <MessageCircle className="w-6 h-6 text-primary" />
              <div className="font-semibold">Natural Conversations</div>
              <div className="text-sm text-muted-foreground">Customers can't tell it's AI</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
