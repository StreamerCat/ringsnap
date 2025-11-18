import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Lock, CreditCard, Loader2 } from "lucide-react";
import { FormSectionProps } from "../types";

/**
 * Payment Section
 *
 * Secure payment collection using Stripe Elements.
 * Features:
 * - PCI-compliant card input (Stripe CardElement)
 * - Real-time validation
 * - Security badges and messaging
 * - Mobile-optimized input
 */

interface PaymentSectionProps extends FormSectionProps {
  onCardChange: (complete: boolean, error: string | null) => void;
}

export function PaymentSection({
  form,
  isSubmitting,
  onCardChange,
}: PaymentSectionProps) {
  const stripe = useStripe();
  const elements = useElements();
  const isStripeReady = stripe && elements;

  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const handleCardChange = (event: any) => {
    const complete = event.complete;
    const error = event.error ? event.error.message ?? "" : null;

    setCardComplete(complete);
    setCardError(error);
    onCardChange(complete, error);
  };

  if (!isStripeReady) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Loading secure payment...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle>Payment Information</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            All transactions are secure and encrypted
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security badge */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">Secure checkout</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Powered by Stripe
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <CreditCard
                  key={i}
                  className="h-4 w-4 text-muted-foreground"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Card input */}
        <div className="space-y-3">
          <div>
            <Label className="text-base">Card Information *</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Enter your card number, expiry date, and CVC
            </p>
          </div>
          <div className="rounded-lg border-2 border-input px-4 py-3 bg-background transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <CardElement
              onChange={handleCardChange}
              options={{
                style: {
                  base: {
                    color: "#2C3639",
                    fontSize: "16px",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    fontSmoothing: "antialiased",
                    "::placeholder": { color: "#88A096" },
                  },
                  invalid: { color: "#ef4444" },
                },
                hidePostalCode: true,
                disabled: isSubmitting,
              }}
            />
          </div>
          {cardError && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              {cardError}
            </p>
          )}
        </div>

        {/* Security message */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <Lock className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p>
            Your payment information is encrypted and secure. We never store
            your card details on our servers. All payment processing is handled
            by Stripe, a certified PCI Level 1 Service Provider.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
