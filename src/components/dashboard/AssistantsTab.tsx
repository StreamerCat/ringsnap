import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AssistantCard } from "@/components/AssistantCard";
import { StudioLayout } from "./AssistantStudio/StudioLayout";

interface AssistantsTabProps {
    account: any;
    assistants: any[];
}

export function AssistantsTab({ account, assistants }: AssistantsTabProps) {
    const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);

    const selectedAssistant = assistants.find(a => a.id === selectedAssistantId);

    if (selectedAssistant) {
        return (
            <StudioLayout
                assistant={selectedAssistant}
                account={account}
                onBack={() => setSelectedAssistantId(null)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Your RingSnap Agents</h2>
                <Button disabled={account.plan_type !== 'premium'}>
                    {account.plan_type === 'premium' ? 'Add Agent' : 'Premium Feature'}
                </Button>
            </div>

            {assistants.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        No agents yet. Your agent will appear here after setup.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {assistants.map((assistant) => (
                        <AssistantCard
                            key={assistant.id}
                            name={assistant.name}
                            gender={assistant.voice_gender || 'female'}
                            status={assistant.status}
                            customInstructions={assistant.custom_instructions}
                            onEdit={() => setSelectedAssistantId(assistant.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
