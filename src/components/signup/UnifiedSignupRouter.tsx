import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { SelfServeTrialFlow } from "../onboarding/SelfServeTrialFlow";
import { SalesGuidedTrialFlow } from "../onboarding/SalesGuidedTrialFlow";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

interface UnifiedSignupRouterProps {
  mode: 'trial' | 'sales';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  source?: string;
  onSuccess?: (data: any) => void;
}

export const UnifiedSignupRouter = ({
  mode,
  open = true,
  onOpenChange,
  source,
  onSuccess
}: UnifiedSignupRouterProps) => {
  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess({});
    }
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  return (
    <Elements stripe={stripePromise}>
      {mode === 'trial' ? (
        <SelfServeTrialFlow
          open={open}
          onOpenChange={onOpenChange || (() => {})}
          onSuccess={handleSuccess}
        />
      ) : (
        <SalesGuidedTrialFlow
          open={open}
          onOpenChange={onOpenChange || (() => {})}
          onSuccess={handleSuccess}
        />
      )}
    </Elements>
  );
};
