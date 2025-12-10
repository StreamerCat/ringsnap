
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssistantConfig } from "@/types/assistant-config";
import { Sparkles, Edit3 } from "lucide-react";

interface OverviewPanelProps {
    config: AssistantConfig;
    onStartGuidedSetup: () => void;
}

export function OverviewPanel({ config, onStartGuidedSetup }: OverviewPanelProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Hero Section */}
            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            Tune your Assistant
                        </h3>
                        <p className="text-muted-foreground">
                            Use our AI guided setup to perfectly match your business voice and rules.
                        </p>
                    </div>
                    <Button onClick={onStartGuidedSetup} size="lg" className="shrink-0">
                        Start Guided Setup
                    </Button>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium text-muted-foreground uppercase tracking-wide">Identity & Tone</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <span className="text-sm font-semibold">Business Name</span>
                            <p>{config.business.name}</p>
                        </div>
                        <div>
                            <span className="text-sm font-semibold">Tone Style</span>
                            <p className="capitalize flex items-center gap-2">
                                {config.tone.style.replace('_', ' ')}
                                {config.tone.humorAllowed && <Badge variant="outline" className="text-xs">Humor</Badge>}
                            </p>
                        </div>
                        <div>
                            <span className="text-sm font-semibold">Services</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {config.business.services.length > 0 ? (
                                    config.business.services.map(s => <Badge key={s} variant="secondary">{s}</Badge>)
                                ) : (
                                    <span className="text-muted-foreground text-sm">No specific services listed</span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-medium text-muted-foreground uppercase tracking-wide">Operations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <span className="text-sm font-semibold">Scheduling</span>
                            <p className="capitalize">{config.scheduling.mode.replace('_', ' ')}</p>
                        </div>
                        <div>
                            <span className="text-sm font-semibold">Emergencies</span>
                            <p className="text-sm text-muted-foreground">{config.emergencies.scriptSummary}</p>
                        </div>
                        <div>
                            <span className="text-sm font-semibold">Collecting Info</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {config.intake.requiredFields.map(f => (
                                    <Badge key={f} variant="outline" className="border-primary/50">{f}</Badge>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
