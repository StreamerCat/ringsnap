
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServiceHoursEditor, ServiceHoursData } from "@/components/onboarding-chat/ServiceHoursEditor";
import { CallRecordingConsentDialog } from "@/components/CallRecordingConsentDialog";
import { Sparkles, Check, Loader2, Bell, PhoneCall, AlertTriangle } from "lucide-react";
import { featureFlags } from "@/lib/featureFlags";
import { trackOnboardingEvent } from "@/lib/sentry-tracking";
import { cn } from "@/lib/utils";
import { getDashboardPlanByKey } from "@/lib/billing/dashboardPlans";

// ToggleRow component for consistent layout
interface ToggleRowProps {
    label: string;
    description?: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    loading?: boolean;
    size?: 'default' | 'sm';
}

function ToggleRow({ label, description, checked, onCheckedChange, disabled, loading, size = 'default' }: ToggleRowProps) {
    return (
        <div className={cn(
            "flex items-center justify-between gap-4",
            size === 'sm' && "py-1"
        )}>
            <div className="flex-1 min-w-0">
                <Label className={cn(size === 'sm' && "text-sm font-normal")}>{label}</Label>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                    checked={checked}
                    onCheckedChange={onCheckedChange}
                    disabled={disabled || loading}
                />
            </div>
        </div>
    );
}

interface SettingsTabProps {
    account: any;
    onUpdateAccount: (newAccount: any) => void;
    recordingState: any;
    onOpenUpgradeModal?: () => void;
}

