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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { searchAvailablePhoneNumbers, type NumberSearchResult } from "@/lib/vapiNumberSearch";
import { cn } from "@/lib/utils";

const onboardingSchema = z.object({
  areaCode: z
    .string()
    .trim()
    .length(3, "Area code must be exactly 3 digits"),
  trade: z.string().min(1, "Please select your trade"),
  assistantGender: z.enum(["male", "female"]),
  referralCode: z
    .string()
    .trim()
    .length(8, "Referral code must be exactly 8 characters")
    .optional()
    .or(z.literal("")),
  goals: z
    .string()
    .trim()
    .max(500, "Please keep your goals brief")
    .optional()
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileWithAccount = ProfileRow & { accounts?: AccountRow | null };

type LoadState = "idle" | "loading" | "ready" | "error";
type NumberSearchState = "idle" | "debouncing" | "loading" | "success" | "empty" | "error";

interface OnboardingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialProfile?: ProfileWithAccount | null;
  initialAccount?: AccountRow | null;
  defaultPhone?: string | null;
  defaultAreaCode?: string | null;
}

interface PhoneNumberOption {
  id: string;
  phoneNumber: string;
  formatted: string;
  source?: string;
}

const ENABLE_DEBUG = false;
const dbg = (...args: unknown[]) => {
  if (ENABLE_DEBUG) {
    console.debug("[OnboardingForm]", ...args);
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

function deriveAreaCodeFromProfile(
  profile: ProfileWithAccount | null | undefined,
  fallbackPhone?: string | null
): string {
  const primary = profile?.phone ?? fallbackPhone ?? "";
  return sanitizeAreaCode(primary);
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

export function OnboardingForm({
  open,
  onOpenChange,
  onSuccess,
  initialProfile = null,
  initialAccount = null,
  defaultPhone = null,
  defaultAreaCode = null
}: OnboardingFormProps) {
  const [profile, setProfile] = useState<ProfileWithAccount | null>(initialProfile);
  const [account, setAccount] = useState<AccountRow | null>(initialAccount);
  const [loadState, setLoadState] = useState<LoadState>(initialProfile ? "ready" : "idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [numberOptions, setNumberOptions] = useState<PhoneNumberOption[]>([]);
  const [numberSearchState, setNumberSearchState] = useState<NumberSearchState>("idle");
  const [numberSearchError, setNumberSearchError] = useState<string | null>(null);
  const [suggestedAreaCodes, setSuggestedAreaCodes] = useState<string[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [hasBootstrapped, setHasBootstrapped] = useState(Boolean(initialProfile));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      areaCode: "",
      trade: "",
      assistantGender: "female",
      referralCode: "",
      goals: ""
    }
  });

  const areaCodeValue = form.watch("areaCode");
  const normalizedAreaCode = useMemo(() => sanitizeAreaCode(areaCodeValue), [areaCodeValue]);

  const resetFormDefaults = useCallback(
    (
      nextProfile: ProfileWithAccount | null,
      nextAccount: AccountRow | null,
      incomingAreaCode?: string | null
    ) => {
      const derivedAreaCode = sanitizeAreaCode(
        incomingAreaCode || deriveAreaCodeFromProfile(nextProfile, defaultPhone)
      );

      form.reset({
        areaCode: derivedAreaCode,
        trade: nextAccount?.trade ?? "",
        assistantGender: (nextAccount?.assistant_gender as "male" | "female" | null) ?? "female",
        referralCode: "",
        goals: ""
      });

      setHasBootstrapped(true);
    },
    [defaultPhone, form]
  );

  useEffect(() => {
    if (!open) return;

    if (initialProfile && !hasBootstrapped) {
      dbg("Bootstrapping from initial profile");
      setProfile(initialProfile);
      setAccount(initialAccount ?? initialProfile.accounts ?? null);
      resetFormDefaults(initialProfile, initialAccount ?? initialProfile.accounts ?? null, defaultAreaCode);
      setLoadState("ready");
      setLoadError(null);
    }
  }, [
    open,
    initialProfile,
    initialAccount,
    hasBootstrapped,
    resetFormDefaults,
    defaultAreaCode
  ]);

  useEffect(() => {
    if (!open || initialProfile) return;
    let isMounted = true;

    const load = async () => {
      dbg("Loading profile/account from Supabase");
      setLoadState("loading");
      setLoadError(null);

      try {
        const {
          data: { user },
          error: authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Unable to resolve authenticated user");
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("*, accounts:account_id(*)")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error("Profile not found");
        }

        const loadedProfile = data as ProfileWithAccount;
        const loadedAccount = (data as ProfileWithAccount).accounts ?? null;

        if (!isMounted) return;

        setProfile(loadedProfile);
        setAccount(loadedAccount);
        resetFormDefaults(loadedProfile, loadedAccount, defaultAreaCode);
        setLoadState("ready");
      } catch (error) {
        console.error("Failed to load onboarding context", error);
        if (!isMounted) return;
        setLoadError(
          error instanceof Error ? error.message : "Unable to load your account information"
        );
        setLoadState("error");
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [open, initialProfile, resetFormDefaults, defaultAreaCode]);

  useEffect(() => {
    if (!hasBootstrapped || !open) return;

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
          limit: 5,
          signal: controller.signal
        });

        const options = result.numbers.map((entry) => ({
          id: entry.id,
          phoneNumber: entry.phoneNumber,
          formatted: entry.formatted ?? formatNumberReadable(entry.phoneNumber),
          source: result.source
        }));

        setNumberOptions(options);
        setSuggestedAreaCodes(result.suggestions ?? []);

        if (options.length) {
          setNumberSearchState("success");
          setSelectedNumber((prev) => prev ?? options[0]?.phoneNumber ?? null);
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
            setNumberSearchError("No numbers were immediately available. You can still continue.");
          }
          setSelectedNumber(null);
        }
      } catch (error: unknown) {
        if ((error as Error)?.name === "AbortError") {
          return;
        }
        console.error("Number search failed", error);
        setNumberSearchState("error");
        setNumberOptions([]);
        setSelectedNumber(null);
        setNumberSearchError(
          error instanceof Error ? error.message : "Unable to search for phone numbers"
        );
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [open, normalizedAreaCode, hasBootstrapped, searchAttempt]);

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

  const handleSubmit = useCallback(
    async (values: OnboardingFormData) => {
      setErrorMessage(null);
      setIsSubmitting(true);
      try {
        const payload = {
          areaCode: sanitizeAreaCode(values.areaCode),
          trade: values.trade,
          assistantGender: values.assistantGender,
          referralCode: values.referralCode?.trim() || null,
          goals: values.goals?.trim() || null
        };

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
    (values: OnboardingFormData) => {
      void handleSubmit(values);
    },
    [handleSubmit]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="space-y-2 text-center">
          <DialogTitle className="text-2xl font-bold">Set up your RingSnap Agent</DialogTitle>
          <DialogDescription>
            We just need a few details to provision your phone number and configure your Voice Agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadState === "loading" && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Loading your account</AlertTitle>
              <AlertDescription>
                Pulling your profile details so we can suggest the right phone number options.
              </AlertDescription>
            </Alert>
          )}

          {loadState === "error" && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>We hit a snag</AlertTitle>
              <AlertDescription>
                {loadError || "We couldn’t load your account details. You can still continue manually."}
              </AlertDescription>
            </Alert>
          )}

          {profile?.name && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Configuring account for</span>
              <Badge variant="secondary">{profile.name}</Badge>
              {account?.company_name && (
                <span className="text-muted-foreground">({account.company_name})</span>
              )}
            </div>
          )}
        </div>

        <Separator className="my-4" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Choose your business number</h3>
              <p className="text-sm text-muted-foreground">
                Start with the area code you want customers to see. We’ll search Vapi for available numbers as you type.
              </p>
            </div>

            <FormField
              control={form.control}
              name="areaCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred area code</FormLabel>
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
                      placeholder="e.g. 415"
                    />
                  </FormControl>
                  <FormDescription>
                    We’ll secure the best available number in this area code. You can also adjust later with support.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">Available numbers</h4>
                {numberSearchState === "loading" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {numberSearchState === "success" && (
                  <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600">
                    Updated
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
                  Preparing your search…
                </div>
              )}

              {numberSearchState === "loading" && (
                <div className="space-y-2">
                  <Skeleton className="h-10 rounded-md" />
                  <Skeleton className="h-10 rounded-md" />
                  <Skeleton className="h-10 rounded-md" />
                </div>
              )}

              {numberSearchState === "success" && numberOptions.length > 0 && (
                <RadioGroup value={selectedNumber ?? ""} onValueChange={setSelectedNumber}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {numberOptions.map((option) => (
                      <label
                        key={option.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm",
                          option.phoneNumber === selectedNumber && "border-primary bg-primary/10"
                        )}
                      >
                        <RadioGroupItem value={option.phoneNumber} id={option.id} />
                        <div className="flex flex-col">
                          <span className="font-medium">{option.formatted}</span>
                          <span className="text-xs text-muted-foreground">
                            Provisioned via {option.source || "Vapi"}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              )}

              {numberSearchState === "empty" && (
                <Alert>
                  <AlertTitle>No numbers yet</AlertTitle>
                  <AlertDescription>
                    We didn’t immediately find a match for this area code. You can still continue—we’ll keep trying while provisioning your account.
                  </AlertDescription>
                </Alert>
              )}

              {numberSearchState === "error" && (
                <div className="space-y-3">
                  <Alert variant="destructive">
                    <TriangleAlert className="h-4 w-4" />
                    <AlertTitle>Couldn’t fetch numbers</AlertTitle>
                    <AlertDescription>
                      {numberSearchError || "Vapi didn’t return available numbers. Try again or continue with this area code."}
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
                      Enter a different area code
                    </Button>
                  </div>

                  {suggestedAreaCodes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Suggested nearby area codes
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

            <Separator />

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Tell us about your business</h3>
                <p className="text-sm text-muted-foreground">
                  These details help us personalize call handling and script the Agent appropriately.
                </p>
              </div>

              <FormField
                control={form.control}
                name="trade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. HVAC, Plumbing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assistantGender"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Preferred assistant voice</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3">
                          <RadioGroupItem value="female" id="voice-female" />
                          <div>
                            <div className="font-medium">Female</div>
                            <p className="text-xs text-muted-foreground">Warm, conversational, and friendly.</p>
                          </div>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md border p-3">
                          <RadioGroupItem value="male" id="voice-male" />
                          <div>
                            <div className="font-medium">Male</div>
                            <p className="text-xs text-muted-foreground">Confident, professional, and direct.</p>
                          </div>
                        </label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="goals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What should your assistant focus on?</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="Share any call handling notes, promotions, or VIP rules."
                      />
                    </FormControl>
                    <FormDescription>
                      Optional, but it helps us tailor scripts when provisioning.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="referralCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referral code (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Have a code? Enter it here." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {errorMessage && (
              <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Unable to complete setup</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                We’ll start provisioning right away. Setup usually finishes in about two minutes.
              </p>
              <Button type="submit" disabled={isSubmitting || loadState === "loading"}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Launch my assistant
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

