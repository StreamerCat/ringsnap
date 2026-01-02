import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    Phone, PhoneCall, MessageSquare, Calendar, Users, TrendingUp, Clock, ArrowRight, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    sanitizeCallText,
    deriveTopicLabels,
    formatTopicDisplay,
    deriveOutcome,
    deriveNextStep,
    deriveWhyItMatters,
    type OutcomeInput,
    type CallOutcome
} from '@/lib/call-text-utils';
import {
    type CallLogWithAppointment,
    getDisplayName,
    getAppointmentDisplay,
    formatPhoneNumber,
    deriveAppointmentMetrics
} from '@/lib/appointments';
import { calculateLeadScore, getLeadScoreLabel, getLeadScoreClasses } from '@/lib/leadScore';
import { CallDetailsDrawer } from './CallDetailsDrawer';

interface InboxTabProps {
    calls: CallLogWithAppointment[];
    companyName?: string;
    onCallClick?: (call: CallLogWithAppointment) => void;
}

/**
 * Inbox Tab - Default landing for contractor dashboard
 * Shows follow-ups (hero), recent calls, and summary cards
 */
export function InboxTab({ calls, companyName }: InboxTabProps) {
    const [selectedCall, setSelectedCall] = useState<CallLogWithAppointment | null>(null);

    // Derive metrics
    const metrics = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const callsToday = calls.filter(c => {
            const callDate = new Date(c.started_at || 0);
            return callDate >= today;
        });

        const appointmentMetrics = deriveAppointmentMetrics(calls);

        // Categorize calls by outcome
        const categorized = calls.map(call => {
            const appointmentDisplay = getAppointmentDisplay(call);
            const outcomeInput: OutcomeInput = {
                call,
                hasAppointment: appointmentDisplay.hasDateTime,
                appointmentStart: appointmentDisplay.start?.toISOString()
            };
            return {
                call,
                outcome: deriveOutcome(outcomeInput),
                outcomeInput
            };
        });

        const followUps = categorized.filter(c => c.outcome === 'Follow-up' || c.outcome === 'Missed');

        return {
            callsToday: callsToday.length,
            bookedToday: appointmentMetrics.bookedTodayCount,
            followUpsNeeded: followUps.length,
            followUps,
            allCategorized: categorized
        };
    }, [calls]);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Calls Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold">{metrics.callsToday}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Booked Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-green-600">{metrics.bookedToday}</p>
                    </CardContent>
                </Card>

                <Card className={cn(metrics.followUpsNeeded > 0 && "border-amber-200 bg-amber-50/50")}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Follow-ups Needed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={cn("text-3xl font-bold", metrics.followUpsNeeded > 0 && "text-amber-600")}>
                            {metrics.followUpsNeeded}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Follow-ups Section (Hero) */}
            {metrics.followUps.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-amber-500" />
                            Follow-ups to Convert
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {metrics.followUps.slice(0, 5).map(({ call, outcome, outcomeInput }) => (
                                <FollowUpRow
                                    key={call.id}
                                    call={call}
                                    outcome={outcome}
                                    outcomeInput={outcomeInput}
                                    companyName={companyName}
                                    onClick={() => setSelectedCall(call)}
                                />
                            ))}
                        </div>
                        {metrics.followUps.length > 5 && (
                            <div className="p-3 text-center text-sm text-muted-foreground">
                                + {metrics.followUps.length - 5} more follow-ups
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Recent Calls */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Recent Calls
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {metrics.allCategorized.slice(0, 10).map(({ call, outcome, outcomeInput }) => (
                            <CallRow
                                key={call.id}
                                call={call}
                                outcome={outcome}
                                outcomeInput={outcomeInput}
                                companyName={companyName}
                                onClick={() => setSelectedCall(call)}
                            />
                        ))}
                    </div>
                    {calls.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                            No calls yet. Your call log will appear here.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ROI Placeholder */}
            <Card className="bg-muted/30 border-dashed">
                <CardContent className="py-6 text-center text-muted-foreground">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Revenue Tracked</p>
                    <p className="text-sm">Coming soon</p>
                </CardContent>
            </Card>

            {/* Call Details Drawer */}
            <CallDetailsDrawer
                open={!!selectedCall}
                onOpenChange={(open) => !open && setSelectedCall(null)}
                call={selectedCall}
                companyName={companyName}
            />
        </div>
    );
}

// ============================================================================
// Follow-up Row Component
// ============================================================================

interface FollowUpRowProps {
    call: CallLogWithAppointment;
    outcome: CallOutcome;
    outcomeInput: OutcomeInput;
    companyName?: string;
    onClick: () => void;
}

function FollowUpRow({ call, outcome, outcomeInput, companyName, onClick }: FollowUpRowProps) {
    const displayName = getDisplayName(call);
    const callerPhone = call.from_number || call.caller_phone || '';
    const callbackPhone = (call as any).callback_phone;
    const hasCallback = callbackPhone && callbackPhone !== callerPhone;
    const preferredPhone = hasCallback ? callbackPhone : callerPhone;

    const topics = deriveTopicLabels({ reason: call.reason, summary: call.summary });
    const nextStep = deriveNextStep(outcomeInput);
    const whyItMatters = deriveWhyItMatters(outcomeInput);
    const score = calculateLeadScore(call);
    const scoreClasses = getLeadScoreClasses(score);

    return (
        <div className="p-4 hover:bg-muted/50 cursor-pointer" onClick={onClick}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                    {/* Name + Phone */}
                    <div>
                        <p className="font-medium truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground">{formatPhoneNumber(callerPhone)}</p>
                        {hasCallback && (
                            <p className="text-xs text-primary">Callback: {formatPhoneNumber(callbackPhone)}</p>
                        )}
                    </div>

                    {/* Topics + Score */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {topics.slice(0, 2).map((topic, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                                {topic}
                            </Badge>
                        ))}
                        <Badge className={cn("text-xs border", outcome === 'Missed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')}>
                            {outcome}
                        </Badge>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full", scoreClasses)}>
                            {score}
                        </span>
                    </div>

                    {/* Why + Next Step */}
                    <p className="text-sm text-muted-foreground">{whyItMatters}</p>
                    <p className="text-sm text-primary flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        {nextStep}
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" variant="default" className="h-8" asChild onClick={e => e.stopPropagation()}>
                        <a href={`tel:${preferredPhone}`}>
                            <PhoneCall className="h-3.5 w-3.5 mr-1" />
                            Call
                        </a>
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" asChild onClick={e => e.stopPropagation()}>
                        <a href={`sms:${preferredPhone}`}>
                            <MessageSquare className="h-3.5 w-3.5 mr-1" />
                            Text
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Simple Call Row Component
// ============================================================================

interface CallRowProps {
    call: CallLogWithAppointment;
    outcome: CallOutcome;
    outcomeInput: OutcomeInput;
    companyName?: string;
    onClick: () => void;
}

function CallRow({ call, outcome, outcomeInput, companyName, onClick }: CallRowProps) {
    const displayName = getDisplayName(call);
    const callerPhone = call.from_number || call.caller_phone || '';
    const topics = deriveTopicLabels({ reason: call.reason, summary: call.summary });
    const score = calculateLeadScore(call);
    const scoreClasses = getLeadScoreClasses(score);

    const getOutcomeColor = () => {
        switch (outcome) {
            case 'Booked': return 'bg-green-100 text-green-800';
            case 'Follow-up': return 'bg-amber-100 text-amber-800';
            case 'Missed': return 'bg-red-100 text-red-800';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const timeAgo = useMemo(() => {
        if (!call.started_at) return '';
        const diff = Date.now() - new Date(call.started_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }, [call.started_at]);

    return (
        <div className="p-4 hover:bg-muted/50 cursor-pointer flex items-center gap-4" onClick={onClick}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{displayName}</p>
                    <span className="text-xs text-muted-foreground">{timeAgo}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatPhoneNumber(callerPhone)}</p>
                {topics.length > 0 && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {formatTopicDisplay(topics)}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Badge className={cn("text-xs", getOutcomeColor())}>{outcome}</Badge>
                <span className={cn("text-xs px-1.5 py-0.5 rounded-full border", scoreClasses)}>{score}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
        </div>
    );
}
