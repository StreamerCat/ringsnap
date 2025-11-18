import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormSectionProps } from "../types";
import { fieldPlaceholders } from "@/components/signup/shared/enhanced-schemas";

/**
 * Sales Representative Section
 *
 * Collects sales rep information for tracking and commission.
 */
export function SalesRepSection({ form, isSubmitting }: FormSectionProps) {
  const salesRepName = form.watch("salesRepName");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Sales Representative
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="salesRepName">Your Name *</Label>
          <p className="text-xs text-muted-foreground">
            This helps us track your sales and commissions
          </p>
          <div className="relative">
            <Input
              id="salesRepName"
              {...form.register("salesRepName")}
              placeholder={fieldPlaceholders.salesRepName}
              className={cn(
                "text-base pr-10",
                form.formState.errors.salesRepName && "border-red-500",
                !form.formState.errors.salesRepName &&
                  salesRepName &&
                  "border-green-500"
              )}
              disabled={isSubmitting}
              autoComplete="name"
            />
            {!form.formState.errors.salesRepName && salesRepName && (
              <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-500" />
            )}
          </div>
          {form.formState.errors.salesRepName && (
            <p className="text-sm text-red-500">
              {form.formState.errors.salesRepName.message}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
