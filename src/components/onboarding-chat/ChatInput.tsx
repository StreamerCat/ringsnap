import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

export interface ChatInputProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: "text" | "email" | "tel" | "url";
  autoFocus?: boolean;
  allowEmpty?: boolean;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

export function ChatInput({
  onSubmit,
  placeholder = "Type your answer...",
  disabled,
  type = "text",
  autoFocus = true,
  allowEmpty = false,
  ...props
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((allowEmpty || value.trim()) && !disabled) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 animate-in slide-in-from-bottom-2 duration-300">
      <Input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={props.maxLength}
        inputMode={props.inputMode}
        className="flex-1"
        data-testid="chat-input"
      />
      <Button
        type="submit"
        size="icon"
        disabled={(!allowEmpty && !value.trim()) || disabled}
        data-testid="chat-send-button"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
