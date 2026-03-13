import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  accent?: "default" | "green" | "red" | "amber" | "blue";
  className?: string;
}

export function AdminKpiCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  accent = "default",
  className,
}: AdminKpiCardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColor =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
      ? "text-red-400"
      : "text-gray-500";

  const accentColor = {
    default: "text-gray-100",
    green: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
  }[accent];

  return (
    <div
      className={cn(
        "bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-2",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <span className="text-gray-600">{icon}</span>
        )}
      </div>

      <div className={cn("text-2xl font-bold font-mono tabular-nums", accentColor)}>
        {value}
      </div>

      <div className="flex items-center gap-2 min-h-4">
        {subtitle && (
          <span className="text-xs text-gray-500">{subtitle}</span>
        )}
        {trend && trendValue && (
          <span className={cn("text-xs flex items-center gap-0.5 font-medium", trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
