import { Button } from "@/components/ui/button";
import { PhoneCall, CheckCircle, Shield, Star, Users } from "lucide-react";

export const ContractorHero = () => {
  const scrollToCalculator = () => {
    document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[90vh] flex items-center bg-gray-50">
      <div className="container mx-auto px-4 py-10 sm:py-14 lg:py-24 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Column - Copy */}
          <div className="space-y-6 lg:space-y-8">
            <h1 className="text-fluid-h1 font-bold leading-tight">
              The only AI receptionist built for{" "}
              <span className="text-primary">home service pros</span>
            </h1>

            <p className="text-fluid-body text-muted-foreground leading-relaxed">
              Works 24/7. Books jobs. Sounds human. Flat rate. Never miss a call again, even at 2 AM.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="btn-pulse text-base sm:text-lg h-12 sm:h-14 px-6 sm:px-8 shadow-lg hover:shadow-emerald-500/20 transition-all duration-200">
                <PhoneCall className="mr-2" />
                Start free trial
              </Button>
              <Button size="lg" variant="outline" className="text-base sm:text-lg h-12 sm:h-14 px-6 sm:px-8 hover:bg-gray-50 transition-all duration-200" onClick={scrollToCalculator}>
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

          {/* Right Column - Transcript Card */}
          <div className="relative">
            <div className="relative p-4 sm:p-6 rounded-2xl border bg-white/80 backdrop-blur-lg elevation-3">
              <div className="absolute -top-3 -right-3 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-lg">
                &lt; 1s pickup
              </div>
              
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">Live Call Transcript</div>
              
              <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm leading-relaxed">
                <div>
                  <span className="font-semibold text-emerald-600">AI:</span>
                  <span className="text-slate-700"> Thanks for calling Summit Plumbing. How can I help?</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Caller:</span>
                  <span className="text-slate-700"> I have a burst pipe in the basement, water everywhere!</span>
                </div>
                <div>
                  <span className="font-semibold text-emerald-600">AI:</span>
                  <span className="text-slate-700"> That's an emergency. Turn your main shutoff valve clockwise. I'm routing our on-call tech now. What's your address?</span>
                </div>
                <div>
                  <span className="font-semibold text-emerald-600">AI:</span>
                  <span className="text-slate-700"> Got it. You're scheduled for arrival in 45 minutes. Text confirmation sent.</span>
                </div>
                
                <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-4 bg-emerald-500 rounded animate-pulse" />
                    <div className="w-1 h-6 bg-emerald-500 rounded animate-pulse" style={{animationDelay: '75ms'}} />
                    <div className="w-1 h-4 bg-emerald-500 rounded animate-pulse" style={{animationDelay: '150ms'}} />
                    <div className="w-1 h-5 bg-emerald-500 rounded animate-pulse" />
                  </div>
                  <span className="text-xs text-slate-500">Call active • 0:47</span>
                </div>
              </div>
            </div>
            
            {/* Floating Stat Pill */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-2 bg-white border-2 border-emerald-500 rounded-full shadow-lg">
              <div className="text-center">
                <span className="text-lg sm:text-2xl font-bold text-emerald-600 text-metric">95%</span>
                <span className="text-xs sm:text-sm text-slate-600 ml-1 sm:ml-2">answered vs. your 55%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
