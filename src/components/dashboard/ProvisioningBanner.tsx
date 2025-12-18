import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ProvisioningBannerProps {
    account?: {
        vapi_phone_number?: string | null;
        vapi_assistant_id?: string | null;
        provisioning_status?: string | null;
    } | null;
}

/**
 * Banner shown when provisioning is incomplete.
 * Displays when:
 * - provisioning_status is NOT 'completed', AND
 * - account is missing phone number or assistant ID
 * 
 * Does NOT show if account is fully provisioned (has both phone and assistant).
 */
export function ProvisioningBanner({ account }: ProvisioningBannerProps) {
    // If no account data yet, don't show banner (dashboard is still loading)
    if (!account) return null;

    // Check if provisioning is actually complete
    const isFullyProvisioned =
        account.provisioning_status === 'completed' &&
        account.vapi_phone_number &&
        account.vapi_assistant_id;

    // Only show banner if NOT fully provisioned AND missing resources
    const shouldShow = !isFullyProvisioned && (
        !account.vapi_phone_number ||
        !account.vapi_assistant_id
    );

    if (!shouldShow) return null;

    const handleRefresh = () => {
        window.location.reload();
    };

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
