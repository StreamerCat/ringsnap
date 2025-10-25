import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Zap, Phone, Crown, Calculator, CheckCircle, Clock, Lock, Star, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const ContractorPricing = () => {
  const comparisonData = [
    { option: "Full-time Receptionist", cost: "$3,000-4,000/month", issues: "Benefits, sick days, 9-5 only" },
    { option: "Answering Service", cost: "$500-1,200/month", issues: "Robotic, can't book appointments" },
    { option: "AI Receptionist", cost: "$297/month", issues: "24/7/365, books jobs, sounds human" },
  ];

  const pricingTiers = [
    {
      name: "Starter",
      price: "$297",
      description: "Solo Contractors & Small Crews",
      minutes: "2,000 minutes included",
      receptionist: "1 AI receptionist",
      overage: "$0.15/min overage",
      features: [
        "Answer 95% of calls automatically",
        "Books appointments automatically",
        "Call recordings & transcripts",
        "Google Calendar + Zapier",
        "Basic analytics"
      ],
      
      cta: "Start Free Trial",
      badge: null,
      icon: Phone
    },
    {
      name: "Professional",
      price: "$797",
      description: "Growing Contractors with Multiple Crews",
      minutes: "5,000 minutes included",
      receptionist: "3 AI receptionists",
      overage: "$0.12/min overage",
      features: [
        "Everything in Starter, PLUS:",
        "Premium voice cloning",
        "Smart call routing to crew",
        "Multi-language (EN + ES)",
        "Advanced analytics"
      ],
      
      cta: "Start Free Trial",
      badge: "MOST POPULAR",
      icon: Zap
    },
    {
      name: "Growth",
      price: "$1,497",
      description: "Multi-Location Contractors & Franchises",
      minutes: "10,000 minutes included",
      receptionist: "5 AI receptionists",
      overage: "$0.10/min overage",
      features: [
        "Everything in Professional, PLUS:",
        "Custom brand voice cloning",
        "Dedicated success manager",
        "API + custom webhooks",
        "Multi-location dashboard"
      ],
      
      cta: "Start Free Trial",
      badge: null,
      icon: Crown
    }
  ];

  return (
    <section className="section-spacer bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-8 sm:mb-12" />
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4" style={{color: 'hsl(var(--charcoal))'}}>
            Pricing as simple as <span style={{color: 'hsl(var(--primary))'}}>a handshake</span>
          </h2>
          <p className="text-fluid-body text-muted-foreground leading-relaxed">
            Transparent pricing. No setup fees. Cancel anytime.
          </p>
        </div>

        {/* Value Comparison */}
        <div className="max-w-3xl mx-auto mb-12">
          <Card className="border-2">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-4 text-center">Compare Your Options</h3>
              <div className="space-y-3">
                {comparisonData.map((item, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      index === 2 ? 'border-primary bg-primary/5' : 'bg-muted/30'
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
              className={`relative flex flex-col h-full ${
                tier.badge 
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
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                    tier.badge ? 'bg-primary' : 'bg-cream'
                  }`}>
                    <tier.icon className="w-8 h-8" style={{color: tier.badge ? 'white' : 'hsl(var(--primary))'}} />
                  </div>
                <CardTitle className="text-xl sm:text-2xl">{tier.name}</CardTitle>
                <CardDescription className="text-xs sm:text-sm">{tier.description}</CardDescription>
                <div className="pt-3 sm:pt-4">
                  <div className="text-4xl sm:text-5xl font-bold" style={{color: 'hsl(var(--charcoal))'}}>{tier.price}</div>
                  <div className="text-sm" style={{color: 'hsl(var(--charcoal) / 0.6)'}}>per month</div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Plan Details */}
                <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
                  <div className="font-semibold">{tier.minutes}</div>
                  <div className="text-muted-foreground">{tier.receptionist}</div>
                  <div className="text-xs text-muted-foreground">{tier.overage}</div>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{color: 'hsl(var(--primary))'}} />
                      <span className={`text-sm ${
                        feature.includes('PLUS') ? 'font-semibold text-primary' : ''
                      }`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button 
                  className={`w-full h-12 text-lg rounded-full transition-all ${
                    tier.badge 
                      ? 'bg-primary text-white hover:opacity-90 shadow-md' 
                      : 'bg-white border-2 hover:shadow-md'
                  }`}
                  style={tier.badge ? {} : {borderColor: 'hsl(var(--charcoal) / 0.3)', color: 'hsl(var(--charcoal))'}}
                  size="lg"
                >
                  {tier.cta}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  14-day free trial · No credit card required
                </p>
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
              <span>99.9% uptime SLA</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>HIPAA compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>Your number stays the same</span>
            </div>
          </div>
        </div>

        {/* Final Strong CTA - Condensed */}
        <div className="max-w-4xl mx-auto mt-12 text-center space-y-6 p-6 rounded-2xl bg-gradient-to-br from-cream/30 to-white border-2 border-primary/20">
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3" style={{color: 'hsl(var(--charcoal))'}}>
              Your Next Customer Is Calling. <span style={{color: 'hsl(var(--primary))'}}>Will You Answer?</span>
            </h2>
            <p className="text-base leading-relaxed" style={{color: 'hsl(var(--charcoal) / 0.7)'}}>
              Join 1,200+ contractors who never miss a call with RingSnap
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="text-base h-12 px-6 font-semibold rounded-full bg-primary text-white hover:opacity-90 shadow-lg">
              <PhoneCall className="mr-2 w-4 h-4" />
              Start Free Trial
            </Button>
            <Button 
              size="lg" 
              className="text-base h-12 px-6 font-semibold rounded-full bg-white border-2 hover:shadow-md"
              style={{borderColor: 'hsl(var(--charcoal) / 0.3)', color: 'hsl(var(--charcoal))'}}
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
