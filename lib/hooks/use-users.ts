"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserRole } from "@/lib/types/auth";
import type {
  UserFilters,
  UserWithDetails,
  UserStatistics,
  UserDashboardMetrics,
  UserActivity,
  UserCreateData,
  UserUpdateData,
  UserAssignmentResult,
  PaginatedUserResponse,
} from "@/lib/types/user-management";

// Query keys
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), { filters }] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  statistics: (id: string) => [...userKeys.all, "statistics", id] as const,
  activity: (id: string) => [...userKeys.all, "activity", id] as const,
  dashboardMetrics: (id: string) => [...userKeys.all, "dashboard", id] as const,
  search: (term: string) => [...userKeys.all, "search", term] as const,
  byRole: (role: UserRole) => [...userKeys.all, "role", role] as const,
  assignable: () => [...userKeys.all, "assignable"] as const,
};

/**
 * Get all users with optional filters
 */
export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: userKeys.list(filters || {}),
    queryFn: async (): Promise<PaginatedUserResponse> => {
      const params = new URLSearchParams();
      if (filters?.isActive !== undefined)
        params.set("isActive", String(filters.isActive));
      if (filters?.role) params.set("role", filters.role);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.offset) params.set("offset", String(filters.offset));

      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la récupération des utilisateurs"
        );
      }

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a single user by ID with details
 */
export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async (): Promise<UserWithDetails> => {
      const response = await fetch(`/api/users/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la récupération de l'utilisateur"
        );
      }

      return data.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get user statistics
 */
export function useUserStatistics(id: string) {
  return useQuery({
    queryKey: userKeys.statistics(id),
    queryFn: async (): Promise<UserStatistics> => {
      const response = await fetch(`/api/users/${id}/statistics`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la récupération des statistiques"
        );
      }

      return data.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes for stats
  });
}

/**
 * Get user activity/audit trail
 */
export function useUserActivity(
  id: string,
  options?: { limit?: number; offset?: number }
) {
  return useQuery({
    queryKey: [...userKeys.activity(id), options],
    queryFn: async (): Promise<UserActivity[]> => {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      if (options?.offset) params.set("offset", String(options.offset));

      const response = await fetch(`/api/users/${id}/activity?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la récupération de l'activité"
        );
      }

      return data.data;
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute for activity
  });
}

/**
 * Get user dashboard metrics
 */
export function useUserDashboardMetrics(id: string) {
  return useQuery({
    queryKey: userKeys.dashboardMetrics(id),
    queryFn: async (): Promise<UserDashboardMetrics> => {
      const response = await fetch(`/api/users/${id}/dashboard-metrics`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la récupération des métriques"
        );
      }

      return data.data;
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds for real-time metrics
  });
}

/**
 * Search users by name or email
 */
export function useUserSearch(searchTerm: string, limit?: number) {
  return useQuery({
    queryKey: userKeys.search(searchTerm),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("q", searchTerm);
      if (limit) params.set("limit", String(limit));

      const response = await fetch(`/api/users/search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Erreur lors de la recherche"
        );
      }

      return data.data;
    },
    enabled: searchTerm.length >= 2, // Only search with 2+ characters
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Get users by role
 */
export function useUsersByRole(role: UserRole) {
  return useQuery({
    queryKey: userKeys.byRole(role),
    queryFn: async () => {
      const response = await fetch(`/api/users?role=${role}&isActive=true`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Erreur lors de la récupération"
        );
      }

      return data.data;
    },
    enabled: !!role,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get assignable users (managers and regular users)
 */
export function useAssignableUsers() {
  return useQuery({
    queryKey: userKeys.assignable(),
    queryFn: async () => {
      const response = await fetch("/api/users/assignable");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la récupération des utilisateurs assignables"
        );
      }

      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new user
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: UserCreateData) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la création de l'utilisateur"
        );
      }

      return data.data;
    },
    onSuccess: () => {
      // Invalidate user lists
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * Update a user
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UserUpdateData;
    }) => {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la mise à jour de l'utilisateur"
        );
      }

      return data.data;
    },
    onSuccess: data => {
      // Invalidate user lists and specific user
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: userKeys.statistics(data.id) });
    },
  });
}

/**
 * Soft delete a user
 */
export function useSoftDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la suppression de l'utilisateur"
        );
      }

      return { id, ...data.data };
    },
    onSuccess: data => {
      // Update cache with soft deleted user
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.setQueryData(userKeys.detail(data.id), {
        ...data,
        is_active: false,
      });
    },
  });
}

/**
 * Restore a soft-deleted user
 */
export function useRestoreUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}/restore`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la restauration de l'utilisateur"
        );
      }

      return data.data;
    },
    onSuccess: data => {
      // Update cache with restored user
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.setQueryData(userKeys.detail(data.id), {
        ...data,
        is_active: true,
      });
    },
  });
}

/**
 * Toggle user active status
 */
export function useToggleUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}/toggle-status`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la modification du statut de l'utilisateur"
        );
      }

      return data.data;
    },
    onSuccess: data => {
      // Update cache optimistically
      queryClient.setQueryData(userKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

/**
 * Assign mailbox to user
 */
export function useAssignMailboxToUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      mailboxId,
    }: {
      userId: string;
      mailboxId: string;
    }) => {
      const response = await fetch(`/api/users/${userId}/assign-mailbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mailboxId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de l'assignation de la mailbox"
        );
      }

      return data.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate user details to refresh assignments
      queryClient.invalidateQueries({
        queryKey: userKeys.detail(variables.userId),
      });
    },
  });
}

/**
 * Unassign mailbox from user
 */
export function useUnassignMailboxFromUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      mailboxId,
    }: {
      userId: string;
      mailboxId: string;
    }) => {
      const response = await fetch(`/api/users/${userId}/unassign-mailbox`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mailboxId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la désassignation de la mailbox"
        );
      }

      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate user details to refresh assignments
      queryClient.invalidateQueries({
        queryKey: userKeys.detail(variables.userId),
      });
    },
  });
}

/**
 * Bulk assign mailboxes to user
 */
export function useBulkAssignMailboxes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      mailboxIds,
    }: {
      userId: string;
      mailboxIds: string[];
    }): Promise<UserAssignmentResult> => {
      const response = await fetch(
        `/api/users/${userId}/bulk-assign-mailboxes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mailboxIds }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Erreur lors de l'assignation en lot"
        );
      }

      return data.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate user details to refresh assignments
      queryClient.invalidateQueries({
        queryKey: userKeys.detail(variables.userId),
      });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
