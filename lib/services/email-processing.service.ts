/**
 * Email Processing Service
 * Service pour le traitement avancé des emails avec threading et gestion des exclusions
 * Orchestre la détection, l'insertion et la mise à jour des emails trackés
 */

import { createClient } from "@/lib/supabase/client";
import { microsoftGraphService } from "./microsoft-graph.service";
import { emailDetectionService } from "./email-detection.service";
import type { DetectionResult } from "./email-detection.service";
import type {
  MicrosoftGraphEmailMessage,
  EmailThreadingInfo,
  ApiResponse,
} from "@/lib/types/microsoft-graph";

/**
 * Interface pour les options de traitement
 */
interface ProcessingOptions {
  skipDuplicateCheck?: boolean;
  forceThreading?: boolean;
  customExclusions?: string[];
  enableAdvancedThreading?: boolean;
}

/**
 * Interface pour les résultats de traitement
 */
interface ProcessingResult {
  action:
    | "inserted"
    | "updated"
    | "excluded"
    | "duplicate"
    | "response_detected";
  trackedEmailId?: string;
  parentEmailId?: string;
  threadInfo?: EmailThreadingInfo;
  exclusionReason?: string;
}

/**
 * Interface pour les statistiques de traitement
 */
interface ProcessingStats {
  processed: number;
  inserted: number;
  responses: number;
  excluded: number;
  duplicates: number;
  errors: number;
}

/**
 * Interface pour l'insertion d'email
 */
interface TrackedEmailInsert {
  microsoft_message_id: string;
  conversation_id: string | null;
  conversation_index: string | null;
  internet_message_id: string;
  in_reply_to: string | null;
  references: string | null;
  mailbox_id: string;
  subject: string;
  sender_email: string;
  recipient_emails: string[];
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
  body_preview: string;
  has_attachments: boolean;
  importance: "low" | "normal" | "high";
  status:
    | "pending"
    | "responded"
    | "stopped"
    | "max_reached"
    | "bounced"
    | "expired";
  sent_at: string;
  is_reply: boolean;
  thread_position: number;
  parent_tracked_email_id: string | null;
}

/**
 * Service de traitement d'emails avancé
 */
export class EmailProcessingService {
  private supabase = createClient();

  constructor() {}

  /**
   * Traite un email entrant complet (webhook → détection → insertion/mise à jour)
   */
  async processEmailFromWebhook(
    microsoftMessageId: string,
    mailboxId: string,
    options: ProcessingOptions = {}
  ): Promise<ApiResponse<ProcessingResult>> {
    try {
      // Récupérer les détails de l'email via Microsoft Graph
      const emailDetails = await this.fetchEmailDetails(
        microsoftMessageId,
        mailboxId
      );

      if (!emailDetails.success || !emailDetails.data) {
        return {
          success: false,
          error: "Failed to fetch email details",
          code: "EMAIL_FETCH_FAILED",
        };
      }

      return await this.processEmail(emailDetails.data, mailboxId, options);
    } catch (error) {
      console.error("Error processing email from webhook:", error);
      return {
        success: false,
        error: "Failed to process email from webhook",
        code: "WEBHOOK_PROCESSING_FAILED",
      };
    }
  }

