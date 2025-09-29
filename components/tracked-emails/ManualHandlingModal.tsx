"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrackedEmailWithDetails } from "@/lib/types";
import { TrackedEmailService } from "@/lib/services/tracked-email.service";
import { toast } from "sonner";
import { Loader2, Mail, Clock, User } from "lucide-react";

interface ManualHandlingModalProps {
  isOpen: boolean;
  onClose: () => void;
  emails: TrackedEmailWithDetails[];
  onSuccess: () => void;
}

type ActionType =
  | "stop"
  | "resume"
  | "mark_resolved"
  | "schedule_manual_followup";

export function ManualHandlingModal({
  isOpen,
  onClose,
  emails,
  onSuccess,
}: ManualHandlingModalProps) {
  const [action, setAction] = useState<ActionType>("stop");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (emails.length === 0) return;

    setIsProcessing(true);
    try {
      const emailIds = emails.map(email => email.id);

      switch (action) {
        case "stop":
          await TrackedEmailService.bulkUpdateStatus(emailIds, "stopped");
          toast.success(`${emails.length} email(s) arrêté(s) avec succès`);
          break;

        case "resume":
          await TrackedEmailService.bulkUpdateStatus(emailIds, "pending");
          toast.success(`${emails.length} email(s) remis en suivi`);
          break;

        case "mark_resolved":
          // For now, we'll mark as responded since we don't have a specific "resolved" status
          await TrackedEmailService.bulkUpdateStatus(emailIds, "responded");
          toast.success(`${emails.length} email(s) marqué(s) comme résolus`);
          break;

        case "schedule_manual_followup":
          // This would require additional backend implementation
          toast.info("Fonctionnalité de relance manuelle à implémenter");
          break;
      }

      onSuccess();
      onClose();
      setNotes("");
      setAction("stop");
    } catch (error) {
      console.error("Error processing manual handling:", error);
      toast.error("Erreur lors du traitement des emails");
    } finally {
      setIsProcessing(false);
    }
  };

  const getActionLabel = (actionType: ActionType) => {
    switch (actionType) {
      case "stop":
        return "Arrêter le suivi";
      case "resume":
        return "Reprendre le suivi";
      case "mark_resolved":
        return "Marquer comme résolu";
      case "schedule_manual_followup":
        return "Programmer relance manuelle";
      default:
        return "";
    }
  };

  const getActionDescription = (actionType: ActionType) => {
    switch (actionType) {
      case "stop":
        return "Arrêter définitivement le suivi de ces emails";
      case "resume":
        return "Remettre ces emails en suivi automatique";
      case "mark_resolved":
        return "Marquer ces emails comme résolus (pas de relance)";
      case "schedule_manual_followup":
        return "Programmer une relance manuelle personnalisée";
      default:
        return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Gestion manuelle des emails
          </DialogTitle>
          <DialogDescription>
            Actions groupées pour {emails.length} email(s) nécessitant une
            intervention manuelle
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Email Summary */}
          <div className="bg-muted/50 rounded-lg border p-4">
            <h4 className="mb-3 flex items-center gap-2 font-medium">
              <User className="h-4 w-4" />
              Emails sélectionnés ({emails.length})
            </h4>
            <div className="max-h-32 space-y-2 overflow-y-auto">
              {emails.slice(0, 5).map(email => (
                <div
                  key={email.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex-1 truncate">
                    <span className="font-medium">{email.subject}</span>
                    <span className="text-muted-foreground ml-2">
                      → {email.recipient_emails[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <Clock className="h-3 w-3" />
                      {email.followup_count} relances
                    </Badge>
                    <Badge variant="destructive" className="text-xs">
                      {email.days_since_sent}j
                    </Badge>
                  </div>
                </div>
              ))}
              {emails.length > 5 && (
                <div className="text-muted-foreground py-2 text-center text-sm">
                  ... et {emails.length - 5} autres emails
                </div>
              )}
            </div>
          </div>

          {/* Action Selection */}
          <div className="space-y-3">
            <Label htmlFor="action">Action à effectuer</Label>
            <Select
              value={action}
              onValueChange={(value: ActionType) => setAction(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stop">
                  <div className="flex flex-col">
                    <span>Arrêter le suivi</span>
                    <span className="text-muted-foreground text-xs">
                      Plus aucune relance ne sera envoyée
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="resume">
                  <div className="flex flex-col">
                    <span>Reprendre le suivi</span>
                    <span className="text-muted-foreground text-xs">
                      Remettre en suivi automatique
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="mark_resolved">
                  <div className="flex flex-col">
                    <span>Marquer comme résolu</span>
                    <span className="text-muted-foreground text-xs">
                      Email traité sans réponse automatique
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="schedule_manual_followup" disabled>
                  <div className="flex flex-col">
                    <span>Relance manuelle (à venir)</span>
                    <span className="text-muted-foreground text-xs">
                      Programmer une relance personnalisée
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {action && (
              <p className="text-muted-foreground text-sm">
                {getActionDescription(action)}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              placeholder="Ajouter des notes sur cette action..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !action}
            className="min-w-32"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement...
              </>
            ) : (
              getActionLabel(action)
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
