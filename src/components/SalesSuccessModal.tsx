import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CarrierForwardingInstructions } from "@/components/CarrierForwardingInstructions";
import { useEmailInstructions } from "@/hooks/useEmailInstructions";
import { Check, Copy, Mail, ShieldCheck, UserRound, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SalesSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  data: SalesSuccessModalData | null;
}

export interface SalesSuccessModalData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName: string;
  ringSnapNumber?: string | null;
  tempPassword?: string | null; // Optional - Phase 3: customers receive magic link email instead
  accountId?: string | null;
  subscriptionStatus?: string | null;
  planType?: string | null;
  salesRepName?: string | null;
}

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return cleaned.substring(1).replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  }
  return phone;
};

export const SalesSuccessModal = ({ open, onOpenChange, onDone, data }: SalesSuccessModalProps) => {
  const { sendInstructions, isSending } = useEmailInstructions();
  const navigate = useNavigate();

  const formattedCustomerPhone = useMemo(() => formatPhone(data?.customerPhone ?? ""), [data?.customerPhone]);
  const formattedRingSnapNumber = useMemo(
    () => (data?.ringSnapNumber ? formatPhone(data.ringSnapNumber) : null),
    [data?.ringSnapNumber]
  );

  if (!data) {
    return null;
  }

  const handleEmailInstructions = () => {
    sendInstructions({
      email: data.customerEmail,
      phoneNumber: data.ringSnapNumber,
      companyName: data.companyName,
      customerName: data.customerName,
      tempPassword: data.tempPassword, // Optional - will be undefined if not provided
    });
  };

  const handleGoToDashboard = () => {
    if (data.accountId) {
      // Navigate to the sales dashboard where the sales rep can see all their accounts
      // including the newly created customer account
      navigate('/salesdash');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl md:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-2xl sm:text-3xl font-semibold flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Account Ready for {data.companyName}
          </DialogTitle>
          <DialogDescription className="text-base">
            {data.customerName} will receive an email to complete their account setup. Their AI line is ready for forwarding and testing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="border-2 border-primary/40 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <CardTitle className="text-xl">Account Access</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Customer will receive an email with a secure login link.
                    </p>
                  </div>
                  {data.subscriptionStatus && (
                    <Badge variant="secondary" className="uppercase tracking-wide">
                      {data.subscriptionStatus}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Login Email</p>
                    <p className="font-medium text-base">{data.customerEmail}</p>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1 text-xs">
                    <UserRound className="h-3 w-3" />
                    {data.customerName}
                  </Badge>
                </div>
                <Separator />
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <Mail className="h-5 w-5 text-primary mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Setup Email Sent</p>
                      <p className="text-sm text-muted-foreground">
                        {data.customerName} will receive a secure magic link at <span className="font-semibold">{data.customerEmail}</span> to set their password and access their dashboard.
                      </p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-2 text-sm text-muted-foreground">
                  {formattedRingSnapNumber ? (
                    <p>
                      📞 Forward their main line to <span className="font-semibold text-foreground">{formattedRingSnapNumber}</span>
                    </p>
                  ) : (
                    <p>📞 Their dedicated RingSnap number will be provisioned shortly.</p>
                  )}
                  <p>☎️ Customer phone on file: {formattedCustomerPhone}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Next Steps for Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  1. <strong>Check email</strong> for magic link to set password and access dashboard.
                </p>
                <p>
                  2. <strong>Forward business line</strong> to their RingSnap number using the instructions on the right.
                </p>
                <p>3. <strong>Test the AI</strong> with a live call to confirm professional greeting.</p>
                <p>4. <strong>Personalize settings</strong> including greeting, hours, and lead routing in dashboard.</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {formattedRingSnapNumber ? (
              <CarrierForwardingInstructions
                phoneNumber={data.ringSnapNumber ?? ""}
                companyName={data.companyName}
              />
            ) : (
              <Card className="border-dashed border-2 border-muted-foreground/50 h-full flex items-center justify-center">
                <CardContent className="text-center space-y-2 py-12">
                  <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="text-base font-medium">Provisioning in Progress</p>
                  <p className="text-sm text-muted-foreground">
                    We'll send the forwarding instructions as soon as the RingSnap number is live.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <div className="flex gap-2 flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleEmailInstructions}
              disabled={isSending}
            >
              <Mail className="h-4 w-4 mr-2" />
              {isSending ? "Opening Email..." : "Email Instructions"}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              <Check className="h-4 w-4 mr-2" />Done
            </Button>
          </div>
          {data.accountId && (
            <Button
              type="button"
              onClick={handleGoToDashboard}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View in Sales Dashboard
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
