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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface BusinessAdvancedFormProps {
  form: UseFormReturn<any>;
  fields?: ("businessHours" | "emergencyPolicy" | "primaryGoal" | "customInstructions")[];
  disabled?: boolean;
}

/**
 * Shared business advanced configuration form component
 * Used primarily in self-serve flow; sales flow skips this
 *
 * @example Self-serve usage
 * <BusinessAdvancedForm
 *   form={form}
 *   fields={['businessHours', 'primaryGoal']}
 * />
 *
 * @example Sales usage (not typically used)
 * <BusinessAdvancedForm
 *   form={form}
 *   fields={['businessHours', 'emergencyPolicy']}
 * />
 */
export function BusinessAdvancedForm({
  form,
  fields = ["businessHours", "primaryGoal"],
  disabled = false,
}: BusinessAdvancedFormProps) {
  return (
    <div className="space-y-4">
      {fields.includes("primaryGoal") && (
        <FormField
          control={form.control}
          name="primaryGoal"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Primary Goal
                <Badge variant="secondary" className="text-xs">
                  Optional
                </Badge>
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="What's your main goal?" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="book_appointments">
                    📅 Book Appointments
                  </SelectItem>
                  <SelectItem value="capture_leads">
                    📝 Capture Leads
                  </SelectItem>
                  <SelectItem value="answer_questions">
                    💬 Answer Questions
                  </SelectItem>
                  <SelectItem value="take_orders">
                    🛒 Take Orders
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                We'll optimize your Agent's behavior for this goal
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {fields.includes("businessHours") && (
        <FormField
          control={form.control}
          name="businessHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Business Hours
                <Badge variant="secondary" className="text-xs">
                  Optional
                </Badge>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Mon-Fri 8am-6pm, Sat 9am-3pm"
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Your Agent will mention these hours to callers
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {fields.includes("emergencyPolicy") && (
        <FormField
          control={form.control}
          name="emergencyPolicy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emergency Call Policy</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="For emergencies outside business hours, call our 24/7 hotline at..."
                  rows={3}
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                How should your Agent handle emergency calls outside business hours?
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {fields.includes("customInstructions") && (
        <FormField
          control={form.control}
          name="customInstructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Custom Instructions
                <Badge variant="secondary" className="text-xs">
                  Optional
                </Badge>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any specific instructions for your Agent?"
                  rows={4}
                  maxLength={500}
                  disabled={disabled}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Special handling, pricing info, or anything else your Agent should know (max 500 characters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
