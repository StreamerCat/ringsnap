/**
 * Role-based access control helpers
 */

/**
 * Check if a user has permission to access a resource based on their staff role.
 *
 * Platform owners and platform admins always have access.
 * Other users must have one of the specified allowed roles.
 *
 * @param userRole - The user's staff role (from staff_roles table), or undefined if they have no staff role
 * @param allowedRoles - Array of roles that are allowed to access the resource (e.g., ['sales'])
 * @returns true if the user has permission, false otherwise
 *
 * @example
 * // Check if user can access sales dashboard
 * const canAccess = hasRoleAccess(userRole, ['sales']);
 *
 * @example
 * // Check if user can access admin features
 * const canAccess = hasRoleAccess(userRole, ['platform_admin', 'platform_owner']);
 */
export function hasRoleAccess(
  userRole: string | undefined | null,
  allowedRoles: string[]
): boolean {
  // No role means no access
  if (!userRole) {
    return false;
  }

  // Platform owners and admins always have access
  if (userRole === 'platform_owner' || userRole === 'platform_admin') {
    return true;
  }

  // Check if user has one of the allowed roles
  return allowedRoles.includes(userRole);
}
