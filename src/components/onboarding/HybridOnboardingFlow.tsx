// Hybrid Onboarding Flow
// Combines SecureTrialStep (optional payment) with OnboardingWizard
// Step 0: Secure trial (payment or skip) → Step 1-3: Original wizard

import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { SecureTrialStep } from "./SecureTrialStep";
import { OnboardingWizard } from "../OnboardingWizard";
import type { Database } from "@/integrations/supabase/types";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileWithAccount = ProfileRow & { accounts?: AccountRow | null };

interface HybridOnboardingFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialProfile?: ProfileWithAccount | null;
  defaultPhone?: string | null;
  accountId: string;
  hasPaymentMethod?: boolean;
}

export function HybridOnboardingFlow({
  open,
  onOpenChange,
  onSuccess,
  initialProfile = null,
  defaultPhone = null,
  accountId,
  hasPaymentMethod = false,
}: HybridOnboardingFlowProps) {
  // Track whether payment step has been completed (added or skipped)
  const [paymentStepComplete, setPaymentStepComplete] = useState(hasPaymentMethod);

  // If they already have a payment method, skip straight to wizard
  useEffect(() => {
    if (hasPaymentMethod) {
      setPaymentStepComplete(true);
    }
  }, [hasPaymentMethod]);

  const handlePaymentAdded = () => {
    setPaymentStepComplete(true);
  };

  const handlePaymentSkipped = () => {
    setPaymentStepComplete(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto">
        {!paymentStepComplete ? (
          // Step 0: Secure Trial (Payment or Skip)
          <Elements stripe={stripePromise}>
            <SecureTrialStep
              accountId={accountId}
              onPaymentAdded={handlePaymentAdded}
              onSkipped={handlePaymentSkipped}
            />
          </Elements>
        ) : (
          // Steps 1-3: Original Onboarding Wizard
          <div className="h-full">
            <OnboardingWizard
              open={true}
              onOpenChange={(isOpen) => {
                if (!isOpen) {
                  onOpenChange(false);
                }
              }}
              onSuccess={onSuccess}
              initialProfile={initialProfile}
              defaultPhone={defaultPhone}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
