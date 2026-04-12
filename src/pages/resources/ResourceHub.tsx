import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ResourceLayout } from "@/components/resources/ResourceLayout";
import { ResourceCTA } from "@/components/resources/ResourceCTA";
import { cn } from "@/lib/utils";
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
    Search,
    X,
    BookOpen,
    Star,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterCategory =
    | "all"
    | "hvac"
    | "plumbing"
    | "electrical"
    | "book-jobs"
    | "after-hours"
    | "emergencies"
    | "increase-ticket"
    | "pricing"
    | "tools";

type ContentType = "Script" | "Calculator" | "Field Guide";

interface ResourceItem {
    title: string;
    description: string;
    href: string;
    tags: string[];
    trade: string | null;
    icon: typeof FileText;
    categories: FilterCategory[];
    contentType: ContentType;
    featured?: boolean;
}

// ─── Resource Data ─────────────────────────────────────────────────────────────

const allResources: ResourceItem[] = [
    // ── Pillar guides (featured) ──────────────────────────────────────────────
    {
        title: "HVAC Dispatcher Script Template + Call Intake Checklist",
        description:
            "Complete call scripts for dispatchers, price shoppers, after-hours, and emergency HVAC scenarios. Includes intake checklist and booking benchmarks.",
        href: "/resources/hvac-dispatcher-script-template",
        tags: ["HVAC", "Scripts", "Checklist"],
        trade: "HVAC",
        icon: Thermometer,
        categories: ["hvac", "book-jobs"],
        contentType: "Script",
        featured: true,
    },
    {
        title: "Plumbing Dispatcher Script Template + Emergency Call Intake",
        description:
            "Copy/paste scripts for burst pipes, sewer backups, drain cleaning, and after-hours plumbing calls. Plus emergency intake checklist.",
        href: "/resources/plumbing-dispatcher-script-template",
        tags: ["Plumbing", "Scripts", "Emergency"],
        trade: "Plumbing",
        icon: Wrench,
        categories: ["plumbing", "book-jobs", "emergencies"],
        contentType: "Script",
        featured: true,
    },
    {
        title: "Electrician Call Answering Script + Safety Triage Checklist",
        description:
            "Safety-first call scripts, panel upgrade booking, power outage handling, and the safety triage checklist every electrical shop needs.",
        href: "/resources/electrician-call-answering-script",
        tags: ["Electrical", "Scripts", "Safety"],
        trade: "Electrical",
        icon: Zap,
        categories: ["electrical", "book-jobs", "emergencies"],
        contentType: "Script",
        featured: true,
    },
    {
        title: "Missed Call Revenue Calculator",
        description:
            "See exactly how much revenue your shop loses from missed and unanswered calls each month. Most contractors are surprised by the number.",
        href: "/resources/missed-call-revenue-calculator",
        tags: ["Calculator", "Revenue"],
        trade: null,
        icon: Calculator,
        categories: ["tools", "book-jobs"],
        contentType: "Calculator",
        featured: true,
    },
    // ── HVAC cluster ─────────────────────────────────────────────────────────
    {
        title: "HVAC After-Hours Answering Script",
        description:
            "Ready-to-use script for handling HVAC calls after business hours. Book emergency jobs and reassure customers overnight.",
        href: "/resources/hvac-after-hours-answering-script",
        tags: ["HVAC", "After-Hours"],
        trade: "HVAC",
        icon: Moon,
        categories: ["hvac", "after-hours"],
        contentType: "Script",
    },
    {
        title: "HVAC Price Shopper Phone Script",
        description:
            "Turn price shoppers into booked jobs. This script shifts the conversation from cost to value without being pushy.",
        href: "/resources/hvac-price-shopper-phone-script",
        tags: ["HVAC", "Pricing"],
        trade: "HVAC",
        icon: DollarSign,
        categories: ["hvac", "increase-ticket", "pricing"],
        contentType: "Script",
    },
    {
        title: "HVAC Emergency Call Triage",
        description:
            "Triage guide for gas leaks, no-heat, and AC failures. Know what's urgent vs. what can wait for the morning.",
        href: "/resources/hvac-emergency-call-triage",
        tags: ["HVAC", "Emergency"],
        trade: "HVAC",
        icon: AlertTriangle,
        categories: ["hvac", "emergencies"],
        contentType: "Field Guide",
    },
    // ── Plumbing cluster ──────────────────────────────────────────────────────
    {
        title: "Burst Pipe Call Script",
        description:
            "Walk callers through immediate shutoff steps while dispatching your crew. Calm, professional, and fast.",
        href: "/resources/burst-pipe-call-script",
        tags: ["Plumbing", "Emergency"],
        trade: "Plumbing",
        icon: Wrench,
        categories: ["plumbing", "emergencies"],
        contentType: "Script",
    },
    {
        title: "Sewer Backup Call Script",
        description:
            "Handle sewer backup calls with urgency and safety guidance. Script covers health risks, containment, and dispatch.",
        href: "/resources/sewer-backup-call-script",
        tags: ["Plumbing", "Emergency"],
        trade: "Plumbing",
        icon: AlertTriangle,
        categories: ["plumbing", "emergencies"],
        contentType: "Script",
    },
    {
        title: "Drain Cleaning Upsell Script",
        description:
            "Turn a basic drain cleaning into a full-value visit with camera inspection, maintenance plans, and line treatments.",
        href: "/resources/drain-cleaning-upsell-script",
        tags: ["Plumbing", "Upsell"],
        trade: "Plumbing",
        icon: TrendingUp,
        categories: ["plumbing", "increase-ticket"],
        contentType: "Script",
    },
    // ── Electrical cluster ────────────────────────────────────────────────────
    {
        title: "Electrical Safety Triage Questions",
        description:
            "The 8 questions every dispatcher needs to ask on an electrical call to assess danger and prioritize response.",
        href: "/resources/electrical-safety-triage-questions",
        tags: ["Electrical", "Safety"],
        trade: "Electrical",
        icon: Zap,
        categories: ["electrical", "emergencies"],
        contentType: "Field Guide",
    },
    {
        title: "Panel Upgrade Booking Script",
        description:
            "Book panel upgrade consultations by asking the right questions about home age, tripping breakers, and expansion plans.",
        href: "/resources/panel-upgrade-booking-script",
        tags: ["Electrical", "Booking"],
        trade: "Electrical",
        icon: PhoneCall,
        categories: ["electrical", "book-jobs", "increase-ticket"],
        contentType: "Script",
    },
    {
        title: "Power Outage Call Script",
        description:
            "Differentiate utility outages from panel issues. Guide callers through safety checks and dispatch only when needed.",
        href: "/resources/power-outage-call-script",
        tags: ["Electrical", "Emergency"],
        trade: "Electrical",
        icon: AlertTriangle,
        categories: ["electrical", "emergencies"],
        contentType: "Script",
    },
    // ── Calculators ───────────────────────────────────────────────────────────
    {
        title: "After-Hours Call Opportunity Calculator",
        description:
            "Calculate the revenue hiding in your after-hours call volume. Most shops leave 20–40% of revenue on the table.",
        href: "/resources/after-hours-call-calculator",
        tags: ["Calculator", "After-Hours"],
        trade: null,
        icon: Calculator,
        categories: ["tools", "after-hours"],
        contentType: "Calculator",
    },
    {
        title: "Service Pricing & Profit Calculator",
        description:
            "Build profitable pricing using your real numbers: labor rate, margin target, materials, and trip charges.",
        href: "/resources/service-pricing-calculator",
        tags: ["Calculator", "Pricing"],
        trade: null,
        icon: Calculator,
        categories: ["tools", "pricing"],
        contentType: "Calculator",
    },
    {
        title: "Average Revenue Per Job Growth Planner",
        description:
            "Plan your average ticket increase with trade-specific upsell menus, scripts, and revenue projections.",
        href: "/resources/increase-average-ticket",
        tags: ["Calculator", "Growth"],
        trade: null,
        icon: TrendingUp,
        categories: ["tools", "increase-ticket"],
        contentType: "Calculator",
    },
];

