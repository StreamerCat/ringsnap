import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, ExternalLink } from "lucide-react";

interface PhoneReadyPanelProps {
  phoneNumber: string;
  onTestCall?: () => void;
  onViewDashboard?: () => void;
  showForwardingInstructions?: boolean;
  variant?: "full" | "minimal";
}

/**
 * Format phone number to E.164 into readable format
 */
function formatPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    const local = digits.slice(1);
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return phoneNumber;
}

/**
 * Get the last 10 digits for forwarding code
 */
function getForwardingDigits(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  return digits.slice(-10);
}

/**
 * Shared phone ready panel component
 * Shows phone number and next steps
 * Used in both self-serve and sales-guided flows
 *
 * @example Self-serve usage (full variant)
 * <PhoneReadyPanel
 *   phoneNumber={phoneNumber}
 *   onTestCall={() => window.open(`tel:${phoneNumber}`)}
 *   onViewDashboard={() => navigate('/dashboard')}
 *   showForwardingInstructions={true}
 *   variant="full"
 * />
 *
 * @example Sales usage (minimal variant, rep demos)
 * <PhoneReadyPanel
 *   phoneNumber={phoneNumber}
 *   onTestCall={() => initiateVapiCall(phoneNumber)}
 *   showForwardingInstructions={true}
 *   variant="minimal"
 * />
 */
export function PhoneReadyPanel({
  phoneNumber,
  onTestCall,
  onViewDashboard,
  showForwardingInstructions = true,
  variant = "full",
}: PhoneReadyPanelProps) {
  const formatted = formatPhoneNumber(phoneNumber);
  const forwardingDigits = getForwardingDigits(phoneNumber);

  return (
    <div className="space-y-6">
      {/* Phone Number Display */}
      <div className="text-center space-y-2">
        <h2 className="text-xl md:text-2xl font-bold">
          {variant === "full" ? "Your RingSnap Line" : "Phone Number Ready"}
        </h2>
        <div className="text-3xl md:text-4xl font-mono font-bold text-primary">
          {formatted}
        </div>
        {variant === "full" && (
          <p className="text-sm text-muted-foreground">
            Your RingSnap Agent is ready to answer calls 24/7
          </p>
        )}
      </div>

      {/* Forwarding Instructions */}
      {showForwardingInstructions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Set Up Call Forwarding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Forward your existing business line to your new RingSnap number:
            </p>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Dial the forwarding code</p>
                    <p className="text-sm">
                      On your business phone, dial:{" "}
                      <span className="font-mono text-lg font-bold">
                        *72{forwardingDigits}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Wait for confirmation</p>
                    <p className="text-sm">
                      Listen for the confirmation tone, then hang up
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold mb-1">Test it out</p>
                    <p className="text-sm">
                      Call your business number to verify forwarding is working
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {variant === "full" && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  <strong>Note:</strong> Forwarding codes may vary by carrier. If *72 doesn't work,
                  try *21 or contact your phone provider.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {onTestCall && (
          <Button onClick={onTestCall} size="lg" className="w-full sm:w-auto">
            <Phone className="mr-2 h-5 w-5" />
            Call My RingSnap Agent
          </Button>
        )}
        {onViewDashboard && (
          <Button
            onClick={onViewDashboard}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View Dashboard
          </Button>
        )}
      </div>

      {/* Additional Tips (full variant only) */}
      {variant === "full" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What's Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Test your RingSnap Agent by calling the number above</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Forward your business line so customers reach your Agent</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>View call logs and leads in your dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Customize your Agent's behavior and voice anytime</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
