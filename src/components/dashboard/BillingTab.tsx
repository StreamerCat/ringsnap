import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, AlertCircle, Loader2, ExternalLink, Sparkles, Calendar, Clock, TrendingUp, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { trackClick, trackFunnelEvent } from "@/lib/sentry-tracking";
import * as Sentry from "@sentry/react";

import { InvoicesList } from "./billing/InvoicesList";
import { PaymentMethodUpdateDialog } from "./billing/PaymentMethodUpdateDialog";
import { UpgradeModal } from "./UpgradeModal";
import { getDashboardPlanByKey } from "@/lib/billing/dashboardPlans";

interface PaymentMethodInfo {
    brand: string | null;
    last4: string | null;
    exp_month: number | null;
    exp_year: number | null;
}

interface BillingTabProps {
    account: any;
    trialDaysRemaining: number;
    creditsBalance: number;
    onRefresh?: () => void;
}

export function BillingTab({ account, trialDaysRemaining, creditsBalance, onRefresh }: BillingTabProps) {
    const { toast } = useToast();
    const [cancelingSubscription, setCancelingSubscription] = useState(false);
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [updateCardOpen, setUpdateCardOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
    const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(true);

    // Plan resolution: use plan_key (new) with fallback to plan_type (legacy)
    const rawPlanKey = account.plan_key || account.plan_type || "night_weekend";
    const currentPlan = getDashboardPlanByKey(rawPlanKey);

    const isTrialing = account.trial_active === true || account.subscription_status === "trial";
    const isActive = account.subscription_status === "active";
    const isCanceled = account.subscription_status === "cancelled" || account.cancel_at_period_end;
    const isNightWeekend = (currentPlan?.key === "night_weekend");

    // Usage figures — prefer new columns, fall back to legacy
    const trialUsed: number = account.trial_minutes_used ?? 0;
    const trialLimit: number = account.trial_minutes_limit ?? 50;
    const periodUsed: number = account.minutes_used_current_period ?? account.monthly_minutes_used ?? 0;
    const includedMinutes: number = currentPlan?.includedMinutes ?? account.monthly_minutes_limit ?? 600;
    const overageMinutes: number = Math.max(0, periodUsed - includedMinutes);
    const projectedOverage: number = overageMinutes * (currentPlan?.overageRate ?? 0.28);

    // Usage percentages
    const trialPct = trialLimit > 0 ? Math.min(100, Math.round((trialUsed / trialLimit) * 100)) : 0;
    const periodPct = includedMinutes > 0 ? Math.min(100, Math.round((periodUsed / includedMinutes) * 100)) : 0;

    // Progress bar color
    const progressColor = (pct: number) =>
        pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";

    // Dates
    const trialEndDate = account.trial_end_date ? new Date(account.trial_end_date) : null;
    const nextBillingDate = account.current_period_end
        ? new Date(typeof account.current_period_end === "number"
            ? account.current_period_end * 1000
            : account.current_period_end)
        : null;

    const fetchBillingSummary = async () => {
        setLoadingPaymentMethod(true);
        try {
            const { data, error } = await supabase.functions.invoke("get-billing-summary", {
                body: { account_id: account.id },
            });
            if (!error && data?.payment_method) {
                setPaymentMethod(data.payment_method);
            }
        } catch (e) {
            console.log("Failed to fetch billing summary:", e);
        } finally {
            setLoadingPaymentMethod(false);
        }
    };

    useEffect(() => {
        if (account?.id) fetchBillingSummary();
    }, [account?.id]);

    const handleCancelSubscription = async () => {
        const message = isTrialing
            ? "Are you sure you want to cancel your trial? Your phone number will be released."
            : "Are you sure you want to cancel? Your subscription stays active until end of billing period.";
        trackClick("cancel_subscription_initiated", { is_trial: isTrialing });
        if (!window.confirm(message)) return;

        setCancelingSubscription(true);
        try {
            const functionName = isTrialing ? "cancel-subscription" : "stripe-subscription-cancel";
            const { error } = await supabase.functions.invoke(functionName, {
                body: { account_id: account.id },
            });
            if (error) throw error;
            toast({
                title: isTrialing ? "Trial Canceled" : "Subscription Scheduled to Cancel",
                description: isTrialing
                    ? "Your trial has been canceled."
                    : "Your subscription remains active until end of billing period.",
            });
            if (onRefresh) onRefresh();
            else window.location.reload();
        } catch (error: any) {
            console.error("Cancellation error:", error);
            toast({ title: "Error", description: "Failed to cancel. Please contact support.", variant: "destructive" });
            Sentry.captureException(error, { extra: { account_id: account.id, is_trial: isTrialing } });
        } finally {
            setCancelingSubscription(false);
        }
    };

    return (
        <div className="space-y-6">
            <UpgradeModal
                open={upgradeModalOpen}
                onOpenChange={setUpgradeModalOpen}
                currentPlanKey={rawPlanKey}
                accountId={account.id}
            />
            <PaymentMethodUpdateDialog
                open={updateCardOpen}
                onOpenChange={setUpdateCardOpen}
                accountId={account.id}
                onSuccess={() => { fetchBillingSummary(); toast({ title: "Payment method updated" }); }}
            />

            {/* ── 4a/4c: Plan & Usage Card ─────────────────────────────────────── */}
            <Card className="border-2">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2 flex-wrap">
                                {currentPlan?.name || "Night & Weekend"}
                                {currentPlan?.badgeText && (
                                    <Badge className="bg-primary text-white">{currentPlan.badgeText}</Badge>
                                )}
                                {isTrialing && (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">Trial</Badge>
                                )}
                                {isCanceled && <Badge variant="destructive">Canceling</Badge>}
                            </CardTitle>
                            {/* 4d: Coverage note for Night & Weekend */}
                            {isNightWeekend && (
                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                    <Moon className="h-3 w-3" />
                                    Active: 6PM–8AM Mon–Fri + all day Sat–Sun
                                </p>
                            )}
                        </div>
                        <Button
                            onClick={() => {
                                trackClick("billing_upgrade_click", { current_plan: rawPlanKey });
                                setUpgradeModalOpen(true);
                            }}
                            className="gap-2"
                        >
                            <Sparkles className="h-4 w-4" />
                            {isTrialing ? "Choose a Plan" : "Change Plan"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-6">
                        {/* Plan pricing */}
                        <div>
                            <p className="text-3xl font-bold text-primary">
                                ${currentPlan?.priceMonthly ?? 59}
                                <span className="text-base font-normal text-muted-foreground">/month</span>
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {includedMinutes.toLocaleString()} minutes included/mo
                            </p>
                            <p className="text-sm text-muted-foreground">
                                ${currentPlan?.overageRate?.toFixed(2) ?? "0.45"}/min if you go over
                            </p>
                        </div>

                        {/* Dates */}
                        <div className="space-y-3">
                            {isTrialing && trialEndDate && (
                                <div className="flex items-center gap-2 text-amber-700">
                                    <Calendar className="h-4 w-4" />
                                    <span className="text-sm">
                                        Trial ends: <strong>{format(trialEndDate, "MMM d, yyyy")}</strong>
                                    </span>
                                </div>
                            )}
                            {isActive && nextBillingDate && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    <span className="text-sm">
                                        Next billing: <strong>{format(nextBillingDate, "MMM d, yyyy")}</strong>
                                    </span>
                                </div>
                            )}
                            <Badge variant={isActive ? "default" : "secondary"} className="capitalize">
                                {account.subscription_status}
                            </Badge>
                        </div>

                        {/* Credits */}
                        <div className="space-y-2">
                            {creditsBalance > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Credits Balance</span>
                                    <span className="font-medium text-green-600">${creditsBalance.toFixed(2)}</span>
                                </div>
                            )}
                            {isNightWeekend && (account.rejected_daytime_calls ?? 0) > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Daytime calls missed this month</span>
                                    <span className="font-medium text-orange-600">{account.rejected_daytime_calls}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── 4c: Trial minutes display ── */}
                    {isTrialing && (
                        <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-medium text-amber-900">
                                    Your free trial includes 50 minutes of live AI call handling
                                </span>
                                <span className="text-amber-700 font-bold">{trialUsed} / {trialLimit} min used</span>
                            </div>
                            <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-2 rounded-full transition-all ${progressColor(trialPct)}`}
                                    style={{ width: `${trialPct}%` }}
                                />
                            </div>
                            <p className="text-xs text-amber-700 mt-2">
                                {trialLimit - trialUsed} minutes remaining in trial
                            </p>
                            {trialPct >= 70 && (
                                <div className="mt-3 p-2 bg-amber-100 rounded text-xs text-amber-900">
                                    {trialPct >= 90
                                        ? "You're almost out of trial minutes — choose a plan to keep going."
                                        : "You're at 70% of your trial minutes — consider choosing a plan soon."}
                                    <Button
                                        size="sm"
                                        className="ml-2 h-6 text-xs"
                                        onClick={() => setUpgradeModalOpen(true)}
                                    >
                                        Choose a Plan
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── 4a: Usage progress bar (active plan) ── */}
                    {!isTrialing && (
                        <div className="mt-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-medium">Minutes used this period</span>
                                <span className="font-bold">
                                    {periodUsed.toLocaleString()} / {includedMinutes.toLocaleString()} min
                                </span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-2 rounded-full transition-all ${progressColor(periodPct)}`}
                                    style={{ width: `${Math.min(100, periodPct)}%` }}
                                />
                            </div>
                            {overageMinutes > 0 && (
                                <div className="mt-2 flex items-center gap-2 text-sm text-orange-700">
                                    <TrendingUp className="h-4 w-4" />
                                    <span>
                                        {overageMinutes} overage minutes — projected extra:{" "}
                                        <strong>${projectedOverage.toFixed(2)}</strong> this month
                                    </span>
                                </div>
                            )}
                            {/* 4b: Upgrade nudge at 70%+ */}
                            {periodPct >= 70 && overageMinutes === 0 && (
                                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                                    <p className="text-yellow-800">
                                        {periodPct >= 90
                                            ? "⚠️ You're nearing your limit — upgrade to avoid overage charges."
                                            : "You're nearing your limit — consider upgrading before overage kicks in."}
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-2"
                                        onClick={() => setUpgradeModalOpen(true)}
                                    >
                                        View Plan Options
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4b: Night & Weekend daytime calls upgrade banner */}
                    {isNightWeekend && !isTrialing && (account.rejected_daytime_calls ?? 0) > 0 && (
                        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-900">
                            You had <strong>{account.rejected_daytime_calls} missed daytime calls</strong> this month.
                            Upgrade to Lite for 24/7 coverage.
                            <Button
                                size="sm"
                                className="ml-2"
                                onClick={() => setUpgradeModalOpen(true)}
                            >
                                Upgrade to Lite →
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Payment Method & Billing History */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Payment Method</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-16 bg-slate-100 rounded flex items-center justify-center">
                                <CreditCard className="h-6 w-6 text-slate-400" />
                            </div>
                            <div className="flex-1">
                                {loadingPaymentMethod ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm text-muted-foreground">Loading...</span>
                                    </div>
                                ) : paymentMethod?.last4 ? (
                                    <>
                                        <p className="font-medium capitalize">
                                            {paymentMethod.brand || "Card"} •••• {paymentMethod.last4}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No payment method on file</p>
                                )}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setUpdateCardOpen(true)}>Update</Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Billing History</CardTitle></CardHeader>
                    <CardContent>
                        <InvoicesList accountId={account.id} />
                    </CardContent>
                </Card>
            </div>

            {/* Cancel Section */}
            {(isTrialing || isActive) && !isCanceled && (
                <Card className="border-destructive/20 bg-destructive/5">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            {isTrialing ? "Cancel Trial" : "Cancel Subscription"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            {isTrialing
                                ? "Canceling your trial will immediately release your phone number and stop your assistant."
                                : "Your subscription will remain active until the end of the current billing period."}
                        </p>
                        <Button
                            variant="destructive"
                            onClick={handleCancelSubscription}
                            disabled={cancelingSubscription}
                        >
                            {cancelingSubscription ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Canceling...</>
                            ) : (
                                isTrialing ? "Cancel Trial" : "Cancel Subscription"
                            )}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