// ─── Trade navigation data ─────────────────────────────────────────────────────

const tradeCards = [
    {
        value: "hvac" as FilterCategory,
        label: "HVAC",
        description: "Heating, cooling & air quality contractors",
        icon: Thermometer,
        productHref: "/hvac",
        count: allResources.filter((r) => r.categories.includes("hvac")).length,
    },
    {
        value: "plumbing" as FilterCategory,
        label: "Plumbing",
        description: "Plumbers, drain specialists & water heater techs",
        icon: Wrench,
        productHref: "/plumbers",
        count: allResources.filter((r) => r.categories.includes("plumbing")).length,
    },
    {
        value: "electrical" as FilterCategory,
        label: "Electrical",
        description: "Electricians, panel specialists & EV charger installers",
        icon: Zap,
        productHref: "/electricians",
        count: allResources.filter((r) => r.categories.includes("electrical")).length,
    },
];

// ─── Topic / problem navigation data ──────────────────────────────────────────

const topicCards: { value: FilterCategory; label: string; description: string }[] = [
    {
        value: "book-jobs",
        label: "Book More Jobs",
        description: "Convert more inbound calls into booked appointments",
    },
    {
        value: "after-hours",
        label: "After-Hours Coverage",
        description: "Stop losing revenue when your office is closed",
    },
    {
        value: "emergencies",
        label: "Handle Emergencies",
        description: "Emergency triage scripts for urgent service calls",
    },
    {
        value: "increase-ticket",
        label: "Increase Average Ticket",
        description: "Upsell scripts and planners that grow revenue per job",
    },
    {
        value: "pricing",
        label: "Pricing & Profit",
        description: "Set and defend profitable prices on every call",
    },
    {
        value: "tools",
        label: "Calculators & Tools",
        description: "Interactive tools to measure missed revenue and plan growth",
    },
];

