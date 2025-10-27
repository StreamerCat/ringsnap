import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckCircle, Mail, Clock, Sparkles, Shield, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  name: z.string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  email: z.string()
    .trim()
    .email("Please enter a valid email")
    .max(255, "Email must be less than 255 characters"),
  phone: z.string()
    .trim()
    .min(10, "Please enter a valid phone number")
    .max(20, "Phone number is too long"),
  wantsAdvancedVoice: z.boolean().default(false),
});

type FormData = z.infer<typeof formSchema>;

interface FreeTrialSignupFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}

export const FreeTrialSignupForm = ({ open, onOpenChange, source }: FreeTrialSignupFormProps) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      wantsAdvancedVoice: false,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      // Parallel submissions to Lovable Cloud and Formspree
      const [supabaseResult, formspreeResult] = await Promise.allSettled([
        // Lovable Cloud submission
        supabase.from("trial_signups").insert({
          name: data.name,
          email: data.email,
          phone: data.phone,
          wants_advanced_voice: data.wantsAdvancedVoice,
          source: source || "unknown",
        }),
        // Formspree submission
        fetch("https://formspree.io/f/xanyepky", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            phone: data.phone,
            wantsAdvancedVoice: data.wantsAdvancedVoice,
            source: source || "unknown",
          }),
        }),
      ]);

      // Check for errors
      if (supabaseResult.status === "rejected") {
        console.error("Lovable Cloud error:", supabaseResult.reason);
      }
      if (formspreeResult.status === "rejected") {
        console.error("Formspree error:", formspreeResult.reason);
      }

      // Show success if at least one succeeded
      if (supabaseResult.status === "fulfilled" || formspreeResult.status === "fulfilled") {
        setShowConfirmation(true);
      } else {
        throw new Error("Both submissions failed");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error("Something went wrong. Please try again or email us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      setShowConfirmation(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {!showConfirmation ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl sm:text-3xl font-bold text-center" style={{color: 'hsl(var(--charcoal))'}}>
                Start Taking Every Call in 10 Minutes
              </DialogTitle>
              <p className="text-center text-sm text-muted-foreground pt-2">
                150 minutes free • Cancel anytime
              </p>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
                      </FormControl>
                      <FormMessage />
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
                        <Input type="email" placeholder="john@smithplumbing.com" {...field} />
                      </FormControl>
                      <FormMessage />
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
                        <Input type="tel" placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="wantsAdvancedVoice"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium">
                          I want to clone my own voice (Premium feature)
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          We'll send you voice recording instructions after signup
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

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
          </>
        ) : (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold" style={{color: 'hsl(var(--charcoal))'}}>
                Check Your Inbox!
              </h3>
              <p className="text-muted-foreground">
                We've sent setup instructions to <span className="font-semibold text-charcoal">{form.getValues("email")}</span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-primary/10 border border-primary/20">
              <Mail className="w-5 h-5 text-primary flex-shrink-0" />
              <p className="text-sm font-medium" style={{color: 'hsl(var(--charcoal))'}}>
                <span className="font-bold">Check your inbox now</span> — Setup link expires in 24 hours
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-center" style={{color: 'hsl(var(--charcoal))'}}>
                What happens next?
              </h4>

              <div className="space-y-3">
                <div className="flex gap-3 items-start p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-sm mb-1" style={{color: 'hsl(var(--charcoal))'}}>
                      Check Your Email (2 minutes)
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      Look for "Your RingSnap Account is Ready"<br />
                      Contains: Login credentials + automatic setup link
                    </p>
                  </div>
                  <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </div>

                <div className="flex gap-3 items-start p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-sm mb-1" style={{color: 'hsl(var(--charcoal))'}}>
                      One-Click Account Setup (30 seconds)
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      Click the link in email to automatically configure your account
                    </p>
                  </div>
                  <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
                </div>

                <div className="flex gap-3 items-start p-3 rounded-lg bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-sm mb-1" style={{color: 'hsl(var(--charcoal))'}}>
                      Start Taking Calls (Today)
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      Test with your first call using 150 free trial minutes
                    </p>
                  </div>
                  <Zap className="w-5 h-5 text-primary flex-shrink-0" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-primary" />
                <span>3-day trial</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-primary" />
                <span>150 minutes included</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-primary" />
                <span>Cancel anytime</span>
              </div>
            </div>

            <Button
              onClick={handleClose}
              className="w-full h-12 rounded-full"
              variant="outline"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};