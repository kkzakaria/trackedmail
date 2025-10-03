"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";

import { TrackedEmailService } from "@/lib/services/tracked-email.service";
import type { TrackedEmailWithDetails } from "@/lib/types";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EmailConversationThread from "./EmailConversationThread";

interface EmailDetailsCardProps {
  emailId: string;
}

export default function EmailDetailsCard({ emailId }: EmailDetailsCardProps) {
  const [email, setEmail] = useState<TrackedEmailWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmailDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const emailData =
          await TrackedEmailService.getTrackedEmailById(emailId);

        if (!emailData) {
          notFound();
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
  }, [emailId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="animate-pulse">
            <div className="h-6 w-3/4 rounded bg-gray-200"></div>
            <div className="h-4 w-1/2 rounded bg-gray-200"></div>
          </CardHeader>
          <CardContent className="animate-pulse">
            <div className="space-y-4">
              <div className="h-4 rounded bg-gray-200"></div>
              <div className="h-4 w-5/6 rounded bg-gray-200"></div>
              <div className="h-4 w-4/6 rounded bg-gray-200"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !email) {
    return (
      <Alert>
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>{error || "Email non trouvé"}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      {email.mailbox ? (
        <EmailConversationThread
          trackedEmailId={emailId}
          mailboxId={email.mailbox.id}
          mailboxEmail={email.mailbox.email_address}
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
  );
}
