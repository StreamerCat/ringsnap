
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface SystemHealthTabProps {
    dateFilter: string;
}

export function SystemHealthTab({ dateFilter }: SystemHealthTabProps) {
    const getDateThreshold = () => {
        if (dateFilter === "all") return null;
        const days = parseInt(dateFilter);
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    };

    // Fetch failures
    const { data: failures = [], isLoading } = useQuery({
        queryKey: ["health_analytics", dateFilter],
        queryFn: async () => {
            let query = supabase
                .from("analytics_events")
                .select("*")
                .ilike("event_type", "%failed%"); // Fetch all failures

            const threshold = getDateThreshold();
            if (threshold) query = query.gte("created_at", threshold);

            const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
            if (error) throw error;
            return data;
        },
    });

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const totalFailures = failures.length;
    const uniqueAccounts = new Set(failures.map(f => f.account_id)).size;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Provisioning & System Failures</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{totalFailures}</div>
                        <p className="text-xs text-muted-foreground">In selected period</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Affected Accounts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{uniqueAccounts}</div>
                        <p className="text-xs text-muted-foreground">Accounts with issues</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Critical Events</CardTitle>
                    <CardDescription>Failures logged by the system.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event Type</TableHead>
                                <TableHead>Error Details</TableHead>
                                <TableHead>Account</TableHead>
                                <TableHead className="text-right">Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {failures.map((event) => {
                                const meta = event.metadata as any || {};
                                return (
                                    <TableRow key={event.id}>
                                        <TableCell>
                                            <Badge variant="destructive">{event.event_type}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[300px] truncate" title={meta.error || JSON.stringify(meta)}>
                                            {meta.error || "See metadata"}
                                        </TableCell>
                                        <TableCell>
                                            {meta.email ? meta.email : event.account_id ? <span className="text-xs font-mono">{event.account_id.slice(0, 8)}...</span> : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {new Date(event.created_at).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {failures.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2 py-4">
                                            <CheckCircle className="h-8 w-8 text-green-500" />
                                            <span>All systems healthy. No failures recorded.</span>
                                        </div>
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
