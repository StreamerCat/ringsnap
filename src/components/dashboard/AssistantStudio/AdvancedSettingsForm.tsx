
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { AssistantConfig } from "@/types/assistant-config";

interface AdvancedSettingsFormProps {
    config: AssistantConfig;
    isPremium: boolean;
    onUpdate: (config: AssistantConfig) => void;
}

export function AdvancedSettingsForm({ config, isPremium, onUpdate }: AdvancedSettingsFormProps) {
    if (!isPremium) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 border rounded-lg bg-muted/10">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold">Advanced Settings Locked</h3>
                <p className="text-muted-foreground max-w-sm">
                    Upgrade to Pro or Premium to access manual configuration controls, custom rules, and advanced prompt engineering.
                </p>
                <Button variant="default">Upgrade Plan</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Alert>
                <AlertTitle>Power User Mode</AlertTitle>
                <AlertDescription>
                    You can manually edit the configuration below. Changes are validated before saving.
                </AlertDescription>
            </Alert>

            <div className="p-12 text-center text-muted-foreground border border-dashed rounded-lg">
                Advanced editor form coming soon. Use the Guided Setup for now.
            </div>
        </div>
    );
}
