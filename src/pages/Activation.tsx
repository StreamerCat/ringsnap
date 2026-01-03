
import { useEffect, useState } from "react";
import { ActivationStepper } from "@/components/onboarding/ActivationStepper";
import LegacyActivation from "./LegacyActivation";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Activation Page Entry Point
 * 
 * Default: Renders the new ActivationStepper flow.
 * Rollback: Change `USE_NEW_FLOW` to false to revert to LegacyActivation.
 */
export default function Activation() {
    const [searchParams] = useSearchParams();
    const [accountId, setAccountId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // ROLLBACK SWITCH: Set this to false to revert instantly
    const USE_NEW_FLOW = true;

    // Allow URL override for testing: ?legacy=true
    const forceLegacy = searchParams.get("legacy") === "true";

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                supabase.from("profiles").select("account_id").eq("id", user.id).single()
                    .then(({ data }) => {
                        if (data?.account_id) setAccountId(data.account_id);
                        setLoading(false);
                    });
            } else {
                setLoading(false);
            }
        });
    }, []);

    if (loading) {
        return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    if (forceLegacy || !USE_NEW_FLOW) {
        return <LegacyActivation />;
    }

    if (!accountId) {
        // Fallback if no account (Legacy handles redirect logic internally, so safe to fallback)
        return <LegacyActivation />;
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <ActivationStepper accountId={accountId} />
        </div>
    );
}
