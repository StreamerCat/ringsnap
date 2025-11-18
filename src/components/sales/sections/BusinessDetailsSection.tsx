import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormSectionProps } from "../types";
import { fieldPlaceholders, fieldHelpText } from "@/components/signup/shared/enhanced-schemas";

const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

/**
 * Business Details Section
 *
 * Collects operational business information:
 * - Service Area
 * - Business Hours (day-by-day schedule)
 * - Emergency Call Policy
 * - ZIP Code (for area code lookup)
 * - Assistant Voice (male/female)
 * - Referral Code (optional)
 */
export function BusinessDetailsSection({ form, isSubmitting }: FormSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Service Area */}
        <div className="space-y-2">
          <Label htmlFor="serviceArea">Service Area *</Label>
          <div className="relative">
            <Input
              id="serviceArea"
              {...form.register("serviceArea")}
              placeholder={fieldPlaceholders.serviceArea}
              className={cn(
                "text-base pr-10",
                form.formState.errors.serviceArea && "border-red-500",
                !form.formState.errors.serviceArea &&
                  form.getValues("serviceArea") &&
                  "border-green-500"
              )}
              disabled={isSubmitting}
            />
            {!form.formState.errors.serviceArea &&
              form.getValues("serviceArea") && (
                <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
              )}
          </div>
          {form.formState.errors.serviceArea && (
            <p className="text-sm text-red-500">
              {form.formState.errors.serviceArea.message}
            </p>
          )}
        </div>

        {/* Business Hours */}
        <div className="space-y-2">
          <Label>Business Hours *</Label>
          {fieldHelpText.businessHours && (
            <p className="text-xs text-muted-foreground">
              {fieldHelpText.businessHours}
            </p>
          )}
          <div className="grid grid-cols-1 gap-2 rounded-lg border p-4 bg-muted/5">
            {daysOfWeek.map((day) => (
              <FormField
                key={day}
                control={form.control}
                name={`businessHours.${day}`}
                render={({ field }) => (
                  <FormItem className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between rounded-md p-2 transition-colors hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value.open}
                          onCheckedChange={(checked) => {
                            field.onChange({ ...field.value, open: !!checked });
                          }}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <span className="w-20 font-medium capitalize">{day}</span>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-2",
                        field.value.open
                          ? "opacity-100"
                          : "opacity-50 pointer-events-none"
                      )}
                    >
                      <Input
                        type="time"
                        value={field.value.openTime}
                        onChange={(e) =>
                          field.onChange({
                            ...field.value,
                            openTime: e.target.value,
                          })
                        }
                        className="h-9 w-32 text-base"
                        disabled={!field.value.open || isSubmitting}
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="time"
                        value={field.value.closeTime}
                        onChange={(e) =>
                          field.onChange({
                            ...field.value,
                            closeTime: e.target.value,
                          })
                        }
                        className="h-9 w-32 text-base"
                        disabled={!field.value.open || isSubmitting}
                      />
                    </div>
                  </FormItem>
                )}
              />
            ))}
          </div>
          {form.formState.errors.businessHours && (
            <p className="text-sm text-red-500">
              Please review business hours settings.
            </p>
          )}
        </div>

        {/* Emergency Policy */}
        <div className="space-y-2">
          <Label htmlFor="emergencyPolicy">Emergency Call Policy *</Label>
          {fieldHelpText.emergencyPolicy && (
            <p className="text-xs text-muted-foreground">
              {fieldHelpText.emergencyPolicy}
            </p>
          )}
          <Textarea
            id="emergencyPolicy"
            {...form.register("emergencyPolicy")}
            placeholder={fieldPlaceholders.emergencyPolicy}
            className={cn(
              "text-base min-h-[100px]",
              form.formState.errors.emergencyPolicy && "border-red-500"
            )}
            disabled={isSubmitting}
          />
          {form.formState.errors.emergencyPolicy && (
            <p className="text-sm text-red-500">
              {form.formState.errors.emergencyPolicy.message}
            </p>
          )}
        </div>

        {/* ZIP Code & Assistant Voice */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* ZIP Code */}
          <div className="space-y-2">
            <Label htmlFor="zipCode">ZIP Code *</Label>
            <div className="relative">
              <Input
                id="zipCode"
                {...form.register("zipCode")}
                placeholder={fieldPlaceholders.zipCode}
                className={cn(
                  "text-base pr-10",
                  form.formState.errors.zipCode && "border-red-500",
                  !form.formState.errors.zipCode &&
                    form.getValues("zipCode") &&
                    /^\d{5}$/.test(form.getValues("zipCode")) &&
                    "border-green-500"
                )}
                disabled={isSubmitting}
                maxLength={5}
                inputMode="numeric"
              />
              {!form.formState.errors.zipCode &&
                form.getValues("zipCode") &&
                /^\d{5}$/.test(form.getValues("zipCode")) && (
                  <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
                )}
            </div>
            {form.formState.errors.zipCode && (
              <p className="text-sm text-red-500">
                {form.formState.errors.zipCode.message}
              </p>
            )}
          </div>

          {/* Assistant Voice */}
          <FormField
            control={form.control}
            name="assistantGender"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Assistant Voice *</FormLabel>
                <FormDescription className="text-xs">
                  {fieldHelpText.assistantGender}
                </FormDescription>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex gap-4"
                    disabled={isSubmitting}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="female"
                        id="sales-female"
                        disabled={isSubmitting}
                      />
                      <label
                        htmlFor="sales-female"
                        className="text-sm cursor-pointer"
                      >
                        Female
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="male"
                        id="sales-male"
                        disabled={isSubmitting}
                      />
                      <label
                        htmlFor="sales-male"
                        className="text-sm cursor-pointer"
                      >
                        Male
                      </label>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Referral Code */}
        <div className="space-y-2">
          <Label htmlFor="referralCode">Referral Code (Optional)</Label>
          {fieldHelpText.referralCode && (
            <p className="text-xs text-muted-foreground">
              {fieldHelpText.referralCode}
            </p>
          )}
          <Input
            id="referralCode"
            {...form.register("referralCode")}
            placeholder={fieldPlaceholders.referralCode}
            className="text-base uppercase"
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              form.setValue("referralCode", val);
            }}
            maxLength={8}
            disabled={isSubmitting}
          />
          {form.formState.errors.referralCode && (
            <p className="text-sm text-red-500">
              {form.formState.errors.referralCode.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
