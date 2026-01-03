
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { ArrowRight, AlertTriangle, PhoneCall, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const OnboardingUiGuardrail = ({ accountId }: { accountId: string }) => {
    const navigate = useNavigate();
    const { state, loading } = useOnboardingState(accountId);

    if (loading || !state) return null;

    // Don't show if complete
    if (state.recommended_next_step === 'complete') return null;

    // Don't show if provisioning is still happening (the ProvisioningBanner takes care of that)
    if (state.recommended_next_step === 'provisioning') return null;

    const handleAction = () => {
        navigate('/activation');
    };

    return (
        <div className="mb-6">
            <Alert className="border-l-4 border-l-amber-500 bg-amber-50/50">
                <div className="flex justify-between items-center w-full">
                    <div className="flex gap-3 items-center">
                        {state.recommended_next_step === 'test_call' && <PhoneCall className="h-5 w-5 text-amber-600" />}
                        {state.recommended_next_step === 'forwarding' && <AlertTriangle className="h-5 w-5 text-amber-600" />}

                        <div>
                            <AlertTitle className="text-amber-800 font-semibold">
                                {state.recommended_next_step === 'test_call' && "Complete Your Setup: Test Your Number"}
                                {state.recommended_next_step === 'forwarding' && "Important: Call Forwarding Not Detected"}
                                {state.recommended_next_step === 'verify' && "Verify Your Call Forwarding"}
                            </AlertTitle>
                            <AlertDescription className="text-amber-700">
                                {state.recommended_next_step === 'test_call' && "Make a quick test call to ensure your agent is working."}
                                {state.recommended_next_step === 'forwarding' && "Your agent is active, but calls aren't forwarding yet."}
                                {state.recommended_next_step === 'verify' && "Double check that your business calls are reaching us."}
                            </AlertDescription>
                        </div>
                    </div>

                    <Button size="sm" onClick={handleAction} className="bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm whitespace-nowrap">
                        Finish Setup <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </div>
            </Alert>
        </div>
    );
};
