"use client";

import { useEffect, useState } from "react";
import { AlertCircleIcon } from "lucide-react";

import { TrackedEmailService } from "@/lib/services/tracked-email.service";
import type { TrackedEmailWithDetails } from "@/lib/types";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import EmailConversationThread from "./EmailConversationThread";

interface EmailDetailsSheetProps {
  emailId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EmailDetailsSheet({
  emailId,
  open,
  onOpenChange,
}: EmailDetailsSheetProps) {
  const [email, setEmail] = useState<TrackedEmailWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!emailId || !open) {
      return;
    }

    const fetchEmailDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const emailData =
          await TrackedEmailService.getTrackedEmailById(emailId);

        if (!emailData) {
          setError("Email non trouvé");
          return;
        }

        setEmail(emailData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erreur lors du chargement"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEmailDetails();
  }, [emailId, open]);

  // Réinitialiser l'état quand le Sheet se ferme
  useEffect(() => {
    if (!open) {
      setEmail(null);
      setError(null);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl">
        {loading && (
          <>
            <SheetHeader>
              <SheetTitle>Chargement...</SheetTitle>
              <SheetDescription>
                Récupération des détails de l&apos;email
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {error && !loading && (
          <>
            <SheetHeader>
              <SheetTitle>Erreur</SheetTitle>
            </SheetHeader>
            <Alert className="mt-6">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </>
        )}

        {email && !loading && !error && (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">
                {email.recipient_emails}
              </SheetTitle>
              <SheetDescription className="text-sm">
                {email.subject}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              {email.mailbox ? (
                <EmailConversationThread
                  trackedEmailId={email.id}
                  mailboxId={email.mailbox.id}
                  mailboxEmail={email.mailbox.email_address}
                  isInSheet={true}
                />
              ) : (
                <Alert>
                  <AlertCircleIcon className="h-4 w-4" />
                  <AlertDescription>
                    Informations de mailbox manquantes
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
