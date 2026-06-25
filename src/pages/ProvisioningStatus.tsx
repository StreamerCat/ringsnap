import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Phone, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { featureFlags } from "@/lib/featureFlags";
import { Helmet } from "react-helmet-async";
import * as Sentry from "@sentry/react";
import { capture } from "@/lib/analytics";
import { useFeatureFlagEnabled } from "posthog-js/react";

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
    const [status, setStatus] = useState<"pending" | "ready" | "failed" | "timeout" | "partial">("pending");
    const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [fallbackDismissed, setFallbackDismissed] = useState(false);

    const showFallback = useFeatureFlagEnabled('provisioning-fallback-ui');

    // One-time guard for Sentry breadcrumb
    const sentryLoggedRef = useRef(false);
    // Poll attempt counter
    const pollCountRef = useRef(0);

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

                        // PRIMARY: provisioning_status is the source of truth
                        // We also accept 'active' as completed (set by standalone provision_number job)
                        const statusCompleted = account.provisioning_status === "completed" || account.provisioning_status === "active";

                        if (statusCompleted) {
                            // If phone number is on account, use it; otherwise fetch from phone_numbers
                            let phoneNum = account.vapi_phone_number;
                            if (!phoneNum || phoneNum.trim() === "") {
                                const { data: pn } = await supabase
                                    .from("phone_numbers")
                                    .select("phone_number")
                                    .or(`assigned_account_id.eq.${profile.account_id},account_id.eq.${profile.account_id}`)
                                    .eq("is_primary", true)
                                    .single();
                                phoneNum = pn?.phone_number || null;
                            }
                            setStatus("ready");
                            setPhoneNumber(phoneNum);
                            if (timerRef.current) clearInterval(timerRef.current);
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);

                            // AUTO-REDIRECT IMMEDIATELY
                            // We use a small timeout to let the UI update briefly to "Ready" so user sees success tick
                            // before the page transition, avoiding jarring feel.
                            setTimeout(() => {
                                handleReadyNavigation();
                            }, 800);
                            return;
                        }

                        // LEGACY FALLBACK: Only if phone_numbers shows truly provisioned primary
                        // Requires: status='active', is_primary=true, activated_at IS NOT NULL
                        const { data: phoneRecord } = await supabase
                            .from("phone_numbers")
                            .select("phone_number, status, is_primary, activated_at")
                            .or(`assigned_account_id.eq.${profile.account_id},account_id.eq.${profile.account_id}`)
                            .eq("is_primary", true)
                            .single();

                        const legacyReady = phoneRecord?.status === "active"
                            && phoneRecord?.is_primary === true
                            && phoneRecord?.activated_at !== null;

                        if (legacyReady) {
                            console.warn("[ProvisioningStatus] Using legacy fallback", {
                                accountId: profile.account_id,
                                phoneNumber: phoneRecord.phone_number
                            });
                            setStatus("ready");
                            setPhoneNumber(phoneRecord.phone_number);
                            if (timerRef.current) clearInterval(timerRef.current);
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);

                            // AUTO-REDIRECT IMMEDIATELY (Legacy)
                            setTimeout(() => {
                                handleReadyNavigation();
                            }, 800);
                            return;
                        }

                        // Check for partially provisioned (assistant ready, phone pending)
                        if (account.provisioning_status === "partially_provisioned") {
                            setStatus("partial");
                            if (timerRef.current) clearInterval(timerRef.current);
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);
                            // Auto-redirect to dashboard where AgentActivationPending shows
                            setTimeout(() => {
                                navigate("/dashboard?provisioning=partial", { replace: true });
                            }, 2000);
                            return;
                        }

                        // Check for permanently failed state
                        if (account.provisioning_status === "failed" || account.provisioning_status === "failed_manual_action_required") {
                            setStatus("failed");
                            if (timerRef.current) clearInterval(timerRef.current);
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        } else if (account.provisioning_status === "failed_retryable") {
                            // Retryable failure — keep polling, it will auto-retry
                            setStatus("pending");
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
                                        hasPhone: !!account.vapi_phone_number,
                                        hasAssistant: !!account.vapi_assistant_id,
                                        status: account.provisioning_status,
                                        legacyPhoneStatus: phoneRecord?.status,
                                        legacyActivatedAt: phoneRecord?.activated_at
                                    }
                                });
                                console.warn('[ProvisioningStatus] Stuck > 30s', {
                                    accountId: profile.account_id,
                                    provisioningStatus: account.provisioning_status,
                                    phoneRecordStatus: phoneRecord?.status,
                                    activatedAt: phoneRecord?.activated_at
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
        pollCountRef.current += 1;
        checkStatus();

        // Poll every 5s
        timerRef.current = setInterval(() => {
            pollCountRef.current += 1;
            checkStatus();
        }, 5000);

        // Set timeout to handle long provisioning
        timeoutRef.current = setTimeout(() => {
            if (active && status === "pending") {
                setStatus("timeout");
                if (timerRef.current) clearInterval(timerRef.current);
                capture("provisioning_timeout", {
                    elapsed_ms: TIMEOUT_MS,
                    account_id: accountId,
                    attempt_count: pollCountRef.current,
                    twilio_error_code: null,
                    twilio_error_message: null,
                    provisioning_stage: null,
                    area_code_requested: null,
                    plan_key: null,
                });
                capture("error_encountered", {
                    flow: "provisioning",
                    error_code: "timeout",
                    failure_reason: "Provisioning timeout",
                    page_path: "/setup/assistant",
                    account_id: accountId,
                });
                if (showFallback) {
                    capture("provisioning_fallback_shown", { account_id: accountId });
                }
            }
        }, TIMEOUT_MS);

        return () => {
            active = false;
            if (timerRef.current) clearInterval(timerRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [navigate, status]);

    return (
        <div className="min-h-[100dvh] h-[100dvh] w-full bg-slate-50 flex flex-col items-center justify-center p-4 overflow-hidden relative">
            <Helmet>
                <title>Setting Up | RingSnap</title>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            <div className="w-full max-w-2xl space-y-8 text-center z-10">

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
                                    Setting up your Voice Agent
                                </h2>
                                <div className="space-y-4 text-slate-600 text-sm">
                                    <p>
                                        We are configuring your RingSnap Agent with your business details right now.
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

                        {status === "timeout" && showFallback && !fallbackDismissed && (
                            <div className="space-y-4 animate-in fade-in duration-500">
                                <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                    <AlertCircle className="h-8 w-8 text-amber-600" />
                                </div>
                                <h2 className="text-xl font-semibold text-amber-900">
                                    Taking longer than expected
                                </h2>
                                <p className="text-slate-600 text-sm">
                                    We're on it. You'll receive an email as soon as your number is ready — usually within 10 minutes.
                                </p>
                                <div className="flex gap-2 justify-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            capture("provisioning_fallback_dismissed", { account_id: accountId });
                                            setFallbackDismissed(true);
                                        }}
                                    >
                                        Got it
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleManualRefresh}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Refresh
                                    </Button>
                                </div>
                            </div>
                        )}

                        {status === "timeout" && (!showFallback || fallbackDismissed) && (
                            <div className="space-y-4 animate-in fade-in duration-500">
                                <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
                                </div>
                                <h2 className="text-xl font-semibold text-amber-900">
                                    Still Working on It...
                                </h2>
                                <div className="space-y-4 text-slate-600 text-sm">
                                    <p>
                                        Your RingSnap Agent is taking a bit longer to set up than usual.
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
                                        <li>Configuring your Agent with your business details</li>
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
                                    All Set!
                                </h2>
                                <p className="text-slate-600">
                                    Redirecting you to activation...
                                </p>
                                <div className="flex justify-center">
                                    <Loader2 className="h-6 w-6 text-green-600 animate-spin" />
                                </div>
                            </div>
                        )}

                        {status === "partial" && (
                            <div className="space-y-4 animate-in fade-in duration-500">
                                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-8 w-8 text-blue-600" />
                                </div>
                                <h2 className="text-xl font-semibold text-blue-900">
                                    Your AI Receptionist is Ready to Preview
                                </h2>
                                <p className="text-slate-600 text-sm">
                                    We&apos;re finishing activation and will notify you as soon as your agent is live.
                                    In the meantime, you can preview your assistant in the dashboard.
                                </p>
                                <div className="flex justify-center">
                                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                                    <span className="ml-2 text-sm text-blue-700">Redirecting to dashboard...</span>
                                </div>
                            </div>
                        )}

                        {status === "failed" && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertCircle className="h-8 w-8 text-red-600" />
                                </div>
                                <h2 className="text-xl font-semibold text-red-900">
                                    We&apos;re Working On It
                                </h2>
                                <p className="text-slate-600">
                                    Your account is being prepared. We captured your setup and will finish
                                    activating your phone number shortly. You&apos;ll receive an email when
                                    everything is ready.
                                </p>
                            </div>
                        )}

                        <div className="pt-4 border-t">
                            {status !== "ready" && (
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

