import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client"; // Verify this path
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function JobberIntegration() {
    const queryClient = useQueryClient();
    const [isConnecting, setIsConnecting] = useState(false);

    // 1. Fetch Connection Status
    const { data: connection, isLoading: isLoadingConnection } = useQuery({
        queryKey: ["jobber-connection"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("jobber_connections")
                .select("*")
                .maybeSingle();
            if (error) throw error;
            return data;
        },
    });

    // 2. Fetch Sync Logs
    const { data: logs, isLoading: isLoadingLogs } = useQuery({
        queryKey: ["jobber-logs"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("jobber_sync_logs")
                .select(`
            *,
            call_outcome_events (
                outcome,
                summary
            )
        `)
                .order("created_at", { ascending: false })
                .limit(20);

            if (error) throw error;
            return data;
        },
    });

    // 3. Connect Mutation
    const handleConnect = async () => {
        try {
            setIsConnecting(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("You must be logged in to connect.");
                return;
            }

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jobber-oauth-start`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (!res.ok) throw new Error("Failed to start OAuth flow");

            const { url } = await res.json();
            if (url) {
                window.location.href = url;
            }
        } catch (error) {
            toast.error("Failed to initiate connection");
            console.error(error);
        } finally {
            setIsConnecting(false);
        }
    };

    // 4. Disconnect Mutation
    const disconnectMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from("jobber_connections")
                .delete()
                .eq("id", connection.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["jobber-connection"] });
            toast.success("Jobber disconnected successfully");
        },
        onError: () => {
            toast.error("Failed to disconnect Jobber");
        }
    });

    if (isLoadingConnection) {
        return <div className="p-8">Loading settings...</div>;
    }

    return (
        <div className="container max-w-5xl py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Jobber Integration</h1>
                <p className="text-muted-foreground mt-2">
                    Sync your RingSnap calls directly to Jobber as clients, requests, and jobs.
                </p>
            </div>

            {/* Connection Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Connection Status</CardTitle>
                    <CardDescription>
                        {connection ? "Your RingSnap account is connected to Jobber." : "Connect your Jobber account to enable automatic syncing."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`h-3 w-3 rounded-full ${connection ? "bg-green-500" : "bg-gray-300"}`} />
                            <span className="font-medium">
                                {connection ? "Connected" : "Not Connected"}
                            </span>
                            {connection && (
                                <span className="text-sm text-muted-foreground">
                                    (Last updated: {new Date(connection.updated_at).toLocaleDateString()})
                                </span>
                            )}
                        </div>
                        {connection ? (
                            <Button
                                variant="destructive"
                                onClick={() => disconnectMutation.mutate()}
                                disabled={disconnectMutation.isPending}
                            >
                                Disconnect
                            </Button>
                        ) : (
                            <Button onClick={handleConnect} disabled={isConnecting}>
                                {isConnecting ? "Connecting..." : "Connect Jobber"}
                                <ExternalLink className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Configuration / Mapping Card (MVP Static) */}
            <Card>
                <CardHeader>
                    <CardTitle>Sync Rules</CardTitle>
                    <CardDescription>
                        Calls will be synced based on their outcome.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="p-4 border rounded-lg bg-muted/50">
                            <h4 className="font-semibold mb-2">New Lead</h4>
                            <p className="text-sm text-muted-foreground">Creates a Client and a Request in Jobber.</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-muted/50">
                            <h4 className="font-semibold mb-2">Quote Requested</h4>
                            <p className="text-sm text-muted-foreground">Creates a Client and a Request in Jobber.</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-muted/50">
                            <h4 className="font-semibold mb-2">Booking Created</h4>
                            <p className="text-sm text-muted-foreground">Creates a Client and a Job in Jobber.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sync Logs */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest sync operations.</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["jobber-logs"] })}>
                        <RefreshCw className={`h-4 w-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Time</TableHead>
                                <TableHead>Outcome</TableHead>
                                <TableHead>Operation</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs?.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {(log.call_outcome_events?.outcome || 'Unknown').replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{log.operation_type}</TableCell>
                                    <TableCell>
                                        {log.status === 'success' ? (
                                            <Badge className="bg-green-500 hover:bg-green-600">Success</Badge>
                                        ) : (
                                            <Badge variant="destructive">Error</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs" title={log.error_message || log.external_id}>
                                        {log.error_message || `ID: ${log.external_id || '-'}`}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoadingLogs && logs?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                        No sync activity recorded yet.
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
