/**
 * AdminControl — RingSnap Internal Admin Control Center
 *
 * Single-page admin dashboard with sidebar navigation.
 * Route: /admin
 *
 * Auth: Requires platform_owner or platform_admin role in staff_roles table.
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar, type AdminTab } from "@/components/admin/AdminSidebar";
import { OverviewTab } from "@/components/admin/tabs/OverviewTab";
import { AccountsTab } from "@/components/admin/tabs/AccountsTab";
import { BillingTab } from "@/components/admin/tabs/BillingTab";
import { MarginsTab } from "@/components/admin/tabs/MarginsTab";
import { TrialsTab } from "@/components/admin/tabs/TrialsTab";
import { CallsTab } from "@/components/admin/tabs/CallsTab";
import { AlertsTab } from "@/components/admin/tabs/AlertsTab";
import { StaffTab } from "@/components/admin/tabs/StaffTab";
import { SettingsTab } from "@/components/admin/tabs/SettingsTab";
import { useAdminFlaggedAccounts, useAdminProvisioningFailures } from "@/hooks/useAdminData";

const TAB_COMPONENTS: Record<AdminTab, React.ComponentType> = {
  overview: OverviewTab,
  accounts: AccountsTab,
  billing: BillingTab,
  margins: MarginsTab,
  trials: TrialsTab,
  calls: CallsTab,
  alerts: AlertsTab,
  settings: SettingsTab,
  staff: StaffTab,
};

function useAlertCount(): number {
  const { data: flagged = [] } = useAdminFlaggedAccounts();
  const { data: failures = [] } = useAdminProvisioningFailures();
  return flagged.length + failures.length;
}

export default function AdminControl() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const rawTab = searchParams.get("tab") as AdminTab | null;
  const activeTab: AdminTab =
    rawTab && rawTab in TAB_COMPONENTS ? rawTab : "overview";

  const alertCount = useAlertCount();

  // Auth verification
  useEffect(() => {
    const verifyAccess = async () => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          // Not authenticated — redirect to login with return path
          navigate("/auth/login?redirect=/admin", { replace: true });
          return;
        }

        const { data: staffRole, error } = await supabase
          .from("staff_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          // Permission or query error — show error state, don't redirect to login
          // (redirecting would cause a loop since the user IS authenticated)
          console.error("Admin role check error:", error);
          setAuthError(`Role check failed: ${error.message}`);
          setIsAuthorized(false);
          return;
        }

        const role = staffRole?.role;
        const hasAccess = role === "platform_owner" || role === "platform_admin";
        setIsAuthorized(hasAccess);
      } catch (err) {
        console.error("Admin auth error", err);
        setAuthError("Unexpected error checking admin access.");
        setIsAuthorized(false);
      } finally {
        setAuthLoading(false);
      }
    };

    verifyAccess();
  }, [navigate]);

  const handleTabChange = (tab: AdminTab) => {
    setSearchParams({ tab });
    setSidebarOpen(false); // close mobile sidebar on navigate
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // Unauthorized state
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-sm w-full text-center">
          <div className="h-12 w-12 rounded-full bg-red-900/30 border border-red-800/40 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-100 mb-2">Access Denied</h2>
          {authError ? (
            <p className="text-sm text-red-400 mb-6">{authError}</p>
          ) : (
            <p className="text-sm text-gray-500 mb-6">
              You need <code className="text-gray-300 bg-gray-800 px-1 rounded">platform_owner</code> or{" "}
              <code className="text-gray-300 bg-gray-800 px-1 rounded">platform_admin</code> role to access
              the admin control center.
            </p>
          )}
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm transition-colors"
          >
            Return home
          </button>
        </div>
      </div>
    );
  }

  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="min-h-screen bg-gray-950 flex text-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop persistent, mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform lg:relative lg:translate-x-0 lg:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <AdminSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          alertCount={alertCount}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile only) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-gray-200 capitalize">
            {activeTab.replace(/_/g, " ")}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <ActiveTabComponent />
        </main>
      </div>
    </div>
  );
}
