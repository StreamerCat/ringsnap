import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Zap, Phone, Users, Crown } from "lucide-react";
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
        "Books appointments & emergency calls",
        "Email & SMS notifications",
        "Call recordings & transcripts",
        "Google Calendar + Zapier integration",
        "Basic analytics dashboard",
        "Email support (24hr response)"
      ],
      riskReversal: "Book 1 emergency call in 14 days or we refund + $50",
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
        "Premium voice cloning (sounds like your team)",
        "Advanced integrations (Salesforce, HubSpot, Make)",
        "Smart call routing to crew members",
        "Multi-language support (English + Spanish)",
        "Priority support (2hr response)",
        "Advanced analytics + conversion tracking",
        "Custom scripts for your services"
      ],
      riskReversal: "Book 10+ jobs in 30 days or full refund",
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
        "Custom voice cloning (your exact brand voice)",
        "Dedicated success manager",
        "API access + custom webhooks",
        "A/B testing & AI optimization",
        "White-label options available",
        "Custom integrations built for you",
        "Multi-location management dashboard"
      ],
      riskReversal: "40% revenue increase in 60 days or refund + $500",
      cta: "Start Free Trial",
      badge: null,
      icon: Crown
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        <hr className="section-divider mb-12" />
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            One Emergency Call <span className="text-primary">Pays for the Entire Month</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
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
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {pricingTiers.map((tier, index) => (
            <Card 
              key={index} 
              className={`relative shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 transition-all duration-200 ${
                tier.badge ? 'border-2 border-primary hover:border-emerald-500 hover:shadow-xl scale-105' : 'border-2 hover:border-emerald-500'
              }`}
            >
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="px-4 py-1 text-xs font-bold bg-primary text-primary-foreground">
                    {tier.badge}
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <tier.icon className="w-7 h-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription className="text-sm">{tier.description}</CardDescription>
                <div className="pt-4">
                  <div className="text-5xl font-bold">{tier.price}</div>
                  <div className="text-sm text-muted-foreground">/month</div>
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
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className={`text-sm ${
                        feature.includes('PLUS') ? 'font-semibold text-primary' : ''
                      }`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Risk Reversal */}
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="text-sm font-semibold text-center">
                    {tier.riskReversal}
                  </div>
                </div>

                {/* CTA */}
                <Button 
                  className="w-full h-12 text-lg shadow-lg hover:shadow-emerald-500/20 transition-all duration-200" 
                  variant={tier.badge ? "default" : "outline"}
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
      </div>
    </section>
  );
};
