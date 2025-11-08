import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { TrialSignupFlow } from "./TrialSignupFlow";
import { SalesSignupWizard } from "../wizard/SalesSignupWizard";

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
  return (
    <Elements stripe={stripePromise}>
      {mode === 'trial' ? (
        <TrialSignupFlow
          open={open}
          onOpenChange={onOpenChange || (() => {})}
          source={source}
          onSuccess={onSuccess}
        />
      ) : (
        <SalesSignupWizard />
      )}
    </Elements>
  );
};
