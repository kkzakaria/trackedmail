import { useState } from "react";
import { Row } from "@tanstack/react-table";
import {
  EllipsisIcon,
  EyeIcon,
  StopCircleIcon,
  PlayCircleIcon,
  SendIcon,
  TrashIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { TrackedEmailWithDetails } from "@/lib/types";

interface TrackedEmailActionsProps {
  row: Row<TrackedEmailWithDetails>;
  onStatusUpdate: (emailId: string, status: "stopped" | "pending") => Promise<void>;
  onViewDetails?: (email: TrackedEmailWithDetails) => void;
  onSendFollowup?: (email: TrackedEmailWithDetails) => void;
}

export function TrackedEmailActions({
  row,
  onStatusUpdate,
  onViewDetails,
  onSendFollowup,
}: TrackedEmailActionsProps) {
  const email = row.original;
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const canStop = email.status === "pending";
  const canResume = email.status === "stopped";
  const canSendFollowup = email.status === "pending" && email.followup_count < 3;

  const handleStatusUpdate = async (status: "stopped" | "pending") => {
    try {
      setLoading(true);
      await onStatusUpdate(email.id, status);
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setLoading(false);
      setShowStopDialog(false);
    }
  };

  const handleViewDetails = () => {
    onViewDetails?.(email);
  };

  const handleSendFollowup = () => {
    onSendFollowup?.(email);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="shadow-none"
              aria-label="Actions"
              disabled={loading}
            >
              <EllipsisIcon size={16} aria-hidden="true" />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleViewDetails}>
              <EyeIcon className="mr-2 h-4 w-4" />
              <span>Voir détails</span>
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>

            {canSendFollowup && (
              <DropdownMenuItem onClick={handleSendFollowup}>
                <SendIcon className="mr-2 h-4 w-4" />
                <span>Envoyer relance</span>
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            {canStop && (
              <DropdownMenuItem
                onClick={() => setShowStopDialog(true)}
                className="text-orange-600 focus:text-orange-600"
              >
                <StopCircleIcon className="mr-2 h-4 w-4" />
                <span>Arrêter suivi</span>
                <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}

            {canResume && (
              <DropdownMenuItem
                onClick={() => handleStatusUpdate("pending")}
                className="text-green-600 focus:text-green-600"
              >
                <PlayCircleIcon className="mr-2 h-4 w-4" />
                <span>Reprendre suivi</span>
                <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <TrashIcon className="mr-2 h-4 w-4" />
              <span>Supprimer</span>
              <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Stop tracking confirmation dialog */}
      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arrêter le suivi ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cet email ne sera plus suivi et aucune relance automatique ne sera envoyée.
              Vous pourrez reprendre le suivi plus tard si nécessaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleStatusUpdate("stopped")}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Arrêter le suivi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}