
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { AssistantConfig } from "@/types/assistant-config";
import { Send, Bot, User, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface GuidedSetupChatProps {
    currentConfig: AssistantConfig;
    onConfigUpdate: (newConfig: AssistantConfig) => void;
    onCancel: () => void;
}

interface Message {
    role: "assistant" | "user";
    content: string;
    proposedConfig?: AssistantConfig;
}

export function GuidedSetupChat({ currentConfig, onConfigUpdate, onCancel }: GuidedSetupChatProps) {
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hi! I'm your AI Setup Assistant. I can help you customize your receptionist. Tell me about your business.\n\nFor example: \"We are a plumbing company in Denver, and I want a friendly tone.\""
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setLoading(true);

        try {
            // Call Edge Function
            const { data, error } = await supabase.functions.invoke('assistant-chat', {
                body: {
                    currentConfig,
                    messages: [...messages, { role: "user", content: userMsg }].map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                }
            });

            if (error) throw error;

            if (data && data.reply) {
                setMessages(prev => [
                    ...prev,
                    {
                        role: "assistant",
                        content: data.reply,
                        proposedConfig: data.proposedConfig
                    }
                ]);
            } else {
                throw new Error("Invalid response from assistant");
            }

        } catch (error: any) {
            console.error("Chat error:", error);
            toast({
                title: "Error",
                description: "Failed to get response from AI assistant. Please try again.",
                variant: "destructive"
            });
            setMessages(prev => [...prev, { role: "assistant", content: "I'm sorry, I had trouble processing that. Could you try saying it differently?" }]);
        } finally {
            setLoading(false);
        }
    };

    const handeApplyConfig = (config: AssistantConfig) => {
        onConfigUpdate(config);
        toast({
            title: "Configuration Applied",
            description: "Your assistant settings have been updated.",
        });
        // Optionally add a system message
        setMessages(prev => [...prev, { role: "assistant", content: "Great! I've applied those changes. What else would you like to adjust?" }]);
    };

    return (
        <div className="flex flex-col h-[600px] border rounded-lg bg-background">
            {/* Header */}
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">AI Setup Assistant</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={onCancel}>Close</Button>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    }`}
                            >
                                {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                            </div>
                            <div className="space-y-2 max-w-[80%]">
                                <div
                                    className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${msg.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                                {msg.proposedConfig && (
                                    <Card className="p-3 border-primary/30 bg-primary/5">
                                        <div className="flex items-center gap-2 mb-2 text-primary font-semibold text-xs uppercase">
                                            <Sparkles className="h-3 w-3" />
                                            Proposed Changes
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            Based on our chat, I've prepared a new configuration properly formatted for your assistant.
                                        </p>
                                        <Button
                                            size="sm"
                                            className="w-full"
                                            onClick={() => handeApplyConfig(msg.proposedConfig!)}
                                        >
                                            Review & Apply Changes
                                        </Button>
                                    </Card>
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                <Bot className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="bg-muted p-3 rounded-lg flex items-center">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t bg-background">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2"
                >
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        disabled={loading}
                        autoFocus
                    />
                    <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
