import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const setupSchema = z.object({
  zipCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Please enter a valid 5-digit ZIP code"),
  trade: z.string().min(1, "Please select your trade"),
  assistantGender: z.enum(['male', 'female']),
  referralCode: z
    .string()
    .trim()
    .length(8, "Referral code must be exactly 8 characters")
    .optional()
    .or(z.literal(''))
});

type SetupFormData = z.infer<typeof setupSchema>;

interface OnboardingSetupFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const OnboardingSetupForm = ({ open, onOpenChange, onSuccess }: OnboardingSetupFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      zipCode: "",
      trade: "",
      assistantGender: "female",
      referralCode: ""
    }
  });

  const onSubmit = async (data: SetupFormData) => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { data: result, error } = await supabase.functions.invoke('complete-onboarding', {
        body: {
          zipCode: data.zipCode.trim(),
          trade: data.trade,
          assistantGender: data.assistantGender,
          referralCode: data.referralCode?.trim() || null
        }
      });

      if (error) {
        throw error;
      }

      if (!result?.ok) {
        throw new Error(result?.error || "Failed to complete onboarding");
      }

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Onboarding setup failed:", error);
      const errorMsg = error instanceof Error ? error.message : "Could not complete setup. Please try again.";
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    // Prevent closing during submission
    if (!nextOpen && isSubmitting) {
      return;
    }
    // Don't allow manual closing - user must complete setup
    if (!nextOpen) {
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Complete Your Setup</DialogTitle>
          <DialogDescription>
            Step 2 of 2 - Help us configure your AI assistant for your business
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="zipCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ZIP Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="12345"
                      {...field}
                      maxLength={5}
                      className="px-3 sm:px-4"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Used to match your local area code
                  </FormDescription>
                  <FormMessage className="text-xs" />
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
              name="assistantGender"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Choose the voice type of your AI assistant</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="female" id="female" />
                        <label htmlFor="female" className="text-sm cursor-pointer">Female Voice</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="male" id="male" />
                        <label htmlFor="male" className="text-sm cursor-pointer">Male Voice</label>
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
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {errorMessage && (
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-primary text-white hover:opacity-90"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting Up Your Account...
                </>
              ) : (
                "Complete Setup & Provision Resources"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              This helps us configure your AI assistant to best serve your business
            </p>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
