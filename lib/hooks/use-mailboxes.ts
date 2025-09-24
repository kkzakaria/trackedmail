"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TablesInsert, TablesUpdate } from "@/lib/types/database.types";

// Query keys
export const mailboxKeys = {
  all: ["mailboxes"] as const,
  lists: () => [...mailboxKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...mailboxKeys.lists(), { filters }] as const,
  details: () => [...mailboxKeys.all, "detail"] as const,
  detail: (id: string) => [...mailboxKeys.details(), id] as const,
  userMailboxes: (userId: string) =>
    [...mailboxKeys.all, "user", userId] as const,
  statistics: (id: string) => [...mailboxKeys.all, "stats", id] as const,
};

/**
 * Get all mailboxes with optional filters
 */
export function useMailboxes(filters?: {
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: mailboxKeys.list(filters || {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.isActive !== undefined)
        params.set("isActive", String(filters.isActive));
      if (filters?.search) params.set("search", filters.search);
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.offset) params.set("offset", String(filters.offset));

      const response = await fetch(`/api/mailboxes?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Erreur lors de la récupération"
        );
      }

      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a single mailbox by ID
 */
export function useMailbox(id: string) {
  return useQuery({
    queryKey: mailboxKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/mailboxes/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Erreur lors de la récupération"
        );
      }

      return data.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get mailbox statistics
 */
export function useMailboxStatistics(id: string) {
  return useQuery({
    queryKey: mailboxKeys.statistics(id),
    queryFn: async () => {
      const response = await fetch(`/api/mailboxes/${id}/statistics`);
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
 * Get user's assigned mailboxes
 */
export function useUserMailboxes(userId: string) {
  return useQuery({
    queryKey: mailboxKeys.userMailboxes(userId),
    queryFn: async () => {
      const params = new URLSearchParams({ userId });
      const response = await fetch(`/api/mailboxes?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Erreur lors de la récupération"
        );
      }

      return data.data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a new mailbox
 */
export function useCreateMailbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mailbox: TablesInsert<"mailboxes">) => {
      const response = await fetch("/api/mailboxes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mailbox),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Erreur lors de la création"
        );
      }

      return data.data;
    },
    onSuccess: () => {
      // Invalidate mailbox lists
      queryClient.invalidateQueries({ queryKey: mailboxKeys.lists() });
    },
  });
}

/**
 * Update a mailbox
 */
export function useUpdateMailbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: TablesUpdate<"mailboxes">;
    }) => {
      const response = await fetch(`/api/mailboxes/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Erreur lors de la mise à jour"
        );
      }

      return data.data;
    },
    onSuccess: data => {
      // Invalidate mailbox lists and specific mailbox
      queryClient.invalidateQueries({ queryKey: mailboxKeys.lists() });
      queryClient.invalidateQueries({ queryKey: mailboxKeys.detail(data.id) });
      queryClient.invalidateQueries({
        queryKey: mailboxKeys.statistics(data.id),
      });
    },
  });
}

/**
 * Delete a mailbox
 */
export function useDeleteMailbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/mailboxes/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Erreur lors de la suppression"
        );
      }

      return data;
    },
    onSuccess: (_, deletedId) => {
      // Remove from cache and invalidate lists
      queryClient.removeQueries({ queryKey: mailboxKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: mailboxKeys.lists() });
    },
  });
}

/**
 * Toggle mailbox active status
 */
export function useToggleMailboxStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/mailboxes/${id}/toggle-status`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Erreur lors de la modification du statut"
        );
      }

      return data.data;
    },
    onSuccess: data => {
      // Update cache optimistically
      queryClient.setQueryData(mailboxKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: mailboxKeys.lists() });
    },
  });
}

/**
 * Sync mailbox with Microsoft Graph
 */
export function useSyncMailbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/mailboxes/${id}/sync`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Erreur lors de la synchronisation"
        );
      }

      return data;
    },
    onSuccess: response => {
      if (response.success && response.data?.mailbox) {
        // Update last sync time
        queryClient.setQueryData(
          mailboxKeys.detail(response.data.mailbox.id as string),
          response.data.mailbox
        );
        queryClient.invalidateQueries({ queryKey: mailboxKeys.lists() });
      }
    },
  });
}
