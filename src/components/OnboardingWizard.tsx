import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Loader2, RefreshCw, TriangleAlert, ArrowLeft, Calendar } from "lucide-react";
import { searchAvailablePhoneNumbers, type NumberSearchResult } from "@/lib/vapiNumberSearch";
import { OnboardingNumberStep } from "@/components/OnboardingNumberStep";
import { cn } from "@/lib/utils";

// Validation schemas for each step
const step1Schema = z.object({
  areaCode: z.string().length(3, "Area code must be 3 digits"),
  selectedNumber: z.string().min(10, "Please select a phone number")
});

const step2Schema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  trade: z.string().min(1, "Please select your trade"),
  customTrade: z.string().optional(),
  assistantGender: z.enum(["male", "female"])
});

const step3Schema = z.object({
  defaultAvailability: z.string().optional(),
  connectCalendar: z.boolean().optional()
});

// Combined schema for final submission
const wizardSchema = step1Schema.merge(step2Schema).merge(step3Schema);

type WizardFormData = z.infer<typeof wizardSchema>;

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileWithAccount = ProfileRow & { accounts?: AccountRow | null };

type NumberSearchState = "idle" | "debouncing" | "loading" | "success" | "empty" | "error";

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialProfile?: ProfileWithAccount | null;
  defaultPhone?: string | null;
}

interface PhoneNumberOption {
  id: string;
  phoneNumber: string;
  formatted: string;
  source?: string;
}

const TRADE_OPTIONS = [
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
  "Restaurant",
  "Local Services",
  "Other"
];

const ENABLE_DEBUG = false;
const dbg = (...args: unknown[]) => {
  if (ENABLE_DEBUG) {
    console.debug("[OnboardingWizard]", ...args);
  }
};

function sanitizeAreaCode(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10, -7);
  }
  return digits.slice(0, 3);
}

function formatNumberReadable(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const local = digits.slice(1);
    return local.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  }
  return phoneNumber;
}

