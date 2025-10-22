import { Button } from "@/components/ui/button";
import { PhoneCall, CheckCircle, Shield, Star, Users } from "lucide-react";

export const ContractorHero = () => {
  const scrollToCalculator = () => {
    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[90vh] flex items-center bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">847 contractors answered 2,347 emergency calls this week</span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
              The only AI receptionist built for{" "}
              <span className="text-primary">home service pros</span>
            </h1>

            <p className="text-xl text-muted-foreground leading-relaxed">
              Works 24/7. Books jobs. Sounds human. Flat rate. Never miss a call again, even at 2 AM.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="text-lg h-14 px-8">
                <PhoneCall className="mr-2" />
                Start free trial
              </Button>
              <Button size="lg" variant="outline" className="text-lg h-14 px-8" onClick={scrollToCalculator}>
                Hear it live
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">14-Day Free Trial</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">HIPAA Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-primary fill-primary" />
                <span className="text-sm font-medium">4.9★ (247 reviews)</span>
              </div>
            </div>
          </div>

          {/* Right Column - Visual */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              {/* Missed Call - Red Tint */}
              <div className="relative p-6 rounded-2xl border-2 border-destructive/30 bg-destructive/5 backdrop-blur">
                <div className="absolute -top-3 left-4 px-3 py-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full">
                  WITHOUT AI
                </div>
                <div className="space-y-4 pt-2">
                  <PhoneCall className="w-12 h-12 text-destructive animate-pulse" />
                  <h3 className="font-bold text-lg">Missed Call</h3>
                  <p className="text-sm text-muted-foreground">
                    Customer called at 8:47 PM about burst pipe emergency
                  </p>
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Lost Revenue:</span>
                      <span className="font-bold text-destructive">-$1,200</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Went to:</span>
                      <span className="font-semibold">Competitor</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Booked Call - Green Tint */}
              <div className="relative p-6 rounded-2xl border-2 border-primary/30 bg-primary/5 backdrop-blur">
                <div className="absolute -top-3 left-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                  WITH AI
                </div>
                <div className="space-y-4 pt-2">
                  <CheckCircle className="w-12 h-12 text-primary" />
                  <h3 className="font-bold text-lg">Booked in 23 Sec</h3>
                  <p className="text-sm text-muted-foreground">
                    AI answered, qualified emergency, scheduled 9 AM arrival
                  </p>
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-bold text-primary">+$1,200</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-semibold text-primary">Confirmed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Stat Card */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm p-4 bg-card border rounded-xl shadow-lg backdrop-blur">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">95%</div>
                <div className="text-sm text-muted-foreground">of emergency calls answered vs. your 55-60%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
