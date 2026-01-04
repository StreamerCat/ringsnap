/**
 * OnboardingUiGuardrail
 * 
 * Non-intrusive banner displayed in the dashboard when onboarding is incomplete.
 * Routes user to the correct next step based on recommended_next_step.
 */

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { ArrowRight, Phone, Settings, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OnboardingUiGuardrailProps {
    accountId: string;
}

export function OnboardingUiGuardrail({ accountId }: OnboardingUiGuardrailProps) {
    const navigate = useNavigate();
    const { state, loading } = useOnboardingState(accountId);

    // Don't show if loading or onboarding is complete
    if (loading || !state || state.recommended_next_step === 'complete') {
        return null;
    }

    const stepConfig = {
        provisioning: {
            title: "Setting up your phone number...",
            description: "We're provisioning your dedicated RingSnap line. This usually takes less than a minute.",
            action: null,
            icon: <Loader2 className="h-4 w-4 animate-spin" />,
        },
        test_call: {
            title: "Complete your setup",
            description: "Make a test call to your new RingSnap number to hear your agent in action.",
            action: () => navigate('/activation'),
            actionLabel: "Continue Setup",
            icon: <Phone className="h-4 w-4" />,
        },
        forwarding: {
            title: "One step left: Set up call forwarding",
            description: "Forward your business line to never miss a call.",
            action: () => navigate('/activation'),
            actionLabel: "Set Up Forwarding",
            icon: <Settings className="h-4 w-4" />,
        },
    };

    const config = stepConfig[state.recommended_next_step as keyof typeof stepConfig];
    if (!config) return null;

    return (
        <Alert className="border-amber-200 bg-amber-50 mb-6">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 text-amber-600">
                    {config.icon}
                </div>
                <div className="flex-1">
                    <AlertTitle className="text-amber-800">{config.title}</AlertTitle>
                    <AlertDescription className="text-amber-700 mt-1">
                        {config.description}
                    </AlertDescription>
                </div>
                {config.action && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={config.action}
                        className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
                    >
                        {config.actionLabel}
                        <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                )}
            </div>
        </Alert>
    );
}
