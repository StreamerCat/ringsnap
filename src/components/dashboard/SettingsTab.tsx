
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { ServiceHoursEditor, ServiceHoursData } from "@/components/onboarding-chat/ServiceHoursEditor";
import { CallRecordingConsentDialog } from "@/components/CallRecordingConsentDialog";
import { Sparkles, Check, Loader2 } from "lucide-react";

interface SettingsTabProps {
    account: any;
    onUpdateAccount: (newAccount: any) => void;
    recordingState: any;
    onOpenUpgradeModal?: () => void;
}

export function SettingsTab({ account, onUpdateAccount, recordingState, onOpenUpgradeModal }: SettingsTabProps) {
    const { toast } = useToast();

    // Custom Instructions State
    const [customInstructions, setCustomInstructions] = useState(account.custom_instructions || "");
    const [savingInstructions, setSavingInstructions] = useState(false);

    // SMS Settings State
    const [smsAppointmentConfirmations, setSmsAppointmentConfirmations] = useState(account.sms_appointment_confirmations || false);
    const [smsReminders, setSmsReminders] = useState(account.sms_reminders || false);
    const [savingSmsSettings, setSavingSmsSettings] = useState(false);

    // Business Details State
    const [serviceArea, setServiceArea] = useState(account.service_area || "");
    const [emergencyPolicy, setEmergencyPolicy] = useState(account.emergency_policy || "");
    const [website, setWebsite] = useState(account.company_website || "");
    const [businessHours, setBusinessHours] = useState<ServiceHoursData | null>(account.business_hours as unknown as ServiceHoursData || null);
    const [showHoursEditor, setShowHoursEditor] = useState(false);
    const [savingBusinessDetails, setSavingBusinessDetails] = useState(false);

    // Call Recording State
    const [showRecordingConsent, setShowRecordingConsent] = useState(false);

    const handleSaveInstructions = async () => {
        setSavingInstructions(true);
        try {
            const { error } = await supabase
                .from('accounts')
                .update({ custom_instructions: customInstructions })
                .eq('id', account.id);
            if (error) throw error;
            onUpdateAccount({ ...account, custom_instructions: customInstructions });
            toast({ title: "Success", description: "Custom instructions updated" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setSavingInstructions(false);
        }
    };

    const handleSaveSmsSettings = async () => {
        setSavingSmsSettings(true);
        try {
            const { error } = await supabase
                .from("accounts")
                .update({
                    sms_appointment_confirmations: smsAppointmentConfirmations,
                    sms_reminders: smsReminders
                })
                .eq("id", account.id);

            if (error) throw error;

            onUpdateAccount({
                ...account,
                sms_appointment_confirmations: smsAppointmentConfirmations,
                sms_reminders: smsReminders
            });
            toast({ title: "Success", description: "SMS settings updated" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setSavingSmsSettings(false);
        }
    };

    const handleSaveBusinessDetails = async () => {
        setSavingBusinessDetails(true);
        try {
            const { error } = await supabase
                .from("accounts")
                .update({
                    service_area: serviceArea,
                    emergency_policy: emergencyPolicy,
                    company_website: website,
                    business_hours: businessHours as any
                })
                .eq("id", account.id);

            if (error) throw error;

            onUpdateAccount({
                ...account,
                service_area: serviceArea,
                emergency_policy: emergencyPolicy,
                company_website: website,
                business_hours: businessHours
            });
            setShowHoursEditor(false);
            toast({ title: "Success", description: "Business details updated" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setSavingBusinessDetails(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Custom Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Assistant Customization
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="customInstructions">Custom Instructions</Label>
                        <Textarea
                            id="customInstructions"
                            placeholder="e.g., Always mention our 24/7 emergency service..."
                            value={customInstructions}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                            rows={6}
                            maxLength={500}
                            className="resize-none"
                        />
                        <div className="flex items-center justify-between text-sm">
                            <span className={customInstructions.length > 450 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}>
                                {customInstructions.length}/500 characters
                            </span>
                            <span className="text-muted-foreground text-xs">Updates take effect on next call</span>
                        </div>
                    </div>
                    <Button onClick={handleSaveInstructions} disabled={savingInstructions}>
                        {savingInstructions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Save Instructions
                    </Button>
                </CardContent>
            </Card>

            {/* Call Recording */}
            <Card>
                <CardHeader>
                    <CardTitle>Call Recording</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {account.plan_type === 'starter' ? (
                        <div className="bg-muted p-4 rounded-lg">
                            <p className="font-semibold mb-2">Upgrade to Professional or Premium</p>
                            <p className="text-sm text-muted-foreground mb-3">
                                Call recording is available on Professional and Premium plans
                            </p>
                            <Button size="sm" onClick={onOpenUpgradeModal}>Upgrade Now</Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Enable Call Recording</Label>
                                    <p className="text-sm text-muted-foreground">Record all calls for quality</p>
                                </div>
                                <Switch
                                    checked={account.call_recording_enabled}
                                    onCheckedChange={async (checked) => {
                                        if (checked && !account.call_recording_consent_accepted) {
                                            setShowRecordingConsent(true);
                                            return;
                                        }

                                        // Toggle logic
                                        try {
                                            const { error } = await supabase
                                                .from("accounts")
                                                .update({ call_recording_enabled: checked })
                                                .eq("id", account.id);

                                            if (error) throw error;
                                            onUpdateAccount({ ...account, call_recording_enabled: checked });
                                            toast({ title: "Updated", description: `Call recording ${checked ? 'enabled' : 'disabled'}` });
                                        } catch (error: any) {
                                            toast({ title: "Error", description: error.message, variant: "destructive" });
                                        }
                                    }}
                                />
                            </div>
                            <CallRecordingConsentDialog
                                open={showRecordingConsent}
                                onOpenChange={setShowRecordingConsent}
                                stateName={recordingState?.state_name || "Unknown"}
                                consentType={recordingState?.consent_type || "two-party"}
                                notificationText={recordingState?.required_notification_text || "This call is being recorded."}
                                onAccept={async () => {
                                    try {
                                        const { error } = await supabase
                                            .from("accounts")
                                            .update({
                                                call_recording_enabled: true,
                                                call_recording_consent_accepted: true,
                                                call_recording_consent_date: new Date().toISOString()
                                            })
                                            .eq("id", account.id);

                                        if (error) throw error;
                                        onUpdateAccount({
                                            ...account,
                                            call_recording_enabled: true,
                                            call_recording_consent_accepted: true,
                                            call_recording_consent_date: new Date().toISOString()
                                        });
                                        toast({ title: "Recording Enabled", description: "Call recording has been enabled" });
                                        setShowRecordingConsent(false);
                                    } catch (error: any) {
                                        toast({ title: "Error", description: error.message, variant: "destructive" });
                                    }
                                }}
                            />
                            {recordingState && (
                                <div className="bg-muted/50 p-3 rounded text-sm">
                                    <p><strong>State:</strong> {recordingState.state_name}</p>
                                    <p><strong>Consent Type:</strong> {recordingState.consent_type}</p>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Business Details */}
            <Card>
                <CardHeader>
                    <CardTitle>Business Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="website">Website</Label>
                            <Input
                                id="website"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                                placeholder="https://example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="serviceArea">Service Area</Label>
                            <Input
                                id="serviceArea"
                                value={serviceArea}
                                onChange={(e) => setServiceArea(e.target.value)}
                                placeholder="e.g. Denver Metro Area"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="emergencyPolicy">Emergency Policy</Label>
                        <Textarea
                            id="emergencyPolicy"
                            value={emergencyPolicy}
                            onChange={(e) => setEmergencyPolicy(e.target.value)}
                            placeholder="How should we handle emergencies?"
                        />
                    </div>

                    <div className="border rounded-md p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-medium">Business Hours</h3>
                            <Button variant="outline" size="sm" onClick={() => setShowHoursEditor(!showHoursEditor)}>
                                {showHoursEditor ? "Hide Editor" : "Edit Hours"}
                            </Button>
                        </div>
                        {showHoursEditor ? (
                            <ServiceHoursEditor
                                initialData={businessHours || undefined}
                                onSubmit={(data) => {
                                    setBusinessHours(data);
                                    // setShowHoursEditor(false); // Let the main save button handle closing?
                                }}
                            />
                        ) : (
                            <div className="text-sm text-muted-foreground">
                                {businessHours ? "Hours configured." : "No hours configured (24/7)"}
                            </div>
                        )}
                    </div>

                    <Button onClick={handleSaveBusinessDetails} disabled={savingBusinessDetails}>
                        {savingBusinessDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Business Details"}
                    </Button>
                </CardContent>
            </Card>

            {/* SMS Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>SMS Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Appointment Confirmations</Label>
                        <Switch checked={smsAppointmentConfirmations} onCheckedChange={setSmsAppointmentConfirmations} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Reminder Messages</Label>
                        <Switch checked={smsReminders} onCheckedChange={setSmsReminders} />
                    </div>
                    <Button onClick={handleSaveSmsSettings} disabled={savingSmsSettings}>
                        {savingSmsSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save SMS Settings"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
