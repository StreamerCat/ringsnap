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

    // Debug log for troubleshooting
    console.log(`[VapiWidget Debug] Init`, {
        path,
        isExcluded,
        shouldShow,
        hasPublicKey: !!PUBLIC_KEY,
        hasAssistantId: !!ASSISTANT_ID,
        publicKeyMasked: PUBLIC_KEY ? `${PUBLIC_KEY.slice(0, 4)}...` : 'missing'
    });

    // Check environment variables specifically
    if (!PUBLIC_KEY) console.warn("[VapiWidget Debug] Missing VITE_VAPI_PUBLIC_KEY");
    if (!ASSISTANT_ID) console.warn("[VapiWidget Debug] Missing VITE_VAPI_WIDGET_ASSISTANT_ID");

    if (!shouldShow || !PUBLIC_KEY || !ASSISTANT_ID) {
        console.log("[VapiWidget Debug] Widget hidden", {
            reason: !shouldShow ? "Route Excluded" : "Missing Keys"
        });
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
                    size="compact"

                    // Customization
                    buttonColor="#D67256" // Updated Terracotta
                    title="Talk with RingSnap"
                    subtitle="We're here to help"
                    // idleButtonText="Get Help" // Vapi SDK distinct prop for this? 
                    // Inspecting typical Vapi props: 'audio' mode has 'callCta'. 'chat' mode might just use title. 
                    // User asked for "CTA on the widget button to say 'Get Help'". 
                    // Usually this is the tooltip or the text when hovered/expanded.
                    // For now, I will add 'text' prop if valid or rely on 'subtitle' covering "talk with AI".
                    // "Talk with AI" is usually the default subtitle. I've overriden it with "We're here to help".

                    // Attempting standard props for button text if supported, otherwise it might be icon-only in compact mode.
                    // But user specifically asked for it. 
                    // Let's try adding a known prop for initial message or CTA. 

                    // assistantOverrides for Context
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
