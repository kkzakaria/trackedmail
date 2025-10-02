"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import {
  AlertCircleIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  SendIcon,
  ExternalLinkIcon,
} from "lucide-react";

import { TrackedEmailService } from "@/lib/services/tracked-email.service";
import type { TrackedEmailWithDetails, EmailStatus } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import EmailConversationThread from "./EmailConversationThread";

interface EmailDetailsCardProps {
  emailId: string;
}

interface EmailWithRelations extends TrackedEmailWithDetails {
  email_responses?: Array<{
    id: string;
    sender_email: string;
    subject: string | null;
    received_at: string;
    response_type: string | null;
    is_auto_response: boolean | null;
  }>;
  followups?: Array<{
    id: string;
    followup_number: number;
    status: string;
    scheduled_for: string;
    sent_at: string | null;
    subject: string;
  }>;
}

// Format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays === 0) return "Aujourd'hui";
  if (diffInDays === 1) return "Hier";
  return `Il y a ${diffInDays} jours`;
};

// Get initials from email
const getInitials = (email: string) => {
  return email.split("@")[0]?.substring(0, 2).toUpperCase() || "??";
};

export default function EmailDetailsCard({ emailId }: EmailDetailsCardProps) {
  const [email, setEmail] = useState<EmailWithRelations | null>(null);
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

        setEmail(emailData as EmailWithRelations);
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

  const handleStatusUpdate = async (newStatus: EmailStatus) => {
    if (!email) return;

    try {
      await TrackedEmailService.updateEmailStatus(email.id, newStatus);

      // Update local state
      setEmail(prev =>
        prev
          ? {
              ...prev,
              status: newStatus,
              stopped_at:
                newStatus === "stopped"
                  ? new Date().toISOString()
                  : prev.stopped_at,
            }
          : null
      );
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
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
        <div className="space-y-4">
          <Card>
            <CardHeader className="animate-pulse">
              <div className="h-6 w-1/2 rounded bg-gray-200"></div>
            </CardHeader>
            <CardContent className="animate-pulse">
              <div className="space-y-2">
                <div className="h-4 rounded bg-gray-200"></div>
                <div className="h-4 w-3/4 rounded bg-gray-200"></div>
              </div>
            </CardContent>
          </Card>
        </div>
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

  const canStop = email.status === "pending";
  const canResume = email.status === "stopped";

  return (
    <TooltipProvider>
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content - Conversation Thread */}
        <div className="md:col-span-2">
          {email.conversation_id && email.mailbox ? (
            <EmailConversationThread
              conversationId={email.conversation_id}
              mailboxId={email.mailbox.id}
              mailboxEmail={email.mailbox.email_address}
            />
          ) : (
            <Alert>
              <AlertCircleIcon className="h-4 w-4" />
              <AlertDescription>
                Conversation ID ou informations de mailbox manquantes
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Statistics Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statistiques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {email.days_since_sent}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    jours depuis envoi
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {email.response_count}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    réponse(s)
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Relances envoyées</span>
                  <span className="font-medium">{email.followup_count}/3</span>
                </div>
                <Progress
                  value={(email.followup_count / 3) * 100}
                  className="h-2"
                />
              </div>

              {email.last_followup_sent && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      Dernière relance :
                    </span>
                    <div className="font-medium">
                      {formatRelativeTime(email.last_followup_sent)}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canStop && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleStatusUpdate("stopped")}
                >
                  <PauseCircleIcon className="mr-2 h-4 w-4" />
                  Arrêter le suivi
                </Button>
              )}

              {canResume && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleStatusUpdate("pending")}
                >
                  <PlayCircleIcon className="mr-2 h-4 w-4" />
                  Reprendre le suivi
                </Button>
              )}

              {email.status === "pending" && email.followup_count < 3 && (
                <Button variant="default" className="w-full">
                  <SendIcon className="mr-2 h-4 w-4" />
                  Relance manuelle
                </Button>
              )}

              <Separator />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full">
                    <ExternalLinkIcon className="mr-2 h-4 w-4" />
                    Ouvrir dans Outlook
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Ouvrir l&apos;email original dans Microsoft Outlook
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          {/* Mailbox Info */}
          {email.mailbox && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Boîte mail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(email.mailbox.email_address)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">
                      {email.mailbox.display_name || "Sans nom"}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {email.mailbox.email_address}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
