import { CardElement } from "@stripe/react-stripe-js";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock, CreditCard, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "16px",
      color: "#424770",
      "::placeholder": {
        color: "#aab7c4",
      },
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    invalid: {
      color: "#9e2146",
    },
  },
};

interface PaymentFormProps {
  onCardChange: (complete: boolean, error: string | null) => void;
  showTerms?: boolean;
  termsAccepted?: boolean;
  onTermsChange?: (accepted: boolean) => void;
  disabled?: boolean;
}

/**
 * Shared payment form component with Stripe CardElement
 * Used in both self-serve and sales-guided flows
 *
 * @example Self-serve usage (with terms)
 * <PaymentForm
 *   onCardChange={(complete, error) => {
 *     setCardComplete(complete);
 *     setCardError(error);
 *   }}
 *   showTerms={true}
 *   termsAccepted={termsAccepted}
 *   onTermsChange={setTermsAccepted}
 * />
 *
 * @example Sales usage (terms handled verbally)
 * <PaymentForm
 *   onCardChange={(complete, error) => {
 *     setCardComplete(complete);
 *     setCardError(error);
 *   }}
 *   showTerms={false}
 * />
 */
export function PaymentForm({
  onCardChange,
  showTerms = true,
  termsAccepted = false,
  onTermsChange,
  disabled = false,
}: PaymentFormProps) {
  const handleCardElementChange = (event: any) => {
    onCardChange(event.complete, event.error?.message || null);
  };

  return (
    <div className="space-y-6">
      {/* Card Information */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Card Information *
        </Label>
        <div
          className={cn(
            "border rounded-lg p-4 bg-background transition-colors",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <CardElement
            options={CARD_ELEMENT_OPTIONS}
            onChange={handleCardElementChange}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Your card will not be charged during the 3-day trial period
        </p>
      </div>

      {/* Terms and Conditions */}
      {showTerms && onTermsChange && (
        <div className="flex items-start space-x-3">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={onTermsChange}
            disabled={disabled}
          />
          <label
            htmlFor="terms"
            className="text-sm leading-relaxed cursor-pointer"
          >
            I accept the{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </a>
          </label>
        </div>
      )}

      {/* Security Badges */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span>Secure payment</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>Powered by Stripe</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">🔒 256-bit SSL</span>
        </div>
      </div>
    </div>
  );
}
