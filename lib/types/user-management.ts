import type { User, UserRole } from "./auth";

/**
 * User with detailed information including relations and statistics
 */
export interface UserWithDetails extends User {
  // Relations
  user_mailbox_assignments: UserMailboxAssignmentWithMailbox[];

  // Computed fields
  assignment_count?: number;
  last_activity?: string | null;
  email_count?: number;
}

/**
 * User mailbox assignment with mailbox details
 */
export interface UserMailboxAssignmentWithMailbox {
  id: string;
  user_id: string;
  mailbox_id: string;
  assigned_at: string;
  assigned_by: string;
  mailboxes: {
    id: string;
    email_address: string;
    display_name: string | null;
    is_active: boolean;
  };
}

/**
 * User activity/audit trail entry
 */
export interface UserActivity {
  id: string;
  user_id: string;
  action:
    | "login"
    | "logout"
    | "created"
    | "updated"
    | "deleted"
    | "assigned"
    | "unassigned";
  details: Record<string, unknown>;
  created_at: string;
  ip_address?: string | null;
}

/**
 * User statistics and metrics
 */
export interface UserStatistics {
  user_id: string;
  emails_sent: number;
  emails_tracked: number;
  response_rate: number;
  active_followups: number;
  last_activity: string;
  mailboxes_assigned: number;
}

/**
 * User dashboard metrics
 */
export interface UserDashboardMetrics {
  total_emails_tracked: number;
  emails_with_responses: number;
  active_followups: number;
  response_rate: number;
  mailboxes_count: number;
}

/**
 * User filters for listing and searching
 */
export interface UserFilters {
  isActive?: boolean;
  role?: UserRole;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * User creation data with validation
 */
export interface UserCreateData {
  email: string;
  full_name: string;
  role: UserRole;
  timezone?: string;
  is_active?: boolean;
}

/**
 * User update data
 */
export interface UserUpdateData {
  email?: string;
  full_name?: string;
  role?: UserRole;
  timezone?: string;
  is_active?: boolean;
}

/**
 * User search result (minimal data for autocomplete/search)
 */
export interface UserSearchResult {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

/**
 * User assignment operation result
 */
export interface UserAssignmentResult {
  success: boolean;
  assigned_count: number;
  failed_assignments: string[];
  message: string;
}

/**
 * Bulk user operations result
 */
export interface BulkUserOperationResult {
  success: boolean;
  processed_count: number;
  failed_operations: Array<{
    user_id: string;
    error: string;
  }>;
  message: string;
}

/**
 * User import/export data structure
 */
export interface UserImportData {
  email: string;
  full_name: string;
  role: UserRole;
  timezone?: string;
  mailboxes?: string[]; // Email addresses of mailboxes to assign
}

/**
 * User export data structure (includes additional computed fields)
 */
export interface UserExportData {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  mailboxes_count: number;
  assigned_mailboxes: string; // Comma-separated list of email addresses
  last_activity: string | null;
}

/**
 * User role with descriptions and permissions
 */
export interface UserRoleInfo {
  value: UserRole;
  label: string;
  description: string;
  permissions: string[];
  color: "blue" | "green" | "purple" | "orange";
}

/**
 * User status info for display
 */
export interface UserStatusInfo {
  is_active: boolean;
  label: string;
  color: "green" | "red" | "gray";
  description: string;
}

/**
 * API response types for user operations
 */
export interface UserApiResponse<T = unknown> {
  data?: T;
  error?: string;
  success: boolean;
  message?: string;
}

export interface PaginatedUserResponse
  extends UserApiResponse<UserWithDetails[]> {
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * User role definitions with metadata
 */
export const USER_ROLES: Record<UserRole, UserRoleInfo> = {
  administrateur: {
    value: "administrateur",
    label: "Administrateur",
    description:
      "Accès complet au système, gestion des utilisateurs et configuration",
    permissions: [
      "Gérer tous les utilisateurs",
      "Configurer le système",
      "Accéder à toutes les mailboxes",
      "Gérer les templates et relances",
      "Consulter toutes les statistiques",
    ],
    color: "purple",
  },
  manager: {
    value: "manager",
    label: "Manager",
    description: "Gestion des équipes et supervision des emails",
    permissions: [
      "Gérer les utilisateurs de son équipe",
      "Accéder aux mailboxes assignées",
      "Consulter les statistiques d'équipe",
      "Gérer les relances",
    ],
    color: "blue",
  },
  utilisateur: {
    value: "utilisateur",
    label: "Utilisateur",
    description: "Accès aux mailboxes assignées uniquement",
    permissions: [
      "Accéder aux mailboxes assignées",
      "Consulter ses propres statistiques",
      "Gérer le suivi de ses emails",
    ],
    color: "green",
  },
};

/**
 * User status definitions
 */
export const USER_STATUSES: Record<string, UserStatusInfo> = {
  active: {
    is_active: true,
    label: "Actif",
    color: "green",
    description: "Utilisateur actif pouvant accéder au système",
  },
  inactive: {
    is_active: false,
    label: "Inactif",
    color: "red",
    description: "Utilisateur désactivé, accès suspendu",
  },
};

/**
 * Available timezones for user configuration
 */
export const USER_TIMEZONES = [
  { value: "Europe/Paris", label: "Paris (UTC+1/+2)" },
  { value: "Europe/London", label: "Londres (UTC+0/+1)" },
  { value: "America/New_York", label: "New York (UTC-5/-4)" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC-8/-7)" },
  { value: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { value: "Australia/Sydney", label: "Sydney (UTC+10/+11)" },
  { value: "UTC", label: "UTC (Temps universel)" },
] as const;

/**
 * User activity action types with descriptions
 */
export const USER_ACTIVITY_ACTIONS = {
  created: { label: "Créé", color: "green" },
  updated: { label: "Modifié", color: "blue" },
  deleted: { label: "Supprimé", color: "red" },
  login: { label: "Connexion", color: "gray" },
  logout: { label: "Déconnexion", color: "gray" },
  assigned: { label: "Assignation", color: "purple" },
  unassigned: { label: "Désassignation", color: "orange" },
} as const;
