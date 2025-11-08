import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignupButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  children: React.ReactNode;
}

export const SignupButton = ({
  isLoading,
  children,
  className,
  ...props
}: SignupButtonProps) => {
  return (
    <Button
      {...props}
      disabled={isLoading || props.disabled}
      className={cn("h-12 text-base font-semibold", className)}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Processing...
        </>
      ) : (
        children
      )}
    </Button>
  );
};
