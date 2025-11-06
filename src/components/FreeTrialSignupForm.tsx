import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email")
    .max(255, "Email must be less than 255 characters"),
  phone: z
    .string()
    .trim()
    .min(10, "Please enter a valid phone number")
    .max(20, "Phone number is too long"),
  companyName: z.string().optional()
});

type FormData = z.infer<typeof formSchema>;

interface FreeTrialSignupFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}

export const FreeTrialSignupForm = ({ open, onOpenChange }: FreeTrialSignupFormProps) => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(null);
  const [provisionJobId, setProvisionJobId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: ""
    }
  });

  // Check if email is generic to conditionally show company field
  const emailValue = form.watch('email');
  const emailDomain = emailValue?.split('@')[1]?.toLowerCase();
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'mail.com'];
  const isGenericEmail = emailDomain ? genericDomains.includes(emailDomain) : false;

  const onSubmit = async (data: FormData) => {
    setErrorMessage(null);
    setProvisionedNumber(null);
    setProvisionJobId(null);
    setIsSubmitting(true);

    const payload = {
      name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      companyName: data.companyName?.trim() ?? ""
    };

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('free-trial-signup', {
        body: payload
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (!result?.ok) {
        const errorDetails = result?.error || "Unknown error";
        throw new Error(errorDetails);
      }

      if (result.phone) {
        setProvisionedNumber(result.phone);
      }

      if (result.jobId) {
        setProvisionJobId(result.jobId);
      }

      // Sign in with returned credentials for instant login when available
      if (result.email && result.password) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: result.email,
          password: result.password,
        });

        if (signInError) {
          throw new Error('Account created but failed to sign in. Please use the login page.');
        }
      }

      form.reset();
      setErrorMessage(null);
      onOpenChange(false);
      navigate("/onboarding");
    } catch (error) {
      console.error("Signup submission failed:", error);
      const errorMsg = error instanceof Error ? error.message : "Could not start your trial. Please try again.";
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) {
      return;
    }

    if (!nextOpen) {
      form.reset();
      setErrorMessage(null);
      setProvisionedNumber(null);
      setProvisionJobId(null);
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className="text-2xl sm:text-3xl font-bold text-center"
            style={{ color: "hsl(var(--charcoal))" }}
          >
            Start Taking Every Call in 10 Minutes
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground pt-2">
            150 minutes free • Cancel anytime
          </p>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 mt-4"
            aria-live="polite"
          >
            {provisionedNumber && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="font-medium">You're all set!</p>
                <p className="mt-1">Your RingSnap assistant is reachable at <span className="font-semibold">{provisionedNumber}</span>.</p>
                {provisionJobId && (
                  <p className="mt-1 text-xs text-emerald-800">Provisioning job ID: {provisionJobId}</p>
                )}
              </div>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="John Smith"
                      {...field}
                      aria-required="true"
                      className="px-3 sm:px-4"
                    />
                  </FormControl>
                  <FormMessage className="text-xs flex items-start gap-1" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john@smithplumbing.com"
                      {...field}
                      aria-required="true"
                      className="px-3 sm:px-4"
                    />
                  </FormControl>
                  <FormMessage className="text-xs flex items-start gap-1" />
                </FormItem>
              )}
            />

            {isGenericEmail && (
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Smith Plumbing"
                        {...field}
                        className="px-3 sm:px-4"
                      />
                    </FormControl>
                    <FormMessage className="text-xs flex items-start gap-1" />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="(555) 123-4567"
                      {...field}
                      aria-required="true"
                      className="px-3 sm:px-4"
                    />
                  </FormControl>
                  <FormMessage className="text-xs flex items-start gap-1" />
                </FormItem>
              )}
            />

            {errorMessage && (
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold rounded-full bg-primary text-white hover:opacity-90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating Account..." : "Start Free Trial"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
