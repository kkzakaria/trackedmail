import type { AuthUser, UserRole } from "@/lib/types/auth";

/**
 * Check if user has admin role
 */
export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === "administrateur";
}

/**
 * Check if user has admin or manager role
 */
export function isManagerOrAdmin(user: AuthUser | null): boolean {
  return user?.role === "administrateur" || user?.role === "manager";
}

/**
 * Check if user has specific role
 */
export function hasRole(user: AuthUser | null, role: UserRole): boolean {
  return user?.role === role;
}

/**
 * Check if user can perform admin actions
 */
export function canPerformAdminActions(user: AuthUser | null): boolean {
  return isAdmin(user);
}

/**
 * Check if user can manage mailboxes
 */
export function canManageMailboxes(user: AuthUser | null): boolean {
  return isManagerOrAdmin(user);
}
