import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle, Phone, CreditCard, Server } from "lucide-react";

export function SystemHealthTab() {
    const { data: events = [], isLoading } = useQuery({
        queryKey: ["system_health_analytics"],
        queryFn: async () => {
            // Last 24 hours
            const date = new Date();
            date.setHours(date.getHours() - 24);
            const threshold = date.toISOString();

            // Fetch broad range of events for health metrics
            const { data, error } = await supabase
                .from("analytics_events")
                .select("*")
                .gte("created_at", threshold)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data;
        },
        refetchInterval: 60000, // Refresh every minute
    });

    const metrics = useMemo(() => {
        const stripe = {
            failures: 0,
            events: [] as any[]
        };
        const provisioning = {
            started: 0,
            completed: 0,
            failed: 0,
            events: [] as any[]
        };
        const telephony = {
            total: 0,
            failed: 0,
            events: [] as any[]
        };

        events.forEach(ev => {
            const type = ev.event_type;
            const isError = type.includes('failed') || type.includes('error');

            if (type.includes('payment') || type.includes('stripe') || type.includes('subscription')) {
                if (isError) stripe.failures++;
                stripe.events.push(ev);
            } else if (type.includes('provisioning')) {
                if (type.includes('started')) provisioning.started++;
                if (type.includes('completed')) provisioning.completed++;
                if (type.includes('failed')) provisioning.failed++;
                provisioning.events.push(ev);
            } else if (type.includes('call') || type.includes('vapi')) {
                telephony.total++;
                if (isError) telephony.failed++;
                telephony.events.push(ev);
            }
        });

        // Critical errors list (last 20 failures across all systems)
        const criticalErrors = events
            .filter(ev => ev.event_type.includes('failed') || ev.event_type.includes('error'))
            .slice(0, 20);

        return { stripe, provisioning, telephony, criticalErrors };
    }, [events]);

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight">System Health (Last 24 Hours)</h2>

            <div className="grid gap-4 md:grid-cols-3">
                {/* Stripe Health */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Stripe Health</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            {metrics.stripe.failures > 0 ? (
                                <span className="text-destructive">{metrics.stripe.failures} Failures</span>
                            ) : (
                                <span className="text-green-600">Healthy</span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Payment & Subscription errors
                        </p>
                    </CardContent>
                </Card>

                {/* Provisioning Health */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Provisioning Health</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-sm">
                                <span>Started:</span>
                                <span className="font-bold">{metrics.provisioning.started}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Completed:</span>
                                <span className="font-bold text-green-600">{metrics.provisioning.completed}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Failed:</span>
                                <span className={`font-bold ${metrics.provisioning.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                    {metrics.provisioning.failed}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Telephony Health */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Telephony Health</CardTitle>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            {metrics.telephony.total} <span className="text-sm font-normal text-muted-foreground">Calls</span>
                        </div>
                        <p className="text-xs mt-1 flex items-center gap-2">
                            Failed:
                            <span className={metrics.telephony.failed > 0 ? "text-destructive font-bold" : "text-green-600 font-bold"}>
                                {metrics.telephony.failed}
                            </span>
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Critical Errors List */}
            <Card className="border-destructive/20">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <CardTitle>Recent Critical Errors</CardTitle>
                    </div>
                    <CardDescription>
                        Last 20 system failures and errors.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Error</TableHead>
                                <TableHead>Account / Context</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {metrics.criticalErrors.map((ev) => {
                                const meta = ev.metadata || {};
                                return (
                                    <TableRow key={ev.id}>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {new Date(ev.created_at).toLocaleTimeString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {ev.event_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-md">
                                            <span className="text-sm font-medium text-destructive">
                                                {meta.error || meta.message || "Unknown error"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {ev.account_id ? `Acc: ${ev.account_id.slice(0, 8)}...` : meta.email || "-"}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {metrics.criticalErrors.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-green-600 flex flex-col items-center gap-2">
                                        <CheckCircle className="h-8 w-8" />
                                        <span>No critical errors in the last 24 hours.</span>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
