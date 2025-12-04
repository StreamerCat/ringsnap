/**
 * STEP 1: Minimal Lead Capture (Two-Step Signup Flow)
 *
 * Collects only name + email to:
 * - Create lead record in database (via capture-signup-lead)
 * - Store lead_id for Step 2
 * - Redirect to /onboarding-chat for full configuration + payment
 *
 * Copy follows Alex Hormozi principles:
 * - Concrete outcomes with numbers
 * - Emphasize missed revenue from unanswered calls
 * - Clear benefit-focused CTAs
 * - Reduce friction and risk
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Phone, ArrowRight, CheckCircle, Shield, Clock, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { captureSignupLead } from '@/lib/api/leads';
import { useUser } from '@/lib/auth/useUser';

// Store lead_id in localStorage for persistence
const LEAD_ID_KEY = 'ringsnap_signup_lead_id';

function getStoredLeadId(): string | null {
  try {
    return localStorage.getItem(LEAD_ID_KEY);
  } catch {
    return null;
  }
}

function storeLeadId(leadId: string): void {
  try {
    localStorage.setItem(LEAD_ID_KEY, leadId);
  } catch {
    // localStorage not available
  }
}

export default function Start() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: isCheckingAuth } = useUser();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get existing lead_id from URL or localStorage
  const existingLeadId = searchParams.get('lead_id') || getStoredLeadId();

  // Check if already logged in or has existing lead
  useEffect(() => {
    const checkStatus = async () => {
      // If user is already logged in, redirect appropriately
      if (user) {
        try {
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
          return;
        } catch (error) {
          console.error('Status check error:', error);
        }
      }

      // If we have an existing lead_id, offer to continue
      if (existingLeadId) {
        // Check if lead exists and is not yet converted
        try {
          const { data: lead } = await supabase
            .from('signup_leads')
            .select('id, email, full_name, completed_at')
            .eq('id', existingLeadId)
            .maybeSingle();

          if (lead && !lead.completed_at) {
            // Lead exists and not yet completed - redirect to Step 2
            navigate(`/onboarding-chat?lead_id=${existingLeadId}&email=${encodeURIComponent(lead.email)}`, { replace: true });
            return;
          }
        } catch {
          // Ignore - will create new lead if needed
        }
      }
    };

    if (!isCheckingAuth) {
      checkStatus();
    }
  }, [user, isCheckingAuth, navigate, existingLeadId]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateName = (name: string): boolean => {
    // At least 2 characters, letters and spaces only
    return name.trim().length >= 2 && /^[a-zA-Z\s'-]+$/.test(name.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // Validation
    if (!trimmedName) {
      toast.error('Please enter your name');
      return;
    }

    if (!validateName(trimmedName)) {
      toast.error('Name should only contain letters and spaces');
      return;
    }

    if (!trimmedEmail) {
      toast.error('Please enter your email');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('[Start] Capturing lead:', { name: trimmedName, email: trimmedEmail });

      // Get UTM params and other metadata
      const utmSource = searchParams.get('utm_source') || undefined;
      const utmCampaign = searchParams.get('utm_campaign') || undefined;
      const utmMedium = searchParams.get('utm_medium') || undefined;

      // Call capture-signup-lead to create/update lead
      const data = await captureSignupLead({
        email: trimmedEmail,
        full_name: trimmedName,
        source: 'website',
        signup_flow: 'two-step-v2',
        metadata: {
          utm_source: utmSource,
          utm_campaign: utmCampaign,
          utm_medium: utmMedium,
          referrer: document.referrer || undefined,
          step: 'lead_capture',
        },
      });

      if (!data || !data.success) {
        console.error('[Start] capture-signup-lead failed:', data);
        throw new Error((data as { message?: string }).message || 'Failed to save your information');
      }

      const leadId = (data as { lead_id?: string }).lead_id;
      console.log('[Start] Lead captured successfully:', { leadId });

      // Store lead_id for persistence
      storeLeadId(leadId);

      // Show success feedback
      toast.success('Great! Loading your setup...');

      // Small delay for UX, then redirect to Step 2
      setTimeout(() => {
        navigate(`/onboarding-chat?lead_id=${leadId}&email=${encodeURIComponent(trimmedEmail)}`);
      }, 500);

    } catch (error: any) {
      console.error('[Start] Error:', error);

      let message = 'Something went wrong. Please try again.';

      if (error.message) {
        if (error.message.includes('disposable')) {
          message = 'Please use a business email address (not a temporary email)';
        } else if (error.message.includes('already')) {
          // Lead already exists - this is actually ok, redirect them
          message = 'You\'ve already started! Redirecting...';
          const leadId = error.lead_id || getStoredLeadId();
          if (leadId) {
            setTimeout(() => {
              navigate(`/onboarding-chat?lead_id=${leadId}&email=${encodeURIComponent(trimmedEmail)}`);
            }, 1000);
            toast.info(message);
            return;
          }
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="p-4 md:p-6">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <Phone className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">RingSnap</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex items-center justify-center px-4 py-8 md:py-16">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-2">
            <CardContent className="p-6 md:p-8">
              {/* Headline */}
              <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                  Stop Losing $4K+/Month to Unanswered Calls
                </h1>
                <p className="text-muted-foreground">
                  Get your AI receptionist in under 2 minutes
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12 text-base"
                    autoComplete="name"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@acmeplumbing.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12 text-base"
                    autoComplete="email"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Use your business email for faster approval
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Start My Free Trial
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>

              {/* Trust Badges */}
              <div className="mt-6 pt-6 border-t">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span>Setup in 2 minutes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    <span>150 minutes included</span>
                  </div>
                </div>
              </div>

              {/* Sign In Link */}
              <div className="mt-6 text-center">
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

          {/* Social Proof */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Trusted by 500+ contractors and home service businesses
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
