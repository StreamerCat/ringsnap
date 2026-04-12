import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Sparkles, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { DASHBOARD_PLANS, PlanKey, normalizeLegacyPlanKey } from "@/lib/billing/dashboardPlans";
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

    const normalizedCurrent = normalizeLegacyPlanKey(currentPlanKey || "night_weekend");
    const currentIndex = DASHBOARD_PLANS.findIndex((p) => p.key === normalizedCurrent);

    const handleUpgrade = async () => {
        if (!selectedPlan) {
            toast({ title: "Select a Plan", description: "Please select a plan to change to.", variant: "destructive" });
            return;
        }

        setUpgrading(true);
        trackFunnelEvent("upgrade_initiated", { account_id: accountId, plan: selectedPlan });

        try {
            const { data, error } = await supabase.functions.invoke("create-upgrade-checkout", {
                body: { account_id: accountId, planKey: selectedPlan },
            });

            if (error) {
                let errorMessage = "Failed to start plan change.";
                try {
                    if (error.message) {
                        const parsed = JSON.parse(error.message);
                        errorMessage = parsed.error || error.message;
                    }
                } catch { errorMessage = error.message || errorMessage; }
                throw new Error(errorMessage);
            }

            if (data?.url) {
                trackCheckpoint("upgrade_checkout_redirect", { url: data.url });
                window.location.href = data.url;
            } else if (data?.success) {
                trackConversion("upgrade_completed", 0, { plan: selectedPlan, account_id: accountId });
                toast({
                    title: "Plan Updated!",
                    description: `Your plan has been updated to ${DASHBOARD_PLANS.find((p) => p.key === selectedPlan)?.name}. Changes take effect immediately.`,
                });
                onOpenChange(false);
                window.location.reload();
            } else {
                throw new Error("No redirect URL or confirmation returned");
            }
        } catch (error: any) {
            console.error("Upgrade error:", error);
            toast({ title: "Change Plan Failed", description: error.message || "Could not process plan change. Please try again.", variant: "destructive" });
            Sentry.captureException(error, { extra: { account_id: accountId, plan: selectedPlan } });
        } finally {
            setUpgrading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Sparkles className="h-6 w-6 text-primary" />
                        Change Your Plan
                    </DialogTitle>
                    <DialogDescription>
                        Compare all plans. Your current plan is shown below — select another to upgrade or change.
                    </DialogDescription>
                </DialogHeader>

                {/* 4b: All 4 plans — current greyed, Core (recommended) highlighted */}
                <div className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
                    {DASHBOARD_PLANS.map((plan, idx) => {
                        const isCurrent = plan.key === normalizedCurrent;
                        const isSelected = selectedPlan === plan.key;
                        const isRecommended = plan.recommended;

                        return (
                            <Card
                                key={plan.key}
                                className={[
                                    "relative transition-all",
                                    isCurrent ? "opacity-50 cursor-not-allowed border-dashed" : "cursor-pointer",
                                    isSelected ? "border-primary ring-2 ring-primary shadow-lg" : "",
                                    isRecommended && !isCurrent ? "border-primary/60" : "",
                                    !isCurrent && !isSelected ? "hover:border-primary/50 hover:shadow-md" : "",
                                ].filter(Boolean).join(" ")}
                                onClick={() => {
                                    if (isCurrent) return;
                                    trackClick("upgrade_plan_selected", { plan: plan.key });
                                    setSelectedPlan(plan.key as PlanKey);
                                }}
                            >
                                {isCurrent && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                        <Badge variant="secondary" className="text-xs">Current Plan</Badge>
                                    </div>
                                )}
                                {isRecommended && !isCurrent && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                                        <Badge className="bg-primary text-white text-xs">Best Value</Badge>
                                    </div>
                                )}

                                <CardHeader className="pb-2 pt-6">
                                    <CardTitle className="text-base">{plan.name}</CardTitle>
                                    <CardDescription className="text-xs leading-tight">{plan.headline}</CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-3">
                                    <div>
                                        <span className="text-2xl font-bold">${plan.priceMonthly}</span>
                                        <span className="text-sm text-muted-foreground">/mo</span>
                                    </div>

                                    <div className="space-y-1 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <Check className="h-3 w-3 text-green-600 shrink-0" />
                                            <span>{plan.includedCalls.toLocaleString()} calls/mo</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                            <span className="ml-4">${plan.overageRateCalls.toFixed(2)}/call overage</span>
                                        </div>
                                        {plan.key === "night_weekend" && (
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Moon className="h-3 w-3 shrink-0" />
                                                <span>After-hours only</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t pt-2 space-y-1">
                                        {plan.features.slice(0, 3).map((feature, i) => (
                                            <div key={i} className="flex items-start gap-1.5 text-xs">
                                                <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                                <span>{feature}</span>
                                            </div>
                                        ))}
                                    </div>
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
                        className="min-w-[160px]"
                    >
                        {upgrading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                        ) : selectedPlan ? (
                            `Change to ${DASHBOARD_PLANS.find((p) => p.key === selectedPlan)?.name}`
                        ) : (
                            "Select a Plan"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
