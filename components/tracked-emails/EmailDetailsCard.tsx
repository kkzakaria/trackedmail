"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import {
  CalendarIcon,
  ClockIcon,
  MailIcon,
  ReplyIcon,
  UserIcon,
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrackedEmailStatusBadge } from "./TrackedEmailStatusBadge";

interface EmailDetailsCardProps {
  emailId: string;
}

interface EmailResponse {
  id: string;
  sender_email: string;
  subject: string | null;
  received_at: string;
  response_type: string | null;
  is_auto_response: boolean | null;
}

interface Followup {
  id: string;
  followup_number: number;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  subject: string;
}

interface EmailWithRelations extends TrackedEmailWithDetails {
  email_responses?: EmailResponse[];
  followups?: Followup[];
}

// Format date function
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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

// Status colors for followups
const getFollowupStatusColor = (status: string) => {
  switch (status) {
    case "sent":
      return "bg-green-100 text-green-800 border-green-200";
    case "scheduled":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "failed":
      return "bg-red-100 text-red-800 border-red-200";
    case "cancelled":
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
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

  const responses = email.email_responses || [];
  const followups = email.followups || [];
  const canStop = email.status === "pending";
  const canResume = email.status === "stopped";

  return (
    <TooltipProvider>
      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2">
          <Tabs defaultValue="details" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Détails</TabsTrigger>
              <TabsTrigger value="responses">
                Réponses ({responses.length})
              </TabsTrigger>
              <TabsTrigger value="followups">
                Relances ({followups.length})
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-xl">{email.subject}</CardTitle>
                      <div className="flex items-center gap-2">
                        <TrackedEmailStatusBadge status={email.status} />
                        {email.importance && email.importance !== "normal" && (
                          <Badge
                            variant={
                              email.importance === "high"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {email.importance === "high"
                              ? "Importante"
                              : "Faible"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email Details */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <UserIcon className="text-muted-foreground h-4 w-4" />
                        <span className="text-sm font-medium">Expéditeur</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {getInitials(email.sender_email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{email.sender_email}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="text-muted-foreground h-4 w-4" />
                        <span className="text-sm font-medium">Envoyé le</span>
                      </div>
                      <div className="text-sm">
                        <div>{formatDate(email.sent_at)}</div>
                        <div className="text-muted-foreground">
                          {formatRelativeTime(email.sent_at)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Recipients */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <MailIcon className="text-muted-foreground h-4 w-4" />
                      <span className="text-sm font-medium">Destinataires</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-muted-foreground text-xs tracking-wide uppercase">
                          À :
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {email.recipient_emails.map((recipient, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className="text-xs"
                            >
                              {recipient}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {email.cc_emails?.length ? (
                        <div>
                          <span className="text-muted-foreground text-xs tracking-wide uppercase">
                            CC :
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {email.cc_emails.map((cc, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="text-xs"
                              >
                                {cc}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Body Preview */}
                  {email.body_preview && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <span className="text-sm font-medium">
                          Aperçu du message
                        </span>
                        <div className="bg-muted rounded-md p-4">
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {email.body_preview}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Responses Tab */}
            <TabsContent value="responses">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ReplyIcon className="h-5 w-5" />
                    Réponses reçues ({responses.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {responses.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center">
                      <MailIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>Aucune réponse reçue pour cet email</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {responses.map(response => (
                        <div
                          key={response.id}
                          className="space-y-3 rounded-lg border p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {getInitials(response.sender_email)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">
                                {response.sender_email}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {response.is_auto_response && (
                                <Badge variant="secondary" className="text-xs">
                                  Auto-réponse
                                </Badge>
                              )}
                              <span className="text-muted-foreground text-xs">
                                {formatDate(response.received_at)}
                              </span>
                            </div>
                          </div>
                          {response.subject && (
                            <p className="text-sm font-medium">
                              {response.subject}
                            </p>
                          )}
                          {response.response_type && (
                            <Badge variant="outline" className="text-xs">
                              {response.response_type}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Followups Tab */}
            <TabsContent value="followups">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClockIcon className="h-5 w-5" />
                    Historique des relances ({followups.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {followups.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center">
                      <ClockIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                      <p>Aucune relance programmée ou envoyée</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {followups.map(followup => (
                        <div
                          key={followup.id}
                          className="space-y-3 rounded-lg border p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                Relance #{followup.followup_number}
                              </span>
                              <Badge
                                className={getFollowupStatusColor(
                                  followup.status
                                )}
                                variant="outline"
                              >
                                {followup.status === "sent"
                                  ? "Envoyée"
                                  : followup.status === "scheduled"
                                    ? "Programmée"
                                    : followup.status === "failed"
                                      ? "Échec"
                                      : "Annulée"}
                              </Badge>
                            </div>
                            <span className="text-muted-foreground text-xs">
                              {followup.sent_at
                                ? `Envoyée le ${formatDate(followup.sent_at)}`
                                : `Programmée pour le ${formatDate(followup.scheduled_for)}`}
                            </span>
                          </div>
                          <p className="text-sm font-medium">
                            {followup.subject}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
