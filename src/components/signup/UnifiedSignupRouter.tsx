import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <Elements stripe={stripePromise}>
          {mode === 'trial' ? (
            <SelfServeTrialFlow onSuccess={handleSuccess} />
          ) : (
            <SalesGuidedTrialFlow onSuccess={handleSuccess} />
          )}
        </Elements>
      </DialogContent>
    </Dialog>
  );
};
