import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Calendar, Clock, MapPin, ChevronRight, List, CalendarDays, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    deriveTopicLabels,
    formatTopicDisplay,
    sanitizeCallText,
} from '@/lib/call-text-utils';
import {
    type CallLogWithAppointment,
    getDisplayName,
    getDisplayAddress,
    getAppointmentDisplay,
    formatPhoneNumber,
    isBookedCall,
    deriveAppointmentEvents,
    type AppointmentEvent
} from '@/lib/appointments';
import { CallDetailsDrawer } from './CallDetailsDrawer';

interface ScheduleTabProps {
    calls: CallLogWithAppointment[];
    companyName?: string;
}

/**
 * Schedule Tab - Shows booked appointments
 * Default: Upcoming list (today + 7 days)
 * Toggle: Week/Month calendar view
 * TBD section for items without structured time
 */
export function ScheduleTab({ calls, companyName }: ScheduleTabProps) {
    const [selectedCall, setSelectedCall] = useState<CallLogWithAppointment | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

    // Derive appointments from calls
    const { upcoming, tbd, past } = useMemo(() => {
        const events = deriveAppointmentEvents(calls);
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Separate into structured and TBD
        const structured = events.filter(e => e.hasDateTime && e.start);
        const tbdEvents = events.filter(e => !e.hasDateTime);

        // Upcoming = structured with start in next 7 days
        const upcomingEvents = structured
            .filter(e => e.start && e.start >= now && e.start <= weekFromNow)
            .sort((a, b) => (a.start?.getTime() || 0) - (b.start?.getTime() || 0));

        // Past = structured with start before now
        const pastEvents = structured
            .filter(e => e.start && e.start < now)
            .sort((a, b) => (b.start?.getTime() || 0) - (a.start?.getTime() || 0));

        return {
            upcoming: upcomingEvents,
            tbd: tbdEvents,
            past: pastEvents
        };
    }, [calls]);

    // Find call by event source
    const findCallForEvent = (event: AppointmentEvent): CallLogWithAppointment | undefined => {
        return calls.find(c => c.id === event.sourceCallId);
    };

    return (
        <div className="space-y-6">
            {/* View Toggle */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Schedule</h2>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'calendar')}>
                    <TabsList className="h-9">
                        <TabsTrigger value="list" className="px-3">
                            <List className="h-4 w-4 mr-1" />
                            List
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="px-3">
                            <CalendarDays className="h-4 w-4 mr-1" />
                            Calendar
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Upcoming Appointments */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-green-500" />
                        Upcoming (Next 7 Days)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {viewMode === 'list' ? (
                        <div className="divide-y">
                            {upcoming.map(event => (
                                <AppointmentRow
                                    key={event.id}
                                    event={event}
                                    companyName={companyName}
                                    onClick={() => {
                                        const call = findCallForEvent(event);
                                        if (call) setSelectedCall(call);
                                    }}
                                />
                            ))}
                            {upcoming.length === 0 && (
                                <div className="p-8 text-center text-muted-foreground">
                                    No upcoming appointments scheduled
                                </div>
                            )}
                        </div>
                    ) : (
                        <CalendarView events={upcoming} onEventClick={(e) => {
                            const call = findCallForEvent(e);
                            if (call) setSelectedCall(call);
                        }} />
                    )}
                </CardContent>
            </Card>

            {/* Time TBD Section */}
            {tbd.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-700">
                            <Clock className="h-5 w-5" />
                            Time TBD ({tbd.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-amber-100">
                            {tbd.map(event => (
                                <TBDRow
                                    key={event.id}
                                    event={event}
                                    companyName={companyName}
                                    onClick={() => {
                                        const call = findCallForEvent(event);
                                        if (call) setSelectedCall(call);
                                    }}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ROI Placeholder */}
            <Card className="bg-muted/30 border-dashed">
                <CardContent className="py-6 text-center text-muted-foreground">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Job Value Tracking</p>
                    <p className="text-sm">Coming soon</p>
                </CardContent>
            </Card>

            {/* Call Details Drawer */}
            <CallDetailsDrawer
                open={!!selectedCall}
                onOpenChange={(open) => !open && setSelectedCall(null)}
                call={selectedCall}
                companyName={companyName}
            />
        </div>
    );
}

// ============================================================================
// Appointment Row (Structured Time)
// ============================================================================

interface AppointmentRowProps {
    event: AppointmentEvent;
    companyName?: string;
    onClick: () => void;
}

function AppointmentRow({ event, companyName, onClick }: AppointmentRowProps) {
    const sanitizedJobType = sanitizeCallText(event.jobType, { companyName });

    return (
        <div className="p-4 hover:bg-muted/50 cursor-pointer flex items-center gap-4" onClick={onClick}>
            {/* Date/Time Block */}
            <div className="bg-green-100 text-green-800 rounded-lg px-3 py-2 text-center min-w-[80px]">
                <p className="text-xs font-medium">{event.displayDay}</p>
                <p className="text-lg font-bold">{event.displayWhen}</p>
                {event.inferred && (
                    <Badge variant="outline" className="text-xs mt-1 border-amber-300 text-amber-600">
                        Estimated
                    </Badge>
                )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 space-y-1">
                <p className="font-medium truncate">{event.customerName}</p>
                <p className="text-sm text-muted-foreground">{formatPhoneNumber(event.customerPhone)}</p>
                {event.address !== 'Address not provided' && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.address}
                    </p>
                )}
                <p className="text-sm">{sanitizedJobType}</p>
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
    );
}

// ============================================================================
// TBD Row (No Structured Time)
// ============================================================================

interface TBDRowProps {
    event: AppointmentEvent;
    companyName?: string;
    onClick: () => void;
}

function TBDRow({ event, companyName, onClick }: TBDRowProps) {
    const sanitizedJobType = sanitizeCallText(event.jobType, { companyName });

    return (
        <div className="p-4 hover:bg-amber-100/50 cursor-pointer flex items-center gap-4" onClick={onClick}>
            {/* TBD Badge */}
            <div className="bg-amber-100 text-amber-800 rounded-lg px-3 py-2 text-center min-w-[80px]">
                <p className="text-sm font-medium">Time</p>
                <p className="text-lg font-bold">TBD</p>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 space-y-1">
                <p className="font-medium truncate">{event.customerName}</p>
                <p className="text-sm text-muted-foreground">{formatPhoneNumber(event.customerPhone)}</p>
                <p className="text-sm">{sanitizedJobType}</p>
                <p className="text-xs text-amber-600">Confirm appointment time</p>
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
    );
}

// ============================================================================
// Calendar View (Secondary)
// ============================================================================

interface CalendarViewProps {
    events: AppointmentEvent[];
    onEventClick: (event: AppointmentEvent) => void;
}

function CalendarView({ events, onEventClick }: CalendarViewProps) {
    // Group events by date
    const grouped = useMemo(() => {
        const groups: Record<string, AppointmentEvent[]> = {};
        events.forEach(event => {
            if (event.start) {
                const dateKey = event.start.toLocaleDateString();
                if (!groups[dateKey]) groups[dateKey] = [];
                groups[dateKey].push(event);
            }
        });
        return groups;
    }, [events]);

    const dateKeys = Object.keys(grouped).sort((a, b) =>
        new Date(a).getTime() - new Date(b).getTime()
    );

    if (dateKeys.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                No appointments to display
            </div>
        );
    }

    return (
        <div className="divide-y">
            {dateKeys.map(dateKey => (
                <div key={dateKey} className="p-4">
                    <h4 className="font-medium text-sm text-muted-foreground mb-3">
                        {new Date(dateKey).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h4>
                    <div className="space-y-2">
                        {grouped[dateKey].map(event => (
                            <div
                                key={event.id}
                                className="bg-green-50 border border-green-200 rounded-lg p-3 cursor-pointer hover:bg-green-100"
                                onClick={() => onEventClick(event)}
                            >
                                <div className="flex items-center justify-between">
                                    <p className="font-medium text-sm">{event.displayWhen}</p>
                                    <p className="text-sm text-muted-foreground">{event.customerName}</p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{event.jobType}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
