import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Mail, Phone, Clock, AlertCircle, Mic, UserCheck } from "lucide-react";
import { WizardFormData } from "./types";

interface BusinessDetailsStepProps {
  form: UseFormReturn<WizardFormData>;
}

export const BusinessDetailsStep = ({ form }: BusinessDetailsStepProps) => {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-foreground">Customer & Business Details</h2>
        <p className="text-muted-foreground">Help us set up your AI assistant properly</p>
      </div>

      {/* Customer Contact Information */}
      <Card className="card-tier-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Customer Contact
          </CardTitle>
          <CardDescription>Primary contact for this account</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName" className="text-base font-medium">
              Full Name <span className="text-primary">*</span>
            </Label>
            <Input
              id="customerName"
              {...form.register("customerName")}
              placeholder="John Smith"
              className="text-base input-focus h-12"
            />
            {form.formState.errors.customerName && (
              <p className="text-sm text-destructive">{form.formState.errors.customerName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerEmail" className="flex items-center gap-2 text-base font-medium">
              <Mail className="h-4 w-4 text-primary" />
              Email <span className="text-primary">*</span>
            </Label>
            <Input
              id="customerEmail"
              type="email"
              {...form.register("customerEmail")}
              placeholder="john@example.com"
              className="text-base input-focus h-12"
            />
            {form.formState.errors.customerEmail && (
              <p className="text-sm text-destructive">{form.formState.errors.customerEmail.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="customerPhone" className="flex items-center gap-2 text-base font-medium">
              <Phone className="h-4 w-4 text-primary" />
              Phone Number <span className="text-primary">*</span>
            </Label>
            <Input
              id="customerPhone"
              type="tel"
              {...form.register("customerPhone")}
              placeholder="(555) 123-4567"
              className="text-base input-focus h-12"
            />
            {form.formState.errors.customerPhone && (
              <p className="text-sm text-destructive">{form.formState.errors.customerPhone.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Business Operations */}
      <Card className="card-tier-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Business Operations
          </CardTitle>
          <CardDescription>Configure how your AI assistant handles calls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="businessHours" className="text-base font-medium">
              Business Hours <span className="text-primary">*</span>
            </Label>
            <Input
              id="businessHours"
              {...form.register("businessHours")}
              placeholder="Mon-Fri 8:00 AM - 5:00 PM"
              className="text-base input-focus h-12"
            />
            <p className="text-xs text-muted-foreground">
              Your AI assistant will mention these hours to callers
            </p>
            {form.formState.errors.businessHours && (
              <p className="text-sm text-destructive">{form.formState.errors.businessHours.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyPolicy" className="flex items-center gap-2 text-base font-medium">
              <AlertCircle className="h-4 w-4 text-primary" />
              Emergency Call Policy <span className="text-primary">*</span>
            </Label>
            <Textarea
              id="emergencyPolicy"
              {...form.register("emergencyPolicy")}
              placeholder="Describe how emergency or after-hours calls should be handled..."
              className="text-base input-focus min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Example: "After hours emergencies are forwarded to our on-call team at (555) 999-9999"
            </p>
            {form.formState.errors.emergencyPolicy && (
              <p className="text-sm text-destructive">{form.formState.errors.emergencyPolicy.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assistant & Sales Rep */}
      <Card className="card-tier-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Assistant & Sales Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Assistant Voice <span className="text-primary">*</span>
            </Label>
            <RadioGroup
              value={form.watch("assistantGender")}
              onValueChange={(value) => form.setValue("assistantGender", value as 'male' | 'female')}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="female" id="female" />
                <Label htmlFor="female" className="cursor-pointer font-normal">
                  Female (Sarah)
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="male" id="male" />
                <Label htmlFor="male" className="cursor-pointer font-normal">
                  Male (Michael)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="salesRepName" className="flex items-center gap-2 text-base font-medium">
              <UserCheck className="h-4 w-4 text-primary" />
              Sales Rep Name <span className="text-primary">*</span>
            </Label>
            <Select
              value={form.watch("salesRepName")}
              onValueChange={(value) => form.setValue("salesRepName", value)}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select sales rep" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Chad">Chad</SelectItem>
                <SelectItem value="Blake">Blake</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This will appear in the sales dashboard
            </p>
            {form.formState.errors.salesRepName && (
              <p className="text-sm text-destructive">{form.formState.errors.salesRepName.message}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
