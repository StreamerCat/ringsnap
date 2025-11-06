import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, MapPin, Hash, Gift } from "lucide-react";
import { WizardFormData, TRADES } from "./types";

interface BusinessEssentialsStepProps {
  form: UseFormReturn<WizardFormData>;
  showReferralCode?: boolean;
}

export const BusinessEssentialsStep = ({ form, showReferralCode = true }: BusinessEssentialsStepProps) => {
  const selectedTrade = form.watch("trade");
  const [customTrade, setCustomTrade] = useState("");
  const referralCode = form.watch("referralCode");

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-foreground">Let's Get Started</h2>
        <p className="text-muted-foreground">Tell us about your business</p>
      </div>

      <Card className="card-tier-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Business Information
          </CardTitle>
          <CardDescription>This information will be used to personalize your AI assistant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName" className="text-base font-medium">
              Company Name <span className="text-primary">*</span>
            </Label>
            <Input
              id="companyName"
              {...form.register("companyName")}
              placeholder="ABC Plumbing & Heating"
              className="text-base input-focus h-12"
              autoFocus
            />
            {form.formState.errors.companyName && (
              <p className="text-sm text-destructive">{form.formState.errors.companyName.message}</p>
            )}
          </div>

          {/* Trade */}
          <div className="space-y-2">
            <Label htmlFor="trade" className="text-base font-medium">
              Trade/Industry <span className="text-primary">*</span>
            </Label>
            <Select
              value={selectedTrade === "other" ? "other" : form.watch("trade")}
              onValueChange={(value) => {
                if (value === "other") {
                  form.setValue("trade", "other", { shouldValidate: true });
                  setCustomTrade("");
                } else {
                  form.setValue("trade", value, { shouldValidate: true });
                }
              }}
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Select your trade" />
              </SelectTrigger>
              <SelectContent>
                {TRADES.map((trade) => (
                  <SelectItem key={trade.value} value={trade.value}>
                    {trade.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTrade === "other" && (
              <Input
                value={customTrade}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomTrade(value);
                  form.setValue("trade", value, { shouldValidate: true });
                }}
                placeholder="Enter your trade or industry"
                className="text-base input-focus h-12 mt-2"
              />
            )}
            {form.formState.errors.trade && (
              <p className="text-sm text-destructive">{form.formState.errors.trade.message}</p>
            )}
          </div>

          {/* Service Area */}
          <div className="space-y-2">
            <Label htmlFor="serviceArea" className="flex items-center gap-2 text-base font-medium">
              <MapPin className="h-4 w-4 text-primary" />
              Service Area <span className="text-primary">*</span>
            </Label>
            <Input
              id="serviceArea"
              {...form.register("serviceArea")}
              placeholder="e.g., Dallas/Fort Worth Metro"
              className="text-base input-focus h-12"
            />
            {form.formState.errors.serviceArea && (
              <p className="text-sm text-destructive">{form.formState.errors.serviceArea.message}</p>
            )}
          </div>

          {/* ZIP Code */}
          <div className="space-y-2">
            <Label htmlFor="zipCode" className="flex items-center gap-2 text-base font-medium">
              <Hash className="h-4 w-4 text-primary" />
              ZIP Code <span className="text-primary">*</span>
            </Label>
            <Input
              id="zipCode"
              {...form.register("zipCode")}
              placeholder="12345"
              maxLength={5}
              className="text-base input-focus h-12"
            />
            <p className="text-xs text-muted-foreground">
              We'll suggest phone numbers with area codes near your location
            </p>
            {form.formState.errors.zipCode && (
              <p className="text-sm text-destructive">{form.formState.errors.zipCode.message}</p>
            )}
          </div>

          {/* Referral Code (Optional) */}
          {showReferralCode && (
            <div className="space-y-2">
              <Label htmlFor="referralCode" className="flex items-center gap-2 text-base font-medium">
                <Gift className="h-4 w-4 text-primary" />
                Referral Code <span className="text-muted-foreground text-sm">(Optional)</span>
              </Label>
              <Input
                id="referralCode"
                {...form.register("referralCode")}
                placeholder="Enter code if you have one"
                className="text-base input-focus h-12"
              />
              {referralCode && referralCode.startsWith("SALES-") && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Gift className="h-4 w-4" />
                  <span>✓ Sales assistance enabled</span>
                </div>
              )}
              {referralCode && !referralCode.startsWith("SALES-") && referralCode.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  🎁 You'll receive special benefits with this referral
                </p>
              )}
              {form.formState.errors.referralCode && (
                <p className="text-sm text-destructive">{form.formState.errors.referralCode.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
