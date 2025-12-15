import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Loader2 } from "lucide-react";

// Initialize Stripe outside to avoid recreation
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function UpdateCardForm({ onSuccess, accountId }: { onSuccess: () => void, accountId: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) return;

        setLoading(true);

        try {
            const result = await stripe.confirmSetup({
                elements,
                confirmParams: {
                    return_url: window.location.href, // Not used for redirect usually if handleActions happens
                },
                redirect: 'if_required',
            });

            if (result.error) {
                throw new Error(result.error.message);
            }

            const setupIntent = result.setupIntent;

            if (setupIntent.status === 'succeeded') {
                // Set as default
                const { error: fnError } = await supabase.functions.invoke('stripe-payment-method-default', {
                    body: {
                        account_id: accountId,
                        payment_method_id: setupIntent.payment_method
                    }
                });

                if (fnError) throw new Error('Failed to save payment method as default');

                toast({ title: "Card updated successfully" });
                onSuccess();
            } else {
                throw new Error('Setup intent did not succeed');
            }

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Update failed",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement />
            <Button type="submit" disabled={!stripe || loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Card"}
            </Button>
        </form>
    );
}

interface PaymentMethodUpdateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accountId: string;
    onSuccess: () => void;
}

export function PaymentMethodUpdateDialog({ open, onOpenChange, accountId, onSuccess }: PaymentMethodUpdateDialogProps) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (open && accountId) {
            // Fetch Setup Intent
            const fetchSecret = async () => {
                const { data, error } = await supabase.functions.invoke('stripe-setup-intent', {
                    body: { account_id: accountId }
                });

                if (error || !data?.client_secret) {
                    toast({ title: "Error", description: "Could not initialize Stripe", variant: "destructive" });
                    onOpenChange(false);
                    return;
                }
                setClientSecret(data.client_secret);
            };
            fetchSecret();
        } else {
            setClientSecret(null);
        }
    }, [open, accountId]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update Payment Method</DialogTitle>
                    <DialogDescription>Enter your new card details.</DialogDescription>
                </DialogHeader>

                {clientSecret ? (
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                        <UpdateCardForm onSuccess={() => { onSuccess(); onOpenChange(false); }} accountId={accountId} />
                    </Elements>
                ) : (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
