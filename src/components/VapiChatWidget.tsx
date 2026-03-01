import { useEffect, useState, type ComponentType } from "react";
import { useLocation } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { useVapiWidget } from "@/lib/VapiWidgetContext";
import { featureFlags } from "@/lib/featureFlags";

const PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY;
const ASSISTANT_ID = import.meta.env.VITE_VAPI_WIDGET_ASSISTANT_ID;

// Routes where widget should clearly NOT appear (Auth, Checkout, Legal)
const HIDDEN_EXACT_ROUTES = [
    "/login",
    "/signup",
    "/signin",
    "/start",
    "/onboarding",
    "/onboarding-chat",
    "/onboarding-status",
    "/setup/assistant",
    "/activation",
    "/checkout",
    "/trial-confirmation",
    "/auth",
    "/terms",
    "/privacy",
    "/form-preview",
    "/trial-preview"
];

const HIDDEN_PREFIXES = [
    "/auth/"
    // Removed billing and settings to allow Customer Mode there
];

const STAFF_PREFIXES = [
    "/salesdash",
    "/admin",
    "/internal",
    "/staff",
    "/monitoring",
    "/ops"
];

const CUSTOMER_PREFIXES = [
    "/dashboard",
    "/app",
    "/settings",
    "/billing",
    "/account"
];

type VapiWidgetProps = {
    key: string;
    publicKey: string;
    assistantId: string;
    mode: "chat";
    theme: "light";
    position: "bottom-right";
    size: "compact";
    buttonColor: string;
    title: string;
    subtitle: string;
    assistantOverrides: Record<string, unknown>;
    onCallStart: () => void;
    onCallEnd: () => void;
    onError: (error: unknown) => void;
    onMessage: (message: unknown) => void;
    requireConsent: string;
    termsContent: string;
    localStorageKey: string;
};

