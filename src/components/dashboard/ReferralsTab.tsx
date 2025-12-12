
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
// ReferralShareInterface temporarily disabled
// import { ReferralShareInterface } from "@/components/ReferralShareInterface";

interface ReferralsTabProps {
    referralCode?: string; // Made optional - referral feature temporarily disabled
    referralStats: {
        total: number;
        converted: number;
        creditsEarned: number;
    }
}

export function ReferralsTab({ referralCode, referralStats }: ReferralsTabProps) {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{referralStats.total}</div>
                        <p className="text-xs text-muted-foreground">Total Referrals</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{referralStats.converted}</div>
                        <p className="text-xs text-muted-foreground">Converted</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">
                            ${referralStats.creditsEarned.toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground">Credits Earned</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Share & Earn</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="mb-4 text-muted-foreground">
                        Share your referral code with other contractors. When they sign up and pay for 3 months, you both get $50 in credits!
                    </p>
                    {/* Referral feature temporarily disabled for MVP */}
                    <div className="p-4 bg-muted rounded text-center text-muted-foreground">
                        Referral program coming soon!
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

