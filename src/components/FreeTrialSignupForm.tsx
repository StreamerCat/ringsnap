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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      trade: "",
      companyName: ""
    }
  });

  const onSubmit = async (data: FormData) => {
    setErrorMessage(null);
    setIsSubmitting(true);

    const trimmedName = data.name.trim();
    const trimmedEmail = data.email.trim();
    const trimmedPhone = data.phone.trim();

    const payload = {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      trade: data.trade?.trim() ?? "",
      companyName: data.companyName?.trim() ?? ""
    };

    try {
      console.log("Submitting signup with payload:", { ...payload, email: payload.email.substring(0, 3) + "***" });

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

      console.log("Response status:", response.status, response.statusText);

      const result = await response
        .json()
        .catch((e) => {
          console.error("Failed to parse JSON response:", e);
          return null;
        });

      console.log("Response data:", result);

      if (!response.ok || !result?.ok) {
        const errorDetails = result?.details || result?.error || "Unknown error";
        const errorCode = result?.code || "";
        const errorHint = result?.hint || "";
        console.error("Signup failed:", { error: errorDetails, code: errorCode, hint: errorHint });

        // Show detailed error to user
        setErrorMessage(`Error: ${errorDetails}${errorCode ? ` (${errorCode})` : ''}${errorHint ? ` - ${errorHint}` : ''}`);
        return;
      }

      form.reset();
      setErrorMessage(null);
      onOpenChange(false);
      navigate("/app");
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

            {errorMessage && (
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold rounded-full bg-primary text-white hover:opacity-90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Starting Your Trial..." : "Start Free Trial"}
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
