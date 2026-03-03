import { useState, useEffect, useRef, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronRight, List, X } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const ContractorFooter = lazy(() =>
    import("@/components/ContractorFooter").then((m) => ({
        default: m.ContractorFooter,
    }))
);

interface TOCItem {
    id: string;
    label: string;
}

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface ResourceLayoutProps {
    children: ReactNode;
    title: string;
    metaDescription: string;
    canonical: string;
    keywords?: string;
    breadcrumbs: BreadcrumbItem[];
    toc?: TOCItem[];
    schema?: object;
    ogTitle?: string;
    ogDescription?: string;
    contentClassName?: string;
}

export const ResourceLayout = ({
    children,
    title,
    metaDescription,
    canonical,
    keywords,
    breadcrumbs,
    toc,
    schema,
    ogTitle,
    ogDescription,
    contentClassName,
}: ResourceLayoutProps) => {
    const hasToc = Boolean(toc && toc.length > 0);
    const [activeSection, setActiveSection] = useState<string>("");
    const [tocOpen, setTocOpen] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Track active section via IntersectionObserver
    useEffect(() => {
        if (!toc || toc.length === 0) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                }
            },
            { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
        );

        toc.forEach((item) => {
            const el = document.getElementById(item.id);
            if (el) observerRef.current?.observe(el);
        });

        return () => observerRef.current?.disconnect();
    }, [toc]);

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.label,
            ...(crumb.href ? { item: `https://getringsnap.com${crumb.href}` } : {}),
        })),
    };

    const fullCanonical = canonical.startsWith("http")
        ? canonical
        : `https://getringsnap.com${canonical}`;

    return (
        <>
            <Helmet>
                <title>{title}</title>
                <meta name="description" content={metaDescription} />
                {keywords && <meta name="keywords" content={keywords} />}
                <meta name="robots" content="index, follow" />
                <link rel="canonical" href={fullCanonical} />

                <meta property="og:title" content={ogTitle || title} />
                <meta property="og:description" content={ogDescription || metaDescription} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={fullCanonical} />
                <meta property="og:image" content="https://getringsnap.com/android-chrome-512x512.png" />
                <meta property="og:site_name" content="RingSnap" />

                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={ogTitle || title} />
                <meta name="twitter:description" content={ogDescription || metaDescription} />
                <meta name="twitter:image" content="https://getringsnap.com/android-chrome-512x512.png" />

                <script type="application/ld+json">
                    {JSON.stringify(breadcrumbSchema)}
                </script>
                {schema && (
                    <script type="application/ld+json">
                        {JSON.stringify(schema)}
                    </script>
                )}
            </Helmet>

            <SiteHeader />
            <main className="pt-14 pb-[calc(5rem+var(--safe-bottom))] md:pb-0">
                <div className="site-container py-8">
                    <div className="flex gap-8">
                        {/* Sticky TOC — Desktop */}
                        {hasToc && (
                            <aside className="hidden lg:block w-64 flex-shrink-0">
                                <div className="sticky top-20">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                        On this page
                                    </h3>
                                    <nav className="space-y-1 border-l border-border">
                                        {toc.map((item) => (
                                            <a
                                                key={item.id}
                                                href={`#${item.id}`}
                                                className={`block pl-4 py-1.5 text-sm transition-colors border-l -ml-px ${activeSection === item.id
                                                    ? "text-primary border-primary font-medium"
                                                    : "text-muted-foreground hover:text-foreground border-transparent"
                                                    }`}
                                                onClick={() => setActiveSection(item.id)}
                                            >
                                                {item.label}
                                            </a>
                                        ))}
                                    </nav>
                                </div>
                            </aside>
                        )}

                        {/* Main Content */}
                        <article className={`flex-1 min-w-0 ${contentClassName ?? "max-w-3xl"} mx-auto ${hasToc ? "lg:mx-0" : ""}`}>
                            {children}
                        </article>
                    </div>
                </div>

                {/* Mobile TOC Toggle */}
                {toc && toc.length > 0 && (
                    <>
                        <button
                            onClick={() => setTocOpen(true)}
                            className="lg:hidden fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
                            aria-label="Open table of contents"
                        >
                            <List className="h-5 w-5" />
                        </button>

                        {tocOpen && (
                            <div className="lg:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm p-6 overflow-y-auto">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold">On this page</h3>
                                    <button
                                        onClick={() => setTocOpen(false)}
                                        className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                                        aria-label="Close table of contents"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <nav className="space-y-2">
                                    {toc.map((item) => (
                                        <a
                                            key={item.id}
                                            href={`#${item.id}`}
                                            className="block py-2 px-4 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                                            onClick={() => setTocOpen(false)}
                                        >
                                            {item.label}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                        )}
                    </>
                )}

                <ErrorBoundary>
                    <Suspense
                        fallback={
                            <div className="w-full h-32 flex items-center justify-center">
                                <div className="animate-pulse text-muted-foreground">Loading...</div>
                            </div>
                        }
                    >
                        <ContractorFooter />
                    </Suspense>
                </ErrorBoundary>
            </main>
        </>
    );
};
