
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, MapPin, User, FileText } from "lucide-react";
import { format } from "date-fns";
import { formatPhoneNumber } from "@/lib/utils";

interface AppointmentsTabProps {
    accountId: string;
}

export function AppointmentsTab({ accountId }: AppointmentsTabProps) {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const { data, error } = await supabase
                    .from("appointments")
                    .select("*")
                    .eq("account_id", accountId)
                    .order("scheduled_start_at", { ascending: false }); // Newest/Future first typically

                if (error) throw error;
                setAppointments(data || []);
            } catch (err) {
                console.error("Error fetching appointments:", err);
            } finally {
                setLoading(false);
            }
        };

        if (accountId) fetchAppointments();

        // Subscribe to realtime changes
        const subscription = supabase
            .channel('appointments_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `account_id=eq.${accountId}` },
                () => {
                    fetchAppointments();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(subscription); };

    }, [accountId]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6" /></div>;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Appointments</CardTitle>
                    <CardDescription>Upcoming and past appointments scheduled by your assistant.</CardDescription>
                </CardHeader>
                <CardContent>
                    {appointments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No appointments found.</div>
                    ) : (
                        <div className="space-y-4">
                            {appointments.map((apt) => (
                                <div key={apt.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-lg gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant={apt.status === 'scheduled' ? 'default' : apt.status === 'canceled' ? 'destructive' : 'secondary'} className="capitalize">
                                                {apt.status}
                                            </Badge>
                                            <span className="font-semibold text-base sm:text-lg flex items-center gap-1">
                                                {format(new Date(apt.scheduled_start_at), "EEE, MMM d, yyyy 'at' h:mm a")}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{apt.caller_name}</span>
                                            <span className="text-muted-foreground">({formatPhoneNumber(apt.caller_phone)})</span>
                                        </div>
                                        {apt.service_type && (
                                            <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                                Service: {apt.service_type}
                                            </div>
                                        )}
                                        {apt.address && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <MapPin className="w-4 h-4" /> {apt.address}
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Side: Notes */}
                                    {apt.notes && (
                                        <div className="bg-muted p-3 rounded-md text-sm max-w-md w-full sm:w-auto">
                                            <div className="flex items-center gap-1 text-muted-foreground mb-1">
                                                <FileText className="w-3 h-3" />
                                                <span className="text-xs font-semibold uppercase">Notes</span>
                                            </div>
                                            <p className="whitespace-pre-wrap">{apt.notes}</p>
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
