
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface UsageTabProps {
    dateFilter: string;
}

export function UsageTab({ dateFilter }: UsageTabProps) {
    const getDateThreshold = () => {
        if (dateFilter === "all") return null;
        const days = parseInt(dateFilter);
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    };

    const { data: usageData = [], isLoading } = useQuery({
        queryKey: ["network_usage", dateFilter],
        queryFn: async () => {
            // Query the view if it exists, or raw events. 
            // Using daily_account_usage view
            let query = supabase
                .from("daily_account_usage")
                .select("*");

            const threshold = getDateThreshold();
            if (threshold) query = query.gte("date", threshold);

            const { data, error } = await query;
            if (error) {
                console.error("Failed to fetch usage:", error);
                return [];
            }
            return data;
        },
    });

    const totals = useMemo(() => {
        return usageData.reduce(
            (acc, curr) => ({
                calls: acc.calls + (curr.total_calls || 0),
                minutes: acc.minutes + (curr.total_minutes || 0),
                leads: acc.leads + (curr.total_leads || 0)
            }),
            { calls: 0, minutes: 0, leads: 0 }
        );
    }, [usageData]);

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totals.calls}</div>
                        <p className="text-xs text-muted-foreground">In selected period</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Minutes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Math.round(totals.minutes)}</div>
                        <p className="text-xs text-muted-foreground">Billed usage</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Qualified Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totals.leads}</div>
                        <p className="text-xs text-muted-foreground">From calls</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Usage Trends</CardTitle>
                    <CardDescription>
                        {usageData.length === 0
                            ? "No usage data found for this period."
                            : "Aggregated network usage."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                    {/* Placeholder for a chart library like Recharts */}
                    {usageData.length > 0 ? (
                        <div className="text-sm">
                            Data points available: {usageData.length}. Charting library needed for visualization.
                        </div>
                    ) : (
                        "No data to display"
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
