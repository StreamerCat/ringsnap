import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Phone, Mail, Building, Key, CreditCard, Copy, ExternalLink } from "lucide-react";

interface SalesCustomerPanelProps {
    accountId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

interface AccountDetails {
    id: string;
    company_name: string;
    website?: string;
    plan_type: string;
    subscription_status: string;
    vapi_phone_number?: string;
    sales_rep_name?: string;
    sales_notes?: string;
    profiles: Array<{
        id: string;
        name: string;
        email: string;
        phone: string;
        is_primary: boolean;
    }>;
}

export function SalesCustomerPanel({ accountId, isOpen, onClose }: SalesCustomerPanelProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        company_name: "",
        website: "",
        sales_notes: "",
        contact_name: "",
        contact_email: "",
        contact_phone: "",
    });

    // Fetch account details
    const { data: account, isLoading } = useQuery({
        queryKey: ["sales-customer-detail", accountId],
        queryFn: async () => {
            if (!accountId) return null;

            const { data, error } = await supabase
                .from("accounts")
                .select(`
          id, company_name, website, plan_type, subscription_status, 
          vapi_phone_number, sales_rep_name, sales_notes,
          profiles!left(id, name, email, phone, is_primary)
        `)
                .eq("id", accountId)
                .single();

            if (error) throw error;
            return data as unknown as AccountDetails;
        },
        enabled: !!accountId && isOpen,
    });

    // Initialize edit form when account data loads
    const handleEditClick = () => {
        if (account) {
            const primaryContact = account.profiles?.find(p => p.is_primary) || account.profiles?.[0];
            setEditForm({
                company_name: account.company_name || "",
                website: account.website || "",
                sales_notes: account.sales_notes || "",
                contact_name: primaryContact?.name || "",
                contact_email: primaryContact?.email || "",
                contact_phone: primaryContact?.phone || "",
            });
            setIsEditing(true);
        }
    };

    // Send password reset mutation
    const sendPasswordReset = useMutation({
        mutationFn: async (email: string) => {
            const { data, error } = await supabase.functions.invoke("send-password-reset", {
                body: { email },
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast({
                title: "Password reset sent",
                description: "The customer will receive an email with reset instructions.",
            });
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to send password reset",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Update customer info mutation
    const updateCustomerInfo = useMutation({
        mutationFn: async (updates: typeof editForm) => {
            const { data, error } = await supabase.functions.invoke("update-customer-info", {
                body: {
                    accountId,
                    updates: {
                        account: {
                            company_name: updates.company_name,
                            website: updates.website,
                            sales_notes: updates.sales_notes,
                        },
                        primaryContact: {
                            name: updates.contact_name,
                            email: updates.contact_email,
                            phone: updates.contact_phone,
                        },
                    },
                },
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast({ title: "Customer info updated" });
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ["sales-customer-detail", accountId] });
            queryClient.invalidateQueries({ queryKey: ["sales_team_accounts"] });
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to update",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: `${label} copied to clipboard` });
    };

    const primaryContact = account?.profiles?.find(p => p.is_primary) || account?.profiles?.[0];

    const planLabels: Record<string, string> = {
        // Current plans
        night_weekend: "Night & Weekend - $59/mo",
        lite: "Lite - $129/mo",
        core: "Core - $229/mo",
        pro: "Pro - $449/mo",
        // Legacy plan names (existing customers)
        starter: "Starter (legacy) - $99/mo",
        professional: "Professional (legacy) - $199/mo",
        premium: "Premium (legacy) - $399/mo",
    };

    const statusColors: Record<string, string> = {
        active: "bg-green-100 text-green-800",
        trial: "bg-blue-100 text-blue-800",
        past_due: "bg-red-100 text-red-800",
        canceled: "bg-gray-100 text-gray-800",
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Customer Details</SheetTitle>
                    <SheetDescription>
                        View and manage customer information
                    </SheetDescription>
                </SheetHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : account ? (
                    <div className="space-y-6 py-4">
                        {/* Company Info Card */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Building className="h-4 w-4" />
                                        {account.company_name}
                                    </CardTitle>
                                    <Badge className={statusColors[account.subscription_status] || "bg-gray-100"}>
                                        {account.subscription_status}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Plan</span>
                                    <span className="font-medium">
                                        {planLabels[account.plan_type] || account.plan_type}
                                    </span>
                                </div>
                                {account.website && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Website</span>
                                        <a
                                            href={account.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                            {new URL(account.website).hostname}
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                )}
                                {account.sales_rep_name && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Sales Rep</span>
                                        <span>{account.sales_rep_name}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* RingSnap Phone Number */}
                        {account.vapi_phone_number && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        RingSnap Number
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-lg">{account.vapi_phone_number}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(account.vapi_phone_number!, "Phone number")}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Primary Contact */}
                        {primaryContact && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">Primary Contact</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Name</span>
                                        <span>{primaryContact.name}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <Mail className="h-3 w-3" /> Email
                                        </span>
                                        <span>{primaryContact.email}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                            <Phone className="h-3 w-3" /> Phone
                                        </span>
                                        <span>{primaryContact.phone}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Edit Form */}
                        {isEditing && (
                            <Card className="border-blue-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">Edit Customer Info</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="company_name">Company Name</Label>
                                        <Input
                                            id="company_name"
                                            value={editForm.company_name}
                                            onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="website">Website</Label>
                                        <Input
                                            id="website"
                                            value={editForm.website}
                                            onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="contact_name">Contact Name</Label>
                                        <Input
                                            id="contact_name"
                                            value={editForm.contact_name}
                                            onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="contact_email">Contact Email</Label>
                                        <Input
                                            id="contact_email"
                                            type="email"
                                            value={editForm.contact_email}
                                            onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="contact_phone">Contact Phone</Label>
                                        <Input
                                            id="contact_phone"
                                            value={editForm.contact_phone}
                                            onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="sales_notes">Sales Notes</Label>
                                        <Input
                                            id="sales_notes"
                                            value={editForm.sales_notes}
                                            onChange={(e) => setEditForm({ ...editForm, sales_notes: e.target.value })}
                                            placeholder="Internal notes about this customer"
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-2">
                                        <Button
                                            onClick={() => updateCustomerInfo.mutate(editForm)}
                                            disabled={updateCustomerInfo.isPending}
                                        >
                                            {updateCustomerInfo.isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : null}
                                            Save Changes
                                        </Button>
                                        <Button variant="outline" onClick={() => setIsEditing(false)}>
                                            Cancel
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Actions */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Actions</h3>

                            {!isEditing && (
                                <Button variant="outline" className="w-full justify-start" onClick={handleEditClick}>
                                    <Building className="h-4 w-4 mr-2" />
                                    Edit Customer Info
                                </Button>
                            )}

                            {primaryContact?.email && (
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => sendPasswordReset.mutate(primaryContact.email)}
                                    disabled={sendPasswordReset.isPending}
                                >
                                    {sendPasswordReset.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                        <Key className="h-4 w-4 mr-2" />
                                    )}
                                    Send Password Reset
                                </Button>
                            )}

                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => {
                                    // Navigate to upgrade checkout - this is for viewing, not triggering a new checkout
                                    toast({
                                        title: "Plan changes",
                                        description: "To upgrade or change this customer's plan, please use the billing portal or contact support.",
                                    });
                                }}
                            >
                                <CreditCard className="h-4 w-4 mr-2" />
                                View Plan Options
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center text-muted-foreground">
                        Account not found
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
