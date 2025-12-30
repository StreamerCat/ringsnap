
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, MapPin, User, FileText, CalendarDays, Phone, ChevronRight, Calendar } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, addDays, addWeeks, addMonths } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhoneNumber } from "@/lib/utils";
import {
    isBookedCall,
    deriveAppointmentEvents,
    getDisplayName,
    getDisplayAddress,
    getJobType,
    type CallLogWithAppointment,
    type AppointmentEvent,
} from "@/lib/appointments";
import { CallDetailsDrawer } from "./CallDetailsDrawer";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppointmentsTabProps {
    accountId: string;
}

type TimeframeMode = 'day' | 'week' | 'month';
type ViewMode = 'list' | 'calendar';

/**
 * Unified Appointments Tab
 * 
 * This component displays appointments from TWO sources:
 * 1. Booked calls from call_logs (primary, always works)
 * 2. Appointments table entries (if they exist)
 * 
 * This ensures users see their booked appointments immediately,
 * regardless of which data path created them.
 */
export function AppointmentsTab({ accountId }: AppointmentsTabProps) {
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<TimeframeMode>('week');
    const [calls, setCalls] = useState<CallLogWithAppointment[]>([]);
    const [tableAppointments, setTableAppointments] = useState<any[]>([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<AppointmentEvent | null>(null);
    const [selectedCall, setSelectedCall] = useState<CallLogWithAppointment | null>(null);
    const isMobile = useIsMobile();

    // Fetch both call_logs (booked) and appointments table data
    useEffect(() => {
        const fetchData = async () => {
            if (!accountId) return;
            setLoading(true);

            try {
                // Calculate date range based on timeframe
                const now = new Date();
                let startDate: Date;
                let endDate: Date;

                switch (timeframe) {
                    case 'day':
                        startDate = startOfDay(now);
                        endDate = endOfDay(addDays(now, 7)); // Show today through next 7 days for "upcoming"
                        break;
                    case 'week':
                        startDate = startOfWeek(now);
                        endDate = endOfDay(addWeeks(now, 2)); // This week plus next
                        break;
                    case 'month':
                        startDate = startOfMonth(now);
                        endDate = endOfDay(addMonths(now, 1)); // This month plus next
                        break;
                }

                // Fetch booked calls from call_logs
                const { data: callsData, error: callsError } = await supabase
                    .rpc('get_recent_calls', { p_account_id: accountId, p_limit: 100 });

                if (callsError) {
                    console.error('Error fetching calls:', callsError);
                } else {
                    // Filter to booked calls within timeframe
                    const bookedCalls = (callsData || []).filter((call: CallLogWithAppointment) => {
                        if (!isBookedCall(call)) return false;

                        // Check if appointment is in timeframe (by appointment_start or call date)
                        const appointmentDate = call.appointment_start
                            ? new Date(call.appointment_start)
                            : new Date(call.started_at || Date.now());
                        const callDate = new Date(call.started_at || Date.now());

                        // Include if appointment is in future OR if call was in timeframe
                        return appointmentDate >= startDate || callDate >= startDate;
                    });

                    setCalls(bookedCalls);
                }

                // Also try to fetch from appointments table (may be empty)
                try {
                    const { data: appointmentsData, error: appointmentsError } = await supabase
                        .from("appointments")
                        .select("*")
                        .eq("account_id", accountId)
                        .gte("scheduled_start_at", startDate.toISOString())
                        .order("scheduled_start_at", { ascending: true });

                    if (!appointmentsError) {
                        setTableAppointments(appointmentsData || []);
                    }
                } catch (e) {
                    // Appointments table might not have scheduled_start_at column on older schemas
                    console.warn('Could not fetch from appointments table:', e);
                }

            } catch (err) {
                console.error("Error fetching appointment data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [accountId, timeframe, refreshTrigger]);

    // Realtime subscription for calls
    useEffect(() => {
        if (!accountId) return;

        const subscription = supabase
            .channel('appointments_calls_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'call_logs',
                filter: `account_id=eq.${accountId}`
            }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments',
                filter: `account_id=eq.${accountId}`
            }, () => {
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [accountId]);

    // Derive appointment events from calls
    const derivedEvents = useMemo(() => {
        return deriveAppointmentEvents(calls);
    }, [calls]);

    // Merge with table appointments (dedupe by call_log_id if linked)
    const allEvents = useMemo(() => {
        const events = [...derivedEvents];

        // Add table appointments that don't already have a matching call
        const callLogIds = new Set(derivedEvents.map(e => e.sourceCallId).filter(Boolean));

        for (const apt of tableAppointments) {
            if (apt.call_log_id && callLogIds.has(apt.call_log_id)) {
                continue; // Already have this from call_logs
            }

            // Convert table appointment to AppointmentEvent format
            events.push({
                id: apt.id,
                sourceCallId: apt.call_log_id || '',
                customerName: apt.caller_name || apt.customer_name || 'Unknown',
                customerPhone: apt.caller_phone || apt.customer_phone || '',
                address: apt.address || 'Address not provided',
                jobType: apt.service_type || apt.job_type || 'Appointment',
                hasDateTime: !!apt.scheduled_start_at,
                inferred: false,
                start: apt.scheduled_start_at ? new Date(apt.scheduled_start_at) : undefined,
                displayWhen: apt.scheduled_start_at
                    ? format(new Date(apt.scheduled_start_at), "h:mm a")
                    : apt.window_description || 'Time TBD',
                callStartedAt: apt.created_at || new Date().toISOString(),
            });
        }

        // Sort by appointment time (soonest first), then by created date
        return events.sort((a, b) => {
            if (a.start && b.start) {
                return a.start.getTime() - b.start.getTime();
            }
            if (a.start) return -1;
            if (b.start) return 1;
            return new Date(b.callStartedAt).getTime() - new Date(a.callStartedAt).getTime();
        });
    }, [derivedEvents, tableAppointments]);

    // Filter events by timeframe for display
    const displayEvents = useMemo(() => {
        const now = new Date();

        return allEvents.filter(event => {
            // For "upcoming" view, show all future events or recent with TBD time
            if (!event.start) {
                // TBD appointments - show if created recently
                const createdDate = new Date(event.callStartedAt);
                const daysSinceCreated = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

                switch (timeframe) {
                    case 'day': return daysSinceCreated <= 7;
                    case 'week': return daysSinceCreated <= 14;
                    case 'month': return daysSinceCreated <= 30;
                }
            }

            // For timed appointments
            const eventDate = event.start;
            const startOfToday = startOfDay(now);

            switch (timeframe) {
                case 'day':
                    // Today and next 7 days
                    return eventDate >= startOfToday && eventDate <= addDays(now, 7);
                case 'week':
                    // This week and next
                    return eventDate >= startOfWeek(now) && eventDate <= addWeeks(now, 2);
                case 'month':
                    // This month and next
                    return eventDate >= startOfMonth(now) && eventDate <= addMonths(now, 2);
            }
        });
    }, [allEvents, timeframe]);

    // Handle event click
    const handleEventClick = (event: AppointmentEvent) => {
        setSelectedEvent(event);

        // Find the source call for rich details
        const sourceCall = calls.find(c => c.id === event.sourceCallId);
        if (sourceCall) {
            setSelectedCall(sourceCall);
        } else {
            setSelectedCall(null);
        }

        setDrawerOpen(true);
    };

    const getTimeframeLabel = () => {
        switch (timeframe) {
            case 'day': return 'Upcoming (7 days)';
            case 'week': return 'Next 2 Weeks';
            case 'month': return 'Next 2 Months';
            default: return 'Appointments';
        }
    };

    if (loading && displayEvents.length === 0) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            Appointments
                        </CardTitle>
                        <CardDescription>
                            Showing {displayEvents.length} appointment{displayEvents.length !== 1 ? 's' : ''} for {getTimeframeLabel().toLowerCase()}
                        </CardDescription>
                    </div>
                    <div className="w-full sm:w-[180px]">
                        <Select value={timeframe} onValueChange={(v: TimeframeMode) => setTimeframe(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select timeframe" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="day">Upcoming (7 days)</SelectItem>
                                <SelectItem value="week">Next 2 Weeks</SelectItem>
                                <SelectItem value="month">Next 2 Months</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {displayEvents.length === 0 ? (
                        <div className="text-center py-12 px-4 border-2 border-dashed rounded-lg">
                            <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                            <h3 className="text-sm font-medium text-foreground mb-1">No appointments found</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                When calls result in booked appointments, they'll appear here.
                            </p>
                            {timeframe === 'day' && (
                                <button
                                    onClick={() => setTimeframe('month')}
                                    className="text-primary text-xs hover:underline"
                                >
                                    Try viewing next 2 months &rarr;
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {displayEvents.map((event) => (
                                <AppointmentCard
                                    key={event.id}
                                    event={event}
                                    onClick={() => handleEventClick(event)}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Call Details Drawer */}
            <CallDetailsDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                call={selectedCall ? {
                    id: selectedCall.id || '',
                    caller_name: selectedEvent?.customerName || undefined,
                    caller_phone: selectedEvent?.customerPhone || undefined,
                    duration_seconds: selectedCall.duration_seconds,
                    reason: selectedEvent?.jobType,
                    transcript_summary: selectedCall.summary,
                    booked: true,
                    lead_captured: selectedCall.lead_captured,
                    outcome: selectedCall.outcome,
                } : selectedEvent ? {
                    id: selectedEvent.sourceCallId,
                    caller_name: selectedEvent.customerName,
                    caller_phone: selectedEvent.customerPhone,
                    reason: selectedEvent.jobType,
                    booked: true,
                } : null}
                side={isMobile ? "bottom" : "right"}
            />
        </div>
    );
}

/**
 * Individual appointment card component
 */
function AppointmentCard({
    event,
    onClick
}: {
    event: AppointmentEvent;
    onClick?: () => void;
}) {
    const statusBadge = event.hasDateTime && event.start
        ? (event.start > new Date() ? 'upcoming' : 'past')
        : 'pending';

    return (
        <button
            onClick={onClick}
            className="w-full text-left border rounded-lg p-4 space-y-3 transition-all hover:bg-accent/50 hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary group"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                    {/* Date/Time Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                            variant={statusBadge === 'upcoming' ? 'default' : statusBadge === 'past' ? 'secondary' : 'outline'}
                            className={statusBadge === 'upcoming' ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                            {statusBadge === 'upcoming' ? 'Upcoming' : statusBadge === 'past' ? 'Past' : 'Time TBD'}
                        </Badge>
                        {event.hasDateTime && event.start ? (
                            <span className="font-semibold text-base flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {format(event.start, "EEE, MMM d 'at' h:mm a")}
                            </span>
                        ) : (
                            <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                                {event.displayWhen}
                            </span>
                        )}
                        {event.inferred && (
                            <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-amber-50 text-amber-700 border-amber-200">
                                Estimated
                            </Badge>
                        )}
                    </div>

                    {/* Customer Row */}
                    <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{event.customerName}</span>
                        {event.customerPhone && (
                            <span className="text-muted-foreground hidden sm:inline">
                                ({formatPhoneNumber(event.customerPhone)})
                            </span>
                        )}
                    </div>

                    {/* Service Type */}
                    <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-current shrink-0" />
                        {event.jobType}
                    </div>

                    {/* Address */}
                    {event.address !== 'Address not provided' && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                            <span className="truncate">{event.address}</span>
                        </div>
                    )}
                </div>

                {/* Arrow indicator */}
                <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 mt-1" />
            </div>
        </button>
    );
}
