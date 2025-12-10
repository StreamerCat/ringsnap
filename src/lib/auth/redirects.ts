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
  try {
    // Check if user has a staff role
    const { data: staffRole } = await supabase
      .from('staff_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

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

    // Default to customer
    return {
      isCustomer: true,
      isStaff: false,
      isSales: false,
      isPlatformAdmin: false,
      isPlatformOwner: false
    };
  } catch (error) {
    console.error('Error getting user role:', error);
    // Default to customer on error
    return {
      isCustomer: true,
      isStaff: false,
      isSales: false,
      isPlatformAdmin: false,
      isPlatformOwner: false
    };
  }
}

/**
 * Get the appropriate dashboard URL based on user role
 */
export function getRoleDashboardUrl(role: UserRole): string {
  // Platform owners/admins go to admin monitoring
  if (role.isPlatformOwner || role.isPlatformAdmin) {
    return '/admin/monitoring';
  }

  // Sales goes to sales dashboard
  if (role.isSales) {
    return '/salesdash';
  }

  // Staff (support, viewer, etc.) goes to admin monitoring
  if (role.isStaff) {
    return '/admin/monitoring';
  }

  // Customers go to customer dashboard
  return '/dashboard';
}

/**
 * Redirect user to appropriate dashboard based on their role and onboarding status
 */
export async function redirectToRoleDashboard(userId: string): Promise<string> {
  const role = await getUserRole(userId);

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
