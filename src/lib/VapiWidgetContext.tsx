
import { createContext, useContext, useState, ReactNode } from "react";

interface VapiWidgetContextType {
    setWidgetContext: (context: Record<string, any>) => void;
    widgetContext: Record<string, any>;
}

const VapiWidgetContext = createContext<VapiWidgetContextType | undefined>(undefined);

export function VapiWidgetProvider({ children }: { children: ReactNode }) {
    const [widgetContext, setWidgetContext] = useState<Record<string, any>>({});

    return (
        <VapiWidgetContext.Provider value={{ widgetContext, setWidgetContext }}>
            {children}
        </VapiWidgetContext.Provider>
    );
}

export function useVapiWidget() {
    const context = useContext(VapiWidgetContext);
    if (context === undefined) {
        throw new Error("useVapiWidget must be used within a VapiWidgetProvider");
    }
    return context;
}
