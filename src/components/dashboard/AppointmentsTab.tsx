
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, MapPin, User, FileText, CalendarDays } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhoneNumber } from "@/lib/utils";

interface AppointmentsTabProps {
    accountId: string;
}

export function AppointmentsTab({ accountId }: AppointmentsTabProps) {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('day');
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const fetchAppointments = async () => {
            setLoading(true);
            try {
                let query = supabase
                    .from("appointments")
                    .select("*")
                    .eq("account_id", accountId)
                    .order("scheduled_start_at", { ascending: true }); // Show earliest/upcoming first

                const now = new Date();

                if (timeframe === 'day') {
                    // Day View: Booked Today OR Scheduled Today/Future
                    const startOfToday = startOfDay(now).toISOString();
                    // We want to capture things happening today onwards, or things that were created today.
                    // Note: Supabase OR syntax with ranges needs to be formatted carefully.
                    // This creates a filter: (created_at >= startOfToday) OR (scheduled_start_at >= startOfToday)
                    query = query.or(`created_at.gte.${startOfToday},scheduled_start_at.gte.${startOfToday}`);
                } else if (timeframe === 'week') {
                    // Week View: Booked within this week
                    const startWeek = startOfWeek(now).toISOString();
                    query = query.gte('created_at', startWeek);
                } else if (timeframe === 'month') {
                    // Month View: Booked within this month
                    const startMonth = startOfMonth(now).toISOString();
                    query = query.gte('created_at', startMonth);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Supabase query error:', error);
                    throw error;
                }
                setAppointments(data || []);
            } catch (err) {
                console.error("Error fetching appointments:", err);
            } finally {
                setLoading(false);
            }
        };

        if (accountId) fetchAppointments();
    }, [accountId, timeframe, refreshTrigger]);

    // Realtime subscription setup
    useEffect(() => {
        if (!accountId) return;

        const subscription = supabase
            .channel('appointments_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments',
                filter: `account_id=eq.${accountId}`
            }, () => {
                // Trigger refresh when data changes
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [accountId]);

    const getTimeframeLabel = () => {
        switch (timeframe) {
            case 'day': return 'Today & Upcoming';
            case 'week': return 'Booked This Week';
            case 'month': return 'Booked This Month';
            default: return 'Appointments';
        }
    };

    if (loading && appointments.length === 0) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                    <div className="space-y-1">
                        <CardTitle>Appointments</CardTitle>
                        <CardDescription>
                            {timeframe === 'day'
                                ? "Showing active appointments and recent bookings."
                                : `Showing appointments booked during this ${timeframe}.`}
                        </CardDescription>
                    </div>
                    <div className="w-full sm:w-[180px]">
                        <Select value={timeframe} onValueChange={(v: any) => setTimeframe(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select timeframe" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="day">Day View</SelectItem>
                                <SelectItem value="week">This Week</SelectItem>
                                <SelectItem value="month">This Month</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {appointments.length === 0 ? (
                        <div className="text-center py-12 px-4 border-2 border-dashed rounded-lg">
                            <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                            <h3 className="text-sm font-medium text-foreground mb-1">No appointments found</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                No appointments found for {getTimeframeLabel().toLowerCase()}.
                            </p>
                            {timeframe === 'day' && (
                                <button
                                    onClick={() => setTimeframe('month')}
                                    className="text-primary text-xs hover:underline"
                                >
                                    Try viewing This Month &rarr;
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {appointments.map((apt) => (
                                <div key={apt.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg gap-4 bg-card hover:bg-accent/5 transition-colors">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant={apt.status === 'scheduled' ? 'default' : apt.status === 'canceled' ? 'destructive' : 'secondary'} className="capitalize">
                                                {apt.status}
                                            </Badge>
                                            <span className="font-semibold text-base flex items-center gap-1">
                                                {apt.scheduled_start_at
                                                    ? format(new Date(apt.scheduled_start_at), "EEE, MMM d, yyyy 'at' h:mm a")
                                                    : <span className="text-muted-foreground italic">Unscheduled</span>
                                                }
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{apt.caller_name || "Unknown Caller"}</span>
                                            <span className="text-muted-foreground">
                                                ({formatPhoneNumber(apt.caller_phone || "")})
                                            </span>
                                        </div>
                                        {apt.service_type && (
                                            <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full bg-current" />
                                                {apt.service_type}
                                            </div>
                                        )}
                                        {apt.address && (
                                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                                                <span>{apt.address}</span>
                                            </div>
                                        )}
                                        {/* Show booking time context if in Week/Month view */}
                                        {timeframe !== 'day' && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Booked {format(new Date(apt.created_at), "MMM d")}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Side: Notes */}
                                    {apt.notes && (
                                        <div className="bg-muted/50 p-3 rounded-md text-sm max-w-md w-full sm:w-64 border">
                                            <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                                <FileText className="w-3 h-3" />
                                                <span className="text-[10px] font-semibold uppercase tracking-wider">Notes</span>
                                            </div>
                                            <p className="whitespace-pre-wrap text-foreground/90 text-xs">{apt.notes}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
