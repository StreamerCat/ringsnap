import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Calendar, PhoneForwarded, MessageCircle, Clock, Brain, Shield, DollarSign } from "lucide-react";

export const SolutionDemo = () => {
  return (
    <section className="section-spacer bg-background">
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

        {/* Interactive Demo */}
        <div className="max-w-3xl mx-auto mb-16">
          <iframe 
            src="https://aivoiceagent.com/demo" 
            title="Interactive Demo" 
            className="w-full h-96 rounded-xl border-2 border-primary shadow-xl"
            allow="microphone"
            loading="lazy"
          />
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
