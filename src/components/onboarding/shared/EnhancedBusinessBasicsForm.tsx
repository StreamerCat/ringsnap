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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Trade options (shared across the app)
export const TRADES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Roofing",
  "General Contractor",
  "Carpentry",
  "Painting",
  "Landscaping",
  "Pest Control",
  "Garage Door Repair",
  "Appliance Repair",
  "Pool Service",
  "Locksmith",
  "Flooring",
  "Drywall",
  "Windows & Doors",
  "Masonry",
  "Concrete",
  "Fencing",
  "Gutters",
  "Restaurant",
  "Retail",
  "Professional Services",
  "Medical/Dental",
  "Legal",
  "Real Estate",
  "Other",
];

interface EnhancedBusinessBasicsFormProps {
  form: UseFormReturn<any>;
  requiredFields?: ("companyName" | "trade" | "website" | "serviceArea" | "zipCode")[];
  showOptionalBadges?: boolean;
  disabled?: boolean;
}

/**
 * Enhanced business basics form component with:
 * - Visual validation feedback (green checkmarks)
 * - Better copy and help text
 * - Improved placeholders
 */
export function EnhancedBusinessBasicsForm({
  form,
  requiredFields = ["companyName", "trade"],
  showOptionalBadges = true,
  disabled = false,
}: EnhancedBusinessBasicsFormProps) {
  const isFieldRequired = (field: string) => requiredFields.includes(field as any);

  const companyNameValue = form.watch("companyName");
  const websiteValue = form.watch("website");
  const zipCodeValue = form.watch("zipCode");

  return (
    <div className="space-y-4">
      {requiredFields.includes("companyName") && (
        <FormField
          control={form.control}
          name="companyName"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Company or Business Name *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="ABC Plumbing"
                    disabled={disabled}
                    className={cn(
                      "pr-10",
                      fieldState.error && "border-red-500",
                      !fieldState.error && companyNameValue && "border-green-500"
                    )}
                    autoComplete="organization"
                    {...field}
                  />
                  {!fieldState.error && companyNameValue && (
                    <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {requiredFields.includes("trade") && (
        <FormField
          control={form.control}
          name="trade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trade or Industry *</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your trade or industry" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TRADES.map((trade) => (
                    <SelectItem key={trade} value={trade}>
                      {trade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {requiredFields.includes("website") && (
        <FormField
          control={form.control}
          name="website"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Company Website
                {showOptionalBadges && !isFieldRequired("website") && (
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                )}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type="url"
                    placeholder="yourcompany.com or email@domain.com"
                    disabled={disabled}
                    className={cn(
                      "pr-10",
                      fieldState.error && "border-red-500",
                      !fieldState.error && websiteValue && "border-green-500"
                    )}
                    autoComplete="url"
                    {...field}
                  />
                  {!fieldState.error && websiteValue && (
                    <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                  )}
                </div>
              </FormControl>
              {!fieldState.error && (
                <FormDescription>
                  You can enter a URL or email - we'll extract the domain
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {requiredFields.includes("serviceArea") && (
        <FormField
          control={form.control}
          name="serviceArea"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Service Area {isFieldRequired("serviceArea") ? "*" : ""}
                {showOptionalBadges && !isFieldRequired("serviceArea") && (
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                )}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Dallas/Fort Worth Metro"
                  disabled={disabled}
                  className={cn(
                    fieldState.error && "border-red-500"
                  )}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Geographic area where you provide services
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {requiredFields.includes("zipCode") && (
        <FormField
          control={form.control}
          name="zipCode"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                ZIP Code {isFieldRequired("zipCode") ? "*" : ""}
                {showOptionalBadges && !isFieldRequired("zipCode") && (
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                )}
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="90210"
                    maxLength={5}
                    disabled={disabled}
                    className={cn(
                      "pr-10",
                      fieldState.error && "border-red-500",
                      !fieldState.error && zipCodeValue && /^\d{5}$/.test(zipCodeValue) && "border-green-500"
                    )}
                    inputMode="numeric"
                    {...field}
                  />
                  {!fieldState.error && zipCodeValue && /^\d{5}$/.test(zipCodeValue) && (
                    <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                  )}
                </div>
              </FormControl>
              <FormDescription>
                Used to select a local phone number area code
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
