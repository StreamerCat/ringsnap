import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Phone, Clock, Calendar, FileText, Target, ArrowRight, MapPin, MessageSquare, Mail, PhoneCall } from "lucide-react";
import { cn, formatPhoneNumber as formatPhoneUtil } from "@/lib/utils";
import {
    calculateLeadScore,
    getLeadScoreLabel,
    getLeadScoreClasses,
    type CallLog
} from "@/lib/leadScore";
import {
    sanitizeCallText,
    deriveTopicLabels,
    formatTopicDisplay,
    deriveOutcome,
    deriveNextStep,
    deriveWhyItMatters,
    type OutcomeInput
} from "@/lib/call-text-utils";
import {
    getDisplayName,
    getDisplayAddress,
    getAppointmentDisplay,
    formatPhoneNumber,
    type CallLogWithAppointment
} from "@/lib/appointments";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface CallDetailsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    call: CallLog | null;
    companyName?: string;
    /** Sheet opening side - "right" for desktop, "bottom" for mobile */
    side?: "right" | "bottom";
}

/**
 * Operating console drawer for call details.
 * Shows caller info, topics, outcome, next step, and job details.
 */
export function CallDetailsDrawer({ open, onOpenChange, call, companyName, side = "right" }: CallDetailsDrawerProps) {
    if (!call) return null;

    const callWithAppointment = call as CallLogWithAppointment;

    // Derive display values using new utilities
    const displayName = getDisplayName(callWithAppointment);
    const callerPhone = callWithAppointment.caller_phone || callWithAppointment.from_number || '';
    const callbackPhone = (callWithAppointment as any).callback_phone;
    const hasCallback = callbackPhone && callbackPhone !== callerPhone;

    // Topic derivation
    const topics = deriveTopicLabels({
        reason: call.reason,
        summary: call.transcript_summary,
    });

    // Outcome and next step
    const appointmentDisplay = getAppointmentDisplay(callWithAppointment);
    const outcomeInput: OutcomeInput = {
        call: callWithAppointment,
        hasAppointment: appointmentDisplay.hasDateTime,
        appointmentStart: appointmentDisplay.start?.toISOString()
    };
    const outcome = deriveOutcome(outcomeInput);
    const nextStep = deriveNextStep(outcomeInput);
    const whyItMatters = deriveWhyItMatters(outcomeInput);

    // Lead score
    const score = calculateLeadScore(call);
    const scoreLabel = getLeadScoreLabel(score);
    const scoreClasses = getLeadScoreClasses(score);

    // Address
    const address = getDisplayAddress(callWithAppointment);
    const hasAddress = address !== 'Address not provided';

    // Sanitized text
    const sanitizedReason = sanitizeCallText(call.reason, { companyName });
    const sanitizedSummary = sanitizeCallText(call.transcript_summary, { companyName });

    // Format duration as mm:ss
    const formatDuration = (seconds: number | undefined) => {
        if (!seconds) return "N/A";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Outcome badge colors
    const getOutcomeColor = () => {
        switch (outcome) {
            case 'Booked': return 'bg-green-100 text-green-800 border-green-200';
            case 'Follow-up': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Missed': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    // Get preferred contact number
    const preferredPhone = hasCallback ? callbackPhone : callerPhone;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side={side}
                className={cn(
                    "overflow-y-auto",
                    side === "bottom" ? "h-[85vh] rounded-t-lg" : "w-full sm:max-w-lg"
                )}
                data-testid="call-details-drawer"
            >
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Call Details
                    </SheetTitle>
                    <SheetDescription>
                        Review and take next action
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-5">
                    {/* Caller Block */}
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="font-semibold text-lg">{displayName}</p>
                                <p className="text-sm text-muted-foreground">
                                    {formatPhoneNumber(callerPhone)}
                                </p>
                                {hasCallback && (
                                    <p className="text-sm text-primary font-medium mt-1">
                                        Callback: {formatPhoneNumber(callbackPhone)}
                                    </p>
                                )}
                            </div>
                            <Badge className={cn("border", getOutcomeColor())}>
                                {outcome}
                            </Badge>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2 mt-3">
                            <Button size="sm" variant="outline" className="flex-1" asChild>
                                <a href={`tel:${preferredPhone}`}>
                                    <PhoneCall className="h-4 w-4 mr-1" />
                                    Call
                                </a>
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1" asChild>
                                <a href={`sms:${preferredPhone}`}>
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    Text
                                </a>
                            </Button>
                        </div>
                    </div>

                    {/* Topic Chips + Lead Score */}
                    <div className="flex flex-wrap items-center gap-2">
                        {topics.map((topic, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                                {topic}
                            </Badge>
                        ))}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border cursor-help", scoreClasses)}>
                                    {score}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[200px]">
                                <p className="text-xs font-medium">{scoreLabel} Lead</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {/* Why It Matters */}
                    {outcome !== 'Info-only' && (
                        <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded">
                            {whyItMatters}
                        </div>
                    )}

                    {/* Next Step (Always Visible) */}
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                        <h4 className="text-sm font-medium flex items-center gap-1 text-primary">
                            <ArrowRight className="h-4 w-4" />
                            Next Step
                        </h4>
                        <p className="text-sm mt-1">
                            {nextStep}
                        </p>
                    </div>

                    <Separator />

                    {/* Job Details Block */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Job Details</h4>

                        {/* Address */}
                        {hasAddress && (
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <p className="text-sm">{address}</p>
                            </div>
                        )}

                        {/* Appointment */}
                        {appointmentDisplay.hasDateTime && (
                            <div className="flex items-start gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium">{appointmentDisplay.displayDay}</p>
                                    <p className="text-xs text-muted-foreground">{appointmentDisplay.displayWhen}</p>
                                </div>
                            </div>
                        )}

                        {/* Duration */}
                        <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <p className="text-sm">Call duration: {formatDuration(call.duration_seconds)}</p>
                        </div>
                    </div>

                    {/* Summary */}
                    {sanitizedSummary && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                    <FileText className="h-4 w-4" />
                                    Summary
                                </h4>
                                <p className="text-sm bg-muted p-3 rounded-lg">
                                    {sanitizedSummary}
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
