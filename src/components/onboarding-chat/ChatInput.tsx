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

function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (type === "tel") {
      setValue(formatPhoneNumber(e.target.value));
    } else {
      setValue(e.target.value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((allowEmpty || value.trim()) && !disabled) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} action="javascript:void(0);" className="flex gap-2 animate-in slide-in-from-bottom-2 duration-300">
      <Input
        type={type}
        value={value}
        onChange={handleChange}
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
