import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Zap, Phone, Crown, Calculator, CheckCircle, Clock, Lock, Star, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";


interface ContractorPricingProps {
  showHeading?: boolean;
  className?: string; // Allow customizing styles (e.g. padding)
}

export const ContractorPricing = ({ showHeading = true, className }: ContractorPricingProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();


  const handleSignup = () => {
    navigate({
      pathname: '/start',
      search: searchParams.toString()
    });
  };

  const comparisonData = [
    { option: "Full-time Receptionist", cost: "$3,000-4,000/month", issues: "Benefits, sick days, limited hours" },
    { option: "Answering Service", cost: "$500-1,200/month", issues: "Generic scripts, no booking, limited visibility" },
    { option: "RingSnap", cost: "$297/month", issues: "24/7 booking, urgent call transfer rules, full call logs" },
  ];

  const pricingTiers = [
    {
      name: "Starter",
      price: "$297",
      description: "Solo Contractors & Small Crews",
      minutes: "1,500 minutes included",
      receptionist: "1 Voice Agent",
      overage: "$0.16/minute",
      overageContext: "Most customers use 1,000-1,400 min/month",
      features: [
        "24/7 call answering",
        "Books appointments automatically",
        "Urgent call transfer with context",
        "Call recordings and transcripts",
        "Google Calendar + Zapier"
      ],
      cta: "Start Free Trial",
      badge: null,
      icon: Phone
    },
    {
      name: "Professional",
      price: "$547",
      description: "Growing Contractors with Multiple Crews",
      minutes: "3,500 minutes included",
      receptionist: "3 Voice Agents",
      overage: "$0.13/minute",
      overageContext: "Most customers stay within plan limits",
      features: [
        "Everything in Starter, PLUS:",
        "Branded voice options",
        "Urgent call transfer rules",
        "Smart call routing to crew",
        "Multi-language (EN + ES)",
        "Priority support"
      ],
      cta: "Start Free Trial",
      badge: "MOST POPULAR",
      icon: Zap
    },
    {
      name: "Premium",
      price: "$947",
      description: "Multi-Location Contractors & Franchises",
      minutes: "7,000 minutes included",
      receptionist: "5 Voice Agents",
      overage: "$0.11/minute",
      overageContext: "Rarely needed at this tier",
      features: [
        "Everything in Professional, PLUS:",
        "Custom brand voice",
        "Dedicated success manager",
        "API + custom webhooks",
        "Multi-location dashboard",
        "Priority phone support"
      ],
      cta: "Start Free Trial",
      badge: null,
      icon: Crown
    }
  ];

  return (
    <section id="pricing" className={cn("section-spacer bg-background", className)}>
      <div className="container mx-auto px-4 max-w-7xl">
        {showHeading && (
          <>
            <hr className="section-divider mb-8 sm:mb-12" />
            <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
              <h2 className="text-h2 mb-4">
                Pricing as simple as <span style={{ color: 'hsl(var(--primary))' }}>a handshake</span>
              </h2>
              <p className="text-fluid-body text-muted-foreground leading-relaxed">
                Transparent pricing. No setup fees. Cancel anytime.
              </p>
            </div>
          </>
        )}

        <div className="max-w-4xl mx-auto mb-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Backed by proof</div>
            <div className="mt-2 text-2xl font-bold text-charcoal">4.9/5 satisfaction</div>
            <p className="text-xs text-muted-foreground mt-1">247 contractors rated onboarding + support experience.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">Always on</div>
            <div className="mt-2 text-2xl font-bold text-primary">24/7 coverage</div>
            <p className="text-xs text-muted-foreground mt-1">After hours, overflow, and urgent calls handled with rules you control.</p>
          </div>
        </div>

        {/* Value Comparison */}
        <div className="max-w-3xl mx-auto mb-12">
          <Card className="border-2">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-4 text-center">Compare the Common Options</h3>
              <div className="space-y-3">
                {comparisonData.map((item, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-4 rounded-lg border ${index === 2 ? 'border-primary bg-primary/5' : 'bg-muted/30'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      {index === 2 ? (
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      ) : (
                        <span className="text-destructive text-xl flex-shrink-0">✕</span>
                      )}
                      <div>
                        <div className="font-semibold">{item.option}</div>
                        <div className="text-sm text-muted-foreground">{item.issues}</div>
                      </div>
                    </div>
                    <div className={`font-bold ${index === 2 ? 'text-primary' : ''}`}>
                      {item.cost}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8 max-w-7xl mx-auto items-stretch">
          {pricingTiers.map((tier, index) => (
            <Card
              key={index}
              className={`relative flex flex-col h-full ${tier.badge
                ? 'card-pricing-popular'
                : 'card-tier-2 hover:shadow-lg hover:-translate-y-1 transition-all duration-300'
                }`}
            >
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="px-4 py-1.5 text-xs font-bold rounded-full bg-primary text-white animate-pulse-subtle">
                    {tier.badge}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${tier.badge ? 'bg-primary' : 'bg-cream'
                  }`}>
                  <tier.icon className="w-8 h-8" style={{ color: tier.badge ? 'white' : 'hsl(var(--primary))' }} />
                </div>
                <CardTitle className="text-xl sm:text-2xl">{tier.name}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{tier.description}</CardDescription>
                <div className="pt-3 sm:pt-4">
                  <div className="text-4xl sm:text-5xl font-bold" style={{ color: 'hsl(var(--charcoal))' }}>{tier.price}</div>
                  <div className="text-sm" style={{ color: 'hsl(var(--charcoal) / 0.6)' }}>per month</div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Plan Details */}
                <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
                  <div className="font-semibold">{tier.minutes}</div>
                  <div className="text-muted-foreground">{tier.receptionist}</div>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'hsl(var(--primary))' }} />
                      <span className={`text-sm ${feature.includes('PLUS') ? 'font-semibold text-primary' : ''
                        }`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  className={`w-full h-12 text-lg rounded-full transition-all ${tier.badge
                    ? 'bg-primary text-white hover:opacity-90 shadow-md'
                    : 'bg-white border-2 hover:shadow-md'
                    }`}
                  style={tier.badge ? {} : { borderColor: 'hsl(var(--charcoal) / 0.3)', color: 'hsl(var(--charcoal))' }}
                  size="lg"
                  onClick={handleSignup}
                >
                  {tier.cta}
                </Button>

                {/* Trial Info - Secondary visibility */}
                <p className="text-sm text-center text-charcoal/70 mt-3 mb-3">
                  3-day trial · 150 minutes included · Cancel anytime
                </p>

                {/* Overage Info - De-emphasized */}
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground font-normal">
                    Additional minutes: {tier.overage} each
                  </p>
                  <p className="text-xs text-muted-foreground/70 italic">
                    ({tier.overageContext})
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* All Plans Include */}
        <div className="max-w-4xl mx-auto mt-12 p-6 rounded-xl bg-muted/50 border text-center">
          <h3 className="font-bold mb-4">All Plans Include</h3>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>No setup fees</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>Your number stays the same</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>Full call logs and transcripts</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Security: Encrypted in transit. Account-level access controls.
          </p>
        </div>

        {/* Usage Guide Section */}
        <div className="max-w-4xl mx-auto mt-12 p-8 rounded-xl border-2 bg-background" style={{ borderColor: 'rgba(44, 54, 57, 0.2)' }}>
          <h3 className="text-2xl font-bold text-center mb-8" style={{ color: 'hsl(var(--charcoal))' }}>
            How Many Minutes Do I Need?
          </h3>

          <div className="text-center mb-8 text-muted-foreground">
            <p className="text-lg">Average call length: <span className="font-semibold text-charcoal">3-4 minutes</span></p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Starter Guide */}
            <div className="p-6 rounded-lg border-2 bg-muted/30" style={{ borderColor: 'rgba(44, 54, 57, 0.1)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Phone className="w-5 h-5 text-primary" />
                <h4 className="font-bold text-lg">STARTER</h4>
              </div>
              <div className="space-y-3 text-sm">
                <div className="font-semibold text-charcoal">1,500 min/month</div>
                <div className="text-muted-foreground">~50 minutes per day</div>
                <div className="text-muted-foreground">~12-15 calls per day</div>
                <div className="mt-4 pt-4 border-t">
                  <div className="font-semibold text-primary mb-1">Perfect for:</div>
                  <div className="text-muted-foreground">Solo operators, part-time businesses</div>
                </div>
              </div>
            </div>

            {/* Professional Guide */}
            <div className="p-6 rounded-lg border-2 bg-primary/5" style={{ borderColor: 'hsl(var(--primary))' }}>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-primary" />
                <h4 className="font-bold text-lg">PROFESSIONAL</h4>
              </div>
              <div className="space-y-3 text-sm">
                <div className="font-semibold text-charcoal">3,500 min/month</div>
                <div className="text-muted-foreground">~115 minutes per day</div>
                <div className="text-muted-foreground">~30-35 calls per day</div>
                <div className="mt-4 pt-4 border-t border-primary/20">
                  <div className="font-semibold text-primary mb-1">Perfect for:</div>
                  <div className="text-muted-foreground">1-3 truck operations</div>
                </div>
              </div>
            </div>

            {/* Premium Guide */}
            <div className="p-6 rounded-lg border-2 bg-muted/30" style={{ borderColor: 'rgba(44, 54, 57, 0.1)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-primary" />
                <h4 className="font-bold text-lg">PREMIUM</h4>
              </div>
              <div className="space-y-3 text-sm">
                <div className="font-semibold text-charcoal">7,000 min/month</div>
                <div className="text-muted-foreground">~230 minutes per day</div>
                <div className="text-muted-foreground">~60-70 calls per day</div>
                <div className="mt-4 pt-4 border-t">
                  <div className="font-semibold text-primary mb-1">Perfect for:</div>
                  <div className="text-muted-foreground">Multi-location, high-volume operations</div>
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade Tip */}
          <div className="mt-8 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💡</div>
              <div className="text-sm">
                <span className="font-semibold text-charcoal">Not sure which plan?</span>
                <span className="text-muted-foreground ml-1">
                  Start with Starter. You can upgrade anytime with zero service interruption.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Final Strong CTA - Condensed */}
        <div className="max-w-4xl mx-auto mt-12 text-center space-y-6 p-6 rounded-2xl bg-gradient-to-br from-cream/30 to-white border-2 border-primary/20">
          <div>
            <h2 className="text-h2 mb-4">
              Your Next Customer Is Calling. <span style={{ color: 'hsl(var(--primary))' }}>Will You Answer?</span>
            </h2>
            <p className="text-base leading-relaxed" style={{ color: 'hsl(var(--charcoal) / 0.7)' }}>
              Join 1,200+ contractors who never miss a call with RingSnap
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="text-base h-12 px-6 font-semibold rounded-full bg-primary text-white hover:opacity-90 shadow-lg"
              onClick={handleSignup}
            >
              <PhoneCall className="mr-2 w-4 h-4" />
              Start Free Trial
            </Button>
            <Button
              size="lg"
              className="text-base h-12 px-6 font-semibold rounded-full bg-white border-2 hover:shadow-md"
              style={{ borderColor: 'hsl(var(--charcoal) / 0.3)', color: 'hsl(var(--charcoal))' }}
              onClick={() => document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Calculator className="mr-2 w-4 h-4" />
              Calculate ROI
            </Button>
          </div>

          {/* Inline trust stats */}
          <div className="flex flex-wrap justify-center items-center gap-4 text-xs sm:text-sm pt-2">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-primary" /> No card required
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-primary" /> 10 min setup
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-primary fill-primary" /> 4.9/5 rating
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