export function VapiChatWidget() {
    const location = useLocation();
    const { widgetContext } = useVapiWidget();
    const [VapiWidgetComponent, setVapiWidgetComponent] = useState<ComponentType<VapiWidgetProps> | null>(null);

    // Calculate visibility synchronously during render
    let path = location.pathname.toLowerCase();
    // Normalize path: remove trailing slash if not root
    if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
    }

    // Helper functions for route classification
    const isStaffRoute = STAFF_PREFIXES.some(prefix => path.startsWith(prefix));
    const isCustomerRoute = CUSTOMER_PREFIXES.some(prefix => path.startsWith(prefix));
    const isPricingPage = path === '/pricing';
    const isHiddenRoute = HIDDEN_EXACT_ROUTES.includes(path) ||
        HIDDEN_PREFIXES.some(prefix => path.startsWith(prefix));

    const shouldShow = !isHiddenRoute && !isStaffRoute;

    // Determine Widget Mode
    let widgetMode: 'marketing' | 'pricing' | 'customer' = 'marketing';
    if (isCustomerRoute || (widgetContext.accountId && !isStaffRoute)) {
        widgetMode = 'customer';
    } else if (isPricingPage) {
        widgetMode = 'pricing';
    }

    // Config for "Riley" Persona
    const RILEY_CONFIG = {
        marketing: {
            title: "RingSnap Concierge",
            subtitle: "Pricing, setup, answers",
            initialMessage: "Hi, I'm Riley. What can I help with today? Pricing, setup, or how RingSnap handles calls?"
        },
        pricing: {
            title: "RingSnap Concierge",
            subtitle: "Pricing, setup, answers",
            initialMessage: "Hi, I'm Riley. Want help choosing the right plan based on your call volume?"
        },
        customer: {
            title: "RingSnap Support",
            subtitle: "Support and onboarding",
            initialMessage: "Hi, I'm Riley. What are you working on right now? Setup, call logs, booking, or billing?"
        }
    };

    const config = RILEY_CONFIG[widgetMode];
    // Remount only on context change (Auth or Mode switch)
    const modeKey = `${widgetContext.accountId ? "in" : "out"}:${widgetMode}`;

    // ORIGINAL WORKING STRUCTURE: assistantOverrides returns { variableValues } ONLY
    // The assistant's firstMessage should be set in the Vapi dashboard, not overridden here.
    const getAssistantOverrides = () => {
        // Basic context for all users
        const variableValues: Record<string, unknown> = {
            pagePath: location.pathname,
            isLoggedIn: !!widgetContext.accountId,
            widgetMode,
            ...widgetContext // Spread dashboard context (customerName, accountId, etc.)
        };

        // Add UTM params if present in URL
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.get('utm_source')) variableValues.utmSource = searchParams.get('utm_source');
        if (searchParams.get('utm_medium')) variableValues.utmMedium = searchParams.get('utm_medium');
        if (searchParams.get('utm_campaign')) variableValues.utmCampaign = searchParams.get('utm_campaign');

        return {
            variableValues
        };
    };

    useEffect(() => {
        if (!shouldShow || !PUBLIC_KEY || !ASSISTANT_ID || VapiWidgetComponent) {
            return;
        }

        let isCancelled = false;
        let idleTimer: number | undefined;

        const loadWidgetSdk = async () => {
            try {
                const sdk = await import("@vapi-ai/client-sdk-react");
                if (!isCancelled) {
                    setVapiWidgetComponent(() => sdk.VapiWidget as ComponentType<VapiWidgetProps>);
                }
            } catch (error) {
                Sentry.captureException(error, { tags: { source: 'vapi-widget-sdk-load' } });
            }
        };

        const startLoad = () => {
            void loadWidgetSdk();
        };

        // Defer third-party widget until idle or first user intent.
        const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
        events.forEach((eventName) => window.addEventListener(eventName, startLoad, { once: true, passive: true }));

        if ('requestIdleCallback' in window) {
            (window as Window & { requestIdleCallback: (callback: () => void, options?: { timeout: number }) => number })
                .requestIdleCallback(startLoad, { timeout: 2500 });
        } else {
            idleTimer = window.setTimeout(startLoad, 2500);
        }

        return () => {
            isCancelled = true;
            events.forEach((eventName) => window.removeEventListener(eventName, startLoad));
            if (idleTimer) {
                window.clearTimeout(idleTimer);
            }
        };
    }, [VapiWidgetComponent, shouldShow]);

    if (!shouldShow || !PUBLIC_KEY || !ASSISTANT_ID || !VapiWidgetComponent) {
        return null;
    }

    // Dynamic Mobile Positioning with Safe Offset
    // When widgetSafeOffset is enabled, use higher offset to avoid overlapping CTAs
    const getMobileBottomClass = () => {
        if (featureFlags.widgetSafeOffset) {
            // Safe offset mode: use higher offset on customer routes to avoid CTA overlap
            if (widgetMode === 'customer') {
                return 'bottom-20'; // Higher offset on dashboard to avoid fixed CTAs
            }
            return 'bottom-28'; // Marketing/pricing pages
        }
        // Legacy behavior
        return widgetMode === 'customer' ? 'bottom-4' : 'bottom-28';
    };

    const mobileBottomClass = getMobileBottomClass();

    return (
        <div className={`vapi-widget-container fixed ${mobileBottomClass} md:bottom-4 right-4 z-[100] transition-all duration-300 ease-in-out`}>
            <Sentry.ErrorBoundary fallback={null}>
                <VapiWidgetComponent
                    key={modeKey}
                    publicKey={PUBLIC_KEY}
                    assistantId={ASSISTANT_ID}
                    mode="chat"
                    theme="light"
                    position="bottom-right"
                    size="compact"

                    // Customization
                    buttonColor="#D67256" // Terracotta
                    title={config.title}
                    subtitle={config.subtitle}

                    assistantOverrides={getAssistantOverrides()}

                    // Events
                    onCallStart={() => {
                        Sentry.addBreadcrumb({ category: 'vapi', message: 'Call/Chat started', level: 'info' });
                    }}
                    onCallEnd={() => {
                        Sentry.addBreadcrumb({ category: 'vapi', message: 'Call/Chat ended', level: 'info' });
                    }}
                    onError={(error: unknown) => {
                        Sentry.captureException(error, { tags: { source: 'vapi-widget' } });
                    }}
                    onMessage={() => {
                        // Intentionally no-op to avoid noisy logs.
                    }}

                    // @ts-expect-error - web-component props
                    requireConsent="true"
                    termsContent="By chatting, you agree to our [Privacy Policy](/privacy) and [Terms of Service](/terms)."
                    localStorageKey="ringsnap_vapi_consent"
                />
            </Sentry.ErrorBoundary>
        </div>
    );
}
