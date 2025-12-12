import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertCircle, Loader2, ExternalLink, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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
}

export function BillingTab({ account, trialDaysRemaining, creditsBalance }: BillingTabProps) {
    const { toast } = useToast();
    const [cancelingTrial, setCancelingTrial] = useState(false);
    const [creatingPortalSession, setCreatingPortalSession] = useState(false);

    // Payment method state - fetched from Stripe
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
    const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(true);

    // Fetch payment method from Stripe (fail soft)
    useEffect(() => {
        const fetchBillingSummary = async () => {
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
                description: "Your subscription has been canceled. The page will reload.",
            });

            // Reload to reflect new status
            setTimeout(() => window.location.reload(), 1500);
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

    const handleOpenBillingPortal = async () => {
        setCreatingPortalSession(true);
        try {
            // Debug: Log auth state before call
            const { data: sessionData } = await supabase.auth.getSession();
            console.log("Current session token:", sessionData.session?.access_token ? "Last 4 chars: " + sessionData.session.access_token.slice(-4) : "No token found");

            // Call Stripe to create a billing portal session
            const { data, error } = await supabase.functions.invoke('create-billing-portal-session', {
                body: { account_id: account.id }
            });

            if (error) {
                console.error("Full invoke error object:", error); // Log full object for debugging
                // Try to parse the error message from the response if it's structured
                let errorMessage = "Failed to open billing portal. Please contact support.";
                try {
                    // Check if context has response body
                    if (error.context && typeof error.context.json === 'function') {
                        const body = await error.context.json();
                        console.log("Error response body:", body);
                        if (body.error) errorMessage = body.error;
                    } else if (error.message) {
                        try {
                            const parsed = JSON.parse(error.message);
                            if (parsed.error) errorMessage = parsed.error;
                            else errorMessage = error.message;
                        } catch {
                            errorMessage = error.message;
                        }
                    }
                } catch (e) {
                    console.warn("Could not parse error details", e);
                }

                throw new Error(errorMessage);
            }

            if (data?.url) {
                // Redirect to Stripe billing portal
                window.location.href = data.url;
            } else {
                throw new Error("No portal URL returned from server");
            }
        } catch (error: any) {
            console.error("Failed to create billing portal session:", error);
            toast({
                title: "Unable to Load Billing Portal",
                description: error.message || "An unknown error occurred.",
                variant: "destructive"
            });
            setCreatingPortalSession(false);
        }
    };

    const handleUpgradePlan = async () => {
        // For now, redirect to billing portal where they can manage subscription
        await handleOpenBillingPortal();
    };

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Current Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Plan</span>
                                <span className="font-bold capitalize">{account.plan_type}</span>
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
                            <div className="pt-4">
                                <Button
                                    className="w-full"
                                    onClick={handleUpgradePlan}
                                    disabled={creatingPortalSession}
                                >
                                    {creatingPortalSession ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        <>
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Manage Subscription
                                        </>
                                    )}
                                </Button>
                            </div>
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
                            {/* Add Credits removed for MVP */}
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
                                onClick={handleOpenBillingPortal}
                                disabled={creatingPortalSession}
                            >
                                {creatingPortalSession ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Update"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Billing History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center">
                                <FileText className="h-5 w-5 text-slate-500" />
                            </div>
                            <div>
                                <p className="font-medium">Invoices & Receipts</p>
                                <p className="text-xs text-muted-foreground">
                                    View your complete billing history on Stripe.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="ml-auto"
                                onClick={handleOpenBillingPortal}
                                disabled={creatingPortalSession}
                            >
                                {creatingPortalSession ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "View Invoices"
                                )}
                            </Button>
                        </div>
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
