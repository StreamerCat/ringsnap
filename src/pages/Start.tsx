/**
 * STEP 1: Minimal Trial Signup
 *
 * Collects only the essential fields needed to:
 * - Create Supabase auth user
 * - Create account + profile in DB
 * - Create Stripe customer + subscription
 * - Capture payment method
 *
 * After success, user proceeds to Step 2 (/onboarding-chat) for assistant configuration.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentForm } from '@/components/onboarding/shared/PaymentForm';
import { supabase } from '@/lib/supabase';
import { buildStep1Payload, inferWebsiteFromEmail, normalizeTrade } from '@/lib/normalization';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

import { useUser } from '@/lib/auth/useUser';

function StartForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const stripe = useStripe();
  const elements = useElements();
  const { user, isLoading: isCheckingAuth } = useUser();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [trade, setTrade] = useState('');
  const [website, setWebsite] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Payment state
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lead tracking
  const leadId = searchParams.get('leadId') || undefined;

  // Check if already logged in
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (user) {
        try {
          // Already logged in - check onboarding status
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_status')
            .eq('id', user.id)
            .single();

          if (profile?.onboarding_status === 'active') {
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/onboarding-chat', { replace: true });
          }
        } catch (error) {
          console.error('Onboarding status check error:', error);
          // Allow to proceed with signup if status check fails
        }
      }
    };

    if (!isCheckingAuth) {
      checkOnboardingStatus();
    }
  }, [user, isCheckingAuth, navigate]);

  // Auto-infer website from email
  useEffect(() => {
    if (email && !website) {
      const inferred = inferWebsiteFromEmail(email);
      if (inferred) {
        setWebsite(inferred);
      }
    }
  }, [email, website]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!phone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    if (!companyName.trim()) {
      toast.error('Please enter your company name');
      return;
    }

    if (!trade.trim()) {
      toast.error('Please enter your trade or service type');
      return;
    }

    if (!cardComplete) {
      toast.error('Please complete your payment information');
      return;
    }

    if (!termsAccepted) {
      toast.error('Please accept the Terms of Service');
      return;
    }

    if (!stripe || !elements) {
      toast.error('Payment system not ready. Please refresh and try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create payment method
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
        },
      });

      if (pmError) {
        throw new Error(pmError.message || 'Failed to process payment method');
      }

      if (!paymentMethod) {
        throw new Error('Payment method creation failed');
      }

      // Build payload for create-trial
      const payload = buildStep1Payload({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        companyName: companyName.trim(),
        trade: trade.trim(),
        website: website.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        paymentMethodId: paymentMethod.id,
        planType: 'starter',
        source: 'website',
        leadId,
      });

      console.log('[Start] Calling create-trial with payload:', {
        ...payload,
        paymentMethodId: '***',
      });

      // Call create-trial edge function
      const { data, error } = await supabase.functions.invoke('create-trial', {
        body: payload,
      });

      if (error) {
        console.error('[Start] create-trial error:', error);
        throw new Error(error.message || 'Failed to create trial account');
      }

      if (!data || !data.success) {
        console.error('[Start] create-trial failed:', data);
        throw new Error(data?.message || 'Failed to create trial account');
      }

      console.log('[Start] Trial created successfully:', {
        accountId: data.account_id,
        userId: data.user_id,
      });

      // Log in the user with the returned credentials
      if (data.email && data.password) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (signInError) {
          console.warn('[Start] Auto sign-in failed (non-critical):', signInError);
          // Don't fail the signup for this
        }
      }

      toast.success('Trial started! Let\'s configure your AI assistant.');

      // Redirect to Step 2 (assistant configuration)
      navigate('/onboarding-chat', {
        state: {
          accountId: data.account_id,
          fromStep1: true,
        },
      });
    } catch (error: any) {
      console.error('[Start] Signup error:', error);

      let message = 'Failed to start trial. Please try again.';

      if (error.message) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          message = 'This email is already registered. Please sign in instead.';
        } else if (error.message.includes('disposable')) {
          message = 'Please use a valid business or personal email address.';
        } else if (error.message.includes('phone')) {
          message = error.message;
        } else if (error.message.includes('card') || error.message.includes('payment')) {
          message = 'Payment failed. Please check your card details.';
        } else {
          message = error.message;
        }
      }

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-center mb-2">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold text-center">
            Start Your 3-Day Free Trial
          </CardTitle>
          <CardDescription className="text-center text-base">
            No charge today. Cancel anytime during your trial.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Contact Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@yourcompany.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zipCode">ZIP Code (Optional)</Label>
                  <Input
                    id="zipCode"
                    type="text"
                    placeholder="12345"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    disabled={isSubmitting}
                    maxLength={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for local phone number provisioning
                  </p>
                </div>
              </div>
            </div>

            {/* Business Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Business Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Acme Plumbing"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trade">Trade/Service *</Label>
                  <Input
                    id="trade"
                    type="text"
                    placeholder="Plumbing, HVAC, Electrical, etc."
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  {trade && (
                    <p className="text-xs text-muted-foreground">
                      Normalized: {normalizeTrade(trade)}
                    </p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="website">Website (Optional)</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://yourcompany.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    We'll use this to personalize your AI assistant
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Payment Information
              </h3>

              <div className="bg-muted/50 border rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Starter Plan - $297/month</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 3-day free trial (no charge today)</li>
                      <li>• 24/7 AI receptionist</li>
                      <li>• Dedicated phone number</li>
                      <li>• Cancel anytime</li>
                    </ul>
                  </div>
                </div>
              </div>

              <PaymentForm
                onCardChange={(complete, error) => {
                  setCardComplete(complete);
                  setCardError(error);
                }}
                showTerms={true}
                termsAccepted={termsAccepted}
                onTermsChange={setTermsAccepted}
                disabled={isSubmitting}
              />

              {cardError && (
                <p className="text-sm text-destructive">{cardError}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || !cardComplete || !termsAccepted}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating Your Trial...
                </>
              ) : (
                <>
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              You won't be charged until after your 3-day trial ends
            </p>
          </form>

          {/* Sign In Link */}
          <div className="mt-6 text-center border-t pt-6">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Button
                variant="link"
                className="p-0 h-auto font-semibold"
                onClick={() => navigate('/auth/login')}
              >
                Sign in
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Start() {
  return (
    <Elements stripe={stripePromise}>
      <StartForm />
    </Elements>
  );
}
