import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertCircle, Loader2, ExternalLink, Sparkles, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

// Components
import { InvoicesList } from "./billing/InvoicesList";
import { PaymentMethodUpdateDialog } from "./billing/PaymentMethodUpdateDialog";
import { UpgradeModal } from "./UpgradeModal";
import { DASHBOARD_PLANS, getDashboardPlanByKey } from "@/lib/billing/dashboardPlans";

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

    // Payment method state
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
    const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(true);

    // Get current plan details
    const currentPlan = getDashboardPlanByKey(account.plan_type || 'starter');
    const isTrialing = account.subscription_status === 'trial';
    const isActive = account.subscription_status === 'active';
    const isCanceled = account.subscription_status === 'cancelled' || account.cancel_at_period_end;

    // Format dates
    const trialEndDate = account.trial_end_date ? new Date(account.trial_end_date) : null;
    const nextBillingDate = account.current_period_end ? new Date(account.current_period_end * 1000) : null;

    const fetchBillingSummary = async () => {
        setLoadingPaymentMethod(true);
        try {
            const { data, error } = await supabase.functions.invoke('get-billing-summary', {
                body: { account_id: account.id }
            });
            if (!error && data?.payment_method) {
                setPaymentMethod(data.payment_method);
            }
        } catch (e) {
            console.log('Failed to fetch billing summary:', e);
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
            : "Are you sure you want to cancel your subscription? It will remain active until the end of the current billing period.";

        if (!window.confirm(message)) return;

        setCancelingSubscription(true);
        try {
            // Use stripe-subscription-cancel for active subscriptions, cancel-subscription for trials
            const functionName = isTrialing ? 'cancel-subscription' : 'stripe-subscription-cancel';
            const { error } = await supabase.functions.invoke(functionName, {
                body: { account_id: account.id }
            });

            if (error) throw error;

            toast({
                title: isTrialing ? "Trial Canceled" : "Subscription Scheduled to Cancel",
                description: isTrialing
                    ? "Your trial has been canceled."
                    : "Your subscription will remain active until the end of the billing period.",
            });

            if (onRefresh) onRefresh();
            else window.location.reload();
        } catch (error: any) {
            console.error("Cancellation error:", error);
            toast({
                title: "Error",
                description: "Failed to cancel. Please contact support.",
                variant: "destructive"
            });
        } finally {
            setCancelingSubscription(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Upgrade Modal */}
            <UpgradeModal
                open={upgradeModalOpen}
                onOpenChange={setUpgradeModalOpen}
                currentPlanKey={account.plan_type}
                accountId={account.id}
            />

            {/* Update Card Dialog */}
            <PaymentMethodUpdateDialog
                open={updateCardOpen}
                onOpenChange={setUpdateCardOpen}
                accountId={account.id}
                onSuccess={() => {
                    fetchBillingSummary();
                    toast({ title: "Payment method updated" });
                }}
            />

            {/* Current Plan Card - Full Width */}
            <Card className="border-2">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                                Current Plan
                                {isTrialing && (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                                        Trial
                                    </Badge>
                                )}
                                {isCanceled && (
                                    <Badge variant="destructive">
                                        Canceling
                                    </Badge>
                                )}
                            </CardTitle>
                        </div>
                        <Button onClick={() => setUpgradeModalOpen(true)} className="gap-2">
                            <Sparkles className="h-4 w-4" />
                            {isTrialing ? "Upgrade Now" : "Change Plan"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-6">
                        {/* Plan Info */}
                        <div>
                            <h3 className="text-2xl font-bold">{currentPlan?.name || 'Starter'}</h3>
                            <p className="text-3xl font-bold text-primary mt-1">
                                ${currentPlan?.priceMonthly || 297}
                                <span className="text-base font-normal text-muted-foreground">/month</span>
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">
                                {currentPlan?.includedMinutes?.toLocaleString() || '1,500'} minutes included
                            </p>
                        </div>

                        {/* Billing Dates */}
                        <div className="space-y-3">
                            {isTrialing && trialEndDate && (
                                <div className="flex items-center gap-2 text-amber-700">
                                    <Calendar className="h-4 w-4" />
                                    <span className="text-sm">
                                        Trial ends: <strong>{format(trialEndDate, 'MMM d, yyyy')}</strong>
                                    </span>
                                </div>
                            )}
                            {isActive && nextBillingDate && (
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                        Next billing: <strong>{format(nextBillingDate, 'MMM d, yyyy')}</strong>
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Badge variant={isActive ? 'default' : 'secondary'} className="capitalize">
                                    {account.subscription_status}
                                </Badge>
                            </div>
                        </div>

                        {/* Credits & Usage */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Credits Balance</span>
                                <span className="font-medium text-green-600">${creditsBalance.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Minutes Used</span>
                                <span className="font-medium">
                                    {account.monthly_minutes_used || 0} / {account.monthly_minutes_limit === -1 ? '∞' : account.monthly_minutes_limit || currentPlan?.includedMinutes}
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Payment Method & Invoices Row */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Method</CardTitle>
                    </CardHeader>
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
                                            {paymentMethod.brand || 'Card'} •••• {paymentMethod.last4}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No payment method on file</p>
                                )}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setUpdateCardOpen(true)}>
                                Update
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Billing History</CardTitle>
                    </CardHeader>
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
                            {isTrialing ? 'Cancel Trial' : 'Cancel Subscription'}
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
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Canceling...
                                </>
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
