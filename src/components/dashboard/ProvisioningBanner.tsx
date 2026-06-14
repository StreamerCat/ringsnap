import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, XCircle, Bot, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

interface ProvisioningBannerProps {
    account?: {
        id?: string | null;
        vapi_phone_number?: string | null;
        vapi_assistant_id?: string | null;
        provisioning_status?: string | null;
    } | null;
}

/**
 * Banner shown when provisioning is incomplete or failed.
 * - pending/processing/failed_retryable: amber "still finishing"
 * - partially_provisioned: blue "agent ready to preview, phone pending"
 * - failed/failed_manual_action_required: red "we're working on it"
 */
export function ProvisioningBanner({ account }: ProvisioningBannerProps) {
    const [retrying, setRetrying] = useState(false);

    if (!account) return null;

    const isFullyProvisioned =
        account.provisioning_status === 'completed' ||
        account.provisioning_status === 'active';

    if (isFullyProvisioned) return null;

    const isPartial = account.provisioning_status === 'partially_provisioned';
    const isPermanentFailure = account.provisioning_status === 'failed' ||
        account.provisioning_status === 'failed_manual_action_required';
    const isRetryable = account.provisioning_status === 'failed_retryable';

    const handleRefresh = () => window.location.reload();

    const handleRetry = async () => {
        if (!account.id) return;
        setRetrying(true);
        try {
            const { error } = await supabase.functions.invoke('provision-vapi', {
                body: { accountId: account.id, triggered_by: 'dashboard-retry' },
            });
            if (error) throw error;
            toast.success('Retry started — refreshing in a few seconds…');
            setTimeout(() => window.location.reload(), 4000);
        } catch {
            toast.error('Retry failed. Please contact support.');
        } finally {
            setRetrying(false);
        }
    };

    // Partially provisioned — assistant ready, phone pending
    if (isPartial) {
        return (
            <Alert className="bg-blue-50 border-blue-200 mb-6">
                <Bot className="h-4 w-4 text-blue-600" />
                <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
                    <div>
                        <p className="font-medium text-blue-800">Your AI receptionist is ready to preview</p>
                        <p className="text-sm text-blue-700">
                            We&apos;re finishing activation and will notify you as soon as your agent is live.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            className="border-blue-300 text-blue-700 hover:bg-blue-100"
                        >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Refresh
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        );
    }

    // Permanent failure
    if (isPermanentFailure) {
        return (
            <Alert className="bg-red-50 border-red-200 mb-6">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
                    <div>
                        <p className="font-medium text-red-800">Setup needs attention</p>
                        <p className="text-sm text-red-700">
                            We&apos;re finishing your setup. You&apos;ll receive an email when everything is ready,
                            or you can try again now.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRetry}
                            disabled={retrying}
                            className="border-red-300 text-red-700 hover:bg-red-100"
                        >
                            <RefreshCw className={`h-4 w-4 mr-1 ${retrying ? 'animate-spin' : ''}`} />
                            {retrying ? 'Retrying…' : 'Try Again'}
                        </Button>
                        <Button
                            variant="link"
                            size="sm"
                            className="text-red-700 px-0"
                            asChild
                        >
                            <a href="mailto:support@getringsnap.com">Contact Support</a>
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>
        );
    }

    // Retryable failure — auto-retrying, just show info
    if (isRetryable) {
        return (
            <Alert className="bg-amber-50 border-amber-200 mb-6">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="flex items-center justify-between w-full">
                    <span className="text-amber-800">
                        Your phone number setup is being retried automatically. This usually resolves in a few minutes.
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        className="ml-4 border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Refresh
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    // Default: pending/processing
    return (
        <Alert className="bg-amber-50 border-amber-200 mb-6">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between w-full">
                <span className="text-amber-800">
                    Setting up your agent. Some features may be delayed.
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    className="ml-4 border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                </Button>
            </AlertDescription>
        </Alert>
    );
}