const COMMON_TIMEZONES = [
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Phoenix", label: "Arizona (MST)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "America/Anchorage", label: "Alaska Time (AKT)" },
    { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

export function SettingsTab({ account, onUpdateAccount, recordingState, onOpenUpgradeModal }: SettingsTabProps) {
    const { toast } = useToast();

    // 4e: Call Handling Preferences state
    const currentPlan = getDashboardPlanByKey(account.plan_key || account.plan_type);
    const [overflowBehavior, setOverflowBehavior] = useState<"always_answer" | "soft_cap" | "hard_cap">(
        account.overflow_behavior || "always_answer"
    );
    const [softCapBuffer, setSoftCapBuffer] = useState<number>(account.soft_cap_overage_minutes ?? 100);
    const [savingCallHandling, setSavingCallHandling] = useState(false);

    const handleSaveCallHandling = async () => {
        setSavingCallHandling(true);
        try {
            const { error } = await supabase
                .from("accounts")
                .update({
                    overflow_behavior: overflowBehavior,
                    soft_cap_overage_minutes: softCapBuffer,
                })
                .eq("id", account.id);
            if (error) throw error;
            onUpdateAccount({ ...account, overflow_behavior: overflowBehavior, soft_cap_overage_minutes: softCapBuffer });
            toast({ title: "Call handling preference saved" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setSavingCallHandling(false);
        }
    };

    // Custom Instructions State
    const [customInstructions, setCustomInstructions] = useState(account.custom_instructions || "");
    const [savingInstructions, setSavingInstructions] = useState(false);

    // Notification Settings State
    const [notifSmsPhone, setNotifSmsPhone] = useState(account.notification_sms_phone || "");
    const [notifEmail, setNotifEmail] = useState(account.notification_email || "");
    const [timezone, setTimezone] = useState(account.timezone || "America/Denver");

    // Notification Toggles
    const [notifyContractorEmail, setNotifyContractorEmail] = useState(account.notify_contractor_email ?? true);
    const [notifyCallerSms, setNotifyCallerSms] = useState(account.notify_caller_sms ?? true);
    const [notifyCallerEmail, setNotifyCallerEmail] = useState(account.notify_caller_email ?? true);

    // Existing SMS Toggles (Contractor)
    const [smsEnabled, setSmsEnabled] = useState(account.sms_enabled ?? true);
    const [smsAppointmentConfirmations, setSmsAppointmentConfirmations] = useState(account.sms_appointment_confirmations || false);
    const [smsReminders, setSmsReminders] = useState(account.sms_reminders || false);

    const [savingNotifications, setSavingNotifications] = useState(false);


    // Business Details State
    const [serviceArea, setServiceArea] = useState(account.service_area || "");
    const [emergencyPolicy, setEmergencyPolicy] = useState(account.emergency_policy || "");
    const [website, setWebsite] = useState(account.company_website || "");
    const [businessHours, setBusinessHours] = useState<ServiceHoursData | null>(account.business_hours as unknown as ServiceHoursData || null);
    const [showHoursEditor, setShowHoursEditor] = useState(false);
    const [savingBusinessDetails, setSavingBusinessDetails] = useState(false);

    // Call Recording State
    const [showRecordingConsent, setShowRecordingConsent] = useState(false);
    const [updatingRecording, setUpdatingRecording] = useState(false);

    // Handle call recording toggle with immediate assistant update
    const handleRecordingToggle = useCallback(async (checked: boolean) => {
        if (checked && !account.call_recording_consent_accepted) {
            setShowRecordingConsent(true);
            return;
        }

        setUpdatingRecording(true);
        try {
            // Update database
            const { error } = await supabase
                .from("accounts")
                .update({ call_recording_enabled: checked })
                .eq("id", account.id);

            if (error) throw error;

            // Track event
            trackOnboardingEvent('settings.call_recording_toggled', {
                enabled: checked,
                accountId: account.id
            });

            // Trigger assistant rebuild if feature flag enabled
            if (featureFlags.callRecordingImmediateApply) {
                try {
                    const { error: rebuildError } = await supabase.functions.invoke('rebuild-assistant', {
                        body: { accountId: account.id, updateRecording: true }
                    });

                    if (rebuildError) {
                        console.warn('Assistant rebuild failed:', rebuildError);
                        // Don't fail the toggle - recording preference is saved
                    } else {
                        trackOnboardingEvent('settings.assistant_updated', {
                            reason: 'call_recording_toggle'
                        });
                    }
                } catch (rebuildErr) {
                    console.warn('Assistant rebuild error:', rebuildErr);
                }
            }

            onUpdateAccount({ ...account, call_recording_enabled: checked });
            toast({
                title: "Updated",
                description: `Call recording ${checked ? 'enabled' : 'disabled'}${featureFlags.callRecordingImmediateApply ? ' - takes effect immediately' : ''}`
            });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setUpdatingRecording(false);
        }
    }, [account, onUpdateAccount, toast]);

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

    const handleSaveNotifications = async () => {
        setSavingNotifications(true);
        try {
            const updates = {
                notification_sms_phone: notifSmsPhone || null,
                notification_email: notifEmail || null,
                timezone: timezone,
                notify_contractor_email: notifyContractorEmail,
                notify_caller_sms: notifyCallerSms,
                notify_caller_email: notifyCallerEmail,
                sms_enabled: smsEnabled,
                sms_appointment_confirmations: smsAppointmentConfirmations,
                sms_reminders: smsReminders
            };

            const { error } = await supabase
                .from("accounts")
                .update(updates)
                .eq("id", account.id);

            if (error) throw error;

            onUpdateAccount({
                ...account,
                ...updates
            });
            toast({ title: "Success", description: "Notification settings updated" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setSavingNotifications(false);
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
            {/* 4e: Call Handling Preferences */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PhoneCall className="h-5 w-5 text-primary" />
                        Call Handling Preferences
                    </CardTitle>
                    <CardDescription>
                        What happens when you reach your monthly minutes?
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        {/* Option 1: Always answer */}
                        <label className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            overflowBehavior === "always_answer" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        )}>
                            <input
                                type="radio"
                                name="overflow"
                                value="always_answer"
                                checked={overflowBehavior === "always_answer"}
                                onChange={() => setOverflowBehavior("always_answer")}
                                className="mt-1"
                            />
                            <div>
                                <p className="font-medium text-sm">
                                    Always answer <span className="text-xs text-muted-foreground ml-1">(recommended)</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    We'll keep answering calls and bill overage at your plan's rate.
                                    You'll never miss an emergency — we'll alert you so you can upgrade if needed.
                                </p>
                            </div>
                        </label>

                        {/* Option 2: Soft cap */}
                        <label className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            overflowBehavior === "soft_cap" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        )}>
                            <input
                                type="radio"
                                name="overflow"
                                value="soft_cap"
                                checked={overflowBehavior === "soft_cap"}
                                onChange={() => setOverflowBehavior("soft_cap")}
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <p className="font-medium text-sm">Answer up to extra minutes, then pause</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Set a buffer. We'll answer up to your limit, then route to voicemail.
                                </p>
                                {overflowBehavior === "soft_cap" && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <Label className="text-xs whitespace-nowrap">Buffer minutes:</Label>
                                        <Input
                                            type="number"
                                            min={10}
                                            max={currentPlan?.systemCeilingMinutes ?? 200}
                                            value={softCapBuffer}
                                            onChange={(e) => setSoftCapBuffer(Math.max(10, parseInt(e.target.value) || 10))}
                                            className="h-7 w-24 text-sm"
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            ≈ ${((softCapBuffer) * (currentPlan?.overageRate ?? 0.28)).toFixed(2)} extra
                                        </span>
                                    </div>
                                )}
                            </div>
                        </label>

                        {/* Option 3: Hard cap */}
                        <label className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            overflowBehavior === "hard_cap" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        )}>
                            <input
                                type="radio"
                                name="overflow"
                                value="hard_cap"
                                checked={overflowBehavior === "hard_cap"}
                                onChange={() => setOverflowBehavior("hard_cap")}
                                className="mt-1"
                            />
                            <div>
                                <p className="font-medium text-sm">Stop at my included minutes</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Calls route to voicemail once your included minutes are used.
                                    Not recommended for emergency-prone trades (HVAC, plumbing, electrical).
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Warning for non-default options */}
                    {(overflowBehavior === "hard_cap" || overflowBehavior === "soft_cap") && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-900 flex gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                                Missed calls cost an average of $300–$1,200 each. We recommend <strong>Always Answer</strong> to ensure you never lose a job to a competitor.
                            </span>
                        </div>
                    )}

                    <Button onClick={handleSaveCallHandling} disabled={savingCallHandling}>
                        {savingCallHandling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Save Preference
                    </Button>

                    {/* System ceiling disclosure */}
                    {currentPlan && (
                        <p className="text-xs text-muted-foreground mt-2">
                            As a safety guardrail, we pause calls if your overage reaches{" "}
                            <strong>{currentPlan.systemCeilingMinutes} minutes</strong> above your plan (about{" "}
                            <strong>${(currentPlan.systemCeilingMinutes * currentPlan.overageRate).toFixed(0)} extra</strong>).
                            You'll be alerted immediately if this happens.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Custom Instructions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Assistant Voice & Rules
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

            {/* Notifications Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" />
                        Notifications & Appointments
                    </CardTitle>
                    <CardDescription>
                        Configure how you and your callers are notified about appointments.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Contact Info */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="timezone">Timezone</Label>
                            <Select value={timezone} onValueChange={setTimezone}>
                                <SelectTrigger id="timezone">
                                    <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                                <SelectContent>
                                    {COMMON_TIMEZONES.map((tz) => (
                                        <SelectItem key={tz.value} value={tz.value}>
                                            {tz.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notifPhone">Contractor SMS Phone</Label>
                            <Input
                                id="notifPhone"
                                value={notifSmsPhone}
                                onChange={(e) => setNotifSmsPhone(e.target.value)}
                                placeholder="+15550001234"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notifEmail">Contractor Email</Label>
                            <Input
                                id="notifEmail"
                                value={notifEmail}
                                onChange={(e) => setNotifEmail(e.target.value)}
                                placeholder="you@company.com"
                            />
                        </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Contractor Notifications</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Enable SMS Notifications</Label>
                                <p className="text-sm text-muted-foreground">Receive texts for new bookings & reminders</p>
                            </div>
                            <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
                        </div>
                        {smsEnabled && (
                            <div className="ml-4 space-y-4 border-l pl-4">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm">New Booking Confirmations</Label>
                                    <Switch checked={smsAppointmentConfirmations} onCheckedChange={setSmsAppointmentConfirmations} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm">Appointment Reminders</Label>
                                    <Switch checked={smsReminders} onCheckedChange={setSmsReminders} />
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Enable Email Notifications</Label>
                                <p className="text-sm text-muted-foreground">Receive details via email</p>
                            </div>
                            <Switch checked={notifyContractorEmail} onCheckedChange={setNotifyContractorEmail} />
                        </div>
                    </div>

                    <div className="border-t pt-4 space-y-4">
                        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Caller Notifications</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Notify Caller via SMS</Label>
                                <p className="text-sm text-muted-foreground">Send confirmation & reminder texts to caller</p>
                            </div>
                            <Switch checked={notifyCallerSms} onCheckedChange={setNotifyCallerSms} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Notify Caller via Email</Label>
                                <p className="text-sm text-muted-foreground">Send confirmation emails to caller (if email provided)</p>
                            </div>
                            <Switch checked={notifyCallerEmail} onCheckedChange={setNotifyCallerEmail} />
                        </div>
                    </div>

                    <Button onClick={handleSaveNotifications} disabled={savingNotifications}>
                        {savingNotifications ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Notification Settings"}
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
                            <ToggleRow
                                label="Enable Call Recording"
                                description="Record all calls for quality and training"
                                checked={account.call_recording_enabled || false}
                                onCheckedChange={handleRecordingToggle}
                                loading={updatingRecording}
                            />
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
        </div>
    );
}
