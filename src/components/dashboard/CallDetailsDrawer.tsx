import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Phone, Clock, Calendar, FileText, Target, ArrowRight } from "lucide-react";
import {
    calculateLeadScore,
    getLeadScoreLabel,
    getLeadScoreReason,
    getLeadScoreClasses,
    type CallLog
} from "@/lib/leadScore";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface CallDetailsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    call: CallLog | null;
}

/**
 * Side drawer showing detailed call information.
 * Opens on row click in call logs table.
 * 
 * Displays:
 * - Caller info
 * - Duration and time
 * - Transcript summary (if available)
 * - Extracted reason
 * - Outcome badge
 * - Lead score with explanation tooltip
 * - Suggested next step
 */
export function CallDetailsDrawer({ open, onOpenChange, call }: CallDetailsDrawerProps) {
    if (!call) return null;

    const score = calculateLeadScore(call);
    const scoreLabel = getLeadScoreLabel(score);
    const scoreReason = getLeadScoreReason(call);
    const scoreClasses = getLeadScoreClasses(score);

    // Format duration as mm:ss
    const formatDuration = (seconds: number | undefined) => {
        if (!seconds) return "N/A";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Generate suggested next step based on outcome
    const getSuggestedNextStep = (): string => {
        if (call.booked || call.outcome === 'booked') {
            return "Confirm appointment details via SMS/email";
        }
        if (call.lead_captured || call.outcome === 'lead') {
            return "Follow up with quote or more information";
        }
        if (call.reason && (call.duration_seconds ?? 0) > 60) {
            return "Send follow-up message to continue conversation";
        }
        if ((call.duration_seconds ?? 0) < 30) {
            return "No action needed - likely brief inquiry";
        }
        return "Review call details and decide on follow-up";
    };

    // Get outcome badge
    const getOutcomeBadge = () => {
        if (call.booked || call.outcome === 'booked') {
            return <Badge className="bg-green-100 text-green-800">Booked</Badge>;
        }
        if (call.lead_captured || call.outcome === 'lead') {
            return <Badge className="bg-blue-100 text-blue-800">Lead</Badge>;
        }
        if (call.outcome === 'missed' || call.outcome === 'voicemail') {
            return <Badge className="bg-amber-100 text-amber-800">Missed</Badge>;
        }
        return <Badge variant="secondary">Completed</Badge>;
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Call Details
                    </SheetTitle>
                    <SheetDescription>
                        View full details and suggested next steps
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* Caller Info */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Caller</h4>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold">
                                    {call.caller_name || "Unknown Caller"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {call.caller_phone || "No number"}
                                </p>
                            </div>
                            {getOutcomeBadge()}
                        </div>
                    </div>

                    <Separator />

                    {/* Call Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Duration</p>
                                <p className="font-medium">{formatDuration(call.duration_seconds)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-xs text-muted-foreground">Lead Score</p>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border cursor-help ${scoreClasses}`}>
                                            {score} · {scoreLabel}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-[200px]">
                                        <p className="text-xs">{scoreReason}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    </div>

                    {/* Reason */}
                    {call.reason && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    Reason for Call
                                </h4>
                                <p className="text-sm bg-muted p-3 rounded-lg">
                                    {call.reason}
                                </p>
                            </div>
                        </>
                    )}

                    {/* Transcript Summary */}
                    {call.transcript_summary && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                    <FileText className="h-4 w-4" />
                                    Summary
                                </h4>
                                <p className="text-sm bg-muted p-3 rounded-lg">
                                    {call.transcript_summary}
                                </p>
                            </div>
                        </>
                    )}

                    {/* Next Step */}
                    <Separator />
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                        <h4 className="text-sm font-medium flex items-center gap-1 text-primary">
                            <ArrowRight className="h-4 w-4" />
                            Suggested Next Step
                        </h4>
                        <p className="text-sm mt-1 text-muted-foreground">
                            {getSuggestedNextStep()}
                        </p>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
