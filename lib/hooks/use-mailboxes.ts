"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MailboxService } from "@/lib/services/mailbox.service";
import type { TablesInsert, TablesUpdate } from "@/lib/types/database.types";

const mailboxService = new MailboxService();

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
    queryFn: () => mailboxService.getMailboxes(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a single mailbox by ID
 */
export function useMailbox(id: string) {
  return useQuery({
    queryKey: mailboxKeys.detail(id),
    queryFn: () => mailboxService.getMailboxById(id),
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
    queryFn: () => mailboxService.getMailboxStatistics(id),
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
    queryFn: () => mailboxService.getUserMailboxes(userId),
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
    mutationFn: (mailbox: TablesInsert<"mailboxes">) =>
      mailboxService.createMailbox(mailbox),
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
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: TablesUpdate<"mailboxes">;
    }) => mailboxService.updateMailbox(id, updates),
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
    mutationFn: (id: string) => mailboxService.deleteMailbox(id),
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
    mutationFn: (id: string) => mailboxService.toggleMailboxStatus(id),
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
    mutationFn: (id: string) => mailboxService.syncWithMicrosoft(id),
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
