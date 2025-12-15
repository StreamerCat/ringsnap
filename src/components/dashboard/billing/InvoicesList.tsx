import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Invoice {
    id: string;
    number: string;
    created: number;
    amount_paid: number;
    amount_due: number;
    status: string;
    invoice_pdf: string;
    hosted_invoice_url: string;
    period_end: number;
}

export function InvoicesList({ accountId }: { accountId: string }) {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInvoices = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase.functions.invoke('stripe-invoices-list', {
                    body: { account_id: accountId }
                });
                if (!error && data?.invoices) {
                    setInvoices(data.invoices);
                }
            } catch (e) {
                console.error("Failed to fetch invoices", e);
            } finally {
                setLoading(false);
            }
        };

        if (accountId) fetchInvoices();
    }, [accountId]);

    if (loading) {
        return <div className="p-4 text-center text-muted-foreground">Loading invoices...</div>;
    }

    if (invoices.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">No invoices found.</div>;
    }

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Invoice</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                            <TableCell>{format(new Date(invoice.created * 1000), 'MMM d, yyyy')}</TableCell>
                            <TableCell>${((invoice.amount_paid || invoice.amount_due) / 100).toFixed(2)}</TableCell>
                            <TableCell>
                                <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'} className="capitalize">
                                    {invoice.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                                {invoice.invoice_pdf && (
                                    <Button variant="ghost" size="sm" asChild>
                                        <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                            <Download className="h-4 w-4" />
                                        </a>
                                    </Button>
                                )}
                                {invoice.hosted_invoice_url && (
                                    <Button variant="ghost" size="sm" asChild>
                                        <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
