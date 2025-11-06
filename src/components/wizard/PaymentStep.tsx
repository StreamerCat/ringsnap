import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { CardElement } from "@stripe/react-stripe-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, CreditCard, Shield, Check } from "lucide-react";
import { WizardFormData, PLANS } from "./types";

interface PaymentStepProps {
  form: UseFormReturn<WizardFormData>;
  cardComplete: boolean;
  onCardChange: (complete: boolean) => void;
  cardError: string | null;
}

export const PaymentStep = ({ form, cardComplete, onCardChange, cardError }: PaymentStepProps) => {
  const selectedPlan = form.watch("planType");
  const planDetails = PLANS.find(p => p.value === selectedPlan);
  const companyName = form.watch("companyName");

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#2C3639',
        '::placeholder': {
          color: '#aab7c4',
        },
        iconColor: '#D97757',
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444',
      },
    },
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-foreground">Secure Payment</h2>
        <p className="text-muted-foreground">Complete your purchase and activate your AI assistant</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl mx-auto">
        {/* Order Summary */}
        <Card className="card-tier-1 lg:order-2">
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{companyName || "Your Business"}</p>
                  <p className="text-sm text-muted-foreground">{planDetails?.name} Plan</p>
                </div>
                <Badge variant="default">{planDetails?.name}</Badge>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Call volume</span>
                  <span className="font-medium">{planDetails?.calls} calls/mo</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">AI Assistant</span>
                  <span className="font-medium">Included</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Phone Number</span>
                  <span className="font-medium">Included</span>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Total due today</span>
                  <span className="text-3xl font-bold text-primary">${planDetails?.price}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Billed monthly</p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium text-sm">What's included:</p>
              <ul className="space-y-1.5">
                {planDetails?.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs">
                    <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card className="card-tier-2 lg:order-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Payment Information
            </CardTitle>
            <CardDescription>Your payment details are secure and encrypted</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Card Details</label>
              <div className="border rounded-lg p-4 bg-background">
                <CardElement
                  options={cardElementOptions}
                  onChange={(e) => onCardChange(e.complete)}
                />
              </div>
              {cardError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <span>{cardError}</span>
                </p>
              )}
              {!cardComplete && !cardError && (
                <p className="text-xs text-muted-foreground">Enter your card details to continue</p>
              )}
            </div>

            {/* Security Badges */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Secure 256-bit SSL encryption</p>
                  <p className="text-xs text-muted-foreground">Your data is protected</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Lock className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">PCI DSS compliant</p>
                  <p className="text-xs text-muted-foreground">Powered by Stripe</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CreditCard className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">No hidden fees</p>
                  <p className="text-xs text-muted-foreground">Cancel anytime</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> After payment, you'll select your phone number and your AI assistant will be activated immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
