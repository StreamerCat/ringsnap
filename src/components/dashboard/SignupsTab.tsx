
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle, XCircle, Search, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface SignupsTabProps {
    dateFilter: string;
}

type FunnelRow = {
    accountId: string | null;
    email: string;
    phone: string;
    companyName: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    status: string;
    funnelStep: string;
    failureReason: string | null;
    lastEventAt: string;
    isError: boolean;
};

export function SignupsTab({ dateFilter }: SignupsTabProps) {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");

    const getDateThreshold = () => {
        if (dateFilter === "all") return null;
        const days = parseInt(dateFilter) || 7;
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    };

    const { data: rows = [], isLoading } = useQuery({
        queryKey: ["signup_funnel", dateFilter],
        queryFn: async () => {
            const threshold = getDateThreshold();

            // 1. Fetch Accounts
            let accountsQuery = supabase
                .from("accounts")
                .select("id, created_at, company_name, stripe_customer_id, stripe_subscription_id, subscription_status, provisioning_status, profiles(email, phone)");

            if (threshold) accountsQuery = accountsQuery.gte("created_at", threshold);

            const { data: accounts, error: accountsError } = await accountsQuery.order("created_at", { ascending: false });
            if (accountsError) throw accountsError;

            // 2. Fetch relevant Analytics Events
            let eventsQuery = supabase
                .from("analytics_events")
                .select("*")
                .in("event_type", [
                    "signup_started",
                    "payment_attempted",
                    "payment_succeeded",
                    "payment_failed",
                    "trial_created",
                    "trial_creation_failed",
                    "provisioning_started",
                    "provisioning_completed",
                    "provisioning_failed"
                ]);

            if (threshold) eventsQuery = eventsQuery.gte("created_at", threshold);

            const { data: events, error: eventsError } = await eventsQuery.order("created_at", { ascending: false });
            if (eventsError) throw eventsError;

            // 3. Aggregate
            const funnelMap = new Map<string, FunnelRow>();

            // Initialize from Accounts
            accounts?.forEach((acc: any) => {
                const profile = acc.profiles?.[0] || {};
                const email = profile.email || "Unknown";

                // Determine initial step based on status
                let step = "account_created";
                if (acc.provisioning_status === 'provisioning' || acc.provisioning_status === 'in_progress') step = "provisioning_started";
                if (acc.provisioning_status === 'completed' || acc.provisioning_status === 'active') step = "provisioning_completed";
                if (acc.subscription_status === 'active' || acc.subscription_status === 'trial') step = "trial_created";

                funnelMap.set(acc.id, {
                    accountId: acc.id,
                    email: email,
                    phone: profile.phone || "",
                    companyName: acc.company_name || "Unnamed Company",
                    stripeCustomerId: acc.stripe_customer_id,
                    stripeSubscriptionId: acc.stripe_subscription_id,
                    status: acc.subscription_status,
                    funnelStep: step,
                    failureReason: null,
                    lastEventAt: acc.created_at,
                    isError: false
                });
            });

            // process events to fill in gaps and find failures
            events?.forEach((ev: any) => {
                const meta = ev.metadata || {};
                const accountId = ev.account_id || meta.account_id;
                const email = meta.email || meta.user_email;

                let key = accountId;

                // If we don't have an account ID, try to match by email if we have a provisional row
                // Or create a new "orphan" row for failed signups that didn't create an account
                if (!key && email) {
                    // Try to find existing row by email
                    for (const [id, row] of funnelMap.entries()) {
                        if (row.email === email) {
                            key = id;
                            break;
                        }
                    }
                }

                if (!key && email) {
                    // Create orphan row for failure tracking
                    key = `orphan_${email}`;
                    if (!funnelMap.has(key)) {
                        funnelMap.set(key, {
                            accountId: null,
                            email: email,
                            phone: meta.phone || "",
                            companyName: "Incomplete Signup",
                            stripeCustomerId: meta.stripe_customer_id || null,
                            stripeSubscriptionId: null,
                            status: "failed",
                            funnelStep: ev.event_type,
                            failureReason: null,
                            lastEventAt: ev.created_at,
                            isError: ev.event_type.includes('failed')
                        });
                    }
                }

                if (key && funnelMap.has(key)) {
                    const row = funnelMap.get(key)!;

                    // Update error state
                    if (ev.event_type.includes("failed")) {
                        row.isError = true;
                        row.failureReason = meta.error || meta.message || ev.event_type;
                        // Determine step name from failure
                        if (ev.event_type === 'payment_failed') row.funnelStep = 'payment_failed';
                        if (ev.event_type === 'trial_creation_failed') row.funnelStep = 'trial_creation_failed';
                        if (ev.event_type === 'provisioning_failed') row.funnelStep = 'provisioning_failed';
                    } else {
                        // If we see a later success event, it might override a previous error (retry)
                        // But usually we want to see the latest state.
                        // Simple logic: if this event is NEWER than what we have, update step
                        if (new Date(ev.created_at) > new Date(row.lastEventAt)) {
                            row.lastEventAt = ev.created_at;
                            // Only update non-error steps if they seem progressive? 
                            // actually, just matching rough flow is fine.
                            if (!row.isError) { // Don't overwrite error with older success, but this loop is newest first?
                                // Wait, events are ordered newest first. 
                                // So the first event we see for an account is likely the latest status.
                            }
                        }
                    }
                }
            });

            return Array.from(funnelMap.values()).sort((a, b) => new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime());
        },
    });

    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const lower = searchTerm.toLowerCase();
        return rows.filter(r =>
            r.email.toLowerCase().includes(lower) ||
            r.companyName.toLowerCase().includes(lower) ||
            (r.accountId && r.accountId.toLowerCase().includes(lower))
        );
    }, [rows, searchTerm]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search email, company, UUID..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Signup Funnel & Activity</CardTitle>
                    <CardDescription>
                        Recent signups, trials, and failures.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Account / Contact</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Funnel Step</TableHead>
                                <TableHead className="text-right">Last Activity</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRows.map((row) => (
                                <TableRow key={row.accountId || row.email} className={row.isError ? "bg-red-50 hover:bg-red-100" : ""}>
                                    <TableCell>
                                        <div className="font-medium text-sm">{row.companyName}</div>
                                        <div className="text-xs text-muted-foreground">{row.email}</div>
                                        <div className="text-xs text-muted-foreground">{row.phone}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {row.accountId && (
                                                <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground font-mono">
                                                    UUID: {row.accountId.slice(0, 8)}...
                                                    <Copy className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={() => copyToClipboard(row.accountId!)} />
                                                </div>
                                            )}
                                            {row.stripeCustomerId && (
                                                <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground font-mono">
                                                    CUST: {row.stripeCustomerId.slice(0, 8)}...
                                                    <Copy className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={() => copyToClipboard(row.stripeCustomerId!)} />
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {row.isError ? (
                                            <Badge variant="destructive" className="gap-1">
                                                <XCircle className="h-3 w-3" />
                                                Failed
                                            </Badge>
                                        ) : row.status === 'active' || row.status === 'trial' ? (
                                            <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                                                <CheckCircle className="h-3 w-3" />
                                                {row.status}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">{row.status}</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium text-sm capitalize">{row.funnelStep.replace(/_/g, ' ')}</div>
                                        {row.failureReason && (
                                            <div className="text-xs text-destructive font-mono mt-1 break-words max-w-[200px]">
                                                {row.failureReason}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground text-xs">
                                        {new Date(row.lastEventAt).toLocaleDateString()}<br />
                                        {new Date(row.lastEventAt).toLocaleTimeString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredRows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No recent signups found.
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
