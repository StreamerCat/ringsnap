/**
 * OnboardingRecoveryPanel
 * 
 * Shown on the Phones tab when provisioning failed or onboarding is incomplete.
 * Surfaces provisioning_jobs.error if available and provides recovery CTAs.
 */

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { AlertTriangle, RefreshCw, Phone, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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
    const navigate = useNavigate();
    const { state, loading, refreshState } = useOnboardingState(accountId);
    const [provisioningJob, setProvisioningJob] = useState<ProvisioningJob | null>(null);
    const [retrying, setRetrying] = useState(false);

    // Fetch latest provisioning job for error details
    useEffect(() => {
        if (!accountId) return;

        supabase
            .from('provisioning_jobs')
            .select('id, status, error, attempts, created_at')
            .eq('account_id', accountId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
                if (data) setProvisioningJob(data);
            });
    }, [accountId]);

    // Don't show if loading, or if onboarding is complete with active number
    if (loading || !state) return null;
    if (state.has_active_primary_number && state.recommended_next_step === 'complete') return null;

    // Show if: provisioning failed OR no active number despite completed status
    const showPanel =
        provisioningJob?.status === 'failed' ||
        (!state.has_active_primary_number && state.provisioning_status === 'completed');

    if (!showPanel && state.has_active_primary_number) return null;

    // If still provisioning, show a different message
    if (!state.has_active_primary_number && state.provisioning_status !== 'completed') {
        return (
            <Alert className="mb-6 border-blue-200 bg-blue-50">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                <AlertTitle className="text-blue-800">Setting up your phone number</AlertTitle>
                <AlertDescription className="text-blue-700">
                    We're provisioning your dedicated RingSnap line. This usually takes less than a minute.
                </AlertDescription>
            </Alert>
        );
    }

    const handleRetry = async () => {
        if (!provisioningJob) return;
        setRetrying(true);

        try {
            // Reset job status and trigger retry
            await supabase
                .from('provisioning_jobs')
                .update({ status: 'queued', attempts: 0, error: null })
                .eq('id', provisioningJob.id);

            // Trigger the provisioning function
            await supabase.functions.invoke('provision-vapi', {
                body: { jobId: provisioningJob.id }
            });

            // Refresh state after a delay
            setTimeout(() => {
                refreshState();
                setRetrying(false);
            }, 3000);
        } catch (err) {
            console.error('Retry failed:', err);
            setRetrying(false);
        }
    };

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
