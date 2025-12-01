import { cn } from "@/lib/utils";

export type MessageRole = "assistant" | "user";

export interface ChatMessageProps {
  role: MessageRole;
  content: string | React.ReactNode;
  timestamp?: Date;
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isAssistant = role === "assistant";

  return (
    <div
      className={cn(
        "flex gap-3 mb-4 animate-in slide-in-from-bottom-2 duration-300",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {isAssistant && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
          AI
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isAssistant
            ? "bg-muted text-foreground"
            : "bg-primary text-primary-foreground"
        )}
      >
        {typeof content === "string" ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          content
        )}
        {timestamp && (
          <p className="text-xs opacity-60 mt-1">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
      {!isAssistant && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-semibold">
          U
        </div>
      )}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
        AI
      </div>
      <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-muted">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
