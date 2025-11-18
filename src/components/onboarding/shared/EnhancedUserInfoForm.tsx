import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSmartEmail } from "@/hooks/useSmartEmail";

interface EnhancedUserInfoFormProps {
  form: UseFormReturn<any>;
  requiredFields?: ("name" | "email" | "phone")[];
  showLabels?: boolean;
  compact?: boolean;
  disabled?: boolean;
  enableSmartEmail?: boolean; // Enable smart email detection
}

/**
 * Enhanced user information form component with:
 * - Visual validation feedback (green checkmarks)
 * - Smart email detection (auto-fills company & website)
 * - Better copy and help text
 * - Improved error messages
 */
export function EnhancedUserInfoForm({
  form,
  requiredFields = ["name", "email", "phone"],
  showLabels = true,
  compact = false,
  disabled = false,
  enableSmartEmail = true,
}: EnhancedUserInfoFormProps) {
  const nameValue = form.watch("name");
  const emailValue = form.watch("email");
  const phoneValue = form.watch("phone");

  // Smart email detection
  const { isBusinessEmail, detectedDomain } = useSmartEmail(form, "email", {
    companyNameField: "companyName",
    websiteField: "website",
    autoFillCompanyName: enableSmartEmail,
    autoFillWebsite: enableSmartEmail,
  });

  return (
    <div className={cn("space-y-4", compact && "space-y-2")}>
      {requiredFields.includes("name") && (
        <FormField
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <FormItem>
              {showLabels && <FormLabel>Full Name *</FormLabel>}
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="John Smith"
                    disabled={disabled}
                    className={cn(
                      "pr-10",
                      fieldState.error && "border-red-500",
                      !fieldState.error && nameValue && "border-green-500"
                    )}
                    autoComplete="name"
                    {...field}
                  />
                  {!fieldState.error && nameValue && (
                    <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {requiredFields.includes("email") && (
        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <FormItem>
              {showLabels && (
                <FormLabel className="flex items-center gap-2">
                  Work Email *
                  {isBusinessEmail && detectedDomain && (
                    <span className="text-xs font-normal text-emerald-600 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      from {detectedDomain}
                    </span>
                  )}
                </FormLabel>
              )}
              <FormControl>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="john@yourcompany.com"
                    disabled={disabled}
                    className={cn(
                      "pr-10",
                      fieldState.error && "border-red-500",
                      !fieldState.error && emailValue && emailValue.includes("@") && "border-green-500"
                    )}
                    autoComplete="email"
                    {...field}
                  />
                  {!fieldState.error && emailValue && emailValue.includes("@") && (
                    <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                  )}
                </div>
              </FormControl>
              {!fieldState.error && (
                <FormDescription className="text-xs">
                  We'll use this for account access and important notifications
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {requiredFields.includes("phone") && (
        <FormField
          control={form.control}
          name="phone"
          render={({ field, fieldState }) => (
            <FormItem>
              {showLabels && <FormLabel>Phone Number *</FormLabel>}
              <FormControl>
                <div className="relative">
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    disabled={disabled}
                    className={cn(
                      "pr-10",
                      fieldState.error && "border-red-500",
                      !fieldState.error && phoneValue && "border-green-500"
                    )}
                    autoComplete="tel"
                    inputMode="tel"
                    {...field}
                  />
                  {!fieldState.error && phoneValue && (
                    <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                  )}
                </div>
              </FormControl>
              {!fieldState.error && (
                <FormDescription className="text-xs">
                  Used for account verification and login codes
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
