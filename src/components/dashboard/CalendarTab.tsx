import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, MapPin, Phone, Briefcase, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    deriveAppointmentEvents,
    formatPhoneNumber,
    type CallLogWithAppointment,
    type AppointmentEvent,
} from "@/lib/appointments";

interface CalendarTabProps {
    calls: CallLogWithAppointment[];
}

/**
 * Calendar tab showing booked appointments in a month grid with day agenda.
 * Mobile-friendly: tapping a day shows agenda list below the calendar.
 */
export function CalendarTab({ calls }: CalendarTabProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

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

    // Get events for selected date, sorted by time
    const selectedDateEvents = useMemo(() => {
        if (!selectedDate) return [];
        return getEventsForDate(selectedDate).sort((a, b) => {
            if (!a.start || !b.start) return 0;
            return a.start.getTime() - b.start.getTime();
        });
    }, [selectedDate, scheduledEvents]);

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

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
        <div className="space-y-4 sm:space-y-6" data-testid="calendar-tab">
            {/* Month Navigation */}
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth("prev")}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <CardTitle className="text-lg" data-testid="calendar-month-title">
                            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => navigateMonth("next")}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Day headers */}
                        {dayNames.map((day) => (
                            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                                {day}
                            </div>
                        ))}

                        {/* Calendar cells */}
                        {calendarCells.map((date, index) => {
                            if (!date) {
                                return <div key={`empty-${index}`} className="p-2" />;
                            }

                            const dayEvents = getEventsForDate(date);
                            const hasEvents = dayEvents.length > 0;

                            return (
                                <button
                                    key={date.toISOString()}
                                    onClick={() => setSelectedDate(date)}
                                    className={cn(
                                        "p-2 text-sm rounded-md transition-colors relative min-h-[40px]",
                                        "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary",
                                        isToday(date) && "bg-primary/10 font-semibold",
                                        isSelected(date) && "bg-primary text-primary-foreground",
                                        !isSelected(date) && !isToday(date) && "hover:bg-muted"
                                    )}
                                >
                                    {date.getDate()}
                                    {hasEvents && (
                                        <span
                                            className={cn(
                                                "absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full",
                                                isSelected(date) ? "bg-primary-foreground" : "bg-green-500"
                                            )}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Selected Day Agenda */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {selectedDate
                            ? selectedDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
                            : "Select a day"}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {selectedDateEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            No scheduled appointments for this day
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {selectedDateEvents.map((event) => (
                                <AppointmentCard key={event.id} event={event} />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* TBD Appointments Section */}
            {tbdEvents.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Booked (Time TBD)
                            <Badge variant="secondary" className="ml-2">{tbdEvents.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {tbdEvents.map((event) => (
                                <AppointmentCard key={event.id} event={event} showWindow />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty state when no appointments at all */}
            {allEvents.length === 0 && (
                <Card>
                    <CardContent className="py-8">
                        <p className="text-center text-muted-foreground">
                            No appointments booked yet. When calls result in booked appointments, they'll appear here.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

/**
 * Individual appointment card component
 */
function AppointmentCard({ event, showWindow }: { event: AppointmentEvent; showWindow?: boolean }) {
    return (
        <div className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <p className="font-medium">{event.customerName}</p>
                    {event.hasDateTime && event.start && (
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                            {event.start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                    )}
                    {showWindow && (
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                            {event.displayWhen}
                        </p>
                    )}
                </div>
                <Badge variant="outline" className="text-xs">
                    {event.jobType}
                </Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {event.customerPhone && (
                    <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {formatPhoneNumber(event.customerPhone)}
                    </span>
                )}
                <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {event.address}
                </span>
            </div>
        </div>
    );
}
