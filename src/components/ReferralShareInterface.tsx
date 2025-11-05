import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Share2, Mail, Twitter, Facebook, Linkedin } from "lucide-react";

interface ReferralShareInterfaceProps {
  referralCode: string;
  accountId: string;
}

export function ReferralShareInterface({ referralCode, accountId }: ReferralShareInterfaceProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const { toast } = useToast();

  const referralLink = `${window.location.origin}/?ref=${referralCode}`;

  useEffect(() => {
    // Generate QR code using Google Charts API
    const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(referralLink)}`;
    setQrCodeUrl(qrUrl);
  }, [referralLink]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        variant: "destructive"
      });
    }
  };

  const shareViaEmail = () => {
    const subject = "Get $25 off RingSnap AI Phone Service!";
    const body = `Hey! I'm using RingSnap to never miss another customer call, and I thought you might like it too.\n\nUse my referral link to get $25 off your first month:\n${referralLink}\n\nThey have AI receptionists that answer 24/7, book appointments, and handle customer questions automatically. Pretty cool!\n\nLet me know if you have any questions about it.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const shareOnTwitter = () => {
    const text = `Never miss another customer call! Get $25 off @RingSnapAI with my referral link:`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`, '_blank');
  };

  const shareOnFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank');
  };

  const shareOnLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <Card className="card-tier-1">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Share & Earn $50 per Referral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <div className="text-4xl font-bold text-primary">$25 + $50</div>
            <p className="text-muted-foreground">
              Your friend gets <strong>$25 off</strong>, you get <strong>$50 credit</strong> when they subscribe
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="font-semibold">How it works:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Share your unique referral link with friends</li>
              <li>They sign up and get $25 credit on their first month</li>
              <li>When they become a paying customer, you get $50 credit</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Share Options */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={referralLink}
              readOnly
              className="font-mono text-sm"
            />
            <Button onClick={copyToClipboard} size="icon">
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-sm text-muted-foreground">Share via</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={shareViaEmail}
            >
              <Mail className="h-4 w-4" />
              Email
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={shareOnTwitter}
            >
              <Twitter className="h-4 w-4" />
              Twitter
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={shareOnFacebook}
            >
              <Facebook className="h-4 w-4" />
              Facebook
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={shareOnLinkedIn}
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Card */}
      <Card>
        <CardHeader>
          <CardTitle>QR Code</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            {qrCodeUrl && (
              <img
                src={qrCodeUrl}
                alt="Referral QR Code"
                className="w-48 h-48 border-4 border-primary/20 rounded-lg"
              />
            )}
            <p className="text-sm text-center text-muted-foreground">
              Print or share this QR code for easy sign-ups
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Referral Code Display */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Your Referral Code</p>
            <div className="text-3xl font-bold font-mono tracking-wider text-primary">
              {referralCode}
            </div>
            <p className="text-xs text-muted-foreground">
              Friends can also enter this code at signup
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
