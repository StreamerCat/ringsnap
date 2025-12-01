import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PhoneCall, CheckCircle, Star } from "lucide-react";
import logo from "@/assets/RS_logo_color.svg";
import { UnifiedSignupRouter } from "@/components/signup/UnifiedSignupRouter";
import { TradeConfig } from "./tradeConfig";

interface TradeHeroProps {
  config: TradeConfig;
}

export const TradeHero = ({ config }: TradeHeroProps) => {
  const [showSignupForm, setShowSignupForm] = useState(false);

  const scrollToVapiDemo = () => {
    document.getElementById('vapi-chat-container')?.scrollIntoView({
      behavior: 'smooth'
    });
  };

  return (
    <section className="relative min-h-screen-safe flex items-center overflow-hidden section-spacer">
      {/* Gradient Aura Background - Trade-specific accent */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-off-white to-cream/30" />
        <div 
          className="absolute top-20 -right-40 w-96 h-96 opacity-10 blur-3xl rounded-full"
          style={{ background: `hsl(${config.accentColor})` }}
        />
        <div className="absolute bottom-20 -left-40 w-96 h-96 gradient-secondary opacity-10 blur-3xl rounded-full" />
      </div>
      
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Left Column */}
          <div>
            <img 
              src={logo} 
              alt={`RingSnap AI Receptionist for ${config.name} Contractors`}
              className="h-10 sm:h-12 lg:h-14 w-auto mb-6 sm:mb-8 mx-auto sm:mx-0" 
            />
            
            <div className="space-y-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-5xl">{config.icon}</span>
                <Badge 
                  className="px-4 py-2 text-sm font-bold"
                  style={{ background: `hsl(${config.accentColor})`, color: 'white' }}
                >
                  For {config.name} Contractors
                </Badge>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl leading-tight font-bold" style={{
                color: 'hsl(var(--charcoal))'
              }}>
                {config.hero.headline}
              </h1>
              
              <div className="space-y-4">
                <p className="text-2xl sm:text-3xl leading-tight font-bold" style={{
                  color: 'hsl(var(--charcoal) / 0.9)'
                }}>
                  {config.hero.subheadline}
                </p>
              </div>
              
              {/* Gradient CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="text-lg h-14 px-8 font-semibold rounded-full text-white hover:opacity-90 transition-all"
                  style={{ background: `hsl(${config.accentColor})` }}
                  onClick={() => setShowSignupForm(true)}
                >
                  <PhoneCall className="mr-2" />
                  Start Free Trial
                </Button>
                <Button 
                  size="lg" 
                  className="text-lg h-14 px-8 font-semibold rounded-full bg-white border-2 transition-all hover:shadow-md" 
                  style={{
                    borderColor: 'hsl(var(--charcoal) / 0.3)',
                    color: 'hsl(var(--charcoal))'
                  }} 
                  onClick={scrollToVapiDemo}
                >
                  Hear how it sounds
                </Button>
              </div>
            
              {/* Trust Badges */}
              <div className="flex flex-wrap items-center gap-4 pt-6 border-t" style={{
                borderColor: 'hsl(var(--charcoal) / 0.05)'
              }}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-cream/50 text-sm" style={{
                  color: 'hsl(var(--charcoal))'
                }}>
                  <Star className="w-4 h-4 fill-current" style={{ color: `hsl(${config.accentColor})` }} />
                  <span className="font-medium">5-star rated</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-cream/50 text-sm" style={{
                  color: 'hsl(var(--charcoal))'
                }}>
                  <CheckCircle className="w-4 h-4" style={{ color: `hsl(${config.accentColor})` }} />
                  <span className="font-medium">Free 3-day trial</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-cream/50 text-sm" style={{
                  color: 'hsl(var(--charcoal))'
                }}>
                  <PhoneCall className="w-4 h-4" style={{ color: `hsl(${config.accentColor})` }} />
                  <span className="font-medium">{config.stats.contractorCount}+ contractors trust us</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Transcript */}
          <div className="relative">
            <div 
              className="relative p-1 rounded-3xl"
              style={{ 
                background: `linear-gradient(to bottom right, hsl(${config.accentColor} / 0.2), hsl(var(--cream) / 0.2))` 
              }}
            >
              <div className="relative p-6 sm:p-8 rounded-3xl bg-white/90 backdrop-blur-xl">
                <Badge 
                  className="absolute -top-3 -right-3 px-4 py-1.5 text-xs font-bold rounded-full shadow-xl text-white"
                  style={{ background: `hsl(${config.accentColor})` }}
                >
                  {config.hero.pickupStat} pickup
                </Badge>
                
                <div className="text-xs text-foreground/40 uppercase tracking-wider mb-4">
                  Live call transcript
                </div>
                
                <div className="space-y-3 text-sm leading-relaxed">
                  <div>
                    <span className="font-semibold" style={{ color: `hsl(${config.accentColor})` }}>AI:</span>
                    <span className="text-foreground/80"> {config.hero.transcriptScenario.ai1}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Caller:</span>
                    <span className="text-foreground/80"> {config.hero.transcriptScenario.caller}</span>
                  </div>
                  <div>
                    <span className="font-semibold" style={{ color: `hsl(${config.accentColor})` }}>AI:</span>
                    <span className="text-foreground/80"> {config.hero.transcriptScenario.ai2}</span>
                  </div>
                  <div>
                    <span className="font-semibold" style={{ color: `hsl(${config.accentColor})` }}>AI:</span>
                    <span className="text-foreground/80"> {config.hero.transcriptScenario.ai3}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-4 border-t border-foreground/5">
                    <div className="flex items-center gap-1">
                      <div 
                        className="w-1 h-4 rounded animate-pulse"
                        style={{ background: `hsl(${config.accentColor})` }}
                      />
                      <div 
                        className="w-1 h-6 rounded animate-pulse"
                        style={{ 
                          background: `hsl(${config.accentColor})`,
                          animationDelay: '75ms'
                        }}
                      />
                      <div 
                        className="w-1 h-4 rounded animate-pulse"
                        style={{ 
                          background: `hsl(${config.accentColor})`,
                          animationDelay: '150ms'
                        }}
                      />
                      <div 
                        className="w-1 h-5 rounded animate-pulse"
                        style={{ background: `hsl(${config.accentColor})` }}
                      />
                    </div>
                    <span className="text-xs text-foreground/40">Call active • 0:47</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-white rounded-full shadow-2xl border border-charcoal/20">
              <div className="text-center">
                <span 
                  className="text-2xl font-bold text-metric"
                  style={{ color: `hsl(${config.accentColor})` }}
                >
                  95%
                </span>
                <span className="text-sm text-foreground/60 ml-2">vs. your 55%</span>
              </div>
            </div>
          </div>
          
        </div>

        <UnifiedSignupRouter 
          mode="trial" 
          open={showSignupForm} 
          onOpenChange={setShowSignupForm} 
          source={`${config.slug}-hero`}
        />
      </div>
    </section>
  );
};
