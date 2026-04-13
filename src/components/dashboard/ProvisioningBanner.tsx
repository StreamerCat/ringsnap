import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, XCircle } from "lucide-react";
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
 * - pending/provisioning: amber "still finishing" with Refresh
 * - failed: red "setup didn't complete" with Retry + Support link
 */
export function ProvisioningBanner({ account }: ProvisioningBannerProps) {
    const [retrying, setRetrying] = useState(false);

    if (!account) return null;

    const isFullyProvisioned =
        account.provisioning_status === 'completed' ||
        account.provisioning_status === 'active';

    if (isFullyProvisioned) return null;

    const isFailed = account.provisioning_status?.startsWith('failed');

    const handleRefresh = () => window.location.reload();

    const handleRetry = async () => {
        if (!account.id) return;
        setRetrying(true);
        try {
            const { error } = await supabase.functions.invoke('provision-resources', {
                body: { accountId: account.id },
            });
            if (error) throw error;
            toast.success('Retry started — refreshing in a few seconds…');
            setTimeout(() => window.location.reload(), 4000);
        } catch (err: any) {
            toast.error('Retry failed. Please contact support.');
        } finally {
            setRetrying(false);
        }
    };

    if (isFailed) {
        return (
            <Alert className="bg-red-50 border-red-200 mb-6">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
                    <div>
                        <p className="font-medium text-red-800">Setup didn't complete</p>
                        <p className="text-sm text-red-700">
                            There was an issue provisioning your phone number. This can usually be fixed with a retry.
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

    return (
        <Alert className="bg-amber-50 border-amber-200 mb-6">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between w-full">
                <span className="text-amber-800">
                    Provisioning still finishing. Some features may be delayed.
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
