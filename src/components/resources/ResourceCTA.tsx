import { Link } from "react-router-dom";
import { Download, Headphones, Calendar } from "lucide-react";

type CTAVariant = "download" | "hear-it" | "demo";

interface ResourceCTAProps {
    variant: CTAVariant;
    trade?: string;
    className?: string;
}

const ctaConfig: Record<CTAVariant, { icon: typeof Download; heading: string; description: string; buttonText: string; href: string }> = {
    download: {
        icon: Download,
        heading: "Get the full script pack",
        description: "Download every script and checklist from this page as a ready-to-use document your team can start with today.",
        buttonText: "Download Script Pack",
        href: "/start",
    },
    "hear-it": {
        icon: Headphones,
        heading: "Hear it in action",
        description: "Listen to how RingSnap handles a real contractor call — no sales pitch, just the actual experience your customers get.",
        buttonText: "Hear a Live Demo",
        href: "/start",
    },
    demo: {
        icon: Calendar,
        heading: "See how this works for your shop",
        description: "Book a quick walkthrough and we'll show you exactly how these scripts run on autopilot with RingSnap's AI receptionist.",
        buttonText: "Book a Demo",
        href: "/start",
    },
};

export const ResourceCTA = ({ variant, trade, className = "" }: ResourceCTAProps) => {
    const config = ctaConfig[variant];
    const Icon = config.icon;

    return (
        <div className={`my-10 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 md:p-8 ${className}`}>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground mb-1">{config.heading}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {config.description}
                        {trade && ` Tailored for ${trade} contractors.`}
                    </p>
                </div>
                <Link
                    to={config.href}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
                >
                    {config.buttonText}
                </Link>
            </div>
        </div>
    );
};
