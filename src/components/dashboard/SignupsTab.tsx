
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface SignupsTabProps {
    dateFilter: string;
}

export function SignupsTab({ dateFilter }: SignupsTabProps) {
    const getDateThreshold = () => {
        if (dateFilter === "all") return null;
        const days = parseInt(dateFilter);
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    };

    const { data: events = [], isLoading } = useQuery({
        queryKey: ["signup_analytics", dateFilter],
        queryFn: async () => {
            let query = supabase
                .from("analytics_events")
                .select("*")
                .in("event_type", ["signup_started", "trial_created", "trial_creation_failed", "payment_failed"]);

            const threshold = getDateThreshold();
            if (threshold) query = query.gte("created_at", threshold);

            const { data, error } = await query.order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const stats = useMemo(() => {
        const attempts = events.filter((e) => e.event_type === "signup_started").length;
        const successes = events.filter((e) => e.event_type === "trial_created").length;
        // Note: 'trial_creation_failed' events might be multiple per attempt, so just counting raw events here
        // In a real app, we'd correlate by metadata->email or session
        const conversionRate = attempts > 0 ? Math.round((successes / attempts) * 100) : 0;

        return { attempts, successes, conversionRate };
    }, [events]);

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Signup Attempts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.attempts}</div>
                        <p className="text-xs text-muted-foreground">Started signups</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.conversionRate}%</div>
                        <p className="text-xs text-muted-foreground">Trial creation success</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">New Trials</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.successes}</div>
                        <p className="text-xs text-muted-foreground">Successful trials</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Latest signup events and failures.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.slice(0, 10).map((event) => {
                                const meta = event.metadata as any || {};
                                const isError = event.event_type.includes('failed');
                                const isSuccess = event.event_type === 'trial_created';

                                return (
                                    <TableRow key={event.id}>
                                        <TableCell className="font-medium capitalize">
                                            {event.event_type.replace(/_/g, ' ')}
                                        </TableCell>
                                        <TableCell>{meta.email || meta.user_email || '-'}</TableCell>
                                        <TableCell className="capitalize">{meta.plan || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={isError ? "destructive" : isSuccess ? "default" : "secondary"}>
                                                {isError ? "Failed" : isSuccess ? "Success" : "Info"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {new Date(event.created_at).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {events.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">No events found</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
