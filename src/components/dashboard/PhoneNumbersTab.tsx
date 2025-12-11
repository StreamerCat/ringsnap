
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneNumberCard } from "@/components/PhoneNumberCard";
import { HelpCircle, Phone, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface PhoneNumbersTabProps {
    account: any;
    phoneNumbers: any[];
}

export function PhoneNumbersTab({ account, phoneNumbers }: PhoneNumbersTabProps) {
    const [showForwardingInfo, setShowForwardingInfo] = useState(false);
    const [showTestInfo, setShowTestInfo] = useState(false);
    const [editingNumber, setEditingNumber] = useState<any>(null);
    const [editLabel, setEditLabel] = useState("");
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    // Choose a primary RingSnap number to display.
    const primaryNumber = useMemo(() => {
        if (!phoneNumbers?.length) return null;
        return phoneNumbers.find((p) => p.is_primary) || phoneNumbers[0];
    }, [phoneNumbers]);

    const hasNumbers = phoneNumbers && phoneNumbers.length > 0;
    const formattedPrimaryNumber = primaryNumber?.phone_number;

    const handleEditNumber = (phone: any) => {
        setEditingNumber(phone);
        setEditLabel(phone.label || "");
    };

    const handleSaveEdit = async () => {
        if (!editingNumber) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from("phone_numbers")
                .update({ label: editLabel })
                .eq("id", editingNumber.id);

            if (error) throw error;

            toast({
                title: "Success",
                description: "Phone number updated"
            });

            setEditingNumber(null);
            // Trigger parent refresh
            window.location.reload();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to update phone number",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSetPrimary = async (phoneId: string) => {
        try {
            // First, unset all primary flags for this account
            await supabase
                .from("phone_numbers")
                .update({ is_primary: false })
                .eq("account_id", account.id);

            // Then set the selected number as primary
            const { error } = await supabase
                .from("phone_numbers")
                .update({ is_primary: true })
                .eq("id", phoneId);

            if (error) throw error;

            toast({
                title: "Success",
                description: "Primary number updated"
            });

            // Trigger parent refresh
            window.location.reload();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to set primary number",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Helper Card: Get your RingSnap assistant answering calls */}
            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            Get your RingSnap assistant answering calls
                        </h3>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>Step 1: Forward your main business phone to your RingSnap number.</p>
                            <p>Step 2: Call your RingSnap number to test your assistant.</p>
                        </div>
                        {formattedPrimaryNumber && (
                            <div className="mt-2 text-sm">
                                Your RingSnap number: <span className="font-mono font-bold text-foreground">{formattedPrimaryNumber}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <Button
                            variant="default"
                            onClick={() => setShowForwardingInfo(true)}
                            disabled={!hasNumbers}
                        >
                            <HelpCircle className="mr-2 h-4 w-4" />
                            How to Forward Calls
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => setShowTestInfo(true)}
                            disabled={!hasNumbers}
                        >
                            <Phone className="mr-2 h-4 w-4" />
                            Test My Assistant
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Header + Add Button */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Your Phone Numbers</h2>
                <Button disabled={account.plan_type === "starter"}>
                    {account.plan_type === "starter"
                        ? "Upgrade to Add Numbers"
                        : "Add Phone Number"}
                </Button>
            </div>

            {/* Numbers list / empty state */}
            {!hasNumbers ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                        <p>No phone numbers yet.</p>
                        <p className="text-sm">
                            Once your trial provisioning completes, your RingSnap number will
                            appear here along with forwarding instructions.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {phoneNumbers.map((phone) => (
                        <PhoneNumberCard
                            key={phone.id}
                            number={phone.phone_number}
                            label={phone.label}
                            status={phone.status}
                            isPrimary={phone.is_primary}
                            linkedAssistant={phone.purpose}
                            onEdit={() => handleEditNumber(phone)}
                            onSetPrimary={() => handleSetPrimary(phone.id)}
                        />
                    ))}
                </div>
            )}

            {/* Forwarding instructions modal */}
            <Dialog open={showForwardingInfo} onOpenChange={setShowForwardingInfo}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Call Forwarding Instructions</DialogTitle>
                        <DialogDescription className="space-y-4 pt-2">
                            <p>
                                Forward your main business phone to your RingSnap number so
                                your assistant can answer calls. You can turn forwarding off at any time.
                            </p>
                            {formattedPrimaryNumber ? (
                                <div className="bg-muted p-3 rounded-md text-center">
                                    <span className="text-sm text-muted-foreground">Your RingSnap Number</span>
                                    <div className="font-mono font-bold text-lg text-foreground">{formattedPrimaryNumber}</div>
                                </div>
                            ) : (
                                <p className="text-warning">RingSnap number not found.</p>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-2">
                        <Tabs defaultValue="verizon" className="w-full">
                            <TabsList className="grid w-full grid-cols-4 mb-4">
                                <TabsTrigger value="verizon">Verizon</TabsTrigger>
                                <TabsTrigger value="att">AT&T</TabsTrigger>
                                <TabsTrigger value="tmobile">T-Mobile</TabsTrigger>
                                <TabsTrigger value="other">Other</TabsTrigger>
                            </TabsList>

                            <TabsContent value="verizon">
                                <CarrierInstructions
                                    carrierName="Verizon"
                                    ringSnapNumber={formattedPrimaryNumber}
                                    forwardCode="*72"
                                    disableCode="*73"
                                />
                            </TabsContent>

                            <TabsContent value="att">
                                <CarrierInstructions
                                    carrierName="AT&T"
                                    ringSnapNumber={formattedPrimaryNumber}
                                    forwardCode="*72"
                                    disableCode="*73"
                                />
                            </TabsContent>

                            <TabsContent value="tmobile">
                                <CarrierInstructions
                                    carrierName="T-Mobile"
                                    ringSnapNumber={formattedPrimaryNumber}
                                    forwardCode="**21*"
                                    disableCode="##21#"
                                />
                            </TabsContent>

                            <TabsContent value="other">
                                <div className="space-y-3 text-sm text-muted-foreground p-2">
                                    <p>
                                        Most carriers support call forwarding using a star code.
                                        Search for "call forwarding [your carrier]" or contact them and ask to forward your calls to:
                                    </p>
                                    <p className="font-mono font-bold text-foreground text-center py-2 bg-muted rounded">
                                        {formattedPrimaryNumber || "your RingSnap number"}
                                    </p>
                                    <p>
                                        You can also contact RingSnap support for help.
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
                            <p className="font-semibold mb-1">How to stop using the assistant:</p>
                            <p>
                                To temporarily turn off your RingSnap assistant, simply turn off call forwarding using the
                                "Turn forwarding off" steps above. Callers will reach your normal business line again.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Test Assistant Dialog */}
            <Dialog open={showTestInfo} onOpenChange={setShowTestInfo}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Test Your Assistant</DialogTitle>
                        <DialogDescription>
                            Call your RingSnap number to hear your assistant in action.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center justify-center space-y-4 py-4">
                        <div className="text-3xl font-mono font-bold tracking-wider">
                            {formattedPrimaryNumber}
                        </div>
                        <Button asChild size="lg" className="w-full sm:w-auto">
                            <a href={`tel:${formattedPrimaryNumber}`}>
                                <Phone className="mr-2 h-4 w-4" />
                                Call Now
                            </a>
                        </Button>
                        <p className="text-xs text-muted-foreground text-center px-8">
                            Use a different phone (like your personal cell) to call this number so you can experience it as a customer would.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Number Dialog */}
            <Dialog open={!!editingNumber} onOpenChange={(open) => !open && setEditingNumber(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Phone Number</DialogTitle>
                        <DialogDescription>
                            Update the label for {editingNumber?.phone_number}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-label">Label</Label>
                            <Input
                                id="edit-label"
                                placeholder="e.g., Main Line, Support"
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingNumber(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

interface CarrierInstructionsProps {
    carrierName: string;
    ringSnapNumber?: string;
    forwardCode: string;
    disableCode: string;
}

function CarrierInstructions({
    carrierName,
    ringSnapNumber,
    forwardCode,
    disableCode,
}: CarrierInstructionsProps) {
    return (
        <div className="space-y-4 p-2">
            <div>
                <p className="font-semibold text-sm mb-2">Turn forwarding on ({carrierName})</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Open the Phone app on your business phone.</li>
                    <li>
                        Dial{" "}
                        <span className="font-mono font-semibold text-foreground">
                            {forwardCode}
                            {ringSnapNumber ? ` ${ringSnapNumber}` : " [your RingSnap number]"}
                        </span>
                        .
                    </li>
                    <li>Press Call.</li>
                    <li>Wait for the confirmation tone or message, then hang up.</li>
                </ol>
            </div>

            <div>
                <p className="font-semibold text-sm mb-2">Turn forwarding off</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Open the Phone app.</li>
                    <li>
                        Dial{" "}
                        <span className="font-mono font-semibold text-foreground">
                            {disableCode}
                        </span>{" "}
                        and press Call.
                    </li>
                    <li>Wait for the confirmation tone, then hang up.</li>
                </ol>
            </div>
        </div>
    );
}
