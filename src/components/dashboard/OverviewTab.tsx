
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Phone, TrendingUp, CheckCircle, AlertCircle, CreditCard, Loader2, Copy, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { featureFlags } from "@/lib/featureFlags";
import { CallDetailsDrawer } from "./CallDetailsDrawer";
import {
    calculateLeadScore,
    getLeadScoreLabel,
    getLeadScoreClasses,
    getLeadScoreReason,
    type CallLog
} from "@/lib/leadScore";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { isBookedCall, getDisplayName, isSentinelValue, formatPhoneNumber } from "@/lib/appointments";

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

    // Date filter state
    const [dateFilter, setDateFilter] = useState<string>("all");

    // Call details drawer state (behind flag)
    const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Filter logs based on date range
    const filteredLogs = useMemo(() => {
        if (dateFilter === "all") return usageLogs;

        const now = new Date();
        let startDate: Date;

        switch (dateFilter) {
            case "3days":
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 3);
                break;
            case "week":
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
                break;
            case "month":
                startDate = new Date(now);
                startDate.setMonth(now.getMonth() - 1);
                break;
            default:
                return usageLogs;
        }

        startDate.setHours(0, 0, 0, 0);
        return usageLogs.filter((log: any) => new Date(log.started_at) >= startDate);
    }, [usageLogs, dateFilter]);

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

    // Handle row click to open drawer (only when flag enabled)
    const handleRowClick = (log: any) => {
        if (!featureFlags.reportingWowEnabled) return;
        setSelectedCall({
            id: log.id,
            caller_name: log.caller_name,
            caller_phone: log.from_number,
            duration_seconds: log.duration_seconds,
            reason: log.reason,
            transcript_summary: log.summary,
            booked: log.booked,
            lead_captured: log.lead_captured,
            outcome: log.outcome,
        });
        setDrawerOpen(true);
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Stats Cards - 2 cols mobile, 3 cols desktop */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                {/* 1. Your Number */}
                <Card className="col-span-2 sm:col-span-1 border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-primary">Your RingSnap Number</CardTitle>
                        <Phone className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold">
                                {(account.vapi_phone_number && account.vapi_phone_number !== "") ? formatPhoneNumber(account.vapi_phone_number) : "Provisioning..."}
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

                {/* Credits card removed per user request */}
            </div>

            {/* Recent Calls Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle>Recent Activity</CardTitle>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Filter by date" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="3days">Last 3 Days</SelectItem>
                            <SelectItem value="week">This Week</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    {filteredLogs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No calls yet</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Caller</TableHead>
                                    <TableHead className="hidden md:table-cell">Reason</TableHead>
                                    <TableHead>Outcome</TableHead>
                                    {featureFlags.reportingWowEnabled && (
                                        <TableHead className="hidden sm:table-cell">Score</TableHead>
                                    )}
                                    <TableHead className="text-right">Duration</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.slice(0, 50).map((log: any) => {
                                    // Use shared detection for booked status
                                    const getOutcomeBadge = () => {
                                        if (isBookedCall(log)) {
                                            return <Badge className="bg-green-600 hover:bg-green-700">Booked</Badge>;
                                        }
                                        if (log.outcome === 'lead' || log.lead_captured) {
                                            return <Badge className="bg-blue-600 hover:bg-blue-700">Lead</Badge>;
                                        }
                                        if (log.status === 'completed' || log.status === 'ended') {
                                            return <Badge variant="secondary">Completed</Badge>;
                                        }
                                        return <Badge variant="secondary" className="capitalize">{log.status || 'Call'}</Badge>;
                                    };

                                    // Summarize reason to a few words
                                    const getSummarizedReason = () => {
                                        const text = log.reason || log.summary || '';
                                        if (!text) return '-';
                                        const firstSentence = text.split(/[.!?]/)[0];
                                        if (firstSentence.length > 50) {
                                            return firstSentence.substring(0, 47) + '...';
                                        }
                                        return firstSentence || text.substring(0, 50);
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

                                    // Lead score calculation (only when flag enabled)
                                    const score = featureFlags.reportingWowEnabled
                                        ? calculateLeadScore({
                                            booked: log.booked,
                                            lead_captured: log.lead_captured,
                                            outcome: log.outcome,
                                            reason: log.reason,
                                            duration_seconds: log.duration_seconds,
                                        })
                                        : 0;
                                    const scoreLabel = getLeadScoreLabel(score);
                                    const scoreClasses = getLeadScoreClasses(score);
                                    const scoreReason = getLeadScoreReason({
                                        booked: log.booked,
                                        lead_captured: log.lead_captured,
                                        outcome: log.outcome,
                                        reason: log.reason,
                                        duration_seconds: log.duration_seconds,
                                    });

                                    return (
                                        <TableRow
                                            key={log.id}
                                            className={featureFlags.reportingWowEnabled ? "cursor-pointer hover:bg-muted/50" : ""}
                                            onClick={() => handleRowClick(log)}
                                        >
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
                                                    <span className="font-semibold">
                                                        {getDisplayName(log)}
                                                    </span>
                                                    {!isSentinelValue(log.caller_name) && log.from_number && !isSentinelValue(log.from_number) && (
                                                        <span className="text-xs text-muted-foreground">{formatPhoneNumber(log.from_number)}</span>
                                                    )}
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
                                            {featureFlags.reportingWowEnabled && (
                                                <TableCell className="hidden sm:table-cell">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border cursor-help ${scoreClasses}`}>
                                                                {score}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-[200px]">
                                                            <p className="font-medium">{scoreLabel}</p>
                                                            <p className="text-xs">{scoreReason}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                            )}
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

            {/* Call Details Drawer (behind flag) */}
            {featureFlags.reportingWowEnabled && (
                <CallDetailsDrawer
                    open={drawerOpen}
                    onOpenChange={setDrawerOpen}
                    call={selectedCall}
                />
            )}
        </div>
    );
}

