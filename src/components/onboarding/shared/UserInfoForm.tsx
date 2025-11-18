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
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserInfoFormProps {
  form: UseFormReturn<any>;
  requiredFields?: ("name" | "email" | "phone")[];
  showLabels?: boolean;
  compact?: boolean;
  disabled?: boolean;
  enhancedValidation?: boolean; // Show visual feedback
}

/**
 * Shared user information form component
 * Used in both self-serve and sales-guided flows
 *
 * @example Self-serve usage
 * <UserInfoForm
 *   form={form}
 *   requiredFields={['name', 'email', 'phone']}
 *   showLabels={true}
 * />
 *
 * @example Sales usage (compact)
 * <UserInfoForm
 *   form={form}
 *   requiredFields={['name', 'email', 'phone']}
 *   showLabels={false}
 *   compact={true}
 * />
 */
export function UserInfoForm({
  form,
  requiredFields = ["name", "email", "phone"],
  showLabels = true,
  compact = false,
  disabled = false,
}: UserInfoFormProps) {
  return (
    <div className={cn("space-y-4", compact && "space-y-2")}>
      {requiredFields.includes("name") && (
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              {showLabels && <FormLabel>Full Name *</FormLabel>}
              <FormControl>
                <Input
                  placeholder="John Smith"
                  disabled={disabled}
                  {...field}
                />
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
          render={({ field }) => (
            <FormItem>
              {showLabels && <FormLabel>Email *</FormLabel>}
              <FormControl>
                <Input
                  type="email"
                  placeholder="john@company.com"
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {requiredFields.includes("phone") && (
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              {showLabels && <FormLabel>Phone Number *</FormLabel>}
              <FormControl>
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