// ─── Filter chip data ──────────────────────────────────────────────────────────

const filterGroups = [
    {
        label: "By Trade",
        options: [
            { value: "hvac" as FilterCategory, label: "HVAC" },
            { value: "plumbing" as FilterCategory, label: "Plumbing" },
            { value: "electrical" as FilterCategory, label: "Electrical" },
        ],
    },
    {
        label: "By Problem",
        options: [
            { value: "book-jobs" as FilterCategory, label: "Book More Jobs" },
            { value: "after-hours" as FilterCategory, label: "After-Hours" },
            { value: "emergencies" as FilterCategory, label: "Emergencies" },
            { value: "increase-ticket" as FilterCategory, label: "Increase Ticket" },
            { value: "pricing" as FilterCategory, label: "Pricing & Profit" },
            { value: "tools" as FilterCategory, label: "Calculators" },
        ],
    },
];

// ─── Structured data ───────────────────────────────────────────────────────────

const hubSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Home Service Contractor Field Guides & Resources | RingSnap",
    description:
        "Free phone scripts, call intake checklists, field guides, and revenue calculators for HVAC, plumbing, and electrical contractors.",
    url: "https://getringsnap.com/resources",
    publisher: {
        "@type": "Organization",
        name: "RingSnap",
        url: "https://getringsnap.com",
        logo: {
            "@type": "ImageObject",
            url: "https://getringsnap.com/RS_logo_color.svg",
        },
    },
    hasPart: allResources.map((r) => ({
        "@type": "Article",
        name: r.title,
        description: r.description,
        url: `https://getringsnap.com${r.href}`,
    })),
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const contentTypeBadgeClass: Record<ContentType, string> = {
    Script: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    Calculator: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    "Field Guide": "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

// ─── Card components ───────────────────────────────────────────────────────────

interface FeaturedCardProps {
    resource: ResourceItem;
}

const FeaturedCard = ({ resource }: FeaturedCardProps) => {
    const Icon = resource.icon;
    return (
        <Link
            to={resource.href}
            className="group block rounded-xl border border-border bg-card p-5 md:p-6 hover:border-primary/40 hover:shadow-md transition-all relative overflow-hidden"
        >
            {/* Content type badge */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <span
                    className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 flex-shrink-0",
                        contentTypeBadgeClass[resource.contentType]
                    )}
                >
                    {resource.contentType}
                </span>
            </div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm md:text-base leading-tight mb-2">
                {resource.title}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mb-3">
                {resource.description}
            </p>
            {resource.trade && (
                <span className="text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5 mr-1.5">
                    {resource.trade}
                </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-2 group-hover:gap-1.5 transition-all">
                Read guide <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
        </Link>
    );
};

interface ResourceCardProps {
    resource: ResourceItem;
}

const ResourceCard = ({ resource }: ResourceCardProps) => {
    const Icon = resource.icon;
    return (
        <Link
            to={resource.href}
            className="group block rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all"
        >
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm leading-tight pt-1">
                        {resource.title}
                    </h3>
                </div>
                <span
                    className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 flex-shrink-0 whitespace-nowrap",
                        contentTypeBadgeClass[resource.contentType]
                    )}
                >
                    {resource.contentType}
                </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {resource.description}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
                {resource.trade && (
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        {resource.trade}
                    </span>
                )}
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary ml-auto">
                    Read more <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
            </div>
        </Link>
    );
};

