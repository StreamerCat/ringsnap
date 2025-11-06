// Limited Trial Banner Component
// Shows for cardless trial users, prompts to add payment method

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CreditCard, Info, X } from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { SecureTrialStep } from "./SecureTrialStep";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface LimitedTrialBannerProps {
  accountId: string;
  minutesUsed?: number;
  minutesLimit?: number;
  onPaymentAdded?: () => void;
  onDismiss?: () => void;
}

export function LimitedTrialBanner({
  accountId,
  minutesUsed = 0,
  minutesLimit = 30,
  onPaymentAdded,
  onDismiss,
}: LimitedTrialBannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const percentUsed = (minutesUsed / minutesLimit) * 100;
  const isNearLimit = percentUsed >= 70;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handlePaymentSuccess = () => {
    setIsOpen(false);
    onPaymentAdded?.();
  };

  if (isDismissed) return null;

  return (
    <>
      <Alert
        variant={isNearLimit ? "destructive" : "default"}
        className="border-2 relative"
      >
        <Info className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between pr-6">
          <span>Limited Trial Active</span>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <div>
            <p className="text-sm mb-2">
              You're using {minutesUsed} of {minutesLimit} limited trial minutes.
              Add your card to unlock:
            </p>
            <ul className="text-sm space-y-1 ml-4 list-disc">
              <li>150 minutes of AI calling</li>
              <li>All premium features</li>
              <li>Priority support</li>
            </ul>
          </div>

          {isNearLimit && (
            <div className="bg-destructive/10 border border-destructive/20 rounded p-2">
              <p className="text-sm font-medium">
                ⚠️ You've used {percentUsed.toFixed(0)}% of your limited minutes
              </p>
            </div>
          )}

          <Button
            onClick={() => setIsOpen(true)}
            className="w-full"
            variant={isNearLimit ? "destructive" : "default"}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Unlock Full Trial
          </Button>
        </AlertDescription>
      </Alert>

      {/* Payment Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <Elements stripe={stripePromise}>
            <SecureTrialStep
              accountId={accountId}
              onPaymentAdded={handlePaymentSuccess}
              onSkipped={() => setIsOpen(false)}
            />
          </Elements>
        </DialogContent>
      </Dialog>
    </>
  );
}
