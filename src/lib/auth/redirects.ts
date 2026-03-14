import { supabase } from "@/integrations/supabase/client";

export interface UserRole {
  isCustomer: boolean;
  isStaff: boolean;
  isSales: boolean;
  isPlatformAdmin: boolean;
  isPlatformOwner: boolean;
  staffRole?: string;
}

/**
 * Get the user's role information
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  // Use maybeSingle() so a missing row returns {data: null, error: null}
  // rather than a PGRST116 error — we only want to throw on real DB errors
  // (e.g. infinite recursion 42P17) so the caller can handle them explicitly
  // instead of silently falling back to the customer role.
  const { data: staffRole, error } = await supabase
    .from('staff_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    // Real query error (RLS recursion, permission denied, etc.) — propagate so
    // the caller can decide what to do rather than silently misidentifying the user.
    throw error;
  }

  if (staffRole) {
    return {
      isCustomer: false,
      isStaff: true,
      isSales: staffRole.role === 'sales',
      isPlatformAdmin: staffRole.role === 'platform_admin',
      isPlatformOwner: staffRole.role === 'platform_owner',
      staffRole: staffRole.role
    };
  }

  // No staff row found — this user is a customer.
  return {
    isCustomer: true,
    isStaff: false,
    isSales: false,
    isPlatformAdmin: false,
    isPlatformOwner: false
  };
}

/**
 * Get the appropriate dashboard URL based on user role
 */
export function getRoleDashboardUrl(role: UserRole): string {
  // Platform owners/admins go to admin control center
  if (role.isPlatformOwner || role.isPlatformAdmin) {
    return '/admin';
  }

  // Sales goes to sales dashboard
  if (role.isSales) {
    return '/salesdash';
  }

  // Staff (support, viewer, etc.) go to admin control center
  if (role.isStaff) {
    return '/admin';
  }

  // Customers go to customer dashboard
  return '/dashboard';
}

/**
 * Redirect user to appropriate dashboard based on their role and onboarding status
 */
export async function redirectToRoleDashboard(userId: string): Promise<string> {
  let role: UserRole;
  try {
    role = await getUserRole(userId);
  } catch (error) {
    // The staff_roles query failed (likely RLS recursion in the database).
    // We cannot safely determine the user's role, so send them to the home
    // page rather than silently mis-routing them to the customer dashboard.
    console.error('[redirectToRoleDashboard] Role check failed — cannot determine dashboard:', error);
    return '/';
  }

  // For customers, check onboarding status
  if (role.isCustomer) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_status')
        .eq('id', userId)
        .maybeSingle();

      // If no profile found or onboarding not active, redirect to onboarding
      if (!profile || profile.onboarding_status !== 'active') {
        return '/onboarding';
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // On error, default to onboarding to be safe
      return '/onboarding';
    }
  }

  return getRoleDashboardUrl(role);
}
