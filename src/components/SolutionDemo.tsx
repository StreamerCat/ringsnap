import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Calendar, PhoneForwarded, MessageCircle, Clock, Brain, Shield, DollarSign } from "lucide-react";
import Vapi from "@vapi-ai/web";
import { useEffect, useRef, useState } from "react";
import { FreeTrialSignupForm } from "./FreeTrialSignupForm";
const VapiWidget = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);
  useEffect(() => {
    // Initialize Vapi instance
    vapiRef.current = new Vapi("9159dfe3-b11f-457c-b41b-e296872027a0");

    // Event listeners
    const handleCallStart = () => setIsCallActive(true);
    const handleCallEnd = () => setIsCallActive(false);
    vapiRef.current.on("call-start", handleCallStart);
    vapiRef.current.on("call-end", handleCallEnd);
    return () => {
      vapiRef.current?.stop();
    };
  }, []);
  const startCall = () => {
    vapiRef.current?.start("db066c6c-e2e3-424e-9fd1-1473f2ac3b01");
  };
  const endCall = () => {
    vapiRef.current?.stop();
  };
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
      {!isCallActive ? (
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
              className="w-full bg-[#D97757] text-white px-8 py-5 rounded-2xl text-xl font-semibold hover:opacity-90 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] transform duration-200 flex items-center justify-center gap-3 group"
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
      ) : (
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
            Hear your new 24/7 receptionist in action.  Friendly, fast, and always on. It answers, qualifies, and books
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
              <p className="text-xs sm:text-sm text-muted-foreground">14-day free trial. Cancel anytime.</p>
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

        <FreeTrialSignupForm open={showSignupForm} onOpenChange={setShowSignupForm} source="solution-demo" />

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
