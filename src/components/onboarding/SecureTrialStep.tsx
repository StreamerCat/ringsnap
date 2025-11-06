// Secure Trial Step Component
// Optional payment step in onboarding - collect card or skip for limited trial

import { PaymentElement } from "@stripe/react-stripe-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, Shield, CheckCircle2, Info } from "lucide-react";
import { useSetupIntent } from "@/hooks/useSetupIntent";

interface SecureTrialStepProps {
  accountId: string;
  onPaymentAdded: () => void;
  onSkipped: () => void;
  trialDays?: number;
}

export function SecureTrialStep({
  accountId,
  onPaymentAdded,
  onSkipped,
  trialDays = 3,
}: SecureTrialStepProps) {
  const {
    clientSecret,
    isLoading,
    error,
    isProcessing,
    isReady,
    confirmSetup,
    skipPayment,
  } = useSetupIntent({
    accountId,
    onSuccess: onPaymentAdded,
    onSkip: onSkipped,
  });

  const handleAddPayment = async () => {
    await confirmSetup();
  };

  const handleSkip = async () => {
    await skipPayment();
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-3xl font-bold">Secure Your Free Trial</h2>
        <p className="text-lg text-muted-foreground">
          Add a payment method to unlock your full {trialDays}-day trial
        </p>
      </div>

      {/* Benefits */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg">What You Get</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Full Trial Access</p>
              <p className="text-sm text-muted-foreground">
                150 minutes of AI calling, all features unlocked
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">No Charge Until Trial Ends</p>
              <p className="text-sm text-muted-foreground">
                You won't be charged for {trialDays} days. Cancel anytime.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Instant Phone Number</p>
              <p className="text-sm text-muted-foreground">
                Get your dedicated number immediately
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment Information
          </CardTitle>
          <CardDescription>
            We'll securely save your card. You won't be charged during your trial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {clientSecret && isReady && (
            <div className="space-y-4">
              <PaymentElement
                options={{
                  layout: "tabs",
                }}
              />

              <Button
                onClick={handleAddPayment}
                disabled={isProcessing}
                className="w-full h-12 text-lg"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-5 w-5" />
                    Secure My Trial
                  </>
                )}
              </Button>
            </div>
          )}

          {!isLoading && !clientSecret && error && (
            <div className="text-center py-4">
              <Button onClick={() => window.location.reload()} variant="outline">
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skip Option */}
      <Card className="border-muted-foreground/20">
        <CardContent className="pt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">
                <strong>Limited trial:</strong> Start with 30 minutes, add card later to unlock full access.
              </span>
            </AlertDescription>
          </Alert>

          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isProcessing}
            className="w-full mt-4"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting limited trial...
              </>
            ) : (
              "Skip for now — I'll add it later"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Trust Signals */}
      <div className="text-center text-sm text-muted-foreground space-y-1">
        <p className="flex items-center justify-center gap-2">
          <Shield className="h-4 w-4" />
          Secured by Stripe • PCI compliant
        </p>
        <p>Cancel anytime during your trial with no charge</p>
      </div>
    </div>
  );
}
