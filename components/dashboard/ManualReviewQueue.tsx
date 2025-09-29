"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TrackedEmailWithDetails } from "@/lib/types";
import { TrackedEmailService } from "@/lib/services/tracked-email.service";
import { ManualHandlingModal } from "@/components/tracked-emails/ManualHandlingModal";
import { TrackedEmailStatusBadge } from "@/components/tracked-emails/TrackedEmailStatusBadge";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  Mail,
  Users,
  Settings,
  RefreshCw,
  CheckSquare,
  Square,
} from "lucide-react";

interface ManualReviewQueueProps {
  className?: string;
}

export function ManualReviewQueue({ className }: ManualReviewQueueProps) {
  const [emails, setEmails] = useState<TrackedEmailWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const supabase = createClient();

  const loadManualReviewEmails = useCallback(async () => {
    try {
      setRefreshing(true);

      // Get emails that require manual review using the same logic as dashboard stats
      const { data } = await supabase
        .from("tracked_emails")
        .select(
          `
          *,
          mailbox:mailboxes(
            id,
            email_address,
            display_name
          )
        `
        )
        .eq("requires_manual_review", true)
        .order("followup_count", { ascending: false })
        .order("sent_at", { ascending: false })
        .limit(50);

      if (data) {
        // Enrich each email with additional details
        const enrichedEmails = await Promise.all(
          data.map(async email => {
            const enriched = await TrackedEmailService.getTrackedEmailById(
              email.id
            );
            return enriched;
          })
        );

        const validEmails = enrichedEmails.filter(
          Boolean
        ) as TrackedEmailWithDetails[];
        setEmails(validEmails);
      }
    } catch (error) {
      console.error("Error loading manual review emails:", error);
      toast.error("Erreur lors du chargement des emails");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadManualReviewEmails();

    // Set up real-time subscription for changes
    const subscription = TrackedEmailService.subscribeToChanges(payload => {
      // Refresh when emails are updated
      if (payload.eventType === "UPDATE") {
        const oldEmail = payload.old as { requires_manual_review?: boolean };
        const newEmail = payload.new as {
          requires_manual_review?: boolean;
          subject?: string;
        };

        // Check if an email now requires manual review
        if (
          !oldEmail.requires_manual_review &&
          newEmail.requires_manual_review
        ) {
          toast.info("Un nouvel email nécessite une révision manuelle", {
            description: `Email: ${newEmail.subject || "Sans titre"}`,
          });
        }

        loadManualReviewEmails();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadManualReviewEmails]);

  const handleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(email => email.id)));
    }
  };

  const handleSelectEmail = (emailId: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const getSelectedEmails = () => {
    return emails.filter(email => selectedEmails.has(email.id));
  };

  const handleModalSuccess = () => {
    setSelectedEmails(new Set());
    loadManualReviewEmails();
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            File d&apos;attente de révision manuelle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              File d&apos;attente de révision manuelle
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {emails.length} email(s)
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={loadManualReviewEmails}
                disabled={refreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {emails.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <AlertTriangle className="text-muted-foreground/50 mx-auto mb-4 h-12 w-12" />
              <p className="text-lg font-medium">Aucun email en attente</p>
              <p className="text-sm">
                Tous les emails sont correctement suivis
              </p>
            </div>
          ) : (
            <>
              {/* Actions en lot */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="flex items-center gap-2"
                  >
                    {selectedEmails.size === emails.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    Tout sélectionner
                  </Button>
                  {selectedEmails.size > 0 && (
                    <Badge variant="outline">
                      {selectedEmails.size} sélectionné(s)
                    </Badge>
                  )}
                </div>
                {selectedEmails.size > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Actions groupées
                  </Button>
                )}
              </div>

              {/* Liste des emails */}
              <div className="max-h-96 space-y-3 overflow-y-auto">
                {emails.map(email => (
                  <div
                    key={email.id}
                    className="hover:bg-muted/50 rounded-lg border p-4 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedEmails.has(email.id)}
                        onCheckedChange={() => handleSelectEmail(email.id)}
                        className="mt-1"
                      />

                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm leading-tight font-medium">
                              {email.subject}
                            </h4>
                            <p className="text-muted-foreground text-xs">
                              {email.recipient_emails[0]}
                            </p>
                          </div>
                          <TrackedEmailStatusBadge status={email.status} />
                        </div>

                        <div className="text-muted-foreground flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {email.days_since_sent} jour(s)
                          </div>
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {email.followup_count} relance(s)
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {email.mailbox?.display_name ||
                              email.mailbox?.email_address}
                          </div>
                        </div>

                        {email.body_preview && (
                          <p className="text-muted-foreground line-clamp-2 text-xs">
                            {email.body_preview}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Informations d'aide */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    <p className="mb-1 font-medium">
                      Emails nécessitant une intervention
                    </p>
                    <p>
                      Ces emails ont reçu 4 relances ou plus sans réponse. Ils
                      nécessitent une vérification manuelle ou une action
                      spécifique.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ManualHandlingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        emails={getSelectedEmails()}
        onSuccess={handleModalSuccess}
      />
    </>
  );
}
