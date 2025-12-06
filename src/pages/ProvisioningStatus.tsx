import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export default function ProvisioningStatus() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<"pending" | "ready" | "failed">("pending");
    const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Poll for status
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkStatus = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate("/auth/login");
                    return;
                }

                // Fetch account status
                // We assume 1:1 user-to-account mapping for now, or fetch by user_id
                // Ideally, we fetch the account associated with this user
                // But for now let's query accounts where owner_id = user.id (or via profiles check)

                // Better: Join profiles -> accounts
                // But let's try direct query if RLS allows reading own account
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("account_id")
                    .eq("id", user.id)
                    .single();

                if (profile?.account_id) {
                    const { data: account } = await supabase
                        .from("accounts")
                        .select("provisioning_status, vapi_phone_number")
                        .eq("id", profile.account_id)
                        .single();

                    if (account) {
                        // Map DB status to UI state
                        // DB statuses: pending, processing, completed, failed
                        if (account.provisioning_status === "completed") {
                            setStatus("ready");
                            setPhoneNumber(account.vapi_phone_number);
                            // Stop polling if ready
                            clearInterval(intervalId);
                        } else if (account.provisioning_status?.startsWith("failed")) {
                            setStatus("failed");
                            clearInterval(intervalId);
                        } else {
                            setStatus("pending");
                        }
                    }
                }
                setLoading(false);
            } catch (error) {
                console.error("Error checking provisioning status:", error);
                // Don't set failed immediately on network error, just retry
            }
        };

        // Initial check
        checkStatus();

        // Poll every 5s
        intervalId = setInterval(checkStatus, 5000);

        return () => clearInterval(intervalId);
    }, [navigate]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8 text-center">

                {/* Logo or Brand */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">RingSnap</h1>
                </div>

                <Card className="border-none shadow-lg">
                    <CardContent className="pt-8 pb-8 px-6 space-y-6">

                        {status === "pending" && (
                            <div className="space-y-4 animate-in fade-in duration-500">
                                <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                                    <Loader2 className="h-6 w-6 text-primary animate-pulse" />
                                </div>
                                <h2 className="text-xl font-semibold text-slate-900">
                                    Setting up your AI Assistant
                                </h2>
                                <div className="space-y-4 text-slate-600 text-sm">
                                    <p>
                                        We are training your AI assistant with your business details right now.
                                        This usually takes just a few minutes.
                                    </p>
                                    <p>
                                        You will receive an email within 10 minutes when your assistant is ready to take calls.
                                    </p>
                                </div>
                                <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-xs">
                                    Thinking... Provisioning phone number...
                                </div>
                            </div>
                        )}

                        {status === "ready" && (
                            <div className="space-y-4 animate-in zoom-in duration-300">
                                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                                </div>
                                <h2 className="text-xl font-semibold text-green-900">
                                    Your Assistant is Ready!
                                </h2>
                                <p className="text-slate-600">
                                    Your AI phone assistant has been set up successfully and is ready to take calls.
                                </p>

                                {phoneNumber && (
                                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                        <p className="text-xs text-green-700 mb-1 uppercase tracking-wide font-semibold">Your AI Number</p>
                                        <p className="text-2xl font-bold text-green-900">{phoneNumber}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {status === "failed" && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertCircle className="h-8 w-8 text-red-600" />
                                </div>
                                <h2 className="text-xl font-semibold text-red-900">
                                    We hit a snag
                                </h2>
                                <p className="text-slate-600">
                                    Something did not complete as expected. We are reviewing this now.
                                    You will receive an email with next steps within 10 minutes.
                                </p>
                            </div>
                        )}

                        <div className="pt-4 border-t">
                            <p className="text-xs text-slate-500 mb-4">
                                You can explore your dashboard while this runs in the background.
                            </p>
                            <Button
                                className="w-full gap-2"
                                size="lg"
                                onClick={() => navigate("/dashboard")}
                            >
                                Go to Dashboard
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
