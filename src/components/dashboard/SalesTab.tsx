
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Search, Users, DollarSign, AlertCircle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SalesCustomerPanel } from "./SalesCustomerPanel";

const PLAN_PRICING: Record<string, number> = {
    starter: 297,
    professional: 797,
    premium: 1497,
};

interface SalesTabProps {
    dateFilter: string;
    /** Optional: Pre-filter accounts to only show those assigned to this sales rep name */
    salesRepNameFilter?: string;
}

export function SalesTab({ dateFilter, salesRepNameFilter }: SalesTabProps) {
    const [salesRepFilter, setSalesRepFilter] = useState("all");
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    const getDateThreshold = () => {
        if (dateFilter === "all") return null;
        const days = parseInt(dateFilter);
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    };

    const {
        data: salesAccounts = [],
        isLoading: salesAccountsLoading,
    } = useQuery({
        queryKey: ["sales_team_accounts", dateFilter, salesRepNameFilter],
        queryFn: async () => {
            let query = supabase
                .from("accounts")
                .select(
                    "id, company_name, plan_type, subscription_status, sales_rep_name, created_at, trade, profiles!left(name, phone, is_primary)"
                )
                .in("subscription_status", ["trial", "active", "past_due"]);

            // Apply sales rep filter at query level if provided
            if (salesRepNameFilter) {
                query = query.eq("sales_rep_name", salesRepNameFilter);
            }

            const threshold = getDateThreshold();
            if (threshold) query = query.gte("created_at", threshold);

            const { data, error } = await query.order("created_at", { ascending: false });
            if (error) throw error;

            return data || [];
        },
    });

    const salesRepOptions = useMemo(() => {
        const reps = new Set<string>();
        salesAccounts.forEach((account: any) => {
            const repValue = (account.sales_rep_name as string | null)?.trim() || "__unassigned";
            reps.add(repValue);
        });
        return Array.from(reps).sort((a, b) => {
            if (a === "__unassigned") return 1;
            if (b === "__unassigned") return -1;
            return a.localeCompare(b);
        });
    }, [salesAccounts]);

    const filteredAccounts = useMemo(() => {
        return salesAccounts.filter((account: any) => {
            const repValue = (account.sales_rep_name as string | null)?.trim() || "__unassigned";
            // If salesRepNameFilter is set, already filtered at query level, so salesRepFilter dropdown applies additionally
            if (salesRepFilter === "all") return true;
            return repValue === salesRepFilter;
        });
    }, [salesAccounts, salesRepFilter]);


    const totals = useMemo(() => {
        const totalAccounts = filteredAccounts.length;
        let activeAccounts = 0;
        let pastDueAccounts = 0;
        const totalMRR = filteredAccounts.reduce((sum: number, account: any) => {
            const status = account.subscription_status;
            if (status === "active") activeAccounts += 1;
            if (status === "past_due") pastDueAccounts += 1;

            const planKey = (account.plan_type as string | null)?.toLowerCase() || "";
            const planValue = PLAN_PRICING[planKey] || 0;
            return sum + planValue;
        }, 0);

        return { totalAccounts, activeAccounts, pastDueAccounts, totalMRR };
    }, [filteredAccounts]);

    const currencyFormatter = useMemo(
        () =>
            new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
            }),
        []
    );

    const exportCSV = (data: any[], filename: string) => {
        if (!data || data.length === 0) return;

        const formattedRows: Record<string, string | number>[] = data.map((account: any) => {
            const planKey = (account.plan_type as string | null)?.toLowerCase() || "";
            const mrrValue = PLAN_PRICING[planKey] || 0;
            return {
                company_name: account.company_name ?? "",
                sales_rep: account.sales_rep_name?.trim() || "Unassigned",
                plan_type: account.plan_type ?? "",
                subscription_status: account.subscription_status ?? "",
                mrr: mrrValue,
                contact_name: account.profiles?.[0]?.name || "",
                contact_phone: account.profiles?.[0]?.phone || "",
                created_at: account.created_at ?? "",
            };
        });

        if (formattedRows.length === 0) return;

        const headers = Object.keys(formattedRows[0]);
        const csvRows = formattedRows.map((row) =>
            headers
                .map((header) => {
                    const value = row[header];
                    return `"${String(value ?? "")}"`;
                })
                .join(",")
        );

        const csv = [headers.join(","), ...csvRows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totals.totalAccounts}</div>
                            <p className="text-xs text-muted-foreground">
                                Across {salesRepFilter === "all" ? "all reps" : "selected rep"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">Active</Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totals.activeAccounts}</div>
                            <p className="text-xs text-muted-foreground">
                                Paying customers
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Estimated MRR</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{currencyFormatter.format(totals.totalMRR)}</div>
                            <p className="text-xs text-muted-foreground">
                                Based on active plans
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Past Due</CardTitle>
                            <AlertCircle className="h-4 w-4 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">{totals.pastDueAccounts}</div>
                            <p className="text-xs text-muted-foreground">
                                Action required
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters & Export */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Select value={salesRepFilter} onValueChange={setSalesRepFilter}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by Sales Rep" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Sales Reps</SelectItem>
                            {salesRepOptions.map((rep) => (
                                <SelectItem key={rep} value={rep}>
                                    {rep === "__unassigned" ? "Unassigned" : rep}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        onClick={() => exportCSV(filteredAccounts, "ringsnap-accounts")}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>

                {/* Accounts Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Accounts</CardTitle>
                        <CardDescription>
                            {filteredAccounts.length} accounts found for the selected period.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {salesAccountsLoading ? (
                            <div className="text-center py-8">Loading accounts...</div>
                        ) : filteredAccounts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">No accounts found.</div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Company</TableHead>
                                            <TableHead>Sales Rep</TableHead>
                                            <TableHead>Plan</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Primary Contact</TableHead>
                                            <TableHead className="text-right">Created</TableHead>
                                            <TableHead className="w-[60px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredAccounts.map((account: any) => (
                                            <TableRow key={account.id}>
                                                <TableCell className="font-medium">
                                                    {account.company_name}
                                                    <div className="text-xs text-muted-foreground">{account.trade}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {account.sales_rep_name || <span className="text-muted-foreground italic">Unassigned</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">
                                                        {account.plan_type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            account.subscription_status === "active"
                                                                ? "default"
                                                                : account.subscription_status === "past_due"
                                                                    ? "destructive"
                                                                    : "secondary"
                                                        }
                                                        className="capitalize"
                                                    >
                                                        {account.subscription_status?.replace("_", " ")}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        {account.profiles?.[0]?.name || "Unknown"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {account.profiles?.[0]?.phone || ""}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {new Date(account.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedAccountId(account.id);
                                                            setIsPanelOpen(true);
                                                        }}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Customer Detail Panel */}
            <SalesCustomerPanel
                accountId={selectedAccountId}
                isOpen={isPanelOpen}
                onClose={() => {
                    setIsPanelOpen(false);
                    setSelectedAccountId(null);
                }}
            />
        </>
    );
}
