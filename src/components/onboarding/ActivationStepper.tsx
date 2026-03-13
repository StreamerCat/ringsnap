
import { useEffect, useState, useCallback } from "react";
import { useOnboardingState, OnboardingState } from "@/hooks/useOnboardingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Check, Copy, Phone, ArrowRight, ExternalLink, Loader2, RefreshCw, Smartphone, AlertTriangle, HelpCircle, MessageCircle, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/lib/utils";
import { CarrierForwardingInstructions } from "@/components/CarrierForwardingInstructions";
import { useNavigate } from "react-router-dom";
import { featureFlags } from "@/lib/featureFlags";
import { trackOnboardingEvent } from "@/lib/sentry-tracking";
import { capture } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";


interface ActivationStepperProps {
    accountId: string;
}

// Timeout before showing troubleshooting panel (25 seconds)
const TROUBLESHOOTING_TIMEOUT_MS = 25000;

export const ActivationStepper = ({ accountId }: ActivationStepperProps) => {
    const navigate = useNavigate();
    const { state, refreshState, trackEvent, loading } = useOnboardingState(accountId);
    const [activeStep, setActiveStep] = useState(1);
    const [verifying, setVerifying] = useState(false);
    const [copiedNumber, setCopiedNumber] = useState(false);

    // Troubleshooting state
    const [callAttemptedAt, setCallAttemptedAt] = useState<Date | null>(null);
    const [showTroubleshooting, setShowTroubleshooting] = useState(false);
    const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

    useEffect(() => {
        if (state) {
            if (state.recommended_next_step === 'test_call') setActiveStep(2);
            else if (state.recommended_next_step === 'forwarding') setActiveStep(3);
            else if (state.recommended_next_step === 'verify') setActiveStep(4);
            else if (state.recommended_next_step === 'complete') {
                setActiveStep(5); // Completion state
            }
        }
    }, [state]);

    // Poll for state updates when waiting for test call or Verification
    useEffect(() => {
        if (!state) return;

        let intervalId: NodeJS.Timeout;
        const shouldPoll =
            (activeStep === 2 && !state.test_call_detected) ||
            (activeStep === 4 && !state.test_call_detected);

        if (shouldPoll) {
            intervalId = setInterval(() => {
                refreshState();
                setLastCheckedAt(new Date());
            }, 5000);
        }
        return () => clearInterval(intervalId);
    }, [state, activeStep, refreshState]);

    // Troubleshooting timeout effect
    useEffect(() => {
        if (!featureFlags.activationTroubleshooting) return;
        if (!callAttemptedAt || state?.test_call_detected || showTroubleshooting) return;

        const timeout = setTimeout(() => {
            setShowTroubleshooting(true);
            trackEvent('onboarding.test_call_troubleshoot_shown');
            trackOnboardingEvent('activation.troubleshooting_shown', {
                phoneNumberId: state?.primary_phone_number_id || null,
                secondsWaited: Math.round((Date.now() - callAttemptedAt.getTime()) / 1000)
            });
        }, TROUBLESHOOTING_TIMEOUT_MS);

        return () => clearTimeout(timeout);
    }, [callAttemptedAt, state?.test_call_detected, showTroubleshooting, trackEvent, state?.primary_phone_number_id]);

    // Reset troubleshooting when test call detected
    useEffect(() => {
        if (state?.test_call_detected) {
            setShowTroubleshooting(false);
            trackOnboardingEvent('activation.test_call_detected', {
                phoneNumberId: state?.primary_phone_number_id || null
            });
            // PostHog: first_value_reached — the activation moment
            capture('first_value_reached', {
                call_id: state?.primary_phone_number_id || undefined,
                hours_since_activation: callAttemptedAt
                    ? Math.round((Date.now() - callAttemptedAt.getTime()) / 3600000 * 10) / 10
                    : undefined,
            });
            capture('activation_milestone_reached', { milestone_name: 'test_call_detected' });
        }
    }, [state?.test_call_detected, state?.primary_phone_number_id, callAttemptedAt]);

    // Handle Call Now click with tracking
    const handleCallNowClick = useCallback(async () => {
        setCallAttemptedAt(new Date());
        setShowTroubleshooting(false);
        await trackEvent('onboarding.test_call_initiated', {
            phone_number_id: state?.primary_phone_number_id,
            ring_snap_number: state?.primary_phone_number,
            route: '/activation',
            user_agent: navigator.userAgent
        });
        trackOnboardingEvent('activation.test_call_initiated', {
            phoneNumberId: state?.primary_phone_number_id || null
        });
    }, [trackEvent, state?.primary_phone_number_id, state?.primary_phone_number]);

    // Handle proceeding to forwarding step without test call
    const handleSkipToForwarding = useCallback(() => {
        setActiveStep(3);
        toast.info("You can always test your number later from the dashboard.");
    }, []);

    const handleCopyNumber = () => {
        if (state?.primary_phone_number) {
            navigator.clipboard.writeText(state.primary_phone_number);
            setCopiedNumber(true);
            setTimeout(() => setCopiedNumber(false), 2000);
            toast.success("Number copied!");
        }
    };

    const markForwardingConfigured = async () => {
        await trackEvent('onboarding.forwarding_confirmed');
        capture('onboarding_step_completed', { step_name: 'forwarding_configured', step_index: 3 });
        // Optimistically update UI or just refresh
        refreshState();
        setActiveStep(4);
    };

    const startVerification = async () => {
        setVerifying(true);
        await trackEvent('onboarding.verification_started');
        // In a real verification flow, we might trigger an outbound call here.
        // For now, we just ask them to call us.
        // Refresh to check if a call happened recently
        await refreshState();
        setVerifying(false);
    };

    const handleContinue = () => {
        capture('activation_milestone_reached', { milestone_name: 'activation_complete' });
        navigate('/dashboard');
    };

    // Skip onboarding entirely (dev/internal only)
    const handleSkipOnboarding = useCallback(async () => {
        if (!featureFlags.internalSkipOnboarding) return;

        try {
            const { error } = await supabase.functions.invoke('complete-onboarding', {
                body: { skipOnboarding: true }
            });

            if (error) {
                toast.error('Failed to skip onboarding');
                console.error('Skip onboarding error:', error);
                return;
            }

            toast.success('Onboarding skipped');
            navigate('/dashboard');
        } catch (err) {
            toast.error('Failed to skip onboarding');
            console.error('Skip onboarding error:', err);
        }
    }, [navigate]);


    if (loading && !state) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    if (!state) return <div className="text-center p-4">Unable to load setup status. <Button variant="link" onClick={() => window.location.reload()}>Retry</Button></div>;

    // Completion State
    if (activeStep === 5) {
        return (
            <Card className="border-green-100 bg-green-50">
                <CardContent className="pt-8 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-900">Setup Complete!</h2>
                    <p className="text-green-700">Your RingSnap Agent is live and forwarding is verified.</p>
                    <Button size="lg" className="w-full mt-4" onClick={handleContinue}>
                        Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            {/* Stepper Logic */}
            <div className="flex justify-between items-center px-4 relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -z-10" />
                {[1, 2, 3, 4].map((step) => (
                    <div key={step} className={`flex flex-col items-center gap-2 bg-background p-2 transition-colors ${step === activeStep ? 'text-primary' : (step < activeStep ? 'text-green-600' : 'text-muted-foreground')}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${step === activeStep ? 'border-primary bg-primary text-primary-foreground' : (step < activeStep ? 'border-green-600 bg-green-100 text-green-700' : 'border-muted-foreground bg-background')}`}>
                            {step < activeStep ? <Check className="h-4 w-4" /> : step}
                        </div>
                        <span className="text-xs font-semibold hidden sm:inline-block">
                            {step === 1 && "Start"}
                            {step === 2 && "Test Call"}
                            {step === 3 && "Forwarding"}
                            {step === 4 && "Verify"}
                        </span>
                    </div>
                ))}
            </div>

            <div className="transition-all duration-300 ease-in-out">
                {/* Step 1: Provisioning / Intro (Auto-skipped usually if provisioned) */}
                {activeStep === 1 && (
                    <Card className="text-center border-2 border-primary/20">
                        <CardHeader>
                            <CardTitle>Your Agent is Ready</CardTitle>
                            <CardDescription>We've provisioned your dedicated RingSnap number.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="text-4xl font-bold text-primary tracking-wider">
                                {state.primary_phone_number ? formatPhoneNumber(state.primary_phone_number) : "Loading..."}
                            </div>
                            <Button size="lg" onClick={() => setActiveStep(2)}>
                                Continue to Setup <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Test Call */}
                {activeStep === 2 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Smartphone className="h-5 w-5 text-primary" />
                                Step 1: Make a Test Call
                            </CardTitle>
                            <CardDescription>
                                Call your new RingSnap number to hear your agent in action.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="bg-muted p-6 rounded-lg text-center space-y-4">
                                <p className="text-sm text-muted-foreground uppercase tracking-wide">Call this number now</p>
                                <div className="text-3xl sm:text-4xl font-bold text-foreground break-all">
                                    {state.primary_phone_number ? formatPhoneNumber(state.primary_phone_number) : "..."}
                                </div>
                                <div className="flex flex-wrap justify-center gap-3">
                                    <Button variant="outline" size="sm" onClick={handleCopyNumber}>
                                        {copiedNumber ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                                        Copy
                                    </Button>
                                    <Button variant="default" size="sm" asChild onClick={handleCallNowClick}>
                                        <a href={`tel:${state.primary_phone_number}`}>
                                            <Phone className="mr-2 h-4 w-4" />
                                            Call Now
                                        </a>
                                    </Button>
                                </div>
                            </div>

                            {/* Waiting status */}
                            {!showTroubleshooting && (
                                <div className="flex items-center justify-center p-4 bg-amber-50 rounded-md text-amber-800 text-sm gap-3">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <div className="text-left">
                                        <div>Waiting for you to complete the call...</div>
                                        {lastCheckedAt && (
                                            <div className="text-xs text-amber-600 mt-1">
                                                Last checked: {lastCheckedAt.toLocaleTimeString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Troubleshooting Panel */}
                            {showTroubleshooting && featureFlags.activationTroubleshooting && (
                                <Alert className="border-amber-200 bg-amber-50">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <AlertTitle className="text-amber-800">Call not detected yet?</AlertTitle>
                                    <AlertDescription className="text-amber-700 space-y-3">
                                        <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                                            <li>Make sure you stayed on the call for at least 10 seconds</li>
                                            <li>Try calling from a different phone</li>
                                            <li>Check that you dialed the correct number</li>
                                        </ul>
                                        <div className="flex flex-wrap gap-2 pt-3">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    handleCallNowClick();
                                                    setShowTroubleshooting(false);
                                                }}
                                                asChild
                                            >
                                                <a href={`tel:${state.primary_phone_number}`}>
                                                    <Phone className="mr-2 h-3 w-3" />
                                                    Try Again
                                                </a>
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    refreshState();
                                                    setLastCheckedAt(new Date());
                                                }}
                                            >
                                                <RefreshCw className="mr-2 h-3 w-3" />
                                                Refresh Status
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={handleSkipToForwarding}
                                            >
                                                Continue to Forwarding
                                                <ArrowRight className="ml-2 h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="pt-2 border-t border-amber-200 mt-3">
                                            <a
                                                href="mailto:support@ringsnap.com?subject=Test%20Call%20Issue"
                                                className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1"
                                            >
                                                <MessageCircle className="h-3 w-3" />
                                                Contact Support
                                            </a>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Skip option (always visible) */}
                            <div className="pt-2 border-t">
                                <Button
                                    variant="ghost"
                                    className="w-full text-xs text-muted-foreground"
                                    onClick={handleSkipToForwarding}
                                >
                                    Skip test call and set up forwarding
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3: Forwarding Instructions */}
                {activeStep === 3 && (
                    <div className="space-y-6">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold">Set Up Call Forwarding</h2>
                            <p className="text-muted-foreground">Ensure you don't miss calls by forwarding your business line.</p>
                        </div>

                        <CarrierForwardingInstructions
                            phoneNumber={state.primary_phone_number || ""}
                            companyName="RingSnap"
                        />

                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t sm:static sm:bg-transparent sm:border-0 sm:p-0 mt-8">
                            <Button
                                size="lg"
                                className="w-full sm:w-auto mx-auto block"
                                onClick={markForwardingConfigured}
                            >
                                I've Set Up Forwarding <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 4: Verification */}
                {activeStep === 4 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Verify Forwarding</CardTitle>
                            <CardDescription>Let's double check that calls to your business number are reaching RingSnap.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <p className="text-base">
                                    <strong>Action Required:</strong> From a different phone (like your cell), call your **Original Business Number**.
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    If forwarding is working, your RingSnap agent should answer.
                                </p>
                            </div>

                            <div className="flex items-center justify-center p-4 bg-blue-50 text-blue-800 rounded-md gap-3">
                                {verifying ? <Loader2 className="animate-spin h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
                                {verifying ? "Checking call logs..." : "Listening for a forwarded call..."}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setActiveStep(3)}>
                                    Back to Instructions
                                </Button>
                                <Button onClick={startVerification} disabled={verifying} className="flex-1">
                                    Check Now
                                </Button>
                            </div>

                            <div className="pt-6 border-t">
                                <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={handleContinue}>
                                    Skip verification for now
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Skip Onboarding Button - Dev/Internal Only */}
            {featureFlags.internalSkipOnboarding && (
                <div className="mt-8 pt-4 border-t border-dashed text-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={handleSkipOnboarding}
                    >
                        <SkipForward className="h-3 w-3 mr-1" />
                        Skip for now (dev only)
                    </Button>
                </div>
            )}
        </div>
    );
};