export function OnboardingWizard({
  open,
  onOpenChange,
  onSuccess,
  initialProfile = null,
  defaultPhone = null
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [numberOptions, setNumberOptions] = useState<PhoneNumberOption[]>([]);
  const [numberSearchState, setNumberSearchState] = useState<NumberSearchState>("idle");
  const [numberSearchError, setNumberSearchError] = useState<string | null>(null);
  const [suggestedAreaCodes, setSuggestedAreaCodes] = useState<string[]>([]);
  const [reservedNumber, setReservedNumber] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneProvisioned, setPhoneProvisioned] = useState<string | null>(null);
  const [phoneProvisioningComplete, setPhoneProvisioningComplete] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    mode: "onChange",
    defaultValues: {
      areaCode: "",
      selectedNumber: "",
      companyName: "",
      trade: "",
      customTrade: "",
      assistantGender: "female",
      defaultAvailability: "",
      connectCalendar: false
    }
  });

  const areaCodeValue = form.watch("areaCode");
  const tradeValue = form.watch("trade");
  const selectedNumberValue = form.watch("selectedNumber");
  const normalizedAreaCode = useMemo(() => sanitizeAreaCode(areaCodeValue), [areaCodeValue]);

  // Debounced phone number search
  useEffect(() => {
    if (!open || currentStep !== 1) return;

    if (!normalizedAreaCode || normalizedAreaCode.length !== 3) {
      setNumberOptions([]);
      setNumberSearchState(normalizedAreaCode ? "error" : "idle");
      setNumberSearchError(
        normalizedAreaCode ? "Enter a full 3-digit area code to preview numbers" : null
      );
      setSuggestedAreaCodes([]);
      return;
    }

    setNumberSearchState("debouncing");
    setNumberSearchError(null);
    setSuggestedAreaCodes([]);

    const controller = new AbortController();
    searchAbortRef.current?.abort();
    searchAbortRef.current = controller;

    const timeoutId = window.setTimeout(async () => {
      setNumberSearchState("loading");
      try {
        const result: NumberSearchResult = await searchAvailablePhoneNumbers({
          areaCode: normalizedAreaCode,
          limit: 3,
          signal: controller.signal
        });

        const options = result.numbers.slice(0, 3).map((entry) => ({
          id: entry.id,
          phoneNumber: entry.phoneNumber,
          formatted: entry.formatted ?? formatNumberReadable(entry.phoneNumber),
          source: result.source
        }));

        setNumberOptions(options);
        setSuggestedAreaCodes(result.suggestions ?? []);

        if (options.length) {
          setNumberSearchState("success");
          // Auto-select first number
          if (!selectedNumberValue) {
            form.setValue("selectedNumber", options[0].phoneNumber);
          }
          if (result.error) {
            setNumberSearchError(result.error);
          } else {
            setNumberSearchError(null);
          }
        } else {
          if (result.error) {
            setNumberSearchState("error");
            setNumberSearchError(result.error);
          } else {
            setNumberSearchState("empty");
            setNumberSearchError("No numbers available. Try a different area code.");
          }
          form.setValue("selectedNumber", "");
        }
      } catch (error: unknown) {
        if ((error as Error)?.name === "AbortError") {
          return;
        }
        console.error("Number search failed", error);
        setNumberSearchState("error");
        setNumberOptions([]);
        form.setValue("selectedNumber", "");
        setNumberSearchError(
          error instanceof Error ? error.message : "Unable to search for phone numbers"
        );
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [open, normalizedAreaCode, searchAttempt, currentStep, selectedNumberValue, form]);

  useEffect(() => {
    if (!open) return;
    return () => {
      searchAbortRef.current?.abort();
    };
  }, [open]);

  const retrySearch = useCallback(() => {
    setSearchAttempt((count) => count + 1);
  }, []);

  const handleSelectSuggestion = useCallback(
    (code: string) => {
      form.setValue("areaCode", sanitizeAreaCode(code));
    },
    [form]
  );

  const validateStep = async (step: number): Promise<boolean> => {
    const values = form.getValues();

    try {
      if (step === 1) {
        await step1Schema.parseAsync({
          areaCode: values.areaCode,
          selectedNumber: values.selectedNumber
        });
        return true;
      } else if (step === 2) {
        const step2Data = {
          companyName: values.companyName,
          trade: values.trade,
          customTrade: values.customTrade,
          assistantGender: values.assistantGender
        };

        // Additional validation for "Other" trade
        if (values.trade === "Other" && !values.customTrade?.trim()) {
          form.setError("customTrade", {
            type: "manual",
            message: "Please specify your trade"
          });
          return false;
        }

        await step2Schema.parseAsync(step2Data);
        return true;
      } else if (step === 3) {
        await step3Schema.parseAsync({
          defaultAvailability: values.defaultAvailability,
          connectCalendar: values.connectCalendar
        });
        return true;
      } else if (step === 4) {
        // Step 4 (phone provisioning) is validated by the component itself
        // Just check that phone has been provisioned
        return phoneProvisioningComplete;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          const path = err.path[0] as keyof WizardFormData;
          form.setError(path, {
            type: "manual",
            message: err.message
          });
        });
      }
      return false;
    }

    return false;
  };

  const handleContinue = async () => {
    const isValid = await validateStep(currentStep);

    if (!isValid) {
      return;
    }

    if (currentStep === 1) {
      // Reserve the selected number
      setReservedNumber(form.getValues("selectedNumber"));
    }

    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
    setErrorMessage(null);
  };

  const handleSubmit = useCallback(
    async (values: WizardFormData) => {
      setErrorMessage(null);
      setIsSubmitting(true);
      try {
        // Determine final trade value
        const finalTrade = values.trade === "Other"
          ? (values.customTrade?.trim() || "Other")
          : values.trade;

        const payload = {
          areaCode: sanitizeAreaCode(values.areaCode),
          selectedNumber: values.selectedNumber,
          companyName: values.companyName,
          trade: finalTrade,
          assistantGender: values.assistantGender,
          defaultAvailability: values.defaultAvailability?.trim() || null,
          connectCalendar: values.connectCalendar || false
        };

        dbg("Submitting wizard payload", payload);

        const { data, error } = await supabase.functions.invoke("complete-onboarding", {
          body: payload
        });

        if (error) {
          throw error;
        }

        if (!data?.ok) {
          throw new Error(data?.error || "Failed to complete onboarding");
        }

        onSuccess();
      } catch (error: unknown) {
        console.error("Onboarding submission failed", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Could not complete setup. Please try again."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSuccess]
  );

  const onSubmit = useCallback(
    async (values: WizardFormData) => {
      const isValid = await validateStep(4);
      if (isValid) {
        await handleSubmit(values);
      }
    },
    [handleSubmit, phoneProvisioningComplete]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const progressPercent = (currentStep / 4) * 100;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="space-y-4 text-center">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-sm">
              Step {currentStep} of 4
            </Badge>
            <Badge variant="outline" className="text-xs">
              {currentStep === 1 && "Phone Number"}
              {currentStep === 2 && "Business Details"}
              {currentStep === 3 && "Availability"}
              {currentStep === 4 && "Provision Number"}
            </Badge>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <DialogTitle className="text-2xl font-bold">
            {currentStep === 1 && "Choose Your Business Number"}
            {currentStep === 2 && "Tell Us About Your Business"}
            {currentStep === 3 && "Set Your Availability"}
            {currentStep === 4 && "Activate Your Phone Number"}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 1 && "Search for available phone numbers in your preferred area code"}
            {currentStep === 2 && "Help us personalize your AI assistant"}
            {currentStep === 3 && "Let customers know when you're available (optional)"}
            {currentStep === 4 && "Finalize your phone number provisioning"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* STEP 1: Phone Number Selection */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="areaCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">Area Code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="numeric"
                          pattern="\d*"
                          maxLength={3}
                          onChange={(event) => {
                            const value = event.target.value.replace(/\D/g, "").slice(0, 3);
                            field.onChange(value);
                          }}
                          placeholder="415"
                          className="text-2xl h-16 text-center font-bold tracking-widest"
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the 3-digit area code where you want your business number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3 rounded-lg border bg-muted/40 p-6">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-lg">Available Numbers</h4>
                    {numberSearchState === "loading" && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {numberSearchState === "success" && (
                      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600">
                        Ready
                      </Badge>
                    )}
                  </div>

                  {numberSearchState === "idle" && (
                    <p className="text-sm text-muted-foreground">
                      Enter a 3-digit area code to preview available numbers.
                    </p>
                  )}

                  {numberSearchState === "debouncing" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching for numbers…
                    </div>
                  )}

                  {numberSearchState === "loading" && (
                    <div className="space-y-2">
                      <Skeleton className="h-20 rounded-md" />
                      <Skeleton className="h-20 rounded-md" />
                      <Skeleton className="h-20 rounded-md" />
                    </div>
                  )}

                  {numberSearchState === "success" && numberOptions.length > 0 && (
                    <FormField
                      control={form.control}
                      name="selectedNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup value={field.value} onValueChange={field.onChange}>
                              <div className="space-y-3">
                                {numberOptions.map((option) => (
                                  <label
                                    key={option.id}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-4 rounded-md border p-5 text-sm transition-colors hover:border-primary hover:bg-primary/5",
                                      option.phoneNumber === field.value && "border-primary bg-primary/10"
                                    )}
                                  >
                                    <RadioGroupItem value={option.phoneNumber} id={option.id} />
                                    <div className="flex flex-col flex-1">
                                      <span className="text-2xl font-bold tracking-wide">{option.formatted}</span>
                                      <span className="text-xs text-muted-foreground mt-1">
                                        Via {option.source || "Vapi"}
                                      </span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {numberSearchState === "empty" && (
                    <Alert>
                      <AlertTitle>No numbers available</AlertTitle>
                      <AlertDescription>
                        We couldn't find available numbers for this area code. Try a different one.
                      </AlertDescription>
                    </Alert>
                  )}

                  {numberSearchState === "error" && (
                    <div className="space-y-3">
                      <Alert variant="destructive">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertTitle>Search failed</AlertTitle>
                        <AlertDescription>
                          {numberSearchError || "Unable to search for phone numbers. Please try again."}
                        </AlertDescription>
                      </Alert>

                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={retrySearch}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Try again
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => form.setValue("areaCode", "")}
                        >
                          Clear area code
                        </Button>
                      </div>

                      {suggestedAreaCodes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase text-muted-foreground">
                            Try these nearby area codes
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {suggestedAreaCodes.map((code) => (
                              <Button
                                key={code}
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => handleSelectSuggestion(code)}
                              >
                                {sanitizeAreaCode(code)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Business Details */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">Company Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. Smith Plumbing"
                          className="text-lg h-12"
                        />
                      </FormControl>
                      <FormDescription>
                        This will be used in your AI assistant's greeting
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">Trade</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-lg h-12">
                            <SelectValue placeholder="Select your trade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRADE_OPTIONS.map((trade) => (
                            <SelectItem key={trade} value={trade}>
                              {trade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose the trade that best describes your business
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {tradeValue === "Other" && (
                  <FormField
                    control={form.control}
                    name="customTrade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg font-semibold">Specify Your Trade</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g. Pool Maintenance"
                            className="text-lg h-12"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="assistantGender"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-lg font-semibold">Assistant Voice</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-2 gap-4"
                        >
                          <label
                            className={cn(
                              "flex flex-col cursor-pointer items-center justify-center gap-3 rounded-md border p-6 transition-colors hover:border-primary hover:bg-primary/5",
                              field.value === "female" && "border-primary bg-primary/10"
                            )}
                          >
                            <div className="text-5xl">👩</div>
                            <RadioGroupItem value="female" id="voice-female" className="sr-only" />
                            <div className="text-center">
                              <div className="font-medium text-lg">Female</div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Warm & friendly
                              </p>
                            </div>
                          </label>
                          <label
                            className={cn(
                              "flex flex-col cursor-pointer items-center justify-center gap-3 rounded-md border p-6 transition-colors hover:border-primary hover:bg-primary/5",
                              field.value === "male" && "border-primary bg-primary/10"
                            )}
                          >
                            <div className="text-5xl">👨</div>
                            <RadioGroupItem value="male" id="voice-male" className="sr-only" />
                            <div className="text-center">
                              <div className="font-medium text-lg">Male</div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Professional & direct
                              </p>
                            </div>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* STEP 3: Availability */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {reservedNumber && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertTitle className="text-green-800 font-semibold">
                      Your Reserved Number
                    </AlertTitle>
                    <AlertDescription className="text-green-700 text-lg font-bold mt-2">
                      {formatNumberReadable(reservedNumber)}
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="defaultAvailability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-lg font-semibold">Default Business Hours</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={4}
                          placeholder="e.g. Monday-Friday 8am-5pm, Emergency service available 24/7"
                          className="resize-none"
                        />
                      </FormControl>
                      <FormDescription>
                        Optional: Let your assistant know when you're typically available
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-lg border bg-muted/20 p-6 opacity-60">
                  <div className="flex items-start gap-4">
                    <Calendar className="h-8 w-8 text-muted-foreground flex-shrink-0 mt-1" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <h4 className="font-semibold text-lg">Google Calendar Integration</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Sync your availability automatically from Google Calendar
                        </p>
                      </div>
                      <Button type="button" variant="outline" disabled className="w-full">
                        Coming Soon
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Phone Provisioning */}
            {currentStep === 4 && (
              <div className="space-y-6">
                {initialProfile?.accounts?.id ? (
                  <OnboardingNumberStep
                    accountId={initialProfile.accounts.id}
                    onSuccess={(phoneNumber) => {
                      setPhoneProvisioned(phoneNumber);
                      setPhoneProvisioningComplete(true);
                      // Update form with provisioned number
                      form.setValue("selectedNumber", phoneNumber);
                    }}
                    onPending={() => {
                      // Phone is provisioning in the background
                      // User can proceed when notified, but for now we'll require success
                    }}
                  />
                ) : (
                  <Alert variant="destructive">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertTitle>Account information missing</AlertTitle>
                    <AlertDescription>
                      Unable to provision phone number. Please go back and try again.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {errorMessage && (
              <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Unable to complete setup</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between gap-4 pt-4">
              <div>
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={handleContinue}
                    className="min-h-[44px] px-8"
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting || !phoneProvisioningComplete}
                    className="min-h-[44px] px-8"
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Complete Setup
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
