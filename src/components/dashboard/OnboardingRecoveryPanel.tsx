
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, ArrowRight, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatPhoneNumber } from "@/lib/utils";

export const OnboardingRecoveryPanel = ({ accountId }: { accountId: string }) => {
    const { state } = useOnboardingState(accountId);
    const navigate = useNavigate();

    if (!state) return null;

    // Only show if onboarding is incomplete or failed
    const showRecovery =
        state.recommended_next_step !== 'complete' ||
        state.provisioning_status === 'failed';

    if (!showRecovery) return null;

    return (
        <Card className="mb-6 border-l-4 border-l-primary shadow-sm bg-gradient-to-r from-background to-slate-50">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    Phone System Setup
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <p className="text-sm text-slate-600">
                            {state.provisioning_status === 'failed'
                                ? "Provisioning encountered an issue along the way."
                                : "Your phone number setup requires attention."}
                        </p>
                        {state.primary_phone_number && (
                            <p className="text-sm font-medium">
                                Assigned Number: {formatPhoneNumber(state.primary_phone_number)}
                            </p>
                        )}
                    </div>
                    <Button onClick={() => navigate('/activation')}>
                        Resume Setup <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
