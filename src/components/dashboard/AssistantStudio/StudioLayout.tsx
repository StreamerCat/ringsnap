
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AssistantConfig, DEFAULT_ASSISTANT_CONFIG } from "@/types/assistant-config";
import { OverviewPanel } from "./OverviewPanel";
import { GuidedSetupChat } from "./GuidedSetupChat";
import { AdvancedSettingsForm } from "./AdvancedSettingsForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface StudioLayoutProps {
    assistant: any;
    account: any;
    onBack: () => void;
}

export function StudioLayout({ assistant, account, onBack }: StudioLayoutProps) {
    const { toast } = useToast();
    const [config, setConfig] = useState<AssistantConfig>(
        (assistant.assistant_config as AssistantConfig) || DEFAULT_ASSISTANT_CONFIG
    );
    const [activeTab, setActiveTab] = useState("overview");
    const [saving, setSaving] = useState(false);

    const handleConfigUpdate = async (newConfig: AssistantConfig) => {
        setSaving(true);
        // Persist to DB
        try {
            // 1. Update local state
            setConfig(newConfig);

            // 2. Save to DB
            const { error } = await supabase
                .from('assistants')
                .update({ assistant_config: newConfig as any } as any) // Cast to any as JSONB
                .eq('id', assistant.id);

            if (error) throw error;

            // 3. Trigger a Vapi Re-provision or Update (Mocked for now)
            // In real impl, we might call an edge function here to sync to Vapi immediately
            toast({ title: "Saved", description: "Assistant configuration updated." });

            // Switch back to overview if coming from guided
            setActiveTab("overview");

        } catch (error: any) {
            console.error("Failed to save config:", error);
            toast({
                title: "Save Failed",
                description: "Could not save configuration. " + error.message,
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold">{assistant.name}</h2>
                    <p className="text-muted-foreground text-sm">Assistant Studio</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                {activeTab !== 'guided' && (
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
                    </TabsList>
                )}

                <TabsContent value="overview" className="mt-6">
                    <OverviewPanel
                        config={config}
                        onStartGuidedSetup={() => setActiveTab("guided")}
                    />
                </TabsContent>

                <TabsContent value="guided" className="mt-6">
                    <GuidedSetupChat
                        currentConfig={config}
                        onConfigUpdate={handleConfigUpdate}
                        onCancel={() => setActiveTab("overview")}
                    />
                </TabsContent>

                <TabsContent value="advanced" className="mt-6">
                    <AdvancedSettingsForm
                        config={config}
                        isPremium={['pro', 'premium'].includes(account.plan_type)}
                        onUpdate={handleConfigUpdate}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
