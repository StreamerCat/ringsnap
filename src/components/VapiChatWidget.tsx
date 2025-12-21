import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import Vapi from "@vapi-ai/web";
import { VapiWidget } from "@vapi-ai/client-sdk-react";
import * as Sentry from "@sentry/react";
import { useVapiWidget } from "@/lib/VapiWidgetContext";

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

export function VapiChatWidget() {
    const location = useLocation();
    const { widgetContext } = useVapiWidget();

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

    // Debug log for troubleshooting
    console.log(`[VapiWidget Debug] Init`, {
        path,
        isStaffRoute,
        isHiddenRoute,
        shouldShow,
        hasPublicKey: !!PUBLIC_KEY,
        hasAssistantId: !!ASSISTANT_ID,
        publicKeyMasked: PUBLIC_KEY ? `${PUBLIC_KEY.slice(0, 4)}...` : 'missing'
    });

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
            // placeholder: "Ask a question…", // Not standard Vapi prop, omitting to avoid react warnings
            initialMessage: "Hi, I’m Riley. What can I help with today? Pricing, setup, or how RingSnap handles calls?"
        },
        pricing: {
            title: "RingSnap Concierge",
            subtitle: "Pricing, setup, answers",
            initialMessage: "Hi, I’m Riley. Want help choosing the right plan based on your call volume?"
        },
        customer: {
            title: "RingSnap Support",
            subtitle: "Support and onboarding",
            initialMessage: "Hi, I’m Riley. What are you working on right now? Setup, call logs, booking, or billing?"
        }
    };

    const config = RILEY_CONFIG[widgetMode];
    // Remount only on context change (Auth or Mode switch)
    const modeKey = `${!!widgetContext.accountId ? "in" : "out"}:${widgetMode}`;

    // Check environment variables specifically
    if (!PUBLIC_KEY) console.warn("[VapiWidget Debug] Missing VITE_VAPI_PUBLIC_KEY");
    if (!ASSISTANT_ID) console.warn("[VapiWidget Debug] Missing VITE_VAPI_WIDGET_ASSISTANT_ID");

    // Construct assistant overrides based on context - DIAGNOSTIC MODE
    const assistantOverrides = useMemo(() => {
        // Hardcoded minimal payload to verify connection and rule out data issues
        return {
            variableValues: {
                isTest: true,
                mode: widgetMode
            },
            assistant: {
                firstMessage: config.initialMessage
            }
        };
    }, [widgetMode, config.initialMessage]);

    if (!shouldShow || !PUBLIC_KEY || !ASSISTANT_ID) {
        console.log("[VapiWidget Debug] Widget hidden", {
            reason: !shouldShow ? (isStaffRoute ? "Staff Route" : "Hidden Route") : "Missing Keys"
        });
        return null;
    }

    // Dynamic Mobile Positioning
    // Marketing/Pricing pages have a sticky footer (MobileFooterCTA) -> use bottom-28
    // Dashboard/Customer pages do NOT have a sticky footer -> use standard bottom-4
    const mobileBottomClass = widgetMode === 'customer' ? 'bottom-4' : 'bottom-28';

    return (
        <div className={`vapi-widget-container fixed ${mobileBottomClass} md:bottom-4 right-4 z-[100] transition-all duration-300 ease-in-out safe-area-bottom-right`}>
            <Sentry.ErrorBoundary fallback={null}>
                <VapiWidget
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

                    // assistantOverrides for Context and First Message
                    assistantOverrides={assistantOverrides}

                    // Events
                    onCallStart={() => {
                        Sentry.addBreadcrumb({ category: 'vapi', message: 'Call/Chat started', level: 'info' });
                        // Could track analytics event here
                    }}
                    onCallEnd={() => {
                        Sentry.addBreadcrumb({ category: 'vapi', message: 'Call/Chat ended', level: 'info' });
                    }}
                    onError={(error: any) => {
                        console.error("Vapi Widget Error:", error);
                        Sentry.captureException(error, { tags: { source: 'vapi-widget' } });
                    }}
                    onMessage={(message: any) => {
                        // Log messages for debug but don't spam Sentry
                        // console.debug("Vapi Message:", message);
                    }}

                    // Consent (Note: Ensure SDK supports these props, otherwise they might need to be passed differently)
                    // The React SDK VapiWidget props typescript definition might not include 'require-consent' directly if it's strict,
                    // but it passes props down to the web component.
                    // @ts-ignore - helping TS with web-component props
                    requireConsent="true"
                    termsContent="By chatting, you agree to our [Privacy Policy](/privacy) and [Terms of Service](/terms)."
                    localStorageKey="ringsnap_vapi_consent"
                />
            </Sentry.ErrorBoundary>
        </div>
    );
}
