import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface UsageWarningAlertProps {
  usagePercent: number;
  remainingMinutes: number;
  onDismiss?: () => void;
}

export function UsageWarningAlert({ usagePercent, remainingMinutes, onDismiss }: UsageWarningAlertProps) {
  if (usagePercent < 80) return null;

  const getAlertConfig = () => {
    if (usagePercent >= 100) {
      return {
        variant: "destructive" as const,
        icon: XCircle,
        title: "Monthly Limit Reached",
        description: "You've used all your included minutes. Overage charges now apply.",
        bgColor: "bg-destructive/10",
        borderColor: "border-destructive"
      };
    } else if (usagePercent >= 95) {
      return {
        variant: "default" as const,
        icon: AlertCircle,
        title: "Almost At Limit",
        description: `Only ${remainingMinutes} minutes remaining this month. Consider upgrading.`,
        bgColor: "bg-orange-50 dark:bg-orange-950",
        borderColor: "border-orange-500"
      };
    } else {
      return {
        variant: "default" as const,
        icon: AlertTriangle,
        title: "Approaching Limit",
        description: `You've used ${usagePercent}% of your monthly minutes. ${remainingMinutes} minutes left.`,
        bgColor: "bg-yellow-50 dark:bg-yellow-950",
        borderColor: "border-yellow-500"
      };
    }
  };

  const config = getAlertConfig();
  const Icon = config.icon;

  return (
    <Alert variant={config.variant} className={`${config.bgColor} ${config.borderColor} border-2`}>
      <Icon className="h-5 w-5" />
      <div className="flex-1">
        <AlertTitle className="mb-2 font-bold">{config.title}</AlertTitle>
        <AlertDescription className="mb-3">
          {config.description}
        </AlertDescription>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" asChild>
            <Link to="/dashboard?tab=billing">Upgrade Plan</Link>
          </Button>
          {onDismiss && (
            <Button size="sm" variant="outline" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}
