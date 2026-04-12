import { Link } from "react-router-dom";
import { Download, Headphones, Calendar } from "lucide-react";
import { useState } from "react";
import { ResourceDownloadModal } from "./ResourceDownloadModal";

type CTAVariant = "download" | "hear-it" | "demo";

interface ResourceCTAProps {
    variant: CTAVariant;
    trade?: string;
    service?: string;
    className?: string;
}

const ctaConfig: Record<CTAVariant, { icon: typeof Download; heading: string; description: string; buttonText: string; href: string }> = {
    download: {
        icon: Download,
        heading: "Get the Contractor Call Conversion Pack",
        description: "Download the exact scripts, triage questions, and booking talk tracks your team can use today for HVAC, plumbing, and electrical calls.",
        buttonText: "Download the Free Script Pack",
        href: "#",
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
        heading: "Start your trial!",
        description: "Test it on your next calls and see exactly how scripts run on autopilot with RingSnap's receptionist. Built for contractors.",
        buttonText: "Book More Jobs",
        href: "/start",
    },
};

export const ResourceCTA = ({ variant, trade, service, className = "" }: ResourceCTAProps) => {
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const config = ctaConfig[variant];
    const Icon = config.icon;

    // Build dynamic description for demo variant if props are provided
    const displayHeading = variant === "demo" ? "Start your trial!" : config.heading;
    const displayDescription = variant === "demo"
        ? `Test it on your next ${service || (trade ? trade.toLowerCase() : 'contractor')} calls and see exactly how scripts run on autopilot with RingSnap's receptionist. Built for ${(trade?.toLowerCase() === "contractor" ? "contractors" : `${trade || "professional"} contractors`)}.`
        : config.description + (trade ? ` Tailored for ${trade} contractors.` : "");

    const handleAction = (e: React.MouseEvent) => {
        if (variant === "download") {
            e.preventDefault();
            setIsDownloadModalOpen(true);
        }
    };

    return (
        <>
            <div className={`my-10 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 md:p-8 ${className}`}>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-foreground mb-1">{displayHeading}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {displayDescription}
                        </p>
                    </div>
                    {variant === "download" ? (
                        <button
                            onClick={() => setIsDownloadModalOpen(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
                        >
                            {config.buttonText}
                        </button>
                    ) : (
                        <Link
                            to={config.href}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
                        >
                            {config.buttonText}
                        </Link>
                    )}
                </div>
            </div>

            <ResourceDownloadModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
                resourceName={trade ? `${trade} Script Pack` : "Script Pack"}
            />
        </>
    );
};
