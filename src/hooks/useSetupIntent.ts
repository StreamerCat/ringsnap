// Custom hook for Stripe Setup Intent flow
// Handles creating Setup Intent and confirming payment method

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";

interface UseSetupIntentOptions {
  accountId: string | null;
  onSuccess?: () => void;
  onSkip?: () => void;
}

interface SetupIntentState {
  clientSecret: string | null;
  isLoading: boolean;
  error: string | null;
  isProcessing: boolean;
}

export function useSetupIntent({ accountId, onSuccess, onSkip }: UseSetupIntentOptions) {
  const [state, setState] = useState<SetupIntentState>({
    clientSecret: null,
    isLoading: false,
    error: null,
    isProcessing: false,
  });

  const stripe = useStripe();
  const elements = useElements();

  // Create Setup Intent when accountId is available
  useEffect(() => {
    if (!accountId) return;

    const createIntent = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const { data, error } = await supabase.functions.invoke("create-setup-intent", {
          body: { accountId },
        });

        if (error) throw error;

        if (!data?.clientSecret) {
          throw new Error("No client secret returned");
        }

        setState((prev) => ({
          ...prev,
          clientSecret: data.clientSecret,
          isLoading: false,
        }));
      } catch (err) {
        console.error("Failed to create Setup Intent:", err);
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to initialize payment",
          isLoading: false,
        }));
        toast.error("Failed to load payment form. Please try again.");
      }
    };

    createIntent();
  }, [accountId]);

  // Confirm Setup Intent and attach payment method
  const confirmSetup = async () => {
    if (!stripe || !elements || !state.clientSecret) {
      toast.error("Payment form not ready. Please wait.");
      return false;
    }

    setState((prev) => ({ ...prev, isProcessing: true, error: null }));

    try {
      // Submit the Payment Element
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw submitError;
      }

      // Confirm the Setup Intent
      const { setupIntent, error: confirmError } = await stripe.confirmSetup({
        elements,
        clientSecret: state.clientSecret,
        redirect: "if_required",
      });

      if (confirmError) {
        throw confirmError;
      }

      if (!setupIntent?.payment_method) {
        throw new Error("No payment method returned");
      }

      // Attach payment method to customer via backend
      const { error: attachError } = await supabase.functions.invoke("confirm-payment-method", {
        body: {
          accountId,
          paymentMethodId: setupIntent.payment_method,
        },
      });

      if (attachError) {
        throw attachError;
      }

      setState((prev) => ({ ...prev, isProcessing: false }));
      toast.success("Payment method added successfully!");
      onSuccess?.();
      return true;
    } catch (err) {
      console.error("Failed to confirm Setup Intent:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to add payment method";
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isProcessing: false,
      }));
      toast.error(errorMessage);
      return false;
    }
  };

  // Skip payment method (cardless trial)
  const skipPayment = async () => {
    if (!accountId) {
      toast.error("Account not found");
      return false;
    }

    setState((prev) => ({ ...prev, isProcessing: true, error: null }));

    try {
      const { error } = await supabase.functions.invoke("skip-card-trial", {
        body: { accountId },
      });

      if (error) throw error;

      setState((prev) => ({ ...prev, isProcessing: false }));
      toast.success("Trial started! Check your email for next steps.");
      onSkip?.();
      return true;
    } catch (err) {
      console.error("Failed to skip payment:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start trial";
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isProcessing: false,
      }));
      toast.error(errorMessage);
      return false;
    }
  };

  return {
    ...state,
    confirmSetup,
    skipPayment,
    isReady: !!state.clientSecret && !!stripe && !!elements,
  };
}
