/**
 * TrackedEmailsBulkActions Component
 *
 * Provides bulk actions for selected emails (stop tracking, delete).
 * Follows Single Responsibility Principle - handles only bulk action UI.
 */

"use client";

import { useState } from "react";
import { Table } from "@tanstack/react-table";
import { CircleAlertIcon, StopCircleIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { isAdmin } from "@/lib/utils/auth-utils";
import type { TrackedEmailWithDetails, AuthUser } from "@/lib/types";

export interface TrackedEmailsBulkActionsProps {
  table: Table<TrackedEmailWithDetails>;
  user: AuthUser | null;
  onBulkStop: (emailIds: string[]) => Promise<void>;
  onBulkDelete: (emailIds: string[]) => Promise<void>;
}

/**
 * Bulk actions component for tracked emails table
 * @param table - TanStack Table instance
 * @param user - Current user (for admin check)
 * @param onBulkStop - Callback for stopping tracking on selected emails
 * @param onBulkDelete - Callback for deleting selected emails
 */
export function TrackedEmailsBulkActions({
  table,
  user,
  onBulkStop,
  onBulkDelete,
}: TrackedEmailsBulkActionsProps) {
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const emailIds = selectedRows.map(row => row.original.id);

  if (selectedCount === 0) {
    return null;
  }

  const handleBulkStop = async () => {
    try {
      await onBulkStop(emailIds);
      table.resetRowSelection();
    } catch (error) {
      // Error handling is done in the hook
      console.error("Bulk stop failed:", error);
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdmin(user)) return;

    try {
      setBulkOperationLoading(true);
      await onBulkDelete(emailIds);
      table.resetRowSelection();
    } catch (error) {
      // Error handling is done in the hook
      console.error("Bulk delete failed:", error);
    } finally {
      setBulkOperationLoading(false);
      setShowBulkDeleteDialog(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Stop tracking action */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="ml-auto" variant="outline">
            <StopCircleIcon
              className="-ms-1 opacity-60"
              size={16}
              aria-hidden="true"
            />
            Arrêter
            <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
              {selectedCount}
            </span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full border"
              aria-hidden="true"
            >
              <CircleAlertIcon className="opacity-80" size={16} />
            </div>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Arrêter le suivi des emails sélectionnés ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Cette action arrêtera le suivi de {selectedCount} email
                {selectedCount === 1 ? "" : "s"} sélectionné
                {selectedCount === 1 ? "" : "s"}. Aucune relance automatique ne
                sera envoyée.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkStop}>
              Arrêter le suivi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete action - Admin only */}
      {isAdmin(user) && (
        <AlertDialog
          open={showBulkDeleteDialog}
          onOpenChange={setShowBulkDeleteDialog}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="ml-2">
              <TrashIcon
                className="-ms-1 opacity-60"
                size={16}
                aria-hidden="true"
              />
              Supprimer
              <span className="bg-background text-muted-foreground/70 -me-1 inline-flex h-5 max-h-full items-center rounded border px-1 font-[inherit] text-[0.625rem] font-medium">
                {selectedCount}
              </span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
              <div
                className="border-destructive flex size-9 shrink-0 items-center justify-center rounded-full border"
                aria-hidden="true"
              >
                <TrashIcon className="text-destructive opacity-80" size={16} />
              </div>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer définitivement les emails sélectionnés ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. {selectedCount} email
                  {selectedCount === 1 ? "" : "s"} et toutes les données
                  associées (réponses, relances, historique) seront
                  définitivement supprimé{selectedCount === 1 ? "" : "s"}.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                className="bg-destructive hover:bg-destructive/90"
                disabled={bulkOperationLoading}
              >
                {bulkOperationLoading
                  ? "Suppression..."
                  : "Supprimer définitivement"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