  /**
   * Traite un email avec détection intelligente
   */
  async processEmail(
    email: MicrosoftGraphEmailMessage,
    mailboxId: string,
    options: ProcessingOptions = {}
  ): Promise<ApiResponse<ProcessingResult>> {
    try {
      // Vérifier les doublons si activé
      if (!options.skipDuplicateCheck) {
        const duplicateCheck = await this.checkForDuplicate(email);
        if (duplicateCheck.success && duplicateCheck.data) {
          return {
            success: true,
            data: {
              action: "duplicate",
              trackedEmailId: duplicateCheck.data.id,
              exclusionReason: "Email already tracked",
            },
          };
        }
      }

      // Effectuer la détection de réponse
      const detectionResult = await emailDetectionService.processIncomingEmail(
        email,
        mailboxId,
        {
          includeThreading: options.enableAdvancedThreading ?? false,
          enableSubjectMatching: true,
          skipInternalEmails: true,
        }
      );

      if (!detectionResult.success) {
        if (detectionResult.code === "EMAIL_EXCLUDED") {
          return {
            success: true,
            data: {
              action: "excluded",
              exclusionReason:
                detectionResult.error ?? "Unknown exclusion reason",
            },
          };
        }

        return {
          success: false,
          error: detectionResult.error ?? "Detection failed",
          code: detectionResult.code ?? "DETECTION_FAILED",
        };
      }

      if (!detectionResult.data) {
        return {
          success: false,
          error: "Detection result data is missing",
          code: "MISSING_DETECTION_DATA",
        };
      }

      const detection = detectionResult.data;

      // Si c'est une réponse détectée, traiter comme telle
      if (detection.isResponse && detection.originalTrackedEmailId) {
        return await this.processEmailResponse(
          email,
          detection.originalTrackedEmailId,
          detection
        );
      }

      // Si ce n'est pas une réponse, insérer comme nouvel email tracké
      return await this.insertNewTrackedEmail(email, mailboxId, options);
    } catch (error) {
      console.error("Error processing email:", error);
      return {
        success: false,
        error: "Failed to process email",
        code: "EMAIL_PROCESSING_FAILED",
      };
    }
  }

  /**
   * Traite une réponse détectée
   */
  private async processEmailResponse(
    email: MicrosoftGraphEmailMessage,
    originalTrackedEmailId: string,
    detection: DetectionResult
  ): Promise<ApiResponse<ProcessingResult>> {
    try {
      // Mettre à jour l'email original comme ayant reçu une réponse
      const { error: updateError } = await this.supabase
        .from("tracked_emails")
        .update({
          status: "responded",
          responded_at: new Date().toISOString(),
        })
        .eq("id", originalTrackedEmailId);

      if (updateError) {
        throw updateError;
      }

      // Insérer la réponse dans email_responses
      const { error: responseError } = await this.supabase
        .from("email_responses")
        .insert({
          tracked_email_id: originalTrackedEmailId,
          microsoft_message_id: email.id,
          conversation_id: email.conversationId,
          internet_message_id: email.internetMessageId,
          sender_email: email.sender?.emailAddress?.address || "",
          subject: email.subject || "",
          body_preview: email.bodyPreview || "",
          received_at: email.receivedDateTime || new Date().toISOString(),
          detection_method: detection.threadingMethod,
          confidence_level: detection.confidence,
        })
        .select()
        .single();

      if (responseError) {
        throw responseError;
      }

      // Annuler les follow-ups en attente
      await this.cancelPendingFollowups(originalTrackedEmailId);

      return {
        success: true,
        data: {
          action: "response_detected",
          trackedEmailId: originalTrackedEmailId,
          threadInfo: detection.threadInfo ?? {
            conversationId: "",
            isNewThread: false,
            threadDepth: 0,
          },
        },
      };
    } catch (error) {
      console.error("Error processing email response:", error);
      return {
        success: false,
        error: "Failed to process email response",
        code: "RESPONSE_PROCESSING_FAILED",
      };
    }
  }

  /**
   * Insère un nouvel email tracké
   */
  private async insertNewTrackedEmail(
    email: MicrosoftGraphEmailMessage,
    mailboxId: string,
    options: ProcessingOptions = {}
  ): Promise<ApiResponse<ProcessingResult>> {
    try {
      // Calculer les informations de threading
      const threadInfo = await this.calculateThreadingInfo(email, options);

      // Préparer les données d'insertion
      const insertData: TrackedEmailInsert = {
        microsoft_message_id: email.id,
        conversation_id: email.conversationId || null,
        conversation_index: email.conversationIndex || null,
        internet_message_id: email.internetMessageId || "",
        in_reply_to: email.inReplyTo || null,
        references: email.references || null,
        mailbox_id: mailboxId,
        subject: email.subject || "",
        sender_email: email.sender?.emailAddress?.address || "",
        recipient_emails:
          email.toRecipients?.map(r => r.emailAddress.address) || [],
        cc_emails: email.ccRecipients?.map(r => r.emailAddress.address) || null,
        bcc_emails:
          email.bccRecipients?.map(r => r.emailAddress.address) || null,
        body_preview: email.bodyPreview || "",
        has_attachments: email.hasAttachments || false,
        importance: email.importance || "normal",
        status: "pending",
        sent_at: email.sentDateTime || new Date().toISOString(),
        is_reply: threadInfo.isReply,
        thread_position: threadInfo.position,
        parent_tracked_email_id: threadInfo.parentId,
      };

      // Insérer l'email
      const { data: insertedEmail, error: insertError } = await this.supabase
        .from("tracked_emails")
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Stocker les headers si disponibles
      if (
        email.internetMessageHeaders &&
        email.internetMessageHeaders.length > 0
      ) {
        await this.storeMessageHeaders(
          insertedEmail.id,
          email.internetMessageHeaders
        );
      }

      const result: ProcessingResult = {
        action: "inserted",
        trackedEmailId: insertedEmail.id,
        threadInfo: {
          conversationId: email.conversationId,
          isNewThread: !threadInfo.parentId,
          threadDepth: threadInfo.position,
        },
      };

      if (threadInfo.parentId) {
        result.parentEmailId = threadInfo.parentId;
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error("Error inserting new tracked email:", error);
      return {
        success: false,
        error: "Failed to insert new tracked email",
        code: "EMAIL_INSERTION_FAILED",
      };
    }
  }

  /**
   * Traite plusieurs emails en lot
   */
  async processBatchEmails(
    emails: MicrosoftGraphEmailMessage[],
    mailboxId: string,
    options: ProcessingOptions = {}
  ): Promise<ApiResponse<ProcessingStats>> {
    try {
      const stats: ProcessingStats = {
        processed: 0,
        inserted: 0,
        responses: 0,
        excluded: 0,
        duplicates: 0,
        errors: 0,
      };

      const results = await Promise.allSettled(
        emails.map(email => this.processEmail(email, mailboxId, options))
      );

      for (const result of results) {
        stats.processed++;

        if (result.status === "fulfilled" && result.value.success) {
          const action = result.value.data?.action;
          switch (action) {
            case "inserted":
              stats.inserted++;
              break;
            case "response_detected":
              stats.responses++;
              break;
            case "excluded":
              stats.excluded++;
              break;
            case "duplicate":
              stats.duplicates++;
              break;
          }
        } else {
          stats.errors++;
        }
      }

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error("Error processing batch emails:", error);
      return {
        success: false,
        error: "Failed to process batch emails",
        code: "BATCH_PROCESSING_FAILED",
      };
    }
  }

  /**
   * Récupère les détails d'un email via Microsoft Graph
   */
  private async fetchEmailDetails(
    microsoftMessageId: string,
    mailboxId: string
  ): Promise<ApiResponse<MicrosoftGraphEmailMessage>> {
    try {
      // Récupérer l'utilisateur Microsoft ID depuis la mailbox
      const { data: mailbox, error: mailboxError } = await this.supabase
        .from("mailboxes")
        .select("microsoft_user_id")
        .eq("id", mailboxId)
        .single();

      if (mailboxError || !mailbox?.microsoft_user_id) {
        throw new Error("Mailbox not found or missing Microsoft User ID");
      }

      // Récupérer le message via Microsoft Graph
      const messageDetails = await microsoftGraphService.getMessage(
        mailbox.microsoft_user_id,
        microsoftMessageId,
        true // includeHeaders
      );

      return {
        success: true,
        data: messageDetails,
      };
    } catch (error) {
      console.error("Error fetching email details:", error);
      return {
        success: false,
        error: "Failed to fetch email details",
        code: "EMAIL_FETCH_FAILED",
      };
    }
  }

  /**
   * Vérifie si un email est déjà tracké
   */
  private async checkForDuplicate(
    email: MicrosoftGraphEmailMessage
  ): Promise<ApiResponse<{ id: string } | null>> {
    try {
      const { data: existing, error } = await this.supabase
        .from("tracked_emails")
        .select("id")
        .eq("internet_message_id", email.internetMessageId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return {
        success: true,
        data: existing || null,
      };
    } catch (error) {
      console.error("Error checking for duplicate:", error);
      return {
        success: false,
        error: "Failed to check for duplicate",
        code: "DUPLICATE_CHECK_FAILED",
      };
    }
  }

  /**
   * Calcule les informations de threading pour un email
   */
  private async calculateThreadingInfo(
    email: MicrosoftGraphEmailMessage,
    options: ProcessingOptions = {}
  ): Promise<{ isReply: boolean; position: number; parentId: string | null }> {
    try {
      let parentId: string | null = null;
      let position = 1;
      let isReply = false;

      // Méthode 1: Chercher par In-Reply-To
      if (email.inReplyTo) {
        const { data: parent } = await this.supabase
          .from("tracked_emails")
          .select("id, thread_position")
          .eq("internet_message_id", email.inReplyTo)
          .single();

        if (parent) {
          parentId = parent.id;
          position = (parent.thread_position || 0) + 1;
          isReply = true;
        }
      }

      // Méthode 2: Chercher par Conversation ID si pas trouvé
      if (
        !parentId &&
        email.conversationId &&
        options.enableAdvancedThreading
      ) {
        const { data: threadEmails } = await this.supabase
          .from("tracked_emails")
          .select("id, thread_position, sent_at")
          .eq("conversation_id", email.conversationId)
          .order("sent_at", { ascending: true });

        if (threadEmails && threadEmails.length > 0) {
          const lastEmail = threadEmails[threadEmails.length - 1];
          if (lastEmail) {
            parentId = lastEmail.id;
            position = (lastEmail.thread_position || 0) + 1;
            isReply = true;
          }
        }
      }

      return { isReply, position, parentId };
    } catch (error) {
      console.warn("Error calculating threading info:", error);
      return { isReply: false, position: 1, parentId: null };
    }
  }

  /**
   * Stocke les headers d'email importants
   */
  private async storeMessageHeaders(
    trackedEmailId: string,
    headers: Array<{ name: string; value: string }>
  ): Promise<void> {
    try {
      const importantHeaders = [
        "Message-ID",
        "In-Reply-To",
        "References",
        "Thread-Topic",
        "Thread-Index",
        "Auto-Submitted",
        "X-Auto-Response-Suppress",
        "Return-Path",
        "X-Mailer",
      ];

      const headersToStore = headers
        .filter(h => importantHeaders.includes(h.name))
        .map(header => ({
          tracked_email_id: trackedEmailId,
          header_name: header.name,
          header_value: header.value,
        }));

      if (headersToStore.length > 0) {
        const { error } = await this.supabase
          .from("message_headers")
          .insert(headersToStore);

        if (error) {
          console.warn("Failed to store message headers:", error);
        }
      }
    } catch (error) {
      console.warn("Error storing message headers:", error);
    }
  }

  /**
   * Annule les follow-ups en attente pour un email
   */
  private async cancelPendingFollowups(trackedEmailId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("followups")
        .update({ status: "cancelled" })
        .eq("tracked_email_id", trackedEmailId)
        .in("status", ["pending", "scheduled"]);

      if (error) {
        console.warn("Failed to cancel pending followups:", error);
      }
    } catch (error) {
      console.warn("Error cancelling pending followups:", error);
    }
  }

  /**
   * Récupère les statistiques de traitement pour une période
   */
  async getProcessingStats(
    days: number = 7,
    mailboxId?: string
  ): Promise<ApiResponse<ProcessingStats & { period: string }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = this.supabase
        .from("tracked_emails")
        .select("status, created_at")
        .gte("created_at", startDate.toISOString());

      if (mailboxId) {
        query = query.eq("mailbox_id", mailboxId);
      }

      const { data: emails, error } = await query;

      if (error) {
        throw error;
      }

      const stats: ProcessingStats = {
        processed: emails?.length || 0,
        inserted: emails?.length || 0,
        responses: emails?.filter(e => e.status === "responded").length || 0,
        excluded: 0, // TODO: Add exclusion tracking
        duplicates: 0, // TODO: Add duplicate tracking
        errors: 0, // TODO: Add error tracking
      };

      return {
        success: true,
        data: {
          ...stats,
          period: `${days} days`,
        },
      };
    } catch (error) {
      console.error("Error getting processing stats:", error);
      return {
        success: false,
        error: "Failed to get processing stats",
        code: "STATS_FETCH_FAILED",
      };
    }
  }
}

/**
 * Instance singleton du service de traitement
 */
export const emailProcessingService = new EmailProcessingService();
