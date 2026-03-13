import { NavLink, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  BarChart3,
  FlaskConical,
  Phone,
  ShieldAlert,
  Settings,
  UserCog,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminTab =
  | "overview"
  | "accounts"
  | "billing"
  | "margins"
  | "trials"
  | "calls"
  | "alerts"
  | "settings"
  | "staff";

interface NavItem {
  tab: AdminTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    tab: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "KPIs at a glance",
  },
  {
    tab: "accounts",
    label: "Users & Accounts",
    icon: Users,
    description: "All customers",
  },
  {
    tab: "billing",
    label: "Billing & Revenue",
    icon: DollarSign,
    description: "MRR, plans, payments",
  },
  {
    tab: "margins",
    label: "COGS & Margins",
    icon: BarChart3,
    description: "Per-customer cost",
  },
  {
    tab: "trials",
    label: "Trials & Conversion",
    icon: FlaskConical,
    description: "Trial pipeline",
  },
  {
    tab: "calls",
    label: "Call Activity",
    icon: Phone,
    description: "Volume, minutes, cost",
  },
  {
    tab: "alerts",
    label: "Abuse & Alerts",
    icon: ShieldAlert,
    description: "Flags, errors, disputes",
  },
  {
    tab: "settings",
    label: "Settings & Config",
    icon: Settings,
    description: "Plans, flags, thresholds",
  },
  {
    tab: "staff",
    label: "Staff Management",
    icon: UserCog,
    description: "Internal team roles",
  },
];

interface AdminSidebarProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  alertCount?: number;
}

export function AdminSidebar({ activeTab, onTabChange, alertCount = 0 }: AdminSidebarProps) {
  return (
    <aside className="w-56 shrink-0 flex flex-col bg-gray-900 border-r border-gray-800 min-h-screen">
      {/* Logo / brand */}
      <div className="px-4 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-100">RingSnap</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Admin</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ tab, label, icon: Icon, description }) => {
          const isActive = activeTab === tab;
          const showBadge = tab === "alerts" && alertCount > 0;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors group",
                isActive
                  ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                  : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-blue-400" : "text-gray-500 group-hover:text-gray-300")} />
              <span className="flex-1 text-sm font-medium leading-none">{label}</span>
              {showBadge && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-red-600 text-[10px] text-white font-bold flex items-center justify-center">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
              {isActive && <ChevronRight className="h-3 w-3 text-blue-400 shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800">
        <p className="text-[10px] text-gray-600">Internal tool · admin only</p>
      </div>
    </aside>
  );
}
