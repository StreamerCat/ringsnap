import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Phone, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { featureFlags } from "@/lib/featureFlags";
import * as Sentry from "@sentry/react";

const TIMEOUT_MS = 60000; // 60 seconds
const STUCK_THRESHOLD_MS = 30000; // Log to Sentry after 30s

// localStorage helper for activation seen (fail-open)
function getActivationSeen(accountId: string | null): boolean {
    if (!accountId) return false;
    try {
        return localStorage.getItem(`activationSeen:${accountId}`) === 'true';
    } catch {
        return false; // Fail open
    }
}

function setActivationSeen(accountId: string | null): void {
    if (!accountId) return;
    try {
        localStorage.setItem(`activationSeen:${accountId}`, 'true');
    } catch {
        // Fail open
    }
}

export default function ProvisioningStatus() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<"pending" | "ready" | "failed" | "timeout">("pending");
    const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [accountId, setAccountId] = useState<string | null>(null);

    // One-time guard for Sentry breadcrumb
    const sentryLoggedRef = useRef(false);

    // Copy phone number to clipboard
    const copyPhoneNumber = () => {
        if (phoneNumber) {
            navigator.clipboard.writeText(phoneNumber);
            toast.success("Phone number copied to clipboard!");
        }
    };

    // Manual refresh function
    const handleManualRefresh = useCallback(() => {
        window.location.reload();
    }, []);

    // Handle navigation on ready
    const handleReadyNavigation = useCallback(() => {
        if (featureFlags.activationOnboardingEnabled && !getActivationSeen(accountId)) {
            setActivationSeen(accountId);
            navigate("/activation", { replace: true });
        } else {
            navigate("/dashboard", { replace: true });
        }
    }, [navigate, accountId]);

    // Handle continue to dashboard (with incomplete flag if not ready)
    const handleContinueToDashboard = useCallback(() => {
        if (status === "ready") {
            handleReadyNavigation();
        } else {
            // Navigate with incomplete provisioning flag
            navigate("/dashboard?provisioning=incomplete", { replace: true });
        }
    }, [status, navigate, handleReadyNavigation]);

    // Poll for status with timeout
    useEffect(() => {
        let active = true;
        const timerRef = { current: null as NodeJS.Timeout | null };
        const timeoutRef = { current: null as NodeJS.Timeout | null };
        const startTime = Date.now();

        const checkStatus = async () => {
            if (!active) return;

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

                if (profile?.account_id && active) {
                    setAccountId(profile.account_id);

                    const { data: account } = await supabase
                        .from("accounts")
                        .select("provisioning_status, vapi_phone_number, vapi_assistant_id")
                        .eq("id", profile.account_id)
                        .single();

                    if (account && active) {
                        const currentElapsed = Date.now() - startTime;
                        setElapsedTime(currentElapsed);

                        // Strict completion logic: BOTH phone AND assistant required
                        const hasPhone = account.vapi_phone_number && account.vapi_phone_number.trim() !== "";
                        const hasAssistant = !!account.vapi_assistant_id;
                        const statusCompleted = account.provisioning_status === "completed";

                        // Complete = hasPhone AND hasAssistant AND statusCompleted
                        const isComplete = hasPhone && hasAssistant && statusCompleted;

                        // Fallback: ready if phone + assistant exist even without status
                        const isReadyFallback = hasPhone && hasAssistant;

                        if (isComplete || isReadyFallback) {
                            setStatus("ready");
                            setPhoneNumber(account.vapi_phone_number);
                            if (timerRef.current) clearInterval(timerRef.current);
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        } else if (account.provisioning_status?.startsWith("failed")) {
                            setStatus("failed");
                            if (timerRef.current) clearInterval(timerRef.current);
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        } else {
                            setStatus("pending");

                            // One-time Sentry breadcrumb when stuck > 30s
                            if (currentElapsed > STUCK_THRESHOLD_MS && !sentryLoggedRef.current) {
                                sentryLoggedRef.current = true;
                                Sentry.addBreadcrumb({
                                    category: 'provisioning',
                                    message: 'Provisioning stuck > 30s',
                                    level: 'warning',
                                    data: {
                                        accountId: profile.account_id,
                                        elapsedMs: currentElapsed,
                                        hasPhone,
                                        hasAssistant,
                                        status: account.provisioning_status,
                                    }
                                });
                                console.warn('[ProvisioningStatus] Stuck > 30s', {
                                    accountId: profile.account_id,
                                    hasPhone,
                                    hasAssistant,
                                });
                            }
                        }
                    }
                }
                if (active) setLoading(false);
            } catch (error) {
                console.error("Error checking provisioning status:", error);
                Sentry.captureException(error, {
                    tags: { component: 'ProvisioningStatus' }
                });
            }
        };

        // Initial check
        checkStatus();

        // Poll every 5s
        timerRef.current = setInterval(checkStatus, 5000);

        // Set timeout to handle long provisioning
        timeoutRef.current = setTimeout(() => {
            if (active && status === "pending") {
                setStatus("timeout");
                if (timerRef.current) clearInterval(timerRef.current);
            }
        }, TIMEOUT_MS);

        return () => {
            active = false;
            if (timerRef.current) clearInterval(timerRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [navigate, status]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl space-y-8 text-center">

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
                                {/* Manual Refresh Button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleManualRefresh}
                                    className="text-slate-500 hover:text-slate-700"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Refresh Status
                                </Button>
                            </div>
                        )}

                        {status === "timeout" && (
                            <div className="space-y-4 animate-in fade-in duration-500">
                                <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
                                </div>
                                <h2 className="text-xl font-semibold text-amber-900">
                                    Still Working on It...
                                </h2>
                                <div className="space-y-4 text-slate-600 text-sm">
                                    <p>
                                        Your AI assistant is taking a bit longer to set up than usual.
                                        This is completely normal!
                                    </p>
                                    <p className="font-medium">
                                        You'll receive an email shortly when everything is ready.
                                    </p>
                                    <p>
                                        In the meantime, feel free to explore your dashboard and familiarize yourself with the platform.
                                    </p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-left">
                                    <p className="text-xs text-amber-800 font-semibold mb-2">What's happening?</p>
                                    <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                                        <li>Creating your dedicated phone number</li>
                                        <li>Training your AI with your business details</li>
                                        <li>Setting up call routing and forwarding</li>
                                    </ul>
                                </div>
                                {/* Manual Refresh Button */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleManualRefresh}
                                    className="mt-2"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Refresh Status
                                </Button>
                            </div>
                        )}

                        {status === "ready" && (
                            <div className="space-y-6 animate-in zoom-in duration-300">
                                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                                </div>
                                <h2 className="text-2xl font-semibold text-green-900">
                                    Your Assistant is Ready! 🎉
                                </h2>
                                <p className="text-slate-600">
                                    Your AI phone assistant has been set up successfully and is ready to take calls.
                                </p>

                                {phoneNumber && (
                                    <div className="space-y-4">
                                        {/* Phone Number Display */}
                                        <div className="bg-green-50 border-2 border-green-200 p-6 rounded-lg">
                                            <p className="text-xs text-green-700 mb-2 uppercase tracking-wide font-semibold">Your AI Number</p>
                                            <div className="flex items-center justify-center gap-3">
                                                <Phone className="h-5 w-5 text-green-700" />
                                                <p className="text-3xl font-bold text-green-900">{phoneNumber}</p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={copyPhoneNumber}
                                                    className="text-green-700 hover:text-green-900 hover:bg-green-100"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Forwarding Instructions */}
                                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg text-left space-y-4">
                                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                                <ArrowRight className="h-5 w-5 text-primary" />
                                                Next Steps: Forward Your Calls
                                            </h3>

                                            <div className="space-y-3 text-sm text-slate-700">
                                                <p className="font-medium">To activate your AI receptionist:</p>

                                                <ol className="space-y-3 list-decimal list-inside">
                                                    <li className="pl-2">
                                                        <span className="font-medium">Set up call forwarding</span> from your existing business number to your new RingSnap number above
                                                    </li>
                                                    <li className="pl-2">
                                                        <span className="font-medium">Test it out!</span> Call your RingSnap number directly to hear your AI assistant in action
                                                    </li>
                                                    <li className="pl-2">
                                                        <span className="font-medium">Monitor calls</span> in your dashboard to see how your assistant is performing
                                                    </li>
                                                </ol>

                                                <div className="bg-blue-50 border border-blue-200 p-3 rounded mt-4">
                                                    <p className="text-xs text-blue-800 font-semibold mb-1">💡 Pro Tip</p>
                                                    <p className="text-xs text-blue-700">
                                                        You can configure when calls are forwarded to you in the dashboard settings.
                                                        Your AI can handle calls 24/7 or only during specific hours.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Test Call Option */}
                                        <div className="pt-2">
                                            <a
                                                href={`tel:${phoneNumber}`}
                                                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium"
                                            >
                                                <Phone className="h-4 w-4" />
                                                Call now to test your assistant
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
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
                            {status === "ready" ? (
                                <>
                                    <p className="text-xs text-slate-500 mb-4">
                                        Ready to see your assistant in action? Head to your dashboard.
                                    </p>
                                    <Button
                                        className="w-full gap-2"
                                        size="lg"
                                        onClick={handleReadyNavigation}
                                    >
                                        Go to Dashboard
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs text-slate-500 mb-4">
                                        You can explore your dashboard while this runs in the background.
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="w-full gap-2"
                                        size="lg"
                                        onClick={handleContinueToDashboard}
                                    >
                                        Go to Dashboard
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

