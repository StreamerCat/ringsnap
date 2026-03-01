import { useState } from "react";
import { Link } from "react-router-dom";
import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import {
    Thermometer,
    Wrench,
    Zap,
    PhoneCall,
    Moon,
    AlertTriangle,
    TrendingUp,
    DollarSign,
    Calculator,
    FileText,
    ArrowRight,
} from "lucide-react";

interface ResourceCardProps {
    title: string;
    description: string;
    href: string;
    tags: string[];
    icon: typeof FileText;
}

const ResourceCard = ({ title, description, href, tags, icon: Icon }: ResourceCardProps) => (
    <Link
        to={href}
        className="group block rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
    >
        <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm leading-tight pt-1">
                {title}
            </h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{description}</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((tag) => (
                <span key={tag} className="text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                    {tag}
                </span>
            ))}
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            Read more <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
    </Link>
);

type FilterCategory = "all" | "hvac" | "plumbing" | "electrical" | "book-jobs" | "after-hours" | "emergencies" | "increase-ticket" | "pricing" | "tools";

const allResources: (ResourceCardProps & { categories: FilterCategory[] })[] = [
    // Pillar pages
    {
        title: "HVAC Dispatcher Script Template + Call Intake Checklist",
        description: "Complete call scripts for dispatchers, price shoppers, after-hours, and emergency HVAC scenarios. Includes intake checklist and booking benchmarks.",
        href: "/resources/hvac-dispatcher-script-template/",
        tags: ["HVAC", "Scripts", "Checklist"],
        icon: Thermometer,
        categories: ["hvac", "book-jobs"],
    },
    {
        title: "Plumbing Dispatcher Script Template + Emergency Call Intake",
        description: "Copy/paste scripts for burst pipes, sewer backups, drain cleaning, and after-hours plumbing calls. Plus emergency intake checklist.",
        href: "/resources/plumbing-dispatcher-script-template/",
        tags: ["Plumbing", "Scripts", "Emergency"],
        icon: Wrench,
        categories: ["plumbing", "book-jobs", "emergencies"],
    },
    {
        title: "Electrician Call Answering Script + Safety Triage Checklist",
        description: "Safety-first call scripts, panel upgrade booking, power outage handling, and the safety triage checklist every electrical shop needs.",
        href: "/resources/electrician-call-answering-script/",
        tags: ["Electrical", "Scripts", "Safety"],
        icon: Zap,
        categories: ["electrical", "book-jobs", "emergencies"],
    },
    // HVAC cluster
    {
        title: "HVAC After-Hours Answering Script",
        description: "Ready-to-use script for handling HVAC calls after business hours. Book emergency jobs and reassure customers overnight.",
        href: "/resources/hvac-after-hours-answering-script/",
        tags: ["HVAC", "After-Hours"],
        icon: Moon,
        categories: ["hvac", "after-hours"],
    },
    {
        title: "HVAC Price Shopper Phone Script",
        description: "Turn price shoppers into booked jobs. This script shifts the conversation from cost to value without being pushy.",
        href: "/resources/hvac-price-shopper-phone-script/",
        tags: ["HVAC", "Pricing"],
        icon: DollarSign,
        categories: ["hvac", "increase-ticket", "pricing"],
    },
    {
        title: "HVAC Emergency Call Triage",
        description: "Triage guide for gas leaks, no-heat, and AC failures. Know what's urgent vs. what can wait for the morning.",
        href: "/resources/hvac-emergency-call-triage/",
        tags: ["HVAC", "Emergency"],
        icon: AlertTriangle,
        categories: ["hvac", "emergencies"],
    },
    // Plumbing cluster
    {
        title: "Burst Pipe Call Script",
        description: "Walk callers through immediate shutoff steps while dispatching your crew. Calm, professional, and fast.",
        href: "/resources/burst-pipe-call-script/",
        tags: ["Plumbing", "Emergency"],
        icon: Wrench,
        categories: ["plumbing", "emergencies"],
    },
    {
        title: "Sewer Backup Call Script",
        description: "Handle sewer backup calls with urgency and safety guidance. Script covers health risks, containment, and dispatch.",
        href: "/resources/sewer-backup-call-script/",
        tags: ["Plumbing", "Emergency"],
        icon: AlertTriangle,
        categories: ["plumbing", "emergencies"],
    },
    {
        title: "Drain Cleaning Upsell Script",
        description: "Turn a basic drain cleaning into a full-value visit with camera inspection, maintenance plans, and line treatments.",
        href: "/resources/drain-cleaning-upsell-script/",
        tags: ["Plumbing", "Upsell"],
        icon: TrendingUp,
        categories: ["plumbing", "increase-ticket"],
    },
    // Electrical cluster
    {
        title: "Electrical Safety Triage Questions",
        description: "The 8 questions every dispatcher needs to ask on an electrical call to assess danger and prioritize response.",
        href: "/resources/electrical-safety-triage-questions/",
        tags: ["Electrical", "Safety"],
        icon: Zap,
        categories: ["electrical", "emergencies"],
    },
    {
        title: "Panel Upgrade Booking Script",
        description: "Book panel upgrade consultations by asking the right questions about home age, tripping breakers, and expansion plans.",
        href: "/resources/panel-upgrade-booking-script/",
        tags: ["Electrical", "Booking"],
        icon: PhoneCall,
        categories: ["electrical", "book-jobs", "increase-ticket"],
    },
    {
        title: "Power Outage Call Script",
        description: "Differentiate utility outages from panel issues. Guide callers through safety checks and dispatch only when needed.",
        href: "/resources/power-outage-call-script/",
        tags: ["Electrical", "Emergency"],
        icon: AlertTriangle,
        categories: ["electrical", "emergencies"],
    },
    // Calculators
    {
        title: "Missed Call Revenue Calculator",
        description: "See exactly how much revenue your shop loses from missed and unanswered calls each month.",
        href: "/resources/missed-call-revenue-calculator/",
        tags: ["Calculator", "Revenue"],
        icon: Calculator,
        categories: ["tools", "book-jobs"],
    },
    {
        title: "After-Hours Call Opportunity Calculator",
        description: "Calculate the revenue hiding in your after-hours call volume. Most shops leave 20-40% of revenue on the table.",
        href: "/resources/after-hours-call-calculator/",
        tags: ["Calculator", "After-Hours"],
        icon: Calculator,
        categories: ["tools", "after-hours"],
    },
    {
        title: "Service Pricing & Profit Calculator",
        description: "Build profitable pricing using your real numbers: labor rate, margin target, materials, and trip charges.",
        href: "/resources/service-pricing-calculator/",
        tags: ["Calculator", "Pricing"],
        icon: Calculator,
        categories: ["tools", "pricing"],
    },
    {
        title: "Average Revenue Per Job Growth Planner",
        description: "Plan your average ticket increase with trade-specific upsell menus, scripts, and revenue projections.",
        href: "/resources/increase-average-ticket/",
        tags: ["Calculator", "Growth"],
        icon: TrendingUp,
        categories: ["tools", "increase-ticket"],
    },
];

