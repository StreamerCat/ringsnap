import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignupButtonProps extends Omit<ButtonProps, 'asChild'> {
  isLoading?: boolean;
  children: React.ReactNode;
}

export const SignupButton = ({
  isLoading,
  children,
  className,
  variant,
  size,
  ...props
}: SignupButtonProps) => {
  return (
    <Button
      variant={variant}
      size={size}
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
