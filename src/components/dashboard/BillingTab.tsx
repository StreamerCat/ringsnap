import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertCircle, Loader2, ExternalLink, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

// New Components
import { InvoicesList } from "./billing/InvoicesList";
import { PaymentMethodUpdateDialog } from "./billing/PaymentMethodUpdateDialog";
import { PlanManagement } from "./billing/PlanManagement";

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
    const [cancelingTrial, setCancelingTrial] = useState(false);
    const [creatingPortalSession, setCreatingPortalSession] = useState(false);
    const [cancelingSubscription, setCancelingSubscription] = useState(false);

    // Payment method state - fetched from Stripe
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
    const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(true);

    // Dialog state
    const [updateCardOpen, setUpdateCardOpen] = useState(false);

    // Fetch payment method from Stripe (fail soft)
    const fetchBillingSummary = async () => {
        setLoadingPaymentMethod(true);
        try {
            const { data, error } = await supabase.functions.invoke('get-billing-summary', {
                body: { account_id: account.id }
            });

            if (!error && data?.payment_method) {
                setPaymentMethod(data.payment_method);
            }
            // Fail soft - don't show errors, just use fallback display
        } catch (e) {
            console.log('Failed to fetch billing summary (soft fail):', e);
        } finally {
            setLoadingPaymentMethod(false);
        }
    };

    useEffect(() => {
        if (account?.id) {
            fetchBillingSummary();
        }
    }, [account?.id]);

    const handleCancelTrial = async () => {
        if (!window.confirm("Are you sure you want to cancel your trial? Your phone number will be released.")) {
            return;
        }

        setCancelingTrial(true);
        try {
            const { error } = await supabase.functions.invoke('cancel-subscription', {
                body: { account_id: account.id }
            });

            if (error) throw error;

            toast({
                title: "Subscription Canceled",
                description: "Your subscription has been canceled.",
            });

            // Refresh
            if (onRefresh) onRefresh();
            else window.location.reload();
        } catch (error: any) {
            console.error("Cancellation error:", error);
            toast({
                title: "Error",
                description: "Failed to cancel subscription. Please contact support.",
                variant: "destructive"
            });
        } finally {
            setCancelingTrial(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!window.confirm("Are you sure you want to cancel your subscription? It will end at the current billing period.")) {
            return;
        }

        setCancelingSubscription(true);
        try {
            const { error } = await supabase.functions.invoke('stripe-subscription-cancel', {
                body: { account_id: account.id }
            });

            if (error) throw error;

            toast({
                title: "Subscription Scheduled to Cancel",
                description: "Your subscription will remain active until the end of the billing period.",
            });

            if (onRefresh) onRefresh();
        } catch (error: any) {
            console.error("Cancellation error:", error);
            toast({
                title: "Error",
                description: "Failed to cancel subscription.",
                variant: "destructive"
            });
        } finally {
            setCancelingSubscription(false);
        }
    };

    const handleOpenBillingPortal = async () => {
        setCreatingPortalSession(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-billing-portal-session', {
                body: { account_id: account.id }
            });

            if (error) throw new Error(error.message);

            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (error: any) {
            console.error("Failed to create billing portal session:", error);
            toast({
                title: "Unable to Load Billing Portal",
                description: "Please try again later.",
                variant: "destructive"
            });
        } finally {
            setCreatingPortalSession(false);
        }
    };

    return (
        <div className="space-y-6">
            <PaymentMethodUpdateDialog
                open={updateCardOpen}
                onOpenChange={setUpdateCardOpen}
                accountId={account.id}
                onSuccess={() => {
                    fetchBillingSummary();
                    toast({ title: "Card updated" });
                }}
            />

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Current Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground mr-2">Plan</span>
                                { /* Show Plan Management if active/trial, otherwise just text */}
                                {['active', 'trial', 'past_due'].includes(account.subscription_status) ? (
                                    <PlanManagement account={account} onUpdate={() => onRefresh && onRefresh()} />
                                ) : (
                                    <span className="font-bold capitalize">{account.plan_type}</span>
                                )}
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Status</span>
                                <Badge variant={account.subscription_status === 'active' ? 'default' : 'secondary'}>
                                    {account.subscription_status}
                                </Badge>
                            </div>
                            {account.subscription_status === 'trial' && (
                                <div className="flex justify-between items-center text-amber-600">
                                    <span>Trial Ends In</span>
                                    <span className="font-bold">{trialDaysRemaining} days</span>
                                </div>
                            )}

                            {account.subscription_status === 'active' && (
                                <div className="pt-4">
                                    <Button
                                        variant="outline"
                                        className="w-full text-destructive hover:text-destructive"
                                        onClick={handleCancelSubscription}
                                        disabled={cancelingSubscription}
                                    >
                                        {cancelingSubscription ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel Subscription"}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Credits & Usage</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Credits Balance</span>
                                <span className="font-bold text-green-600">${creditsBalance.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Minutes Used</span>
                                <span className="flex items-center gap-1">{account.monthly_minutes_used} <span className="text-muted-foreground">/ {account.monthly_minutes_limit === -1 ? 'Unlimited' : account.monthly_minutes_limit}</span></span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Method</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-16 bg-slate-100 rounded flex items-center justify-center">
                                <CreditCard className="h-6 w-6 text-slate-400" />
                            </div>
                            <div>
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
                                ) : account.last_4 ? (
                                    <>
                                        <p className="font-medium">•••• •••• •••• {account.last_4}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Expires {account.exp_month || '**'}/{account.exp_year || '**'}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No payment method on file</p>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                className="ml-auto"
                                onClick={() => setUpdateCardOpen(true)}
                            >
                                Update
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Billing History</CardTitle>
                            <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-muted-foreground"
                                onClick={handleOpenBillingPortal}
                                disabled={creatingPortalSession}
                            >
                                {creatingPortalSession ? "Loading..." : "Open Portal"} <ExternalLink className="ml-1 h-3 w-3" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <InvoicesList accountId={account.id} />
                    </CardContent>
                </Card>
            </div>

            {account.subscription_status === 'trial' && (
                <Card className="border-destructive/20 bg-destructive/5">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Canceling your trial will immediately release your phone number and stop your assistant.
                        </p>
                        <Button variant="destructive" onClick={handleCancelTrial} disabled={cancelingTrial}>
                            {cancelingTrial ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Canceling...
                                </>
                            ) : (
                                "Cancel Trial"
                            )}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
