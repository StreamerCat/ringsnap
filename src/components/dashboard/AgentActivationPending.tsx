import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Clock, Phone, PhoneOff, Volume2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Vapi from "@vapi-ai/web";

interface AgentActivationPendingProps {
    account: {
        id: string;
        vapi_assistant_id?: string | null;
        provisioning_status?: string | null;
        company_name?: string | null;
    };
}

/**
 * Shown in the dashboard when provisioning_status is 'partially_provisioned'.
 * The Vapi assistant is created, but phone number provisioning is pending.
 *
 * Lets the user:
 *  - Preview/listen to their configured AI receptionist via browser call
 *  - See a clear "activation pending" status
 *  - Understand they'll be notified when the agent is live
 *  - NOT see any provider-specific details
 */
export function AgentActivationPending({ account }: AgentActivationPendingProps) {
    const [callState, setCallState] = useState<"idle" | "connecting" | "active" | "error">("idle");
    const vapiRef = useRef<Vapi | null>(null);

    const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
    const canPreview = !!account.vapi_assistant_id && !!publicKey;

    useEffect(() => {
        if (!canPreview) return;

        const vapi = new Vapi(publicKey);
        vapiRef.current = vapi;

        vapi.on("call-start", () => setCallState("active"));
        vapi.on("call-end", () => setCallState("idle"));
        vapi.on("error", () => {
            setCallState("error");
            setTimeout(() => setCallState("idle"), 3000);
        });

        return () => {
            vapi.stop();
        };
    }, [canPreview, publicKey]);

    const handlePreviewCall = async () => {
        if (!vapiRef.current || !account.vapi_assistant_id) return;

        if (callState === "active") {
            vapiRef.current.stop();
            setCallState("idle");
            return;
        }

        setCallState("connecting");
        try {
            await vapiRef.current.start(account.vapi_assistant_id);
        } catch {
            setCallState("error");
            setTimeout(() => setCallState("idle"), 3000);
        }
    };

    return (
        <Card className="border-blue-200 bg-blue-50/50 mb-6">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Bot className="h-5 w-5 text-blue-600" />
                        Agent Activation Pending
                    </CardTitle>
                    <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-100">
                        <Clock className="h-3 w-3 mr-1" />
                        Activating
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-slate-700">
                    Your AI receptionist is ready to preview. We&apos;re finishing activation
                    and will notify you as soon as your agent is live.
                </p>

                {/* Preview call button */}
                {canPreview && (
                    <div className="flex items-center gap-3">
                        <Button
                            variant={callState === "active" ? "destructive" : "default"}
                            size="sm"
                            onClick={handlePreviewCall}
                            disabled={callState === "connecting" || callState === "error"}
                        >
                            {callState === "idle" && (
                                <>
                                    <Volume2 className="h-4 w-4 mr-2" />
                                    Preview Your Agent
                                </>
                            )}
                            {callState === "connecting" && (
                                <>
                                    <Phone className="h-4 w-4 mr-2 animate-pulse" />
                                    Connecting...
                                </>
                            )}
                            {callState === "active" && (
                                <>
                                    <PhoneOff className="h-4 w-4 mr-2" />
                                    End Preview
                                </>
                            )}
                            {callState === "error" && "Try Again"}
                        </Button>
                        {callState === "idle" && (
                            <span className="text-xs text-slate-500">
                                Talk to your AI receptionist in the browser
                            </span>
                        )}
                    </div>
                )}

                {/* What's pending */}
                <Alert className="bg-white border-blue-100">
                    <AlertDescription className="text-xs text-slate-600 space-y-1">
                        <p className="font-medium text-slate-700">What&apos;s happening:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li>Your AI receptionist configuration is saved</li>
                            <li>Your dedicated phone number is being finalized</li>
                            <li>You&apos;ll receive an email when your agent is live</li>
                        </ul>
                    </AlertDescription>
                </Alert>

                {/* Disabled live-call notice */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <PhoneOff className="h-3 w-3" />
                    <span>Live call handling will be enabled once activation is complete</span>
                </div>
            </CardContent>
        </Card>
    );
}
