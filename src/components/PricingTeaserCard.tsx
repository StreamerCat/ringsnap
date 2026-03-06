import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface PricingTeaserCardProps {
    /**
     * Heading level for semantic flexibility (h2 or h3)
     */
    headingLevel: 'h2' | 'h3';
}

/**
 * Reusable pricing teaser card that navigates to /pricing
 * Designed for WCAG compliance with 44px minimum touch targets
 */
export const PricingTeaserCard = ({ headingLevel }: PricingTeaserCardProps) => {
    const navigate = useNavigate();
    const HeadingTag = headingLevel;

    return (
        <Card className="card-tier-2 max-w-md mx-auto">
            <CardContent className="p-6 text-center">
                <HeadingTag className="text-h3 font-bold mb-2" style={{ color: 'hsl(var(--charcoal))' }}>
                    One receptionist. Every call. 24/7.
                </HeadingTag>
                <p className="text-muted-foreground mb-4">
                    Starting at <span className="font-bold text-2xl text-foreground">$59/month</span> — scales with your call volume
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                    Night & Weekend from $59. Full 24/7 coverage from $129. 3-day free trial on every plan.
                </p>
                <Button
                    variant="gradient"
                    className="rounded-full px-8 h-12 min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={() => navigate('/pricing')}
                >
                    See Pricing <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
                </Button>
            </CardContent>
        </Card>
    );
};

export default PricingTeaserCard;
