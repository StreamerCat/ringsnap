import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plan {
  id: 'starter' | 'professional' | 'premium';
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 297,
    features: [
      'Up to 80 calls/month',
      '24/7 AI answering',
      'SMS notifications',
      'Basic analytics'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 797,
    features: [
      'Up to 160 calls/month',
      'Priority support',
      'Advanced analytics',
      'Call recording',
      'Custom branding'
    ],
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 1497,
    features: [
      'Unlimited calls',
      'Dedicated account manager',
      'White-label option',
      'API access',
      'Custom integrations'
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

      <div className="grid gap-4 md:grid-cols-3">
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
