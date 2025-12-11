import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface BillingTabProps {
    account: any;
    trialDaysRemaining: number;
    creditsBalance: number;
}

export function BillingTab({ account, trialDaysRemaining, creditsBalance }: BillingTabProps) {
    const { toast } = useToast();
    const [cancelingTrial, setCancelingTrial] = useState(false);
    const [creatingPortalSession, setCreatingPortalSession] = useState(false);

    const handleCancelTrial = async () => {
        if (!window.confirm("Are you sure you want to cancel your trial? Your phone number will be released.")) {
            return;
        }

        setCancelingTrial(true);
        try {
            const { error } = await supabase
                .from("accounts")
                .update({
                    subscription_status: 'cancelled',
                })
                .eq("id", account.id);

            if (error) throw error;

            toast({
                title: "Trial Canceled",
                description: "Your trial has been canceled. Please refresh the page.",
            });
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Failed to cancel trial. Please contact support.",
                variant: "destructive"
            });
        } finally {
            setCancelingTrial(false);
        }
    };

    const handleOpenBillingPortal = async () => {
        setCreatingPortalSession(true);
        try {
            // Call Stripe to create a billing portal session
            const { data, error } = await supabase.functions.invoke('create-billing-portal-session', {
                body: { account_id: account.id }
            });

            if (error) throw error;

            if (data?.url) {
                // Redirect to Stripe billing portal
                window.location.href = data.url;
            } else {
                throw new Error("No portal URL returned");
            }
        } catch (error: any) {
            console.error("Failed to create billing portal session:", error);
            toast({
                title: "Error",
                description: "Failed to open billing portal. Please contact support.",
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
                                <span>{account.monthly_minutes_used} / {account.monthly_minutes_limit}</span>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleOpenBillingPortal}
                                disabled={creatingPortalSession}
                            >
                                {creatingPortalSession ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    "Add Credits"
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

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
                            <p className="font-medium">•••• •••• •••• {account.last_4 || "****"}</p>
                            <p className="text-xs text-muted-foreground">
                                {account.last_4 ? `Expires ${account.exp_month || "**"}/${account.exp_year || "**"}` : "No payment method on file"}
                            </p>
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
