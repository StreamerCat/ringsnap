import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanSelectorProps {
  form: UseFormReturn<any>;
  variant?: "detailed" | "compact";
  highlight?: "starter" | "professional" | "premium";
  disabled?: boolean;
}

const PLANS = [
  {
    value: "starter" as const,
    name: "Starter",
    price: 297,
    priceLabel: "$297/mo",
    calls: "≤80 calls/mo",
    features: [
      "AI phone receptionist",
      "Call forwarding",
      "24/7 availability",
      "Email support",
    ],
  },
  {
    value: "professional" as const,
    name: "Professional",
    price: 797,
    priceLabel: "$797/mo",
    calls: "≤160 calls/mo",
    features: [
      "Everything in Starter",
      "Priority routing",
      "Advanced AI voice",
      "Phone & chat support",
      "Call recording",
    ],
    popular: true,
  },
  {
    value: "premium" as const,
    name: "Premium",
    price: 1497,
    priceLabel: "$1,497/mo",
    calls: ">160 calls/mo",
    features: [
      "Everything in Professional",
      "Voice cloning",
      "Dedicated support",
      "Custom integrations",
      "Advanced analytics",
    ],
  },
];

/**
 * Shared plan selector component
 * Used in both self-serve and sales-guided flows
 *
 * @example Self-serve usage (detailed)
 * <PlanSelector
 *   form={form}
 *   variant="detailed"
 *   highlight="professional"
 * />
 *
 * @example Sales usage (compact)
 * <PlanSelector
 *   form={form}
 *   variant="compact"
 * />
 */
export function PlanSelector({
  form,
  variant = "detailed",
  highlight = "professional",
  disabled = false,
}: PlanSelectorProps) {
  return (
    <FormField
      control={form.control}
      name="planType"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Choose Your Plan *</FormLabel>
          <FormDescription>
            3-day free trial, then billed monthly. Cancel anytime.
          </FormDescription>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              disabled={disabled}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"
            >
              {PLANS.map((plan) => {
                const isSelected = field.value === plan.value;
                const isHighlighted = plan.value === highlight || plan.popular;

                return (
                  <Card
                    key={plan.value}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary relative",
                      isSelected && "border-primary ring-2 ring-primary",
                      isHighlighted && !isSelected && "border-primary/50"
                    )}
                    onClick={() => !disabled && field.onChange(plan.value)}
                  >
                    {isHighlighted && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-primary">Most Popular</Badge>
                      </div>
                    )}

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <div className="mt-1 flex items-baseline">
                            <span className="text-3xl font-bold">${plan.price}</span>
                            <span className="text-muted-foreground ml-1">/mo</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {plan.calls}
                          </p>
                        </div>
                        <RadioGroupItem
                          value={plan.value}
                          id={`plan-${plan.value}`}
                          className="mt-1"
                        />
                      </div>
                    </CardHeader>

                    {variant === "detailed" && (
                      <CardContent className="pt-0">
                        <ul className="space-y-2">
                          {plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start text-sm">
                              <Check className="h-4 w-4 text-primary mr-2 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    )}

                    {variant === "compact" && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground">
                          {plan.features.length} features included
                        </p>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
