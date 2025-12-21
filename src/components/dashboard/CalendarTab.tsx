import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, MapPin, Phone, Clock, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { CallDetailsDrawer } from "./CallDetailsDrawer";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    deriveAppointmentEvents,
    formatPhoneNumber,
    type CallLogWithAppointment,
    type AppointmentEvent,
} from "@/lib/appointments";

interface CalendarTabProps {
    calls: CallLogWithAppointment[];
}

type ViewMode = 'month' | 'week';

/**
 * Calendar tab showing booked appointments in a month grid with day agenda.
 * Mobile-friendly: tapping a day shows agenda list below the calendar.
 */
export function CalendarTab({ calls }: CalendarTabProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedCall, setSelectedCall] = useState<any>(null);
    const isMobile = useIsMobile();

    // Derive all appointment events from calls
    const allEvents = useMemo(() => {
        return deriveAppointmentEvents(calls);
    }, [calls]);

    // Separate events by parseability
    const { scheduledEvents, tbdEvents } = useMemo(() => {
        const scheduled = allEvents.filter((e) => e.hasDateTime && e.start);
        const tbd = allEvents.filter((e) => !e.hasDateTime);
        return { scheduledEvents: scheduled, tbdEvents: tbd };
    }, [allEvents]);

    // Get events for a specific date
    const getEventsForDate = (date: Date): AppointmentEvent[] => {
        return scheduledEvents.filter((e) => {
            if (!e.start) return false;
            return (
                e.start.getFullYear() === date.getFullYear() &&
                e.start.getMonth() === date.getMonth() &&
                e.start.getDate() === date.getDate()
            );
        });
    };

    // Get event count for a date (for calendar dots)
    const getEventCountForDate = (date: Date): number => {
        return getEventsForDate(date).length;
    };

    // Get events for selected date, sorted by time
    const selectedDateEvents = useMemo(() => {
        if (!selectedDate) return [];
        return getEventsForDate(selectedDate).sort((a, b) => {
            if (!a.start || !b.start) return 0;
            return a.start.getTime() - b.start.getTime();
        });
    }, [selectedDate, scheduledEvents]);

    // Week view: get the week containing selected date
    const currentWeekDates = useMemo(() => {
        const dates: Date[] = [];
        const start = new Date(selectedDate);
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek); // Go to Sunday

        for (let i = 0; i < 7; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            dates.push(date);
        }
        return dates;
    }, [selectedDate]);

    // Calendar grid helpers
    const getDaysInMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const navigateMonth = (direction: "prev" | "next") => {
        setCurrentMonth((prev) => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
            return newDate;
        });
    };

    const navigateWeek = (direction: "prev" | "next") => {
        setSelectedDate((prev) => {
            const newDate = new Date(prev);
            newDate.setDate(prev.getDate() + (direction === "next" ? 7 : -7));
            return newDate;
        });
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return (
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
        );
    };

    const isSelected = (date: Date) => {
        if (!selectedDate) return false;
        return (
            date.getFullYear() === selectedDate.getFullYear() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getDate() === selectedDate.getDate()
        );
    };

    // Generate calendar grid cells
    const calendarCells = useMemo(() => {
        const cells: (Date | null)[] = [];
        const daysInMonth = getDaysInMonth(currentMonth);
        const firstDay = getFirstDayOfMonth(currentMonth);

        // Padding for days before the first of the month
        for (let i = 0; i < firstDay; i++) {
            cells.push(null);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            cells.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
        }

        return cells;
    }, [currentMonth]);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const dayNames = isMobile
        ? ["S", "M", "T", "W", "T", "F", "S"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Handle appointment click - open drawer with source call
    const handleAppointmentClick = (event: AppointmentEvent) => {
        // Find the source call
        const sourceCall = calls.find(c => c.id === event.sourceCallId);
        if (sourceCall) {
            setSelectedCall({
                id: sourceCall.id,
                caller_name: event.customerName,
                caller_phone: event.customerPhone,
                duration_seconds: sourceCall.duration_seconds,
                reason: event.jobType,
                transcript_summary: sourceCall.summary,
                booked: sourceCall.booked,
                lead_captured: sourceCall.lead_captured,
                outcome: sourceCall.outcome,
            });
            setDrawerOpen(true);
        }
    };

    return (
        <div className="space-y-4" data-testid="calendar-tab">
            {/* View Toggle & Navigation */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => viewMode === 'month' ? navigateMonth("prev") : navigateWeek("prev")}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <CardTitle className="text-base sm:text-lg whitespace-nowrap" data-testid="calendar-month-title">
                                {viewMode === 'month'
                                    ? `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`
                                    : `Week of ${currentWeekDates[0].toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                                }
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => viewMode === 'month' ? navigateMonth("next") : navigateWeek("next")}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex gap-1">
                            <Button
                                variant={viewMode === 'month' ? 'default' : 'ghost'}
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => setViewMode('month')}
                            >
                                <Calendar className="h-3 w-3 mr-1" />
                                Month
                            </Button>
                            <Button
                                variant={viewMode === 'week' ? 'default' : 'ghost'}
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => setViewMode('week')}
                            >
                                <CalendarDays className="h-3 w-3 mr-1" />
                                Week
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    {viewMode === 'month' ? (
                        /* Month Grid */
                        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                            {/* Day headers */}
                            {dayNames.map((day, i) => (
                                <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1.5">
                                    {day}
                                </div>
                            ))}

                            {/* Calendar cells */}
                            {calendarCells.map((date, index) => {
                                if (!date) {
                                    return <div key={`empty-${index}`} className="p-1 sm:p-2 min-h-[36px] sm:min-h-[44px]" />;
                                }

                                const eventCount = getEventCountForDate(date);

                                return (
                                    <button
                                        key={date.toISOString()}
                                        onClick={() => setSelectedDate(date)}
                                        className={cn(
                                            "p-1 sm:p-2 text-xs sm:text-sm rounded-md transition-all relative min-h-[36px] sm:min-h-[44px] flex flex-col items-center justify-center",
                                            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                                            isToday(date) && !isSelected(date) && "bg-primary/10 font-semibold ring-1 ring-primary/30",
                                            isSelected(date) && "bg-primary text-primary-foreground shadow-sm",
                                        )}
                                    >
                                        <span>{date.getDate()}</span>
                                        {eventCount > 0 && (
                                            <div className={cn(
                                                "flex gap-0.5 mt-0.5",
                                                isSelected(date) ? "text-primary-foreground" : "text-green-500"
                                            )}>
                                                {eventCount <= 3 ? (
                                                    // Show dots for 1-3 events
                                                    [...Array(eventCount)].map((_, i) => (
                                                        <span
                                                            key={i}
                                                            className={cn(
                                                                "w-1 h-1 rounded-full",
                                                                isSelected(date) ? "bg-primary-foreground" : "bg-green-500"
                                                            )}
                                                        />
                                                    ))
                                                ) : (
                                                    // Show count for 4+ events
                                                    <span className="text-[10px] font-medium leading-none">
                                                        {eventCount}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        /* Week View */
                        <div className="grid grid-cols-7 gap-1">
                            {currentWeekDates.map((date, i) => {
                                const eventCount = getEventCountForDate(date);
                                const dayName = date.toLocaleDateString([], { weekday: 'short' });

                                return (
                                    <button
                                        key={date.toISOString()}
                                        onClick={() => setSelectedDate(date)}
                                        className={cn(
                                            "p-2 rounded-lg transition-all flex flex-col items-center gap-1",
                                            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary",
                                            isToday(date) && !isSelected(date) && "bg-primary/10 ring-1 ring-primary/30",
                                            isSelected(date) && "bg-primary text-primary-foreground shadow-sm",
                                        )}
                                    >
                                        <span className="text-xs text-muted-foreground">
                                            {isMobile ? dayName[0] : dayName}
                                        </span>
                                        <span className="text-lg font-semibold">{date.getDate()}</span>
                                        {eventCount > 0 && (
                                            <Badge
                                                variant={isSelected(date) ? "secondary" : "default"}
                                                className={cn(
                                                    "text-[10px] px-1.5 h-4",
                                                    !isSelected(date) && "bg-green-500 hover:bg-green-600"
                                                )}
                                            >
                                                {eventCount}
                                            </Badge>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Selected Day Agenda */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {selectedDate.toLocaleDateString([], {
                            weekday: "long",
                            month: "long",
                            day: "numeric"
                        })}
                        {isToday(selectedDate) && (
                            <Badge variant="outline" className="text-xs">Today</Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {selectedDateEvents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No appointments scheduled</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {selectedDateEvents.map((event) => (
                                <AppointmentCard
                                    key={event.id}
                                    event={event}
                                    onClick={() => handleAppointmentClick(event)}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* TBD Appointments Section */}
            {tbdEvents.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Booked (Time TBD)
                            <Badge variant="secondary" className="text-xs">{tbdEvents.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {tbdEvents.map((event) => (
                                <AppointmentCard
                                    key={event.id}
                                    event={event}
                                    showWindow
                                    onClick={() => handleAppointmentClick(event)}
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty state when no appointments at all */}
            {allEvents.length === 0 && (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No appointments yet</p>
                            <p className="text-sm mt-1">Booked appointments will appear here</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Call Details Drawer */}
            <CallDetailsDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                call={selectedCall}
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
    showWindow,
    onClick
}: {
    event: AppointmentEvent;
    showWindow?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full text-left border rounded-lg p-3 space-y-2 transition-colors",
                "hover:bg-muted/50 hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary",
                onClick && "cursor-pointer"
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{event.customerName}</p>
                        {event.inferred && (
                            <Badge variant="outline" className="text-[10px] px-1.5 h-5 bg-amber-50 text-amber-700 border-amber-200">
                                Estimated
                            </Badge>
                        )}
                    </div>
                    {event.hasDateTime && event.start && !showWindow && (
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                            {event.start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                    )}
                    {showWindow && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                            {event.displayWhen}
                        </p>
                    )}
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                    {event.jobType}
                </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {event.customerPhone && (
                    <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatPhoneNumber(event.customerPhone)}
                    </span>
                )}
                {event.address !== 'Address not provided' && (
                    <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{event.address}</span>
                    </span>
                )}
            </div>
        </button>
    );
}
