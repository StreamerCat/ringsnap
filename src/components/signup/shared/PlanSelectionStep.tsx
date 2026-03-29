import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plan {
  id: 'night_weekend' | 'lite' | 'core' | 'pro';
  name: string;
  price: number;
  includedCalls: number;
  overageRate: string;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'night_weekend',
    name: 'Night & Weekend',
    price: 59,
    includedCalls: 60,
    overageRate: '$1.10/call',
    features: [
      '60 calls included/month',
      'After-hours + weekend coverage',
      'Urgent transfer to your phone',
      'CRM included'
    ]
  },
  {
    id: 'lite',
    name: 'Lite',
    price: 129,
    includedCalls: 125,
    overageRate: '$0.95/call',
    features: [
      '125 calls included/month',
      '24/7 call answering',
      'Google Calendar + Zapier',
      'Call recordings + transcripts',
      'Urgent call transfer with context'
    ],
    popular: true
  },
  {
    id: 'core',
    name: 'Core',
    price: 229,
    includedCalls: 250,
    overageRate: '$0.85/call',
    features: [
      '250 calls included/month',
      '24/7 call answering',
      'Priority support',
      'Smart call routing by urgency',
      'Multi-language (English + Spanish)'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 449,
    includedCalls: 450,
    overageRate: '$0.75/call',
    features: [
      '450 calls included/month',
      '24/7 call answering',
      'Dedicated account manager',
      'Custom voice + branding',
      'Multi-location support'
    ]
  }
];

interface PlanSelectionStepProps {
  selectedPlan: string | null;
  onSelectPlan: (planId: string) => void;
  isTrial?: boolean;
}

export const PlanSelectionStep = ({
  selectedPlan,
  onSelectPlan,
  isTrial = false
}: PlanSelectionStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Choose Your Plan</h2>
        {isTrial && (
          <p className="text-sm text-muted-foreground">
            3-day free trial • $0 due today • Cancel anytime
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              "relative cursor-pointer transition-all hover:shadow-lg",
              selectedPlan === plan.id && "ring-2 ring-primary shadow-lg"
            )}
            onClick={() => onSelectPlan(plan.id)}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">
                  Most Popular
                </Badge>
              </div>
            )}
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
