"use client";

import Link from "next/link";
import { useEmailConversation } from "@/lib/hooks/use-email-conversation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircleIcon,
  ArrowLeft,
  MailIcon,
  RefreshCwIcon,
  FileIcon,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EmailConversationThreadProps {
  conversationId: string;
  mailboxId: string;
  mailboxEmail: string;
}

// Formater la date
const formatMessageDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffInDays === 0) {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffInDays === 1) {
    return `Hier ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Obtenir les initiales
const getInitials = (email: string) => {
  return email.split("@")[0]?.substring(0, 2).toUpperCase() || "??";
};

// Extraire le texte du corps HTML
const extractTextFromBody = (
  body: { contentType: "text" | "html"; content: string } | undefined
) => {
  if (!body) return "";

  if (body.contentType === "text") {
    return body.content;
  }

  // Pour HTML, on affiche tel quel (le navigateur va le rendre)
  return body.content;
};

// Formater la taille des fichiers
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 10) / 10} ${sizes[i]}`;
};

export default function EmailConversationThread({
  conversationId,
  mailboxId,
  mailboxEmail,
}: EmailConversationThreadProps) {
  const { messages, loading, error, refetch } = useEmailConversation(
    conversationId,
    mailboxId
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="flex flex-col gap-0.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <AlertCircleIcon className="text-destructive h-4 w-4" />
                <span className="text-sm">Erreur lors du chargement</span>
              </div>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              {error}
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                className="ml-2"
              >
                <RefreshCwIcon className="mr-1 h-3 w-3" />
                Réessayer
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm">Aucune conversation</span>
                <span className="text-muted-foreground text-xs font-normal">
                  Aucun message trouvé
                </span>
              </div>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            <MailIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Aucun message dans cette conversation</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Extraire l'adresse de l'expéditeur et le sujet du message initial (le plus ancien)
  const initialMessage = messages[messages.length - 1];
  const senderEmail =
    initialMessage?.sender?.emailAddress?.address ||
    initialMessage?.from?.emailAddress?.address ||
    "Expéditeur inconnu";
  const subject = initialMessage?.subject || "Sans objet";

  return (
    <Card className="flex h-[calc(100vh-200px)] flex-col">
      <CardHeader className="flex-none border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm">{senderEmail}</span>
              <span className="text-muted-foreground text-xs font-semibold">
                {subject}
              </span>
            </div>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={refetch}>
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.map((message, index) => {
          const senderEmail =
            message.sender?.emailAddress?.address ||
            message.from?.emailAddress?.address ||
            "Inconnu";
          const senderName =
            message.sender?.emailAddress?.name ||
            message.from?.emailAddress?.name ||
            senderEmail;

          // Déterminer si c'est un message envoyé ou reçu
          const isSentMessage =
            senderEmail.toLowerCase() === mailboxEmail.toLowerCase();

          return (
            <div
              key={message.id || index}
              className={`flex gap-3 ${isSentMessage ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <Avatar className="h-10 w-10 flex-none">
                <AvatarFallback
                  className={
                    isSentMessage
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700"
                  }
                >
                  {getInitials(senderEmail)}
                </AvatarFallback>
              </Avatar>

              {/* Message content */}
              <div
                className={`flex max-w-[75%] flex-col gap-1 ${isSentMessage ? "items-end" : "items-start"}`}
              >
                {/* Header */}
                <div
                  className={`flex items-center gap-2 ${isSentMessage ? "flex-row-reverse" : "flex-row"}`}
                >
                  <span className="text-sm font-medium">{senderName}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatMessageDate(message.sentDateTime)}
                  </span>
                  {message.hasAttachments && (
                    <Badge variant="outline" className="text-xs">
                      📎
                    </Badge>
                  )}
                </div>

                {/* Subject if different from initial message */}
                {message.subject !== initialMessage?.subject && (
                  <div className="text-sm font-medium text-gray-700">
                    {message.subject}
                  </div>
                )}

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {message.attachments
                      .filter(att => !att.isInline)
                      .map(attachment => (
                        <a
                          key={attachment.id}
                          href={`/api/attachments/${message.id}/${attachment.id}?mailboxId=${mailboxId}`}
                          download={attachment.name}
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${
                            isSentMessage
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                          }`}
                        >
                          <FileIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="flex-1 truncate font-medium">
                            {attachment.name}
                          </span>
                          <span className="text-xs opacity-75">
                            {formatFileSize(attachment.size)}
                          </span>
                          <Download className="h-3 w-3 flex-shrink-0" />
                        </a>
                      ))}
                  </div>
                )}

                {/* Body */}
                <div
                  className={`rounded-lg px-4 py-3 ${
                    isSentMessage
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {message.body?.contentType === "html" ? (
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: message.body.content,
                      }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {extractTextFromBody(message.body) || message.bodyPreview}
                    </p>
                  )}
                </div>

                {/* Recipients (for sent messages) */}
                {isSentMessage && message.toRecipients?.length > 0 && (
                  <div className="text-muted-foreground text-xs">
                    À:{" "}
                    {message.toRecipients
                      .map(r => r.emailAddress.name || r.emailAddress.address)
                      .join(", ")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
