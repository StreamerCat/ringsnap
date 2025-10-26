import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Calendar, PhoneForwarded, MessageCircle, Clock, Brain, Shield, DollarSign } from "lucide-react";
import Vapi from "@vapi-ai/web";
import { useEffect, useRef, useState } from "react";

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
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-bold mb-2 text-[#2C3639]">Chat with RingSnap AI</h3>
            <p className="text-muted-foreground">
              Ask about pricing, book an appointment, or report an emergency.
            </p>
          </div>
          <button
            onClick={startCall}
            className="bg-[#D97757] text-white px-8 py-4 rounded-full text-lg font-semibold hover:opacity-90 transition-opacity shadow-lg"
          >
            Start Conversation
          </button>
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
  return (
    <section className="section-spacer bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-8 sm:mb-12" />
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full"></div>
          <h2 className="text-h2 mb-4 uppercase tracking-tight">
            Meet Your New Receptionist <span style={{color: 'hsl(var(--primary))'}}>Who Never Sleeps</span>
          </h2>
          <p className="text-body-default">
            Try it now. Ask about pricing. Book an appointment. Report an emergency. All calls handled.
          </p>
        </div>

        {/* Interactive Demo */}
        <div className="max-w-3xl mx-auto mb-16">
          <div 
            id="vapi-chat-container"
            className="rounded-xl overflow-hidden border-2 shadow-xl min-h-[400px] sm:min-h-[500px] bg-[#FAF9F6] flex items-center justify-center relative"
            style={{ borderColor: 'rgba(44, 54, 57, 0.2)' }}
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
          <Button size="lg" variant="gradient" className="text-lg h-14 px-8 rounded-full">
            Start Free Trial
          </Button>
          <Button size="lg" variant="outline" className="text-lg h-14 px-8 rounded-full border-2 border-foreground/10 hover:border-foreground/30 transition-all">
            See How It Works
          </Button>
        </div>

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
                Life-threatening emergencies transferred instantly. Routine calls and quotes booked automatically with instant confirmation.
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
                Syncs with your calendar. Checks availability in real-time. Sends confirmations via SMS and email instantly.
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
                Gas leaks, electrical fires, or customer insists on speaking to you? AI transfers immediately with full context.
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
