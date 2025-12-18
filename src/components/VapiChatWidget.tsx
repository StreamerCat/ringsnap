import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Vapi from "@vapi-ai/web";
// Using the web SDK directly for more control or the react SDK wrapper? 
// The plan said @vapi-ai/client-sdk-react. Let's use the React component as requested.
// But wait, the React SDK <VapiWidget> is the easiest integration.
import { VapiWidget } from "@vapi-ai/client-sdk-react";
import * as Sentry from "@sentry/react";
import { useVapiWidget } from "@/lib/VapiWidgetContext";

const PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY;
const ASSISTANT_ID = import.meta.env.VITE_VAPI_WIDGET_ASSISTANT_ID;

// Excluded routes where widget should NOT appear
const EXCLUDED_ROUTES = [
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

const EXCLUDED_PREFIXES = [
    "/auth/",
    "/billing/",
    "/settings/integrations"
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

    const isExcluded = EXCLUDED_ROUTES.includes(path) ||
        EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix));
    const shouldShow = !isExcluded;

    // Debug log for troubleshooting (can be removed later)
    // console.log(`VapiWidget: path=${path}, excluded=${isExcluded}, show=${shouldShow}`);

    // Construct assistant overrides based on context
    const getAssistantOverrides = () => {
        // Basic context for all users
        const variableValues: Record<string, any> = {
            pagePath: location.pathname,
            isLoggedIn: !!widgetContext.accountId,
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

    if (!shouldShow || !PUBLIC_KEY || !ASSISTANT_ID) {
        if (!PUBLIC_KEY || !ASSISTANT_ID) console.warn("Vapi Widget: Missing keys");
        return null;
    }

    return (
        <div className="vapi-widget-container fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out safe-area-bottom-right">
            <Sentry.ErrorBoundary fallback={null}>
                <VapiWidget
                    publicKey={PUBLIC_KEY}
                    assistantId={ASSISTANT_ID}
                    mode="chat"
                    theme="light"
                    position="bottom-right"
                    size="compact" // Will be overridden by CSS media query if needed or handle logic here. 
                    // Vapi widget size prop doesn't have "auto". We'll use 'compact' and trust the internal responsive logic or CSS.
                    // For mobile "tiny", we might need conditional rendering based on window width if Vapi doesn't auto-resize. 
                    // Docs say: "Vapi supports size (tiny, compact, full)". 
                    // Let's stick to 'compact' for now as it's a good middle ground.

                    // Customization
                    buttonColor="#D97757" // Terracotta

                    // Assistant Overrides for Context
                    assistantOverrides={getAssistantOverrides()}

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
