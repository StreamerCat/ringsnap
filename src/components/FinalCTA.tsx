import { Button } from "@/components/ui/button";
import { PhoneCall, Calculator, CheckCircle, Clock, CreditCard, Lock } from "lucide-react";

export const FinalCTA = () => {
  const scrollToCalculator = () => {
    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="section-spacer relative overflow-hidden">
      {/* Gradient Aura Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-cream/30 via-off-white to-white" />
        <div className="absolute top-20 right-20 w-96 h-96 gradient-core opacity-10 blur-3xl rounded-full" />
      </div>
      
      <div className="container mx-auto px-4">
        <hr className="section-divider mb-12" />
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="w-10 h-1 bg-primary mx-auto mb-4 rounded-full"></div>
          <h2 className="text-h2">
            Stop letting your competitors book{" "}
            <span style={{color: 'hsl(var(--primary))'}}>your emergency calls</span>
          </h2>

          <p className="text-xl leading-relaxed max-w-2xl mx-auto font-secondary" style={{color: 'hsl(var(--charcoal) / 0.7)'}}>
            While you're under a sink or on a ladder, they're answering in under 1 second. Book $800+ emergency jobs 24/7 with AI that sounds human.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" variant="gradient" className="text-lg h-14 px-8 rounded-full">
              <PhoneCall className="mr-2" />
              Try Live Demo Now
            </Button>
            <Button size="lg" variant="outline" className="text-lg h-14 px-8 rounded-full border-2 border-foreground/10 hover:border-foreground/30" onClick={scrollToCalculator}>
              <Calculator className="mr-2" />
              Calculate Your Lost Revenue
            </Button>
          </div>

          {/* Trust Signals */}
          <div className="flex flex-wrap justify-center items-center gap-8 pt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>10-minute setup</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              <span>14-day free trial</span>
            </div>
          </div>

          {/* Social Proof */}
          <div className="pt-8 border-t max-w-2xl mx-auto">
            <p className="text-sm text-muted-foreground mb-4">Join 847 contractors who never miss a call</p>
            <div className="flex justify-center items-center gap-2">
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i}
                    className="w-10 h-10 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-bold"
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <span className="text-sm font-medium">+842 more</span>
            </div>
          </div>

          {/* Urgency Without Fake Scarcity */}
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-card border border-charcoal/20">
            <h3 className="font-bold mb-2">Every hour you wait:</h3>
            <ul className="text-sm text-foreground/60 space-y-2 text-left">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Your competitors answer emergency calls worth $500-2,000</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>Customers find "someone who picks up" on Google</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>You lose $140-350 in potential revenue (based on averages)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
