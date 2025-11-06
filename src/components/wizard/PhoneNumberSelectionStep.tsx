import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Search, Check, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WizardFormData } from "./types";

interface PhoneNumberSelectionStepProps {
  form: UseFormReturn<WizardFormData>;
  onProvision: () => Promise<void>;
  isProvisioning: boolean;
}

interface AvailableNumber {
  id: string;
  phoneNumber: string;
  areaCode: string;
  city?: string;
  state?: string;
}

export const PhoneNumberSelectionStep = ({
  form,
  onProvision,
  isProvisioning,
}: PhoneNumberSelectionStepProps) => {
  const [areaCodeInput, setAreaCodeInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [suggestedAreaCodes, setSuggestedAreaCodes] = useState<string[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const selectedPhoneNumber = form.watch("selectedPhoneNumber");
  const zipCode = form.watch("zipCode");

  const searchNumbers = async (areaCode: string) => {
    if (!/^\d{3}$/.test(areaCode)) {
      setSearchError("Please enter a valid 3-digit area code");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setAvailableNumbers([]);
    setSuggestedAreaCodes([]);

    try {
      const { data, error } = await supabase.functions.invoke("search-vapi-numbers", {
        body: { areaCode, limit: 3 },
      });

      if (error) throw error;

      if (data.numbers && data.numbers.length > 0) {
        setAvailableNumbers(data.numbers);
        toast.success(`Found ${data.numbers.length} available numbers!`);
      } else if (data.suggestions && data.suggestions.length > 0) {
        setSuggestedAreaCodes(data.suggestions);
        setSearchError(`No numbers available in area code ${areaCode}`);
        toast.info("Showing nearest alternatives");
      } else {
        setSearchError("No numbers available. Please try a different area code.");
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchError("Failed to search numbers. Please try again.");
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectNumber = (number: AvailableNumber) => {
    form.setValue("selectedPhoneNumber", number.phoneNumber, { shouldValidate: true });
    form.setValue("selectedPhoneId", number.id);
    form.setValue("selectedAreaCode", number.areaCode);
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    }
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return cleaned.substring(1).replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    }
    return phone;
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-foreground">Choose Your Phone Number</h2>
        <p className="text-muted-foreground">Select a local number for your AI assistant</p>
      </div>

      {/* Area Code Search */}
      <Card className="card-tier-2 max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search by Area Code
          </CardTitle>
          <CardDescription>
            {zipCode && `Based on ZIP ${zipCode}, we'll show numbers in nearby area codes`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="areaCode" className="sr-only">
                Area Code
              </Label>
              <Input
                id="areaCode"
                value={areaCodeInput}
                onChange={(e) => setAreaCodeInput(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="Enter 3-digit area code (e.g., 214)"
                className="text-base input-focus h-12 text-center text-lg font-semibold"
                maxLength={3}
              />
            </div>
            <Button
              onClick={() => searchNumbers(areaCodeInput)}
              disabled={isSearching || areaCodeInput.length !== 3}
              size="lg"
              className="px-8"
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Search
                </>
              )}
            </Button>
          </div>

          {searchError && (
            <div className="text-sm text-destructive text-center">{searchError}</div>
          )}
        </CardContent>
      </Card>

      {/* Suggested Area Codes */}
      {suggestedAreaCodes.length > 0 && (
        <Card className="card-tier-3 max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Nearest Available Area Codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 justify-center">
              {suggestedAreaCodes.map((code) => (
                <Button
                  key={code}
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setAreaCodeInput(code);
                    searchNumbers(code);
                  }}
                  className="font-mono text-lg"
                >
                  {code}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Numbers */}
      {availableNumbers.length > 0 && (
        <div className="space-y-4 max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold text-center">Available Numbers</h3>
          <div className="grid gap-4">
            {availableNumbers.map((number) => {
              const isSelected = selectedPhoneNumber === number.phoneNumber;
              return (
                <Card
                  key={number.id}
                  className={cn(
                    "cursor-pointer transition-all duration-300 hover:scale-102",
                    isSelected
                      ? "card-tier-1 ring-2 ring-primary shadow-lg"
                      : "card-tier-2 hover:border-primary/50"
                  )}
                  onClick={() => handleSelectNumber(number)}
                >
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Phone className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold font-mono">
                          {formatPhoneNumber(number.phoneNumber)}
                        </p>
                        {(number.city || number.state) && (
                          <p className="text-sm text-muted-foreground">
                            {number.city}, {number.state}
                          </p>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Badge variant="default" className="ml-4">
                        <Check className="h-4 w-4 mr-1" />
                        Selected
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Provision Button */}
      {selectedPhoneNumber && (
        <div className="text-center space-y-4 animate-in fade-in-50 duration-300">
          <div className="bg-muted/50 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-sm text-muted-foreground mb-2">Selected Number:</p>
            <p className="text-3xl font-bold text-primary font-mono">
              {formatPhoneNumber(selectedPhoneNumber)}
            </p>
          </div>
          <Button
            onClick={onProvision}
            disabled={isProvisioning}
            size="lg"
            className="px-12 h-14 text-lg font-semibold"
          >
            {isProvisioning ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Provisioning Your Number...
              </>
            ) : (
              <>
                <Check className="mr-2 h-6 w-6" />
                Activate My Number & Assistant
              </>
            )}
          </Button>
        </div>
      )}

      {form.formState.errors.selectedPhoneNumber && (
        <p className="text-sm text-destructive text-center">
          {form.formState.errors.selectedPhoneNumber.message}
        </p>
      )}
    </div>
  );
};
