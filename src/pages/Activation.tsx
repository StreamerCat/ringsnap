import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Copy, ArrowRight, ExternalLink, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useActivationSeen } from "@/hooks/useActivationSeen";

/**
 * Activation page shown after provisioning completes.
 * Provides a "wow moment" with phone number, test call CTA, and forwarding instructions.
 * 
 * Key behaviors:
 * - Fails open: always allows user to continue to dashboard
 * - Show-once: marks as seen in localStorage on mount
 * - Handles missing phone number with "still finishing" state
 */
export default function Activation() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [account, setAccount] = useState<any>(null);
    const [accountId, setAccountId] = useState<string | null>(null);

    const { markSeen } = useActivationSeen(accountId);

    // Load account data
    useEffect(() => {
        const loadAccount = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate("/auth/login", { replace: true });
                    return;
                }

                const { data: profile } = await supabase
                    .from("profiles")
                    .select("account_id")
                    .eq("id", user.id)
                    .single();

                if (!profile?.account_id) {
                    navigate("/dashboard", { replace: true });
                    return;
                }

                setAccountId(profile.account_id);

                const { data: accountData } = await supabase
                    .from("accounts")
                    .select("vapi_phone_number, company_name, vapi_assistant_id")
                    .eq("id", profile.account_id)
                    .single();

                setAccount(accountData);

                // Mark as seen immediately
                markSeen();
            } catch (error) {
                console.error("Error loading account:", error);
            } finally {
                setLoading(false);
            }
        };

        loadAccount();
    }, [navigate, markSeen]);

    // Copy phone number to clipboard
    const copyPhoneNumber = () => {
        if (account?.vapi_phone_number) {
            navigator.clipboard.writeText(account.vapi_phone_number);
            toast.success("Phone number copied to clipboard!");
        }
    };

    // Navigate to dashboard with replace
    const handleContinue = () => {
        navigate("/dashboard", { replace: true });
    };

    // Navigate to call logs
    const handleViewCallLogs = () => {
        navigate("/dashboard?tab=today", { replace: true });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Phone number still finishing - show loading state with Continue option
    if (!account?.vapi_phone_number) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-lg text-center">
                    <Card className="border-none shadow-lg">
                        <CardContent className="pt-8 pb-8 px-6 space-y-6">
                            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900">
                                Almost ready...
                            </h2>
                            <p className="text-slate-600 text-sm">
                                Your phone number is still being set up. This usually takes just a moment.
                            </p>
                            <div className="flex flex-col gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => window.location.reload()}
                                    className="gap-2"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Refresh
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleContinue}
                                    className="gap-2"
                                >
                                    Continue to Dashboard
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // Full activation experience
    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl space-y-6 text-center">

                {/* Header */}
                <div className="space-y-2">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        🎉 Your AI Assistant is Live!
                    </h1>
                    <p className="text-slate-600">
                        Your RingSnap number is ready. Let's get you taking calls.
                    </p>
                </div>

                {/* Phone Number Card */}
                <Card className="border-2 border-green-200 bg-green-50/50">
                    <CardContent className="pt-6 pb-6 px-6">
                        <p className="text-xs text-green-700 mb-2 uppercase tracking-wide font-semibold">
                            Your RingSnap Number
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Phone className="h-6 w-6 text-green-700" />
                            <p className="text-3xl font-bold text-green-900">
                                {account.vapi_phone_number}
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={copyPhoneNumber}
                                className="text-green-700 hover:text-green-900 hover:bg-green-100"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Primary CTA: Test Call */}
                <Card>
                    <CardContent className="pt-6 pb-6 px-6 space-y-4">
                        <h2 className="text-lg font-semibold text-slate-900">
                            Step 1: Test Your Assistant
                        </h2>
                        <p className="text-sm text-slate-600">
                            Call your RingSnap number now to hear your AI assistant in action.
                        </p>
                        <a
                            href={`tel:${account.vapi_phone_number}`}
                            className="inline-flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md px-8 font-medium"
                        >
                            <Phone className="h-5 w-5" />
                            Call Now to Test
                            <ExternalLink className="h-4 w-4" />
                        </a>
                    </CardContent>
                </Card>

                {/* Forwarding Instructions */}
                <Card>
                    <CardContent className="pt-6 pb-6 px-6 space-y-4 text-left">
                        <h2 className="text-lg font-semibold text-slate-900 text-center">
                            Step 2: Forward Your Business Number
                        </h2>
                        <p className="text-sm text-slate-600 text-center">
                            Set up call forwarding so your existing business calls go to RingSnap.
                        </p>

                        <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                            <p className="font-medium text-sm text-slate-800">Common forwarding codes:</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-white p-2 rounded border">
                                    <span className="font-medium">AT&T:</span>
                                    <code className="ml-1 text-slate-600">*21*{account.vapi_phone_number}#</code>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                    <span className="font-medium">Verizon:</span>
                                    <code className="ml-1 text-slate-600">*72{account.vapi_phone_number}</code>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                    <span className="font-medium">T-Mobile:</span>
                                    <code className="ml-1 text-slate-600">**21*{account.vapi_phone_number}#</code>
                                </div>
                                <div className="bg-white p-2 rounded border">
                                    <span className="font-medium">Other:</span>
                                    <span className="ml-1 text-slate-600">Contact carrier</span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">
                                Each carrier has different activation codes. Contact your phone provider if unsure.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Confirm Success */}
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4 pb-4 px-6">
                        <div className="flex items-center justify-between">
                            <div className="text-left">
                                <p className="font-medium text-blue-900">Step 3: Confirm it's working</p>
                                <p className="text-sm text-blue-700">
                                    After you call, check your Call Logs to see the result.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleViewCallLogs}
                                className="border-blue-300 text-blue-700 hover:bg-blue-100"
                            >
                                View Call Logs
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Continue to Dashboard */}
                <div className="pt-4">
                    <Button
                        className="w-full gap-2"
                        size="lg"
                        onClick={handleContinue}
                    >
                        Continue to Dashboard
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
