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

interface BusinessBasicsFormProps {
  form: UseFormReturn<any>;
  requiredFields?: ("companyName" | "trade" | "website" | "serviceArea" | "zipCode")[];
  showOptionalBadges?: boolean;
  disabled?: boolean;
}

/**
 * Shared business basics form component
 * Used in both self-serve and sales-guided flows
 *
 * @example Self-serve usage
 * <BusinessBasicsForm
 *   form={form}
 *   requiredFields={['companyName', 'trade', 'website']}
 *   showOptionalBadges={true}
 * />
 *
 * @example Sales usage
 * <BusinessBasicsForm
 *   form={form}
 *   requiredFields={['companyName', 'trade', 'serviceArea', 'zipCode']}
 *   showOptionalBadges={false}
 * />
 */
export function BusinessBasicsForm({
  form,
  requiredFields = ["companyName", "trade"],
  showOptionalBadges = true,
  disabled = false,
}: BusinessBasicsFormProps) {
  const isFieldRequired = (field: string) => requiredFields.includes(field as any);

  return (
    <div className="space-y-4">
      {requiredFields.includes("companyName") && (
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Company Name *
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="ACME HVAC & Plumbing"
                  disabled={disabled}
                  {...field}
                />
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
              <FormLabel>
                Trade / Industry *
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your trade" />
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
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Website
                {showOptionalBadges && !isFieldRequired("website") && (
                  <Badge variant="secondary" className="text-xs">
                    Optional
                  </Badge>
                )}
              </FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://yourcompany.com"
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                We'll use this to personalize your AI assistant
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {requiredFields.includes("serviceArea") && (
        <FormField
          control={form.control}
          name="serviceArea"
          render={({ field }) => (
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
                  placeholder="Denver Metro Area"
                  disabled={disabled}
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
          render={({ field }) => (
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
                <Input
                  placeholder="80202"
                  maxLength={5}
                  disabled={disabled}
                  {...field}
                />
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
