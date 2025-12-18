import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { DASHBOARD_PLANS, PlanDef, PlanKey } from "@/lib/billing/dashboardPlans";
import { trackClick, trackFunnelEvent, trackConversion, trackCheckpoint } from "@/lib/sentry-tracking";
import * as Sentry from "@sentry/react";

interface UpgradeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentPlanKey: PlanKey | string | null;
    accountId: string;
}

export function UpgradeModal({ open, onOpenChange, currentPlanKey, accountId }: UpgradeModalProps) {
    const { toast } = useToast();
    const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
    const [upgrading, setUpgrading] = useState(false);

    // Normalize current plan key for comparison
    const normalizedCurrentPlan = (currentPlanKey?.toLowerCase() || "starter") as PlanKey;

    // Get current plan index to filter for upgrades only
    const currentPlanIndex = DASHBOARD_PLANS.findIndex(p => p.key === normalizedCurrentPlan);

    // Only show plans that are higher tier than current (upgrades only)
    const upgradePlans = DASHBOARD_PLANS.filter((_, index) => index > currentPlanIndex);

    const handleUpgrade = async () => {
        if (!selectedPlan) {
            toast({
                title: "Select a Plan",
                description: "Please select a plan to upgrade or change to.",
                variant: "destructive",
            });
            return;
        }

        setUpgrading(true);
        trackFunnelEvent("upgrade_initiated", {
            account_id: accountId,
            plan: selectedPlan
        });
        try {
            const { data, error } = await supabase.functions.invoke("create-upgrade-checkout", {
                body: {
                    account_id: accountId,
                    planKey: selectedPlan,
                },
            });

            if (error) {
                // Try to extract meaningful error message
                let errorMessage = "Failed to start plan change process.";
                try {
                    if (error.message) {
                        const parsed = JSON.parse(error.message);
                        errorMessage = parsed.error || error.message;
                    }
                } catch {
                    errorMessage = error.message || errorMessage;
                }
                throw new Error(errorMessage);
            }

            if (data?.url) {
                trackCheckpoint("upgrade_checkout_redirect", { url: data.url });
                // Redirect to Stripe
                window.location.href = data.url;
            } else if (data?.success) {
                // Subscription was updated in-place (no checkout redirect needed)
                trackConversion("upgrade_completed", 0, {
                    plan: selectedPlan,
                    account_id: accountId
                });
                trackFunnelEvent("upgrade_completed", { account_id: accountId, plan: selectedPlan });
                toast({
                    title: "Plan Updated!",
                    description: `Your plan has been changed to ${selectedPlan}. Changes take effect immediately.`,
                });
                onOpenChange(false);
                // Refresh page to show updated plan
                window.location.reload();
            } else {
                throw new Error("No redirect URL or success confirmation returned");
            }
        } catch (error: any) {
            console.error("Upgrade error:", error);
            toast({
                title: "Change Plan Failed",
                description: error.message || "Could not process plan change. Please try again.",
                variant: "destructive",
            });
            Sentry.captureException(error, {
                extra: { account_id: accountId, plan: selectedPlan }
            });
        } finally {
            setUpgrading(false);
        }
    };

    // If no upgrade plans available and user is on top tier, we'll show a message in the modal instead
    // Don't return null here - we want to show the modal with appropriate messaging

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Sparkles className="h-6 w-6 text-primary" />
                        Change Your Plan
                    </DialogTitle>
                    <DialogDescription>
                        {upgradePlans.length > 0
                            ? "Upgrade to get more minutes and features."
                            : "You're on our top plan! Contact us for enterprise options."}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4 md:grid-cols-2 lg:grid-cols-3">
                    {upgradePlans.length === 0 ? (
                        <div className="col-span-full text-center py-8">
                            <p className="text-muted-foreground">You're on our Premium plan - the best we offer!</p>
                            <p className="text-sm text-muted-foreground mt-2">Contact us for enterprise needs.</p>
                        </div>
                    ) : upgradePlans.map((plan) => {
                        const isSelected = selectedPlan === plan.key;

                        return (
                            <Card
                                key={plan.key}
                                className={`relative cursor-pointer transition-all ${isSelected
                                    ? "border-primary ring-2 ring-primary shadow-lg"
                                    : "hover:border-primary/50 hover:shadow-md"
                                    }`}
                                onClick={() => {
                                    trackClick("upgrade_plan_selected", { plan: plan.key });
                                    setSelectedPlan(plan.key);
                                }}
                            >
                                {plan.recommended && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                                            Most Popular
                                        </Badge>
                                    </div>
                                )}

                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                                    <CardDescription className="text-xs">{plan.headline}</CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <div>
                                        <span className="text-3xl font-bold">${plan.priceMonthly}</span>
                                        <span className="text-muted-foreground">/month</span>
                                    </div>

                                    <div className="space-y-1 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-green-600" />
                                            <span>{plan.includedMinutes.toLocaleString()} minutes/mo</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-green-600" />
                                            <span>{plan.aiReceptionists} AI receptionist{plan.aiReceptionists > 1 ? "s" : ""}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <span className="ml-6">${plan.overageRate}/min overage</span>
                                        </div>
                                    </div>

                                    <div className="border-t pt-3 space-y-1">
                                        {plan.features.slice(0, 4).map((feature, i) => (
                                            <div key={i} className="flex items-start gap-2 text-xs">
                                                <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                                <span>{feature}</span>
                                            </div>
                                        ))}
                                        {plan.features.length > 4 && (
                                            <p className="text-xs text-muted-foreground ml-5">
                                                +{plan.features.length - 4} more features
                                            </p>
                                        )}
                                    </div>

                                    {plan.notes && (
                                        <p className="text-xs text-muted-foreground italic">{plan.notes}</p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upgrading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpgrade}
                        disabled={!selectedPlan || upgrading}
                        className="min-w-[140px]"
                    >
                        {upgrading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : selectedPlan ? (
                            `Upgrade to ${DASHBOARD_PLANS.find(p => p.key === selectedPlan)?.name}`
                        ) : (
                            "Select a Plan"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog >
    );
}
