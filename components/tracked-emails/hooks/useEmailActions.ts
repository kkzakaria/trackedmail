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
   * Delete a single email
   */
  const handleDeleteEmail = useCallback(
    async (email: TrackedEmailWithDetails) => {
      if (!isAdmin(user)) {
        toast.error("Vous n'avez pas les droits pour supprimer cet email");
        return;
      }

      try {
        await TrackedEmailService.deleteTrackedEmail(email.id);
        toast.success("Email supprimé avec succès");
        // Remove from local state (optimistic update)
        setData(prev => prev.filter(e => e.id !== email.id));
      } catch (error) {
        console.error("Failed to delete email:", error);
        toast.error("Erreur lors de la suppression de l'email");
      }
    },
    [user, setData]
  );

  /**
   * Update email status
   */
  const handleStatusUpdate = useCallback(
    async (emailId: string, status: EmailStatus) => {
      try {
        await TrackedEmailService.updateEmailStatus(emailId, status);
        toast.success("Statut mis à jour");
        // Update local state (optimistic update)
        setData(prev =>
          prev.map(email =>
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
          )
        );
      } catch (error) {
        console.error("Failed to update status:", error);
        toast.error("Erreur lors de la mise à jour du statut");
      }
    },
    [setData]
  );

  /**
   * Bulk stop tracking for selected emails
   */
  const handleBulkStopTracking = useCallback(
    async (emailIds: string[]) => {
      if (emailIds.length === 0) return;

      try {
        await Promise.all(
          emailIds.map(id =>
            TrackedEmailService.updateEmailStatus(id, "stopped")
          )
        );
        toast.success(`${emailIds.length} email(s) arrêté(s) avec succès`);
        // Update local state (optimistic update)
        setData(prev =>
          prev.map(email =>
            emailIds.includes(email.id)
              ? {
                  ...email,
                  status: "stopped" as EmailStatus,
                  stopped_at: new Date().toISOString(),
                }
              : email
          )
        );
      } catch (error) {
        console.error("Failed to stop tracking:", error);
        toast.error("Erreur lors de l'arrêt du suivi");
      }
    },
    [setData]
  );

  /**
   * Bulk delete selected emails (admin only)
   */
  const handleBulkDelete = useCallback(
    async (emailIds: string[]) => {
      if (!isAdmin(user)) {
        toast.error("Vous n'avez pas les droits pour supprimer ces emails");
        return;
      }

      if (emailIds.length === 0) return;

      try {
        await Promise.all(
          emailIds.map(id => TrackedEmailService.deleteTrackedEmail(id))
        );
        toast.success(`${emailIds.length} email(s) supprimé(s) avec succès`);
        // Remove from local state (optimistic update)
        setData(prev => prev.filter(email => !emailIds.includes(email.id)));
      } catch (error) {
        console.error("Failed to delete emails:", error);
        toast.error("Erreur lors de la suppression des emails");
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
