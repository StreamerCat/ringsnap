import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChatButtonOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
  description?: string;
}

export interface ChatButtonsProps {
  options: ChatButtonOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  layout?: "vertical" | "horizontal" | "grid";
}

export function ChatButtons({ options, onSelect, disabled, layout = "vertical" }: ChatButtonsProps) {
  return (
    <div
      className={cn(
        "flex gap-2 animate-in slide-in-from-bottom-2 duration-300",
        layout === "vertical" && "flex-col",
        layout === "horizontal" && "flex-row flex-wrap",
        layout === "grid" && "grid grid-cols-2 gap-3"
      )}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          variant="outline"
          size={layout === "grid" ? "lg" : "default"}
          disabled={disabled}
          onClick={() => onSelect(option.value)}
          className={cn(
            "justify-start text-left h-auto",
            layout === "grid" && "flex-col items-start py-4"
          )}
        >
          {option.icon && (
            <span className={cn("mr-2", layout === "grid" && "mb-2 mr-0")}>
              {option.icon}
            </span>
          )}
          <div className="flex flex-col">
            <span className="font-medium">{option.label}</span>
            {option.description && (
              <span className="text-xs text-muted-foreground font-normal mt-1">
                {option.description}
              </span>
            )}
          </div>
        </Button>
      ))}
    </div>
  );
}
