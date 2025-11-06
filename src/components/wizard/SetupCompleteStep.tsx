import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Copy, Check, Phone, Mail, Lock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { CarrierForwardingInstructions } from "@/components/CarrierForwardingInstructions";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WizardFormData } from "./types";

interface SetupCompleteStepProps {
  formData: WizardFormData;
}

export const SetupCompleteStep = ({ formData }: SetupCompleteStepProps) => {
  const navigate = useNavigate();
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

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

  const handleCopyPassword = () => {
    if (formData.tempPassword) {
      navigator.clipboard.writeText(formData.tempPassword);
      setCopiedPassword(true);
      toast.success("Password copied to clipboard!");
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-500">
      {/* Success Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in-50 duration-500">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h2 className="text-4xl font-bold text-foreground">🎉 Success!</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Your RingSnap AI assistant is now active and ready to answer calls!
        </p>
      </div>

      {/* Account Details Card */}
      <Card className="card-tier-1 max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Your RingSnap Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Company</p>
              <p className="text-2xl font-bold">{formData.companyName}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Selected Plan</p>
              <Badge variant="default" className="text-lg py-1 px-4">
                {formData.planType?.toUpperCase()}
              </Badge>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">Your RingSnap Number</p>
              <div className="flex items-center justify-center gap-3">
                <Phone className="h-6 w-6 text-primary" />
                <p className="text-4xl font-bold text-primary font-mono">
                  {formData.vapiPhoneNumber ? formatPhoneNumber(formData.vapiPhoneNumber) : "Provisioning..."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps: Forwarding Instructions */}
      {formData.vapiPhoneNumber && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold">Next Step: Forward Your Phone</h3>
            <p className="text-muted-foreground">
              Follow these instructions to activate call forwarding from your business line
            </p>
          </div>

          <CarrierForwardingInstructions
            phoneNumber={formData.vapiPhoneNumber}
            companyName={formData.companyName}
          />
        </div>
      )}

      {/* Login Credentials (Collapsible) */}
      <Card className="max-w-3xl mx-auto card-tier-2">
        <Collapsible open={showCredentials} onOpenChange={setShowCredentials}>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Access Your Dashboard
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {showCredentials ? "Hide" : "Show"} credentials
                </span>
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Login Email</p>
                    <p className="font-mono text-sm">{formData.customerEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Temporary Password</p>
                    <p className="font-mono text-sm">{formData.tempPassword || "********"}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPassword}
                  >
                    {copiedPassword ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Important:</strong> Please change your password after first login for security.
                </p>
              </div>

              <Button
                onClick={() => navigate("/login")}
                variant="default"
                size="lg"
                className="w-full"
              >
                <ExternalLink className="mr-2 h-5 w-5" />
                Go to Login
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Support Section */}
      <Card className="max-w-3xl mx-auto card-tier-3">
        <CardContent className="text-center space-y-3 py-6">
          <p className="font-medium">Need Help?</p>
          <p className="text-sm text-muted-foreground">
            Our support team is available to assist you with setup and training
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button variant="outline" asChild>
              <a href="mailto:support@getringsnap.com">
                <Mail className="mr-2 h-4 w-4" />
                support@getringsnap.com
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="tel:+15555555555">
                <Phone className="mr-2 h-4 w-4" />
                (555) 555-5555
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
