import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Users, Calendar, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface OperatorStats {
  calls_today: number;
  call_duration_seconds_today: number;
  leads_today: number;
  new_leads_today: number;
  appointment_requests_today: number;
  emergency_leads_today: number;
  pending_appointments: number;
  emergency_appointments: number;
  last_call_at: string | null;
  last_lead_at: string | null;
}

interface PendingAppointment {
  id: string;
  customer_name: string;
  customer_phone: string;
  job_type: string | null;
  preferred_time_range: string | null;
  urgency: string | null;
  created_at: string;
}

export function OperatorOverview({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [pendingAppointments, setPendingAppointments] = useState<PendingAppointment[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    loadOperatorData();
    // Refresh every 60 seconds
    const interval = setInterval(loadOperatorData, 60000);
    return () => clearInterval(interval);
  }, [accountId]);

  const loadOperatorData = async () => {
    try {
      // Load summary stats from view
      const { data: statsData, error: statsError } = await supabase
        .from("operator_dashboard_summary")
        .select("*")
        .eq("account_id", accountId)
        .single();

      if (statsError) {
        console.error("Failed to load operator stats:", statsError);
      } else {
        setStats(statsData);
      }

      // Load data directly from RPC to ensure freshness and bypass RLS
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Use RPC for call logs to bypass RLS
      const [callLogsRes, appointmentsRes, leadsRes] = await Promise.all([
        supabase.rpc("get_calls_today", { p_account_id: accountId }) as Promise<any>,
        supabase.from("appointments" as any)
          .select("id, customer_name, customer_phone, job_type, preferred_time_range, urgency, created_at")
          .eq("account_id", accountId)
          .eq("status", "pending_confirmation")
          .order("urgency", { ascending: false, nullsLast: true } as any)
          .order("created_at", { ascending: true })
          .limit(10),
        supabase.from("customer_leads" as any)
          .select("id, customer_name, customer_phone, intent, urgency, created_at, call_summary")
          .eq("account_id", accountId)
          .gte("created_at", startOfDay.toISOString())
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (callLogsRes.error) {
        console.error("Failed to load call logs:", callLogsRes.error);
      } else if (callLogsRes.data) {
        // Manual aggregation for "Calls Today" to update instantly
        const count = callLogsRes.data.length;
        const duration = callLogsRes.data.reduce((acc: number, c: any) => acc + (c.duration_seconds || 0), 0);
        const lastCall = callLogsRes.data.length > 0 ? callLogsRes.data[0].started_at : null;

        setStats(prev => ({
          ...prev!, // Assumes statsData loaded or partial update
          // Fallbacks if prev is null
          calls_today: count,
          call_duration_seconds_today: duration,
          leads_today: prev?.leads_today || 0,
          new_leads_today: prev?.new_leads_today || 0,
          appointment_requests_today: prev?.appointment_requests_today || 0,
          emergency_leads_today: prev?.emergency_leads_today || 0,
          pending_appointments: prev?.pending_appointments || 0,
          emergency_appointments: prev?.emergency_appointments || 0,
          last_call_at: lastCall,
          last_lead_at: prev?.last_lead_at || null
        }));
      }

      // Load pending appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from("appointments" as any)
        .select("id, customer_name, customer_phone, job_type, preferred_time_range, urgency, created_at")
        .eq("account_id", accountId)
        .eq("status", "pending_confirmation")
        .order("urgency", { ascending: false, nullsLast: true } as any)
        .order("created_at", { ascending: true })
        .limit(10);

      if (appointmentsError) {
        console.error("Failed to load appointments:", appointmentsError);
      } else {
        setPendingAppointments(appointmentsData || []);
      }

      // Load today's leads
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: leadsData, error: leadsError } = await supabase
        .from("customer_leads" as any)
        .select("id, customer_name, customer_phone, intent, urgency, created_at, call_summary")
        .eq("account_id", accountId)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (leadsError) {
        console.error("Failed to load leads:", leadsError);
      } else {
        setLeads(leadsData || []);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading operator data:", error);
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getUrgencyBadge = (urgency: string | null) => {
    switch (urgency) {
      case "emergency":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Emergency</Badge>;
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium</Badge>;
      default:
        return <Badge variant="outline">Normal</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Calls Today</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.calls_today || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.call_duration_seconds_today ? formatDuration(stats.call_duration_seconds_today) : "0m"} total
            </p>
            {stats?.last_call_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Last: {formatTime(stats.last_call_at)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Today</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.leads_today || 0}</div>
            <div className="flex gap-2 mt-1">
              {(stats?.new_leads_today || 0) > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {stats?.new_leads_today} new
                </Badge>
              )}
              {(stats?.emergency_leads_today || 0) > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {stats?.emergency_leads_today} urgent
                </Badge>
              )}
            </div>
            {stats?.last_lead_at && (
              <p className="text-xs text-muted-foreground mt-1">
                Last: {formatTime(stats.last_lead_at)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending_appointments || 0}</div>
            {(stats?.emergency_appointments || 0) > 0 && (
              <Badge variant="destructive" className="mt-1 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {stats?.emergency_appointments} emergency
              </Badge>
            )}
            {stats?.pending_appointments === 0 && (
              <p className="text-xs text-muted-foreground mt-1">All caught up!</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Appointments Table */}
      {pendingAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Job Type</TableHead>
                  <TableHead>Preferred Time</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingAppointments.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell className="font-medium">{apt.customer_name}</TableCell>
                    <TableCell>{apt.customer_phone}</TableCell>
                    <TableCell>{apt.job_type || "-"}</TableCell>
                    <TableCell>{apt.preferred_time_range || "-"}</TableCell>
                    <TableCell>{getUrgencyBadge(apt.urgency)}</TableCell>
                    <TableCell>{formatTime(apt.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Today's Leads Table */}
      {leads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today's Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.customer_name || "Unknown"}</TableCell>
                    <TableCell>{lead.customer_phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {lead.intent || "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getUrgencyBadge(lead.urgency)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {lead.call_summary || "-"}
                    </TableCell>
                    <TableCell>{formatTime(lead.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {pendingAppointments.length === 0 && leads.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Quiet Today</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              No pending appointments or leads yet. Your AI assistant is ready to handle incoming calls.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
