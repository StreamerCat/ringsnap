
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Phone, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";

interface OverviewTabProps {
    account: any;
    usageLogs: any[];
    usagePercent: number;
    remainingMinutes: number;
    trialDaysRemaining: number;
    creditsBalance: number;
}

export function OverviewTab({
    account,
    usageLogs,
    usagePercent,
    trialDaysRemaining,
    creditsBalance
}: OverviewTabProps) {
    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {account.monthly_minutes_used} / {account.monthly_minutes_limit}
                        </div>
                        <Progress value={usagePercent} className="mt-2" />
                        <p className="text-xs text-muted-foreground mt-2">
                            {usagePercent}% used this cycle
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Calls This Month</CardTitle>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{usageLogs.length}</div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {usageLogs.filter(l => l.appointment_booked).length} appointments booked
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Account Status</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <Badge variant={account.subscription_status === 'active' ? 'default' : 'secondary'}>
                            {account.subscription_status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-2">
                            {account.plan_type} plan
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {account.subscription_status === 'trial' ? 'Trial Days Left' : 'Credits Balance'}
                        </CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {account.subscription_status === 'trial' ? trialDaysRemaining : `$${creditsBalance.toFixed(2)}`}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {account.subscription_status === 'trial' ? 'Upgrade to continue' : 'Available credits'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Calls Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Calls</CardTitle>
                </CardHeader>
                <CardContent>
                    {usageLogs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No calls yet</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Customer Phone</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Outcome</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usageLogs.slice(0, 10).map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            {new Date(log.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>{log.customer_phone || 'Unknown'}</TableCell>
                                        <TableCell>{Math.ceil(log.call_duration_seconds / 60)} min</TableCell>
                                        <TableCell>
                                            {log.appointment_booked && (
                                                <Badge variant="default">Appointment</Badge>
                                            )}
                                            {log.was_emergency && (
                                                <Badge variant="destructive">Emergency</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
