/**
 * OnboardingRecoveryPanel
 * 
 * Shown on the Phones tab when provisioning failed or onboarding is incomplete.
 * Surfaces provisioning_jobs.error if available and provides recovery CTAs.
 *
 * States:
 * - awaiting_number / still provisioning → friendly blue "securing your number" panel
 *   (assistant is already live; the number backfills automatically once available).
 * - failed / failed_permanent → red recovery panel with a working retry.
 */

import { useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface OnboardingRecoveryPanelProps {
    accountId: string;
}

interface ProvisioningJob {
    id: string;
    status: string;
    error: string | null;
    attempts: number;
    created_at: string;
}

export function OnboardingRecoveryPanel({ accountId }: OnboardingRecoveryPanelProps) {
    const { state, loading, refreshState } = useOnboardingState(accountId);
    const [provisioningJob, setProvisioningJob] = useState<ProvisioningJob | null>(null);
    const [retrying, setRetrying] = useState(false);

    // Fetch latest provisioning job for status + error details
    const fetchJob = useCallback(async () => {
        if (!accountId) return;
        const { data } = await supabase
            .from('provisioning_jobs')
            .select('id, status, error, attempts, created_at')
            .eq('account_id', accountId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (data) setProvisioningJob(data);
    }, [accountId]);

    useEffect(() => {
        fetchJob();
    }, [fetchJob]);

    // Don't show if loading, or if onboarding is complete with active number
    if (loading || !state) return null;
    if (state.has_active_primary_number) return null;

    const status = provisioningJob?.status;
    const isHardFailure = status === 'failed' || status === 'failed_permanent';
    const isAwaitingNumber = status === 'awaiting_number';
    // "completed" with no active number is an anomaly worth surfacing for retry.
    const completedButNoNumber = state.provisioning_status === 'completed';

    const handleCheckAgain = async () => {
        await Promise.all([refreshState(), fetchJob()]);
    };

    const handleRetry = async () => {
        if (!provisioningJob) return;
        setRetrying(true);

        try {
            // The function (service_role) resets the job's retry state server-side.
            // The browser client only has SELECT on provisioning_jobs (RLS), so we do
            // NOT attempt a direct UPDATE here — it would be silently dropped.
            await supabase.functions.invoke('provision-vapi', {
                body: { jobId: provisioningJob.id }
            });

            // Refresh state after a short delay to reflect the new attempt.
            setTimeout(() => {
                refreshState();
                fetchJob();
                setRetrying(false);
            }, 3000);
        } catch (err) {
            console.error('Retry failed:', err);
            setRetrying(false);
        }
    };

    // Graceful in-progress states: initial provisioning OR number backfill pending.
    // The AI assistant is already created; only the dedicated number is outstanding.
    if (!isHardFailure && !completedButNoNumber) {
        return (
            <Alert className="mb-6 border-blue-200 bg-blue-50">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                <AlertTitle className="text-blue-800">
                    {isAwaitingNumber
                        ? "Your AI assistant is ready — securing your number"
                        : "Setting up your phone number"}
                </AlertTitle>
                <AlertDescription className="space-y-3 text-blue-700">
                    <p>
                        {isAwaitingNumber
                            ? "Your AI assistant is live and ready to take calls. We're securing your dedicated phone number now — this can take a few minutes. We'll text and email you the moment it's live."
                            : "We're provisioning your dedicated RingSnap line. This usually takes less than a minute."}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={isAwaitingNumber ? handleRetry : handleCheckAgain}
                            disabled={retrying}
                            className="bg-white"
                        >
                            <RefreshCw className={`mr-2 h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                            {retrying ? 'Checking...' : (isAwaitingNumber ? 'Check / retry now' : 'Check again')}
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        );
    }

    // Hard failure (or completed-without-number anomaly): red recovery panel.
    return (
        <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Phone Number Setup Issue</AlertTitle>
            <AlertDescription className="space-y-3">
                <p>
                    {provisioningJob?.error
                        ? `There was a problem setting up your phone number: ${provisioningJob.error}`
                        : "We encountered an issue setting up your phone number. Our team has been notified."
                    }
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetry}
                        disabled={retrying}
                        className="bg-white"
                    >
                        <RefreshCw className={`mr-2 h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                        {retrying ? 'Retrying...' : 'Retry Setup'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="bg-white"
                    >
                        <a href="mailto:support@getringsnap.com?subject=Phone%20Provisioning%20Issue">
                            <ExternalLink className="mr-2 h-3 w-3" />
                            Contact Support
                        </a>
                    </Button>
                </div>
            </AlertDescription>
        </Alert>
    );
}
