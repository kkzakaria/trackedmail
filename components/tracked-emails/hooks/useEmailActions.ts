/**
 * useEmailActions Hook
 *
 * Manages CRUD operations for tracked emails with optimistic updates.
 * Follows Single Responsibility Principle - handles only email actions.
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { TrackedEmailService } from "@/lib/services/tracked-email.service";
import { isAdmin } from "@/lib/utils/auth-utils";
import type {
  TrackedEmailWithDetails,
  EmailStatus,
  AuthUser,
} from "@/lib/types";

export interface UseEmailActionsProps {
  user: AuthUser | null;
  setData: React.Dispatch<React.SetStateAction<TrackedEmailWithDetails[]>>;
}

export interface UseEmailActionsReturn {
  handleDeleteEmail: (email: TrackedEmailWithDetails) => Promise<void>;
  handleStatusUpdate: (emailId: string, status: EmailStatus) => Promise<void>;
  handleBulkStopTracking: (emailIds: string[]) => Promise<void>;
  handleBulkDelete: (emailIds: string[]) => Promise<void>;
}

/**
 * Hook to manage email actions (delete, update status, bulk operations)
 * @param user - Current user
 * @param setData - State setter for email data (for optimistic updates)
 * @returns Action handlers
 */
export function useEmailActions({
  user,
  setData,
}: UseEmailActionsProps): UseEmailActionsReturn {
  /**
   * Delete a single email with optimistic update and rollback
   */
  const handleDeleteEmail = useCallback(
    async (email: TrackedEmailWithDetails) => {
      if (!isAdmin(user)) {
        toast.error("Vous n'avez pas les droits pour supprimer cet email");
        return;
      }

      // 🚀 OPTIMIZATION: Optimistic update - save previous state for rollback
      let previousData: TrackedEmailWithDetails[] = [];

      try {
        // Save current state before optimistic update
        setData(prev => {
          previousData = prev;
          // Optimistic update: remove immediately from UI
          return prev.filter(e => e.id !== email.id);
        });

        toast.success("Email supprimé avec succès");

        // Perform actual deletion
        await TrackedEmailService.deleteTrackedEmail(email.id);
      } catch (error) {
        console.error("Failed to delete email:", error);
        toast.error("Erreur lors de la suppression de l'email");

        // 🚀 OPTIMIZATION: Rollback on error
        setData(previousData);
      }
    },
    [user, setData]
  );

  /**
   * Update email status with optimistic update and rollback
   */
  const handleStatusUpdate = useCallback(
    async (emailId: string, status: EmailStatus) => {
      // 🚀 OPTIMIZATION: Optimistic update - save previous state for rollback
      let previousData: TrackedEmailWithDetails[] = [];

      try {
        // Save current state and perform optimistic update
        setData(prev => {
          previousData = prev;
          return prev.map(email =>
            email.id === emailId
              ? {
                  ...email,
                  status,
                  stopped_at:
                    status === "stopped"
                      ? new Date().toISOString()
                      : email.stopped_at,
                }
              : email
          );
        });

        toast.success("Statut mis à jour");

        // Perform actual update
        await TrackedEmailService.updateEmailStatus(emailId, status);
      } catch (error) {
        console.error("Failed to update status:", error);
        toast.error("Erreur lors de la mise à jour du statut");

        // 🚀 OPTIMIZATION: Rollback on error
        setData(previousData);
      }
    },
    [setData]
  );

  /**
   * Bulk stop tracking for selected emails with optimistic update and rollback
   */
  const handleBulkStopTracking = useCallback(
    async (emailIds: string[]) => {
      if (emailIds.length === 0) return;

      // 🚀 OPTIMIZATION: Optimistic update - save previous state for rollback
      let previousData: TrackedEmailWithDetails[] = [];

      try {
        // Save current state and perform optimistic update
        setData(prev => {
          previousData = prev;
          return prev.map(email =>
            emailIds.includes(email.id)
              ? {
                  ...email,
                  status: "stopped" as EmailStatus,
                  stopped_at: new Date().toISOString(),
                }
              : email
          );
        });

        toast.success(`${emailIds.length} email(s) arrêté(s) avec succès`);

        // Perform actual updates
        await Promise.all(
          emailIds.map(id =>
            TrackedEmailService.updateEmailStatus(id, "stopped")
          )
        );
      } catch (error) {
        console.error("Failed to stop tracking:", error);
        toast.error("Erreur lors de l'arrêt du suivi");

        // 🚀 OPTIMIZATION: Rollback on error
        setData(previousData);
      }
    },
    [setData]
  );

  /**
   * Bulk delete selected emails (admin only) with optimistic update and rollback
   */
  const handleBulkDelete = useCallback(
    async (emailIds: string[]) => {
      if (!isAdmin(user)) {
        toast.error("Vous n'avez pas les droits pour supprimer ces emails");
        return;
      }

      if (emailIds.length === 0) return;

      // 🚀 OPTIMIZATION: Optimistic update - save previous state for rollback
      let previousData: TrackedEmailWithDetails[] = [];

      try {
        // Save current state and perform optimistic update
        setData(prev => {
          previousData = prev;
          return prev.filter(email => !emailIds.includes(email.id));
        });

        toast.success(`${emailIds.length} email(s) supprimé(s) avec succès`);

        // Perform actual deletions
        await Promise.all(
          emailIds.map(id => TrackedEmailService.deleteTrackedEmail(id))
        );
      } catch (error) {
        console.error("Failed to delete emails:", error);
        toast.error("Erreur lors de la suppression des emails");

        // 🚀 OPTIMIZATION: Rollback on error
        setData(previousData);
      }
    },
    [user, setData]
  );

  return {
    handleDeleteEmail,
    handleStatusUpdate,
    handleBulkStopTracking,
    handleBulkDelete,
  };
}
