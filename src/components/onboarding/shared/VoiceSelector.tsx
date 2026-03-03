import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceSelectorProps {
  form: UseFormReturn<any>;
  showSamples?: boolean;
  layout?: "horizontal" | "vertical";
  disabled?: boolean;
  onAutoAdvance?: () => void;
}

/**
 * Shared voice selector component
 * Used in both self-serve and sales-guided flows
 *
 * @example Self-serve usage (with samples)
 * <VoiceSelector
 *   form={form}
 *   showSamples={true}
 *   layout="horizontal"
 * />
 *
 * @example Sales usage (without samples, faster)
 * <VoiceSelector
 *   form={form}
 *   showSamples={false}
 *   layout="vertical"
 * />
 */
export function VoiceSelector({
  form,
  showSamples = true,
  layout = "horizontal",
  disabled = false,
  onAutoAdvance,
}: VoiceSelectorProps) {
  const handleVoiceClick = (
    gender: "male" | "female",
    onChange: (value: "male" | "female") => void,
  ) => {
    if (disabled) return;
    onChange(gender);
    onAutoAdvance?.();
  };

  const handlePlaySample = (gender: "male" | "female") => {
    // TODO: Implement audio sample playback
    // For now, just show a toast
    console.log(`Playing ${gender} voice sample`);
  };

  return (
    <FormField
      control={form.control}
      name="assistantGender"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Agent Voice *</FormLabel>
          <FormDescription>
            Choose the voice your customers will hear
          </FormDescription>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              disabled={disabled}
              className={cn(
                "grid gap-4",
                layout === "horizontal" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
              )}
            >
              {/* Female Voice Option */}
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:border-primary",
                  field.value === "female" && "border-primary ring-2 ring-primary"
                )}
                onClick={() => handleVoiceClick("female", field.onChange)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="female" id="voice-female" className="mt-1" />
                    <div className="flex-1 space-y-2">
                      <label
                        htmlFor="voice-female"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Female Voice (Sarah)
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Professional, warm, and clear
                      </p>
                      {showSamples && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaySample("female");
                          }}
                          disabled={disabled}
                        >
                          <Volume2 className="mr-2 h-4 w-4" />
                          Play Sample
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Male Voice Option */}
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:border-primary",
                  field.value === "male" && "border-primary ring-2 ring-primary"
                )}
                onClick={() => handleVoiceClick("male", field.onChange)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="male" id="voice-male" className="mt-1" />
                    <div className="flex-1 space-y-2">
                      <label
                        htmlFor="voice-male"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Male Voice (Michael)
                      </label>
                      <p className="text-sm text-muted-foreground">
                        Authoritative, friendly, and professional
                      </p>
                      {showSamples && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaySample("male");
                          }}
                          disabled={disabled}
                        >
                          <Volume2 className="mr-2 h-4 w-4" />
                          Play Sample
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
