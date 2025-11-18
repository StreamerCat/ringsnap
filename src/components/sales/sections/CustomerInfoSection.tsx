import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSmartEmail } from "@/hooks/useSmartEmail";
import { TRADES } from "@/components/wizard/types";
import { FormSectionProps } from "../types";
import { fieldPlaceholders, fieldHelpText } from "@/components/signup/shared/enhanced-schemas";

/**
 * Customer Information Section
 *
 * Collects basic customer details:
 * - Name, Email, Phone
 * - Company Name, Website (with smart email detection)
 * - Trade/Industry
 *
 * Features:
 * - Auto-fills company name and website from business email domains
 * - Visual feedback for valid fields
 * - Helpful placeholder text and error messages
 */
export function CustomerInfoSection({ form, isSubmitting }: FormSectionProps) {
  const [customTrade, setCustomTrade] = useState("");

  // Smart email detection
  const { isBusinessEmail, detectedDomain } = useSmartEmail(form, 'email', {
    companyNameField: 'companyName',
    websiteField: 'website',
    autoFillCompanyName: true,
    autoFillWebsite: true,
  });

  const selectedTrade = form.watch('trade');
  const emailValue = form.watch('email');
  const companyNameValue = form.watch('companyName');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Customer Information
          {isBusinessEmail && (
            <span className="inline-flex items-center gap-1 text-sm font-normal text-emerald-600">
              <Sparkles className="h-4 w-4" />
              Auto-filled from email
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <div className="relative">
            <Input
              id="name"
              {...form.register("name")}
              placeholder={fieldPlaceholders.name}
              className={cn(
                "text-base pr-10",
                form.formState.errors.name && "border-red-500",
                !form.formState.errors.name &&
                  form.getValues("name") &&
                  "border-green-500"
              )}
              disabled={isSubmitting}
              autoComplete="name"
            />
            {!form.formState.errors.name && form.getValues("name") && (
              <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
            )}
          </div>
          {form.formState.errors.name && (
            <p className="text-sm text-red-500">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Work Email *</Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              placeholder={fieldPlaceholders.email}
              className={cn(
                "text-base pr-10",
                form.formState.errors.email && "border-red-500",
                !form.formState.errors.email &&
                  emailValue &&
                  emailValue.includes("@") &&
                  "border-green-500"
              )}
              disabled={isSubmitting}
              autoComplete="email"
            />
            {!form.formState.errors.email &&
              emailValue &&
              emailValue.includes("@") && (
                <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
              )}
          </div>
          {form.formState.errors.email && (
            <p className="text-sm text-red-500">
              {form.formState.errors.email.message}
            </p>
          )}
          {!form.formState.errors.email && fieldHelpText.email && (
            <p className="text-xs text-muted-foreground">
              {fieldHelpText.email}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <div className="relative">
            <Input
              id="phone"
              type="tel"
              {...form.register("phone")}
              placeholder={fieldPlaceholders.phone}
              maxLength={17}
              className={cn(
                "text-base pr-10",
                form.formState.errors.phone && "border-red-500",
                !form.formState.errors.phone &&
                  form.getValues("phone") &&
                  "border-green-500"
              )}
              disabled={isSubmitting}
              autoComplete="tel"
              inputMode="tel"
            />
            {!form.formState.errors.phone && form.getValues("phone") && (
              <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
            )}
          </div>
          {form.formState.errors.phone && (
            <p className="text-sm text-red-500">
              {form.formState.errors.phone.message}
            </p>
          )}
          {!form.formState.errors.phone && fieldHelpText.phone && (
            <p className="text-xs text-muted-foreground">
              {fieldHelpText.phone}
            </p>
          )}
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="companyName">
            Company or Business Name *
            {isBusinessEmail && detectedDomain && (
              <span className="ml-2 text-xs font-normal text-emerald-600">
                from {detectedDomain}
              </span>
            )}
          </Label>
          <div className="relative">
            <Input
              id="companyName"
              {...form.register("companyName")}
              placeholder={fieldPlaceholders.companyName}
              className={cn(
                "text-base pr-10",
                form.formState.errors.companyName && "border-red-500",
                !form.formState.errors.companyName &&
                  companyNameValue &&
                  "border-green-500"
              )}
              disabled={isSubmitting}
              autoComplete="organization"
            />
            {!form.formState.errors.companyName && companyNameValue && (
              <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
            )}
          </div>
          {form.formState.errors.companyName && (
            <p className="text-sm text-red-500">
              {form.formState.errors.companyName.message}
            </p>
          )}
        </div>

        {/* Website */}
        <div className="space-y-2">
          <Label htmlFor="website">Company Website *</Label>
          <div className="relative">
            <Input
              id="website"
              type="url"
              {...form.register("website")}
              placeholder={fieldPlaceholders.website}
              className={cn(
                "text-base pr-10",
                form.formState.errors.website && "border-red-500",
                !form.formState.errors.website &&
                  form.getValues("website") &&
                  "border-green-500"
              )}
              disabled={isSubmitting}
              autoComplete="url"
            />
            {!form.formState.errors.website && form.getValues("website") && (
              <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
            )}
          </div>
          {form.formState.errors.website && (
            <p className="text-sm text-red-500">
              {form.formState.errors.website.message}
            </p>
          )}
          {!form.formState.errors.website && fieldHelpText.website && (
            <p className="text-xs text-muted-foreground">
              {fieldHelpText.website}
            </p>
          )}
        </div>

        {/* Trade */}
        <FormField
          control={form.control}
          name="trade"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Trade or Industry *</FormLabel>
              <Select
                onValueChange={(value) => {
                  if (value === "other") {
                    field.onChange("other");
                    setCustomTrade("");
                  } else {
                    field.onChange(value);
                  }
                }}
                defaultValue={field.value}
                disabled={isSubmitting}
              >
                <FormControl>
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="Select your trade or industry" />
                  </SelectTrigger>
                </FormControl>
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
                    field.onChange(value);
                  }}
                  placeholder="Enter your trade or industry"
                  className="text-base mt-2"
                  disabled={isSubmitting}
                />
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
