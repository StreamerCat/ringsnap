import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignupInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  isValid?: boolean;
  showValidation?: boolean;
}

export const SignupInput = ({
  label,
  error,
  isValid,
  showValidation = true,
  className,
  ...props
}: SignupInputProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={props.id} className="text-sm font-medium">
          {label}
        </Label>
        {showValidation && isValid && !error && (
          <Check className="h-4 w-4 text-green-500" />
        )}
        {error && (
          <AlertCircle className="h-4 w-4 text-red-500" />
        )}
      </div>
      <Input
        {...props}
        className={cn(
          "h-12 text-base",
          error && "border-red-500 focus-visible:ring-red-500",
          isValid && !error && "border-green-500",
          className
        )}
      />
      {error && (
        <p className="text-sm text-red-500 flex items-start gap-1">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
};
