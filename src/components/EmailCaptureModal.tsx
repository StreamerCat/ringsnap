import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Mail, Building, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address").max(255),
  business: z.string().min(2, "Business name must be at least 2 characters").max(100)
});

type FormData = z.infer<typeof formSchema>;

interface EmailCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculatorData?: {
    trade: string;
    customerCalls: number;
    lostRevenue: number;
    recoveredRevenue: number;
    netGain: number;
    roi: number;
    paybackDays: number;
  };
}

export const EmailCaptureModal = ({ open, onOpenChange, calculatorData }: EmailCaptureModalProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema)
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      // Save to database
      const { error } = await supabase.from("revenue_report_leads" as any).insert({
        name: data.name,
        email: data.email,
        business: data.business,
        trade: calculatorData?.trade || null,
        customer_calls: calculatorData?.customerCalls || null,
        lost_revenue: calculatorData?.lostRevenue || null,
        recovered_revenue: calculatorData?.recoveredRevenue || null,
        net_gain: calculatorData?.netGain || null,
        roi: calculatorData?.roi || null,
        payback_days: calculatorData?.paybackDays || null,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your personalized recovery plan is on the way. Check your email in 2 minutes.",
      });

      reset();
      onOpenChange(false);
    } catch (error) {
      // Only log in development to prevent information leakage
      if (import.meta.env.DEV) {
        console.error("Form submission error:", error);
      }
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Get Your Personalized Recovery Plan</DialogTitle>
          <DialogDescription>
            We'll send you a detailed breakdown showing exactly how much revenue you're losing and how to recover it—plus 3 contractor case studies.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Your Name
            </Label>
            <Input 
              id="name" 
              placeholder="John Smith" 
              {...register("name")}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address
            </Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="john@smithplumbing.com" 
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="business" className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              Business Name
            </Label>
            <Input 
              id="business" 
              placeholder="Smith Plumbing LLC" 
              {...register("business")}
              className={errors.business ? "border-destructive" : ""}
            />
            {errors.business && (
              <p className="text-xs text-destructive">{errors.business.message}</p>
            )}
          </div>

          {calculatorData && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2 text-sm">
              <div className="font-semibold">Your Recovery Potential:</div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lost Revenue:</span>
                <span className="font-bold text-destructive">${calculatorData.lostRevenue.toLocaleString()}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recoverable:</span>
                <span className="font-bold text-primary">${calculatorData.recoveredRevenue.toLocaleString()}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payback Time:</span>
                <span className="font-bold">{calculatorData.paybackDays} days</span>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full h-12" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send Me My Recovery Plan"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            🔒 We'll never spam you. Unsubscribe anytime with one click.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};
