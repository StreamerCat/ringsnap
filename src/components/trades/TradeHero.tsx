import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, CheckCircle, Star } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { TradeConfig } from "./tradeConfig";

interface TradeHeroProps {
  config: TradeConfig;
}

export const TradeHero = ({ config }: TradeHeroProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const scrollToVapiDemo = () => {
    document.getElementById('vapi-chat-container')?.scrollIntoView({
      behavior: 'smooth'
    });
  };

  const handleSignup = () => {
    // preserve existing params
    const newParams = new URLSearchParams(searchParams);
    // add/overwrite trade specific param
    newParams.set('trade', config.slug);

    navigate(`/start?${newParams.toString()}`);
  };

  return (
    <>
      <SiteHeader />
      <section className="relative flex items-center overflow-hidden section-spacer-compact sm:py-14 lg:py-16 pt-14">
        {/* Gradient Aura Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-off-white to-cream/30" />
          <div className="absolute top-20 -right-40 w-96 h-96 gradient-core opacity-10 blur-3xl rounded-full" />
          <div className="absolute bottom-20 -left-40 w-96 h-96 gradient-secondary opacity-10 blur-3xl rounded-full" />
        </div>

        <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left Column */}
            <div>
              <div className="space-y-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-5xl">{config.icon}</span>
                  <Badge className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground">
                    For {config.name} Contractors
                  </Badge>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl leading-tight font-bold text-charcoal">
                  {config.hero.headline}
                </h1>

                <div className="space-y-4">
                  <p className="text-xl sm:text-2xl leading-tight font-bold text-charcoal/90">
                    {config.hero.subheadline}
                  </p>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    className="text-lg h-14 px-8 font-semibold rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all"
                    onClick={handleSignup}
                  >
                    <PhoneCall className="mr-2" />
                    Start Free Trial
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg h-14 px-8 font-semibold rounded-full transition-all hover:shadow-md"
                    onClick={scrollToVapiDemo}
                  >
                    Demo
                  </Button>
                </div>

                {/* Trust Badges */}
                <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-charcoal/5">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-cream/50 text-sm text-charcoal">
                    <Star className="w-4 h-4 fill-current text-primary" />
                    <span className="font-medium">5-star rated</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-cream/50 text-sm text-charcoal">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="font-medium">Free 3-day trial</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-cream/50 text-sm text-charcoal">
                    <PhoneCall className="w-4 h-4 text-primary" />
                    <span className="font-medium">{config.stats.contractorCount}+ contractors trust us</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Transcript */}
            <div className="relative">
              <div className="relative p-1 rounded-3xl bg-gradient-to-br from-primary/20 to-cream/20">
                <div className="relative p-6 sm:p-8 rounded-3xl bg-white/90 backdrop-blur-xl">
                  <Badge className="absolute -top-3 -right-3 px-4 py-1.5 text-xs font-bold rounded-full shadow-xl bg-primary text-primary-foreground">
                    {config.hero.pickupStat} pickup
                  </Badge>

                  <div className="text-xs text-foreground/40 uppercase tracking-wider mb-4">
                    Live call transcript
                  </div>

                  <div className="space-y-3 text-sm leading-relaxed">
                    <div>
                      <span className="font-semibold text-primary">AI:</span>
                      <span className="text-foreground/80"> {config.hero.transcriptScenario.ai1}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Caller:</span>
                      <span className="text-foreground/80"> {config.hero.transcriptScenario.caller}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-primary">AI:</span>
                      <span className="text-foreground/80"> {config.hero.transcriptScenario.ai2}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-primary">AI:</span>
                      <span className="text-foreground/80"> {config.hero.transcriptScenario.ai3}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-4 border-t border-foreground/5">
                      <div className="flex items-center gap-1">
                        <div className="w-1 h-4 rounded animate-pulse bg-primary" />
                        <div className="w-1 h-6 rounded animate-pulse bg-primary" style={{ animationDelay: '75ms' }} />
                        <div className="w-1 h-4 rounded animate-pulse bg-primary" style={{ animationDelay: '150ms' }} />
                        <div className="w-1 h-5 rounded animate-pulse bg-primary" />
                      </div>
                      <span className="text-xs text-foreground/40">Call active • 0:47</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-white rounded-full shadow-2xl border border-charcoal/20">
                <div className="text-center">
                  <span className="text-2xl font-bold text-metric text-primary">95%</span>
                  <span className="text-sm text-foreground/60 ml-2">vs. your 55%</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  );
};
