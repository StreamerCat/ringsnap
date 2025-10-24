import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Zap, Calendar, PhoneForwarded, MessageCircle, Clock, Brain, Shield, DollarSign, Phone, PhoneOff, Volume2, VolumeX } from "lucide-react";

export const SolutionDemo = () => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [volume, setVolume] = useState([80]);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const vapiRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Vapi on component mount
  useEffect(() => {
    // Dynamically load Vapi SDK
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@vapi-ai/web@latest/dist/index.js';
    script.async = true;
    script.onload = () => {
      // Initialize Vapi with your assistant ID
      // Replace 'YOUR_VAPI_ASSISTANT_ID' with actual ID
      if (window.Vapi) {
        vapiRef.current = new window.Vapi('YOUR_VAPI_PUBLIC_KEY');
      }
    };
    document.body.appendChild(script);

    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      document.body.removeChild(script);
    };
  }, []);

  // Handle call duration timer
  useEffect(() => {
    if (isCallActive) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setCallDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isCallActive]);

  const handleStartCall = async () => {
    if (vapiRef.current) {
      try {
        await vapiRef.current.start('YOUR_VAPI_ASSISTANT_ID');
        setIsCallActive(true);
      } catch (error) {
        console.error('Failed to start call:', error);
        alert('Please enable microphone permissions to use the demo');
      }
    } else {
      alert('Demo is loading, please try again in a moment');
    }
  };

  const handleEndCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      setIsCallActive(false);
    }
  };

  const toggleMute = () => {
    if (vapiRef.current) {
      if (isMuted) {
        vapiRef.current.setMuted(false);
      } else {
        vapiRef.current.setMuted(true);
      }
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value);
    // Adjust volume if Vapi supports it
    // vapiRef.current?.setVolume(value[0] / 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <section id="demo" className="py-10 sm:py-14 lg:py-20 bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-8 sm:mb-12" />
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <h2 className="text-fluid-h2 font-bold mb-3 sm:mb-4 uppercase tracking-tight leading-tight">
            Meet Your New Receptionist <span className="text-primary">(Who Never Sleeps)</span>
          </h2>
          <p className="text-fluid-body text-muted-foreground leading-relaxed">
            Try it now. Ask about pricing. Book an appointment. Report an emergency.
          </p>
        </div>

        {/* Interactive Voice Demo */}
        <div className="max-w-3xl mx-auto mb-16">
          <Card className="border-2 border-primary shadow-xl">
            <CardContent className="p-6 sm:p-8">
              {/* Call Status */}
              <div className="text-center mb-6">
                {isCallActive ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-lg font-semibold">Call Active</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-primary">{formatTime(callDuration)}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Phone className="w-12 h-12 mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground">Click below to start a live conversation with our AI receptionist</p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              {!isCallActive && (
                <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-semibold mb-2 text-sm">Try asking:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• "What are your hours?"</li>
                    <li>• "I need emergency plumbing service"</li>
                    <li>• "Can I schedule an appointment?"</li>
                    <li>• "What's your pricing?"</li>
                  </ul>
                </div>
              )}

              {/* Call Controls */}
              <div className="flex flex-col gap-4">
                {/* Start/End Call Button */}
                <Button
                  size="lg"
                  onClick={isCallActive ? handleEndCall : handleStartCall}
                  className={`w-full h-14 text-lg shadow-lg transition-all duration-200 ${
                    isCallActive
                      ? 'bg-destructive hover:bg-destructive/90'
                      : 'bg-primary hover:bg-primary/90'
                  }`}
                >
                  {isCallActive ? (
                    <>
                      <PhoneOff className="mr-2 w-5 h-5" />
                      End Call
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 w-5 h-5" />
                      Start Demo Call
                    </>
                  )}
                </Button>

                {/* Volume and Mute Controls */}
                {isCallActive && (
                  <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleMute}
                      className="flex-shrink-0"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <div className="flex-1 flex items-center gap-3">
                      <Volume2 className="w-4 h-4 text-muted-foreground" />
                      <Slider
                        value={volume}
                        onValueChange={handleVolumeChange}
                        min={0}
                        max={100}
                        step={10}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium text-muted-foreground w-10">{volume[0]}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Microphone Permission Note */}
              <p className="text-xs text-center text-muted-foreground mt-4">
                This demo requires microphone access. Your call is not recorded.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Proof Points Grid */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto mb-8 sm:mb-12">
          <Card className="text-center p-4 sm:p-6 elevation-2 hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="space-y-3 p-0">
              <Zap className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">Built for your industry</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Books jobs. Routes emergencies. Answers FAQs.</p>
            </CardContent>
          </Card>
          <Card className="text-center p-4 sm:p-6 elevation-2 hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="space-y-3 p-0">
              <Clock className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">24/7 coverage at a flat price</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">No after hours fees. $297-$797/month.</p>
            </CardContent>
          </Card>
          <Card className="text-center p-4 sm:p-6 elevation-2 hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="space-y-3 p-0">
              <Brain className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">Live in 10 minutes</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">No training. No contracts. Keep your number.</p>
            </CardContent>
          </Card>
          <Card className="text-center p-4 sm:p-6 elevation-2 hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="space-y-3 p-0">
              <DollarSign className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">Affordable for any size</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Plans from $297 to $1,497 per month.</p>
            </CardContent>
          </Card>
          <Card className="text-center p-4 sm:p-6 elevation-2 hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="space-y-3 p-0">
              <MessageCircle className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">Sounds human</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">89% of callers cannot tell it's AI.</p>
            </CardContent>
          </Card>
          <Card className="text-center p-4 sm:p-6 elevation-2 hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="space-y-3 p-0">
              <Shield className="w-8 sm:w-10 h-8 sm:h-10 text-primary mx-auto opacity-80 hover:opacity-100 transition-opacity" />
              <h3 className="font-bold text-base sm:text-lg">Zero risk</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">14-day free trial. Cancel anytime.</p>
            </CardContent>
          </Card>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-xl mx-auto mb-16">
          <Button size="lg" className="text-lg h-14 px-8 shadow-lg hover:shadow-emerald-500/20 transition-all duration-200">
            Start Free Trial
          </Button>
          <Button size="lg" variant="outline" className="text-lg h-14 px-8 hover:bg-gray-50 transition-all duration-200">
            See How It Works
          </Button>
        </div>

        {/* Outcome Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <Card className="border-2 hover:border-primary hover:-translate-y-0.5 transition-all duration-200 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
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

          <Card className="border-2 hover:border-primary hover:-translate-y-0.5 transition-all duration-200 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg">Knows Emergency vs. Quote</h3>
              <p className="text-sm text-muted-foreground">
                AI identifies $800+ urgent jobs from regular inquiries. Books same-day for emergencies, schedules quotes appropriately.
              </p>
              <div className="pt-2 border-t">
                <div className="text-2xl font-bold text-primary">$1,200</div>
                <div className="text-xs text-muted-foreground">Avg emergency value</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary hover:-translate-y-0.5 transition-all duration-200 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
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

          <Card className="border-2 hover:border-primary hover:-translate-y-0.5 transition-all duration-200 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
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
