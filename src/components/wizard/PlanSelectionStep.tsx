import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { WizardFormData, PLANS } from "./types";

interface PlanSelectionStepProps {
  form: UseFormReturn<WizardFormData>;
}

export const PlanSelectionStep = ({ form }: PlanSelectionStepProps) => {
  const selectedPlan = form.watch("planType");

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-foreground">Choose Your Plan</h2>
        <p className="text-muted-foreground">Select the plan that best fits your call volume</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.value;
          const isPopular = plan.popular;

          return (
            <Card
              key={plan.value}
              className={cn(
                "relative cursor-pointer transition-all duration-300 hover:scale-105",
                isSelected
                  ? "card-tier-1 ring-2 ring-primary shadow-xl"
                  : "card-tier-2 hover:border-primary/50",
                isPopular && !isSelected && "border-primary/30"
              )}
              onClick={() => {
                form.setValue("planType", plan.value, { shouldValidate: true });
                form.clearErrors("planType");
              }}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1 shadow-lg">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="pt-4">
                  <span className="text-5xl font-bold text-primary">${plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <CardDescription className="pt-2 text-base">
                  {plan.calls} calls per month
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isSelected && (
                  <div className="pt-4 text-center">
                    <Badge variant="default" className="animate-pulse">
                      <Check className="h-3 w-3 mr-1" />
                      Selected
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {form.formState.errors.planType && (
        <p className="text-sm text-destructive text-center">{form.formState.errors.planType.message}</p>
      )}

      {selectedPlan && (
        <div className="text-center text-sm text-muted-foreground animate-in fade-in-50 duration-300">
          Your monthly investment: <span className="font-bold text-primary text-lg">
            ${PLANS.find(p => p.value === selectedPlan)?.price}/mo
          </span>
        </div>
      )}
    </div>
  );
};