const filterOptions: { value: FilterCategory; label: string; group: string }[] = [
    { value: "all", label: "All Resources", group: "all" },
    { value: "hvac", label: "HVAC", group: "trade" },
    { value: "plumbing", label: "Plumbing", group: "trade" },
    { value: "electrical", label: "Electrical", group: "trade" },
    { value: "book-jobs", label: "Book More Jobs", group: "goal" },
    { value: "after-hours", label: "After-Hours Coverage", group: "goal" },
    { value: "emergencies", label: "Handle Emergencies", group: "goal" },
    { value: "increase-ticket", label: "Increase Average Ticket", group: "goal" },
    { value: "pricing", label: "Pricing & Profit", group: "goal" },
    { value: "tools", label: "Calculators & Tools", group: "tools" },
];

const ResourceHub = () => {
    const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");

    const filtered =
        activeFilter === "all"
            ? allResources
            : allResources.filter((r) => r.categories.includes(activeFilter));

    return (
        <ResourceLayout
            title="Contractor Phone Scripts, Call Intake & After-Hours Answering Resources | RingSnap"
            metaDescription="Free phone scripts, call intake checklists, benchmarks, and revenue calculators for HVAC, plumbing, and electrical contractors. Built by contractors, for contractors."
            canonical="/resources/"
            keywords="contractor phone scripts, hvac call scripts, plumbing dispatcher script, electrician answering script, contractor call intake checklist, after hours answering script"
            breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Resources" },
            ]}
        >
            {/* Hero */}
            <div className="mb-10">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight">
                    Contractor Phone Scripts, Call Intake, and After-Hours Answering Resources
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
                    Practical scripts, intake checklists, benchmarks, and calculators built for HVAC, plumbing, and electrical shops. Copy, paste, and start booking more jobs today.
                </p>
            </div>

            {/* Filters */}
            <div className="mb-8">
                <div className="flex flex-wrap gap-2">
                    {filterOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setActiveFilter(option.value)}
                            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${activeFilter === option.value
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Resource Grid */}
            <div className="grid md:grid-cols-2 gap-4 mb-12">
                {filtered.map((resource) => (
                    <ResourceCard
                        key={resource.href}
                        title={resource.title}
                        description={resource.description}
                        href={resource.href}
                        tags={resource.tags}
                        icon={resource.icon}
                    />
                ))}
            </div>

            {/* CTAs */}
            <ResourceCTA variant="download" />
            <ResourceCTA variant="demo" trade="contractor" service="contractor" />
        </ResourceLayout>
    );
};

export default ResourceHub;
