'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssignmentService } from '@/lib/services/assignment.service';

const assignmentService = new AssignmentService();

// Query keys
export const assignmentKeys = {
  all: ['assignments'] as const,
  userMailboxes: (userId: string) => [...assignmentKeys.all, 'user', userId] as const,
  mailboxUsers: (mailboxId: string) => [...assignmentKeys.all, 'mailbox', mailboxId] as const,
  stats: () => [...assignmentKeys.all, 'stats'] as const,
};

/**
 * Get all mailboxes assigned to a user
 */
export function useUserMailboxes(userId: string) {
  return useQuery({
    queryKey: assignmentKeys.userMailboxes(userId),
    queryFn: () => assignmentService.getUserMailboxes(userId),
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

/**
 * Get all users assigned to a mailbox
 */
export function useMailboxUsers(mailboxId: string) {
  return useQuery({
    queryKey: assignmentKeys.mailboxUsers(mailboxId),
    queryFn: () => assignmentService.getMailboxUsers(mailboxId),
    enabled: !!mailboxId,
    staleTime: 3 * 60 * 1000,
  });
}

/**
 * Get assignment statistics
 */
export function useAssignmentStats() {
  return useQuery({
    queryKey: assignmentKeys.stats(),
    queryFn: () => assignmentService.getAssignmentStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Check if user is assigned to mailbox
 */
export function useIsUserAssigned(userId: string, mailboxId: string) {
  return useQuery({
    queryKey: [...assignmentKeys.all, 'check', userId, mailboxId],
    queryFn: () => assignmentService.isUserAssigned(userId, mailboxId),
    enabled: !!(userId && mailboxId),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Assign a mailbox to a user
 */
export function useAssignMailbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignment: { userId: string; mailboxId: string; assignedBy: string }) =>
      assignmentService.assignMailbox(assignment),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.userMailboxes(variables.userId)
      });
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.mailboxUsers(variables.mailboxId)
      });
      queryClient.invalidateQueries({
        queryKey: [...assignmentKeys.all, 'check', variables.userId, variables.mailboxId]
      });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.stats() });
    },
  });
}

/**
 * Remove mailbox assignment from user
 */
export function useUnassignMailbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, mailboxId }: { userId: string; mailboxId: string }) =>
      assignmentService.unassignMailbox(userId, mailboxId),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.userMailboxes(variables.userId)
      });
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.mailboxUsers(variables.mailboxId)
      });
      queryClient.invalidateQueries({
        queryKey: [...assignmentKeys.all, 'check', variables.userId, variables.mailboxId]
      });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.stats() });
    },
  });
}

/**
 * Bulk assign multiple mailboxes to a user
 */
export function useBulkAssignToUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      mailboxIds,
      assignedBy
    }: {
      userId: string;
      mailboxIds: string[];
      assignedBy: string;
    }) => assignmentService.bulkAssignToUser(userId, mailboxIds, assignedBy),
    onSuccess: (_, variables) => {
      // Invalidate user assignments
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.userMailboxes(variables.userId)
      });

      // Invalidate each mailbox's users
      variables.mailboxIds.forEach(mailboxId => {
        queryClient.invalidateQueries({
          queryKey: assignmentKeys.mailboxUsers(mailboxId)
        });
      });

      queryClient.invalidateQueries({ queryKey: assignmentKeys.stats() });
    },
  });
}

/**
 * Bulk assign multiple users to a mailbox
 */
export function useBulkAssignToMailbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mailboxId,
      userIds,
      assignedBy
    }: {
      mailboxId: string;
      userIds: string[];
      assignedBy: string;
    }) => assignmentService.bulkAssignToMailbox(mailboxId, userIds, assignedBy),
    onSuccess: (_, variables) => {
      // Invalidate mailbox assignments
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.mailboxUsers(variables.mailboxId)
      });

      // Invalidate each user's assignments
      variables.userIds.forEach(userId => {
        queryClient.invalidateQueries({
          queryKey: assignmentKeys.userMailboxes(userId)
        });
      });

      queryClient.invalidateQueries({ queryKey: assignmentKeys.stats() });
    },
  });
}

/**
 * Remove all mailbox assignments for a user
 */
export function useRemoveAllUserAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => assignmentService.removeAllUserAssignments(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.userMailboxes(userId)
      });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.stats() });
      // Note: Could also invalidate all mailbox users, but would be expensive
    },
  });
}

/**
 * Remove all user assignments for a mailbox
 */
export function useRemoveAllMailboxAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mailboxId: string) => assignmentService.removeAllMailboxAssignments(mailboxId),
    onSuccess: (_, mailboxId) => {
      queryClient.invalidateQueries({
        queryKey: assignmentKeys.mailboxUsers(mailboxId)
      });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.stats() });
      // Note: Could also invalidate all user assignments, but would be expensive
    },
  });
}