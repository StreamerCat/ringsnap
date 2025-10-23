import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, CheckCircle, Shield, Star } from "lucide-react";

export const ContractorHero = () => {
  const scrollToCalculator = () => {
    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen-safe flex items-center overflow-hidden">
      {/* Gradient Aura Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-purple-50/30 to-pink-50/20" />
        <div className="absolute top-20 -right-40 w-96 h-96 gradient-core opacity-10 blur-3xl rounded-full" />
        <div className="absolute bottom-20 -left-40 w-96 h-96 gradient-secondary opacity-10 blur-3xl rounded-full" />
      </div>
      
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Left Column */}
          <div className="space-y-8">
            <h2 className="text-display leading-tight font-bold">
              AI that answers{" "}
              <span className="text-gradient-core">like a human</span>
            </h2>
            
            <p className="text-xl sm:text-2xl text-foreground/70 leading-relaxed font-secondary">
              Never miss a call. Book jobs 24/7. Sound warm, not robotic. Your customers won't know it's AI.
            </p>
            
            {/* Gradient CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                variant="gradient"
                className="text-lg h-14 px-8 font-semibold rounded-full"
              >
                <PhoneCall className="mr-2" />
                Try Ringsnap free
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg h-14 px-8 font-semibold rounded-full border-2 border-foreground/10 hover:border-foreground/30 transition-all"
                onClick={scrollToCalculator}
              >
                Hear how it sounds
              </Button>
            </div>
            
            {/* Soft Trust Badges */}
            <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-foreground/5">
              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <div className="w-5 h-5 rounded-full gradient-core flex items-center justify-center">
                  <CheckCircle className="w-3 h-3 text-white" />
                </div>
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <span>4.9 from 247 reviews</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <Shield className="w-5 h-5 text-foreground/40" />
                <span>HIPAA compliant</span>
              </div>
            </div>
          </div>
          
          {/* Right Column - Transcript */}
          <div className="relative">
            <div className="relative p-1 rounded-3xl bg-gradient-to-br from-purple-400/20 via-pink-400/20 to-purple-400/10">
              <div className="relative p-6 sm:p-8 rounded-3xl bg-white/90 backdrop-blur-xl">
                <Badge variant="gradient" className="absolute -top-3 -right-3 px-4 py-1.5 text-xs font-bold rounded-full shadow-xl">
                  &lt;1s pickup
                </Badge>
                
                <div className="text-xs text-foreground/40 uppercase tracking-wider mb-4">
                  Live call transcript
                </div>
                
                <div className="space-y-3 text-sm leading-relaxed">
                  <div>
                    <span className="font-semibold text-gradient-core">AI:</span>
                    <span className="text-foreground/80"> Thanks for calling Summit Plumbing. How can I help?</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Caller:</span>
                    <span className="text-foreground/80"> I have a burst pipe in the basement, water everywhere!</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gradient-core">AI:</span>
                    <span className="text-foreground/80"> That's an emergency. Turn your main shutoff valve clockwise. I'm routing our on-call tech now. What's your address?</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gradient-core">AI:</span>
                    <span className="text-foreground/80"> Got it. You're scheduled for arrival in 45 minutes. Text confirmation sent.</span>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-4 border-t border-foreground/5">
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-4 gradient-core rounded animate-pulse" />
                      <div className="w-1 h-6 gradient-core rounded animate-pulse" style={{animationDelay: '75ms'}} />
                      <div className="w-1 h-4 gradient-core rounded animate-pulse" style={{animationDelay: '150ms'}} />
                      <div className="w-1 h-5 gradient-core rounded animate-pulse" />
                    </div>
                    <span className="text-xs text-foreground/40">Call active • 0:47</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-white rounded-full shadow-2xl border border-purple-100">
              <div className="text-center">
                <span className="text-2xl font-bold text-gradient-core text-metric">95%</span>
                <span className="text-sm text-foreground/60 ml-2">vs. your 55%</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
};
