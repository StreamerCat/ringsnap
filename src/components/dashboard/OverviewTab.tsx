
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Phone, TrendingUp, CheckCircle, AlertCircle, CreditCard, Loader2, Copy, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { featureFlags } from "@/lib/featureFlags";

interface OverviewTabProps {
    account: any;
    usageLogs: any[];
    usagePercent: number;
    remainingMinutes: number;
    trialDaysRemaining: number;
    creditsBalance: number;
    onOpenUpgradeModal?: () => void;
}

export function OverviewTab({
    account,
    usageLogs,
    usagePercent,
    trialDaysRemaining,
    creditsBalance,
    onOpenUpgradeModal
}: OverviewTabProps) {
    const [billingLoading, setBillingLoading] = useState(false);

    const handleManageBilling = async () => {
        setBillingLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-billing-portal-session', {
                body: { account_id: account?.id }
            });
            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error("No URL returned from billing session");
            }
        } catch (error) {
            console.error("Billing portal error:", error);
            toast.error("Could not open billing portal. Please try again.");
        } finally {
            setBillingLoading(false);
        }
    };

    const copyPhoneNumber = () => {
        if (account?.vapi_phone_number) {
            navigator.clipboard.writeText(account.vapi_phone_number);
            toast.success("Number copied!");
        }
    };

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* 1. Your Number (New) - Spans 2 cols on large if needed, or just 1 */}
                <Card className="col-span-1 border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-primary">Your RingSnap Number</CardTitle>
                        <Phone className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold">
                                {account.vapi_phone_number || "Provisioning..."}
                            </div>
                            {account.vapi_phone_number && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyPhoneNumber}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            Call this number to test your assistant.
                        </p>
                    </CardContent>
                </Card>

                {/* 2. Account Status & Billing */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Plan & Billing</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <Badge variant={account.subscription_status === 'active' ? 'default' : 'secondary'}>
                                {account.subscription_status}
                            </Badge>
                            <span className="text-sm font-medium uppercase text-muted-foreground">{account.plan_type}</span>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-3 h-8"
                            onClick={() => {
                                if (featureFlags.upgradeModalEnabled && onOpenUpgradeModal) {
                                    onOpenUpgradeModal();
                                } else {
                                    handleManageBilling();
                                }
                            }}
                            disabled={billingLoading}
                        >
                            {billingLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <>
                                    <ArrowUpRight className="h-3 w-3 mr-1" />
                                    Upgrade
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* 3. Monthly Usage */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {account.monthly_minutes_used} / {account.monthly_minutes_limit}
                        </div>
                        <Progress value={usagePercent} className="mt-2" />
                        <p className="text-xs text-muted-foreground mt-2">
                            {usagePercent}% used this cycle
                        </p>
                    </CardContent>
                </Card>

                {/* 4. Trial/Credits */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {account.subscription_status === 'trial' ? 'Trial Days Left' : 'Credits Balance'}
                        </CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {account.subscription_status === 'trial' ? trialDaysRemaining : `$${creditsBalance.toFixed(2)}`}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {account.subscription_status === 'trial' ? 'Upgrade to continue' : 'Available credits'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Calls Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    {usageLogs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No calls yet</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Customer Phone</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usageLogs.slice(0, 10).map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell>{log.customer_phone || 'Unknown'}</TableCell>
                                        <TableCell>{Math.ceil(log.call_duration_seconds / 60)} min</TableCell>
                                        <TableCell>
                                            {log.appointment_booked ? (
                                                <Badge variant="default" className="bg-green-600">Appointment</Badge>
                                            ) : log.was_emergency ? (
                                                <Badge variant="destructive">Emergency</Badge>
                                            ) : (
                                                <Badge variant="secondary">Call</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
