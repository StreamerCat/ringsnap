import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CarrierForwardingInstructions } from "@/components/CarrierForwardingInstructions";
import { useEmailInstructions } from "@/hooks/useEmailInstructions";
import { Check, Copy, Mail, ShieldCheck, UserRound } from "lucide-react";
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
  tempPassword: string;
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
  const [copiedPassword, setCopiedPassword] = useState(false);
  const { sendInstructions, isSending } = useEmailInstructions();

  const formattedCustomerPhone = useMemo(() => formatPhone(data?.customerPhone ?? ""), [data?.customerPhone]);
  const formattedRingSnapNumber = useMemo(
    () => (data?.ringSnapNumber ? formatPhone(data.ringSnapNumber) : null),
    [data?.ringSnapNumber]
  );

  if (!data) {
    return null;
  }

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(data.tempPassword);
      setCopiedPassword(true);
      toast.success("Temporary password copied");
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch (error) {
      console.error("Failed to copy password", error);
      toast.error("Unable to copy password");
    }
  };

  const handleEmailInstructions = () => {
    sendInstructions({
      email: data.customerEmail,
      phoneNumber: data.ringSnapNumber,
      companyName: data.companyName,
      customerName: data.customerName,
      tempPassword: data.tempPassword,
    });
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
            Share the credentials below with {data.customerName}. Their AI line is ready for forwarding and testing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="border-2 border-primary/40 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <CardTitle className="text-xl">Login Credentials</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Email and temporary password to access the RingSnap dashboard.
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Temporary Password</p>
                    <p className="font-mono text-lg break-all">{data.tempPassword}</p>
                  </div>
                  <Button variant="outline" onClick={handleCopyPassword} className="sm:w-auto w-full">
                    {copiedPassword ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />Copy Password
                      </>
                    )}
                  </Button>
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
                <CardTitle className="text-lg">Share Next Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  1. Forward their current business line to their RingSnap number using the quick instructions on the right.
                </p>
                <p>2. Make a live test call to confirm the AI answers professionally.</p>
                <p>3. Ask them to log in and personalize greeting, hours, and lead routing.</p>
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

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleEmailInstructions}
            disabled={isSending}
          >
            <Mail className="h-4 w-4 mr-2" />
            {isSending ? "Opening Email..." : "Email Instructions"}
          </Button>
          <Button type="button" onClick={onDone}>
            <Check className="h-4 w-4 mr-2" />Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
