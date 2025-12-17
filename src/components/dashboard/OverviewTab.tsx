
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
        <div className="space-y-4 sm:space-y-6">
            {/* Stats Cards - 2 cols mobile, 4 cols desktop */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {/* 1. Your Number */}
                <Card className="col-span-2 sm:col-span-1 border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-primary">Your RingSnap Number</CardTitle>
                        <Phone className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold">
                                {(account.vapi_phone_number && account.vapi_phone_number !== "") ? account.vapi_phone_number : "Provisioning..."}
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
                        <CardTitle className="text-sm font-medium">Plan</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-lg font-bold uppercase">{account.plan_type || 'Free'}</span>
                            <Badge variant={account.subscription_status === 'active' ? 'default' : 'secondary'} className="w-fit text-xs">
                                {account.subscription_status}
                            </Badge>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs"
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
                        <CardTitle className="text-sm font-medium">Usage</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="text-lg font-bold">
                            {Math.ceil(usageLogs.reduce((acc, call) => acc + (call.duration_seconds || 0), 0) / 60)}
                            <span className="text-sm font-normal text-muted-foreground"> / {account.monthly_minutes_limit} min</span>
                        </div>
                        <Progress value={usagePercent} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                            {usagePercent}% used
                        </p>
                    </CardContent>
                </Card>

                {/* 4. Trial/Credits */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {account.subscription_status === 'trial' ? 'Trial' : 'Credits'}
                        </CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold">
                            {account.subscription_status === 'trial'
                                ? `${trialDaysRemaining} days`
                                : `$${creditsBalance.toFixed(2)}`}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {account.subscription_status === 'trial' ? 'remaining' : 'available'}
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
                                    <TableHead>Caller</TableHead>
                                    <TableHead className="hidden md:table-cell">Reason</TableHead>
                                    <TableHead>Outcome</TableHead>
                                    <TableHead className="text-right">Duration</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usageLogs.slice(0, 50).map((log: any) => {
                                    // Helper to format appointment info
                                    const getOutcomeBadge = () => {
                                        if (log.outcome === 'booked' || log.booked) {
                                            return <Badge className="bg-green-600 hover:bg-green-700">Booked</Badge>;
                                        }
                                        if (log.outcome === 'lead' || log.lead_captured) {
                                            return <Badge className="bg-blue-600 hover:bg-blue-700">Lead</Badge>;
                                        }
                                        return <Badge variant="secondary" className="capitalize">{log.status}</Badge>;
                                    };

                                    const getAppointmentText = () => {
                                        if (log.appointment_window) return log.appointment_window;
                                        if (log.appointment_start) {
                                            return new Date(log.appointment_start).toLocaleString([], {
                                                weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                            });
                                        }
                                        return null;
                                    };

                                    return (
                                        <TableRow key={log.id}>
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">
                                                        {new Date(log.started_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(log.started_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{log.caller_name || log.from_number || "Unknown"}</span>
                                                    {log.caller_name && <span className="text-xs text-muted-foreground">{log.from_number}</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell max-w-[200px]">
                                                <div className="truncate text-sm" title={log.reason || log.summary}>
                                                    {log.reason || (log.summary ? log.summary.substring(0, 50) + "..." : "-")}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 items-start">
                                                    {getOutcomeBadge()}
                                                    {(log.booked || log.outcome === 'booked') && getAppointmentText() && (
                                                        <span className="text-xs font-medium text-green-700 dark:text-green-400">
                                                            {getAppointmentText()}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {Math.ceil((log.duration_seconds || 0) / 60)} min
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