// ─── Main component ────────────────────────────────────────────────────────────

const ResourceHub = () => {
    const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const allGuidesRef = useRef<HTMLDivElement>(null);

    const featuredResources = allResources.filter((r) => r.featured);

    const filteredResources = allResources.filter((r) => {
        const matchesFilter = activeFilter === "all" || r.categories.includes(activeFilter);
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
            q === "" ||
            r.title.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q) ||
            r.tags.some((t) => t.toLowerCase().includes(q)) ||
            (r.trade && r.trade.toLowerCase().includes(q));
        return matchesFilter && matchesSearch;
    });

    const handleFilterClick = (filter: FilterCategory) => {
        setActiveFilter(filter);
        setSearchQuery("");
        allGuidesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const clearFilters = () => {
        setActiveFilter("all");
        setSearchQuery("");
    };

    const isFiltered = activeFilter !== "all" || searchQuery.trim() !== "";

    return (
        <ResourceLayout
            title="Free Field Guides for Home Service Contractors | RingSnap Resources"
            metaDescription="Free phone scripts, call intake checklists, field guides, and revenue calculators for HVAC, plumbing, and electrical contractors. Copy, paste, and start booking more jobs today."
            canonical="/resources"
            keywords="contractor phone scripts, hvac call scripts, plumbing dispatcher script, electrician answering script, contractor call intake checklist, after hours answering script, missed call calculator, home service contractor resources"
            breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Resources" },
            ]}
            schema={hubSchema}
            contentClassName="max-w-6xl"
        >

            {/* ── Hero ────────────────────────────────────────────────────────── */}
            <section className="pt-4 md:pt-6 mb-12 max-w-4xl">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
                    Free Resources
                </p>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
                    Field Guides for Home Service Contractors
                </h1>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-3xl mb-6">
                    Phone scripts, call intake checklists, emergency triage guides, and revenue
                    calculators built for HVAC, plumbing, and electrical businesses. Find what you
                    need by trade or by the problem you're solving.
                </p>
                <div className="flex flex-wrap gap-3">
                    <a
                        href="#by-trade"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        Browse by trade <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                    <a
                        href="#by-topic"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-colors"
                    >
                        Browse by problem
                    </a>
                </div>
            </section>

            {/* ── Featured Guides ──────────────────────────────────────────────── */}
            <section className="mb-14" aria-labelledby="featured-heading">
                <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h2 id="featured-heading" className="text-xl md:text-2xl font-bold text-foreground">
                        Start Here
                    </h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
                    The highest-value guides for each trade, plus the tool contractors use most to
                    size up their missed-call problem.
                </p>
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {featuredResources.map((resource) => (
                        <FeaturedCard key={resource.href} resource={resource} />
                    ))}
                </div>
            </section>

            {/* ── Browse by Trade ──────────────────────────────────────────────── */}
            <section id="by-trade" className="mb-14 scroll-mt-20" aria-labelledby="trade-heading">
                <h2 id="trade-heading" className="text-xl md:text-2xl font-bold text-foreground mb-2">
                    Browse by Trade
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
                    Every guide is written for a specific trade. Select yours to see scripts and
                    checklists tailored to the calls your team actually handles.
                </p>
                <div className="grid sm:grid-cols-3 gap-4">
                    {tradeCards.map((trade) => {
                        const Icon = trade.icon;
                        return (
                            <div key={trade.value} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                        <Icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">{trade.label}</p>
                                        <p className="text-xs text-muted-foreground">{trade.count} resources</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                                    {trade.description}
                                </p>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <button
                                        onClick={() => handleFilterClick(trade.value)}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                    >
                                        See {trade.label} guides <ArrowRight className="h-3 w-3" />
                                    </button>
                                    <Link
                                        to={trade.productHref}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        RingSnap for {trade.label} →
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* ── Browse by Topic / Problem ────────────────────────────────────── */}
            <section id="by-topic" className="mb-14 scroll-mt-20" aria-labelledby="topic-heading">
                <h2 id="topic-heading" className="text-xl md:text-2xl font-bold text-foreground mb-2">
                    Browse by Problem
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
                    Not sure which trade to start with? Find guides by the specific problem
                    you're solving — booking more jobs, handling emergencies, or growing your ticket.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {topicCards.map((topic) => (
                        <button
                            key={topic.value}
                            onClick={() => handleFilterClick(topic.value)}
                            className="group text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                        >
                            <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors mb-1">
                                {topic.label}
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {topic.description}
                            </p>
                        </button>
                    ))}
                </div>
            </section>

            {/* ── All Guides ───────────────────────────────────────────────────── */}
            <section id="all-guides" ref={allGuidesRef} className="mb-14 scroll-mt-20" aria-labelledby="all-guides-heading">
                <h2 id="all-guides-heading" className="text-xl md:text-2xl font-bold text-foreground mb-6">
                    All Field Guides &amp; Tools
                </h2>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="search"
                        placeholder="Search guides — try &quot;HVAC&quot;, &quot;emergency&quot;, or &quot;pricing&quot;…"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (e.target.value.trim()) setActiveFilter("all");
                        }}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                        aria-label="Search field guides and tools"
                    />
                </div>

                {/* Filter chips */}
                <div className="flex flex-col gap-2.5 mb-6">
                    {filterGroups.map((group) => (
                        <div key={group.label} className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground w-16 shrink-0">
                                {group.label}:
                            </span>
                            {group.options.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setActiveFilter(activeFilter === opt.value ? "all" : opt.value)}
                                    className={cn(
                                        "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                                        activeFilter === opt.value
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Active filter / result count row */}
                <div className="flex items-center justify-between mb-4 min-h-[1.5rem]">
                    <p className="text-xs text-muted-foreground">
                        {filteredResources.length === allResources.length
                            ? `${allResources.length} resources`
                            : `${filteredResources.length} of ${allResources.length} resources`}
                    </p>
                    {isFiltered && (
                        <button
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-3 w-3" /> Clear filters
                        </button>
                    )}
                </div>

                {/* Grid */}
                {filteredResources.length > 0 ? (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredResources.map((resource) => (
                            <ResourceCard key={resource.href} resource={resource} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <BookOpen className="h-8 w-8 text-muted-foreground/40 mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">No guides found</p>
                        <p className="text-xs text-muted-foreground mb-4">
                            Try a different search term or clear your filters.
                        </p>
                        <button
                            onClick={clearFilters}
                            className="text-xs font-medium text-primary hover:underline"
                        >
                            Show all resources
                        </button>
                    </div>
                )}
            </section>

            {/* ── Internal links: trade pages ──────────────────────────────────── */}
            <section className="mb-14 rounded-xl border border-border bg-muted/30 p-5 md:p-6" aria-label="Related pages">
                <h2 className="text-sm font-semibold text-foreground mb-3">
                    Trade-Specific AI Answering for Your Business
                </h2>
                <p className="text-xs text-muted-foreground mb-4 max-w-xl">
                    These guides pair with RingSnap's AI phone receptionist, which handles calls
                    24/7 so you never miss a job. Learn how it works for your trade:
                </p>
                <nav aria-label="Trade landing pages" className="flex flex-wrap gap-3">
                    <Link
                        to="/hvac"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                        <Thermometer className="h-3.5 w-3.5" />
                        RingSnap for HVAC contractors
                    </Link>
                    <Link
                        to="/plumbers"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                        <Wrench className="h-3.5 w-3.5" />
                        RingSnap for plumbers
                    </Link>
                    <Link
                        to="/electricians"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                        <Zap className="h-3.5 w-3.5" />
                        RingSnap for electricians
                    </Link>
                    <Link
                        to="/pricing"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                        View pricing
                    </Link>
                </nav>
            </section>

            {/* ── CTAs ─────────────────────────────────────────────────────────── */}
            <ResourceCTA variant="download" />
            <ResourceCTA variant="demo" trade="contractor" service="contractor" />
        </ResourceLayout>
    );
};

export default ResourceHub;
