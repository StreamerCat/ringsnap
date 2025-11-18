import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormSectionProps, PLANS } from "../types";

/**
 * Plan Selection Section
 *
 * Displays plan cards with features and pricing.
 * Shows "Recommended" badge on Professional plan.
 * Includes order summary when a plan is selected.
 */
export function PlanSelectionSection({ form, isSubmitting }: FormSectionProps) {
  const selectedPlan = form.watch("planType");
  const selectedPlanDetails = PLANS.find((p) => p.value === selectedPlan);

  return (
    <>
      {/* Plan Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <button
                key={plan.value}
                type="button"
                onClick={() => {
                  form.setValue("planType", plan.value, { shouldValidate: true });
                  form.clearErrors("planType");
                }}
                disabled={isSubmitting}
                className={cn(
                  "relative p-5 sm:p-6 rounded-2xl border-2 text-left transition-all touch-manipulation min-h-[56px] w-full",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
                  "hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                  selectedPlan === plan.value
                    ? "border-primary bg-primary/5 shadow-lg"
                    : "border-slate-200 hover:border-primary/50"
                )}
              >
                {/* Recommended badge */}
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Recommended
                  </div>
                )}

                <div className="text-lg font-bold">{plan.name}</div>
                <div className="text-2xl font-bold text-primary mt-2">
                  ${plan.price.toLocaleString()}/mo
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {plan.calls} calls/month
                </div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Selected indicator */}
                {selectedPlan === plan.value && (
                  <div className="absolute top-4 right-4">
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
          {form.formState.errors.planType && (
            <p className="text-sm text-red-500 mt-2">
              {form.formState.errors.planType.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Order Summary */}
      {selectedPlanDetails && (
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">
                  {selectedPlanDetails.name} Plan
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedPlanDetails.calls} calls/month
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">
                  ${selectedPlanDetails.price.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">per month</div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm font-medium">What's included:</p>
              {selectedPlanDetails.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Billing cycle:</span>
                <span className="font-medium">Monthly</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">Due today:</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    ${selectedPlanDetails.price.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Billed monthly, cancel anytime
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
