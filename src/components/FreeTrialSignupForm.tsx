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
import { PhoneVerificationModal } from "@/components/PhoneVerificationModal";

const formSchema = z
  .object({
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
    trade: z.string().optional(),
    companyName: z.string().optional(),
    zipCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "Please enter a valid 5-digit ZIP code")
      .optional(),
    assistantGender: z.enum(['male', 'female']).default('female'),
    referralCode: z
      .string()
      .trim()
      .length(8, "Referral code must be exactly 8 characters")
      .optional()
      .or(z.literal(''))
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
  const [showVerification, setShowVerification] = useState(false);
  const [verificationPhone, setVerificationPhone] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      trade: "",
      companyName: "",
      zipCode: "",
      assistantGender: "female",
      referralCode: ""
    }
  });

  const onSubmit = async (data: FormData) => {
    setErrorMessage(null);
    setIsSubmitting(true);

    const trimmedPhone = data.phone.trim();
    setVerificationPhone(trimmedPhone);

    try {
      // Step 1: Send verification code
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const sendCodeResponse = await fetch(`${supabaseUrl}/functions/v1/send-verification-code`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: trimmedPhone })
      });

      const sendCodeResult = await sendCodeResponse.json();

      if (!sendCodeResponse.ok || !sendCodeResult?.ok) {
        throw new Error(sendCodeResult?.error || "Failed to send verification code");
      }

      // Show verification modal
      setShowVerification(true);
      setIsSubmitting(false);
    } catch (error) {
      console.error("Verification send failed:", error);
      const errorMsg = error instanceof Error ? error.message : "Could not send verification code. Please try again.";
      setErrorMessage(errorMsg);
      setIsSubmitting(false);
    }
  };

  const handleVerificationSuccess = async () => {
    setShowVerification(false);
    setIsSubmitting(true);

    const data = form.getValues();
    const payload = {
      name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      trade: data.trade?.trim() ?? "",
      companyName: data.companyName?.trim() ?? "",
      zipCode: data.zipCode?.trim() ?? "",
      assistantGender: data.assistantGender,
      referralCode: data.referralCode?.trim() ?? ""
    };

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/free-trial-signup`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        const errorDetails = result?.details || result?.error || "Unknown error";
        throw new Error(errorDetails);
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

            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name (Optional)</FormLabel>
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

            <FormField
              control={form.control}
              name="trade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trade</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your trade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="hvac">HVAC</SelectItem>
                      <SelectItem value="plumbing">Plumbing</SelectItem>
                      <SelectItem value="electrician">Electrician</SelectItem>
                      <SelectItem value="landscaping">Landscaping</SelectItem>
                      <SelectItem value="general_contractor">General Contractor</SelectItem>
                      <SelectItem value="roofing">Roofing</SelectItem>
                      <SelectItem value="pest_control">Pest Control</SelectItem>
                      <SelectItem value="garage_door">Garage Door Repair</SelectItem>
                      <SelectItem value="carpentry">Carpentry</SelectItem>
                      <SelectItem value="painting">Painting</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP Code (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="12345"
                      {...field}
                      className="px-3 sm:px-4"
                    />
                  </FormControl>
                  <FormMessage className="text-xs flex items-start gap-1" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assistantGender"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Assistant Voice</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="female" id="female" />
                        <label htmlFor="female" className="text-sm cursor-pointer">Female (Sarah)</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="male" id="male" />
                        <label htmlFor="male" className="text-sm cursor-pointer">Male (Michael)</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="referralCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referral Code (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter 8-character code"
                      {...field}
                      maxLength={8}
                      className="px-3 sm:px-4 uppercase"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
              {isSubmitting ? "Sending Code..." : "Continue"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By continuing, you agree to our Terms of Service and Privacy Policy
            </p>
          </form>
        </Form>
      </DialogContent>

      <PhoneVerificationModal
        open={showVerification}
        onOpenChange={setShowVerification}
        phone={verificationPhone}
        onSuccess={handleVerificationSuccess}
      />
    </Dialog>
  );
};
