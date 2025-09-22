/**
 * Email Detection Service
 * Service pour la détection et le traitement intelligent des emails entrants
 * Gère la logique de threading, détection de réponses et exclusions
 */

import { createClient } from "@/lib/supabase/client";
import type {
  MicrosoftGraphEmailMessage,
  EmailThreadingInfo,
  ApiResponse,
} from "@/lib/types/microsoft-graph";

/**
 * Interface pour les résultats de détection
 */
export interface DetectionResult {
  isResponse: boolean;
  originalTrackedEmailId?: string;
  threadingMethod:
    | "conversation_id"
    | "internet_message_id"
    | "in_reply_to"
    | "references"
    | "subject_pattern";
  confidence: "high" | "medium" | "low";
  threadInfo?: EmailThreadingInfo;
}

/**
 * Interface pour les options de détection
 */
interface DetectionOptions {
  includeThreading?: boolean;
  maxLookbackDays?: number;
  enableSubjectMatching?: boolean;
  skipInternalEmails?: boolean;
}

/**
 * Interface pour la configuration d'exclusion
 */
interface ExclusionConfig {
  excludeInternalEmails: boolean;
  internalDomains: string[];
  excludeAutoResponses: boolean;
  excludeDeliveryReports: boolean;
}

/**
 * Service de détection d'emails intelligent
 */
export class EmailDetectionService {
  private supabase = createClient();

  constructor() {}

  /**
   * Traite un email entrant et détermine s'il s'agit d'une réponse
   */
  async processIncomingEmail(
    email: MicrosoftGraphEmailMessage,
    mailboxId: string,
    options: DetectionOptions = {}
  ): Promise<ApiResponse<DetectionResult>> {
    try {
      // Vérifier les exclusions avant traitement
      const shouldExclude = await this.shouldExcludeEmail(email, options);
      if (shouldExclude.success && shouldExclude.data) {
        return {
          success: false,
          error: "Email excluded from processing",
          code: "EMAIL_EXCLUDED",
        };
      }

      // Effectuer la détection de réponse avec plusieurs méthodes
      const detectionResult = await this.detectEmailResponse(email, options);

      if (!detectionResult.success) {
        return detectionResult;
      }

      // Log de la tentative de détection
      if (detectionResult.data) {
        await this.logDetectionAttempt(email, detectionResult.data, mailboxId);
      }

      return detectionResult;
    } catch (error) {
      console.error("Error processing incoming email:", error);
      return {
        success: false,
        error: "Failed to process incoming email",
        code: "EMAIL_PROCESSING_FAILED",
      };
    }
  }

  /**
   * Détecte si un email est une réponse en utilisant plusieurs méthodes
   */
  private async detectEmailResponse(
    email: MicrosoftGraphEmailMessage,
    options: DetectionOptions = {}
  ): Promise<ApiResponse<DetectionResult>> {
    try {
      const methods = [
        this.detectByConversationId.bind(this),
        this.detectByInternetMessageId.bind(this),
        this.detectByInReplyTo.bind(this),
        this.detectByReferences.bind(this),
        this.detectBySubjectPattern.bind(this),
      ];

      // Essayer chaque méthode de détection par ordre de fiabilité
      for (const method of methods) {
        const result = await method(email, options);
        if (result.success && result.data?.isResponse) {
          return result;
        }
      }

      // Aucune correspondance trouvée
      return {
        success: true,
        data: {
          isResponse: false,
          threadingMethod: "conversation_id",
          confidence: "high",
        },
      };
    } catch (error) {
      console.error("Error detecting email response:", error);
      return {
        success: false,
        error: "Failed to detect email response",
        code: "DETECTION_FAILED",
      };
    }
  }

  /**
   * Détection par Conversation ID (méthode la plus fiable)
   */
  private async detectByConversationId(
    email: MicrosoftGraphEmailMessage,
    _options: DetectionOptions = {}
  ): Promise<ApiResponse<DetectionResult>> {
    try {
      if (!email.conversationId) {
        return {
          success: true,
          data: {
            isResponse: false,
            threadingMethod: "conversation_id",
            confidence: "high",
          },
        };
      }

      const { data: trackedEmail, error } = await this.supabase
        .from("tracked_emails")
        .select("id, subject, sent_at, conversation_id")
        .eq("conversation_id", email.conversationId)
        .eq("status", "pending")
        .order("sent_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (trackedEmail) {
        return {
          success: true,
          data: {
            isResponse: true,
            originalTrackedEmailId: trackedEmail.id,
            threadingMethod: "conversation_id",
            confidence: "high",
            threadInfo: {
              conversationId: email.conversationId,
              isNewThread: false,
              threadDepth: await this.calculateThreadDepth(
                email.conversationId
              ),
            },
          },
        };
      }

      return {
        success: true,
        data: {
          isResponse: false,
          threadingMethod: "conversation_id",
          confidence: "high",
        },
      };
    } catch (error) {
      console.error("Error in conversation ID detection:", error);
      return {
        success: false,
        error: "Conversation ID detection failed",
        code: "CONVERSATION_DETECTION_FAILED",
      };
    }
  }

  /**
   * Détection par Internet Message ID
   */
  private async detectByInternetMessageId(
    email: MicrosoftGraphEmailMessage,
    _options: DetectionOptions = {}
  ): Promise<ApiResponse<DetectionResult>> {
    try {
      if (!email.internetMessageId) {
        return {
          success: true,
          data: {
            isResponse: false,
            threadingMethod: "internet_message_id",
            confidence: "high",
          },
        };
      }

      const { data: trackedEmail, error } = await this.supabase
        .from("tracked_emails")
        .select("id, subject, sent_at, internet_message_id")
        .eq("internet_message_id", email.internetMessageId)
        .eq("status", "pending")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (trackedEmail) {
        return {
          success: true,
          data: {
            isResponse: true,
            originalTrackedEmailId: trackedEmail.id,
            threadingMethod: "internet_message_id",
            confidence: "high",
          },
        };
      }

      return {
        success: true,
        data: {
          isResponse: false,
          threadingMethod: "internet_message_id",
          confidence: "high",
        },
      };
    } catch (error) {
      console.error("Error in Internet Message ID detection:", error);
      return {
        success: false,
        error: "Internet Message ID detection failed",
        code: "MESSAGE_ID_DETECTION_FAILED",
      };
    }
  }

  /**
   * Détection par In-Reply-To header
   */
  private async detectByInReplyTo(
    email: MicrosoftGraphEmailMessage,
    _options: DetectionOptions = {}
  ): Promise<ApiResponse<DetectionResult>> {
    try {
      if (!email.inReplyTo) {
        return {
          success: true,
          data: {
            isResponse: false,
            threadingMethod: "in_reply_to",
            confidence: "medium",
          },
        };
      }

      const { data: trackedEmail, error } = await this.supabase
        .from("tracked_emails")
        .select("id, subject, sent_at, internet_message_id")
        .eq("internet_message_id", email.inReplyTo)
        .eq("status", "pending")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (trackedEmail) {
        return {
          success: true,
          data: {
            isResponse: true,
            originalTrackedEmailId: trackedEmail.id,
            threadingMethod: "in_reply_to",
            confidence: "high",
          },
        };
      }

      return {
        success: true,
        data: {
          isResponse: false,
          threadingMethod: "in_reply_to",
          confidence: "medium",
        },
      };
    } catch (error) {
      console.error("Error in In-Reply-To detection:", error);
      return {
        success: false,
        error: "In-Reply-To detection failed",
        code: "IN_REPLY_TO_DETECTION_FAILED",
      };
    }
  }

  /**
   * Détection par References header
   */
  private async detectByReferences(
    email: MicrosoftGraphEmailMessage,
    _options: DetectionOptions = {}
  ): Promise<ApiResponse<DetectionResult>> {
    try {
      if (!email.references || email.references.trim() === "") {
        return {
          success: true,
          data: {
            isResponse: false,
            threadingMethod: "references",
            confidence: "medium",
          },
        };
      }

      // Parser les références (format: <id1> <id2> <id3>)
      const references = email.references
        .split(/\s+/)
        .map(ref => ref.replace(/[<>]/g, ""))
        .filter(ref => ref.length > 0);

      if (references.length === 0) {
        return {
          success: true,
          data: {
            isResponse: false,
            threadingMethod: "references",
            confidence: "medium",
          },
        };
      }

      // Chercher dans les tracked emails
      const { data: trackedEmails, error } = await this.supabase
        .from("tracked_emails")
        .select("id, subject, sent_at, internet_message_id")
        .in("internet_message_id", references)
        .eq("status", "pending")
        .order("sent_at", { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      if (trackedEmails && trackedEmails.length > 0) {
        const firstEmail = trackedEmails[0];
        if (firstEmail) {
          return {
            success: true,
            data: {
              isResponse: true,
              originalTrackedEmailId: firstEmail.id,
              threadingMethod: "references",
              confidence: "medium",
            },
          };
        }
      }

      return {
        success: true,
        data: {
          isResponse: false,
          threadingMethod: "references",
          confidence: "medium",
        },
      };
    } catch (error) {
      console.error("Error in References detection:", error);
      return {
        success: false,
        error: "References detection failed",
        code: "REFERENCES_DETECTION_FAILED",
      };
    }
  }

  /**
   * Détection par pattern de sujet (fallback)
   */
  private async detectBySubjectPattern(
    email: MicrosoftGraphEmailMessage,
    options: DetectionOptions = {}
  ): Promise<ApiResponse<DetectionResult>> {
    try {
      if (!options.enableSubjectMatching || !email.subject) {
        return {
          success: true,
          data: {
            isResponse: false,
            threadingMethod: "subject_pattern",
            confidence: "low",
          },
        };
      }

      // Nettoyer le sujet (supprimer RE:, FW:, etc.)
      const cleanSubject = this.cleanSubject(email.subject);

      if (cleanSubject.length < 5) {
        return {
          success: true,
          data: {
            isResponse: false,
            threadingMethod: "subject_pattern",
            confidence: "low",
          },
        };
      }

      // Chercher des emails avec un sujet similaire
      const lookbackDate = new Date();
      lookbackDate.setDate(
        lookbackDate.getDate() - (options.maxLookbackDays || 30)
      );

      const { data: trackedEmails, error } = await this.supabase
        .from("tracked_emails")
        .select("id, subject, sent_at")
        .eq("status", "pending")
        .gte("sent_at", lookbackDate.toISOString())
        .order("sent_at", { ascending: false });

      if (error) {
        throw error;
      }

      // Recherche par similarité de sujet
      for (const trackedEmail of trackedEmails || []) {
        const trackedCleanSubject = this.cleanSubject(trackedEmail.subject);
        if (
          this.calculateSubjectSimilarity(cleanSubject, trackedCleanSubject) >
          0.8
        ) {
          return {
            success: true,
            data: {
              isResponse: true,
              originalTrackedEmailId: trackedEmail.id,
              threadingMethod: "subject_pattern",
              confidence: "low",
            },
          };
        }
      }

      return {
        success: true,
        data: {
          isResponse: false,
          threadingMethod: "subject_pattern",
          confidence: "low",
        },
      };
    } catch (error) {
      console.error("Error in subject pattern detection:", error);
      return {
        success: false,
        error: "Subject pattern detection failed",
        code: "SUBJECT_DETECTION_FAILED",
      };
    }
  }

  /**
   * Vérifie si un email doit être exclu du traitement
   */
  private async shouldExcludeEmail(
    email: MicrosoftGraphEmailMessage,
    options: DetectionOptions = {}
  ): Promise<ApiResponse<boolean>> {
    try {
      const exclusionConfig = await this.getExclusionConfig();

      if (!exclusionConfig.success || !exclusionConfig.data) {
        return { success: true, data: false };
      }

      const config = exclusionConfig.data;

      // Vérifier les emails internes
      if (
        config.excludeInternalEmails &&
        options.skipInternalEmails !== false
      ) {
        const senderDomain = email.sender?.emailAddress?.address?.split("@")[1];
        if (senderDomain && config.internalDomains.includes(senderDomain)) {
          return { success: true, data: true };
        }
      }

      // Vérifier les réponses automatiques
      if (config.excludeAutoResponses) {
        if (this.isAutoResponse(email)) {
          return { success: true, data: true };
        }
      }

      // Vérifier les rapports de livraison
      if (config.excludeDeliveryReports) {
        if (this.isDeliveryReport(email)) {
          return { success: true, data: true };
        }
      }

      return { success: true, data: false };
    } catch (error) {
      console.error("Error checking email exclusions:", error);
      return {
        success: false,
        error: "Failed to check email exclusions",
        code: "EXCLUSION_CHECK_FAILED",
      };
    }
  }

  /**
   * Récupère la configuration d'exclusion
   */
  private async getExclusionConfig(): Promise<ApiResponse<ExclusionConfig>> {
    try {
      const { data: config, error } = await this.supabase
        .from("system_config")
        .select("value")
        .eq("key", "email_exclusion_config")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!config?.value) {
        // Configuration par défaut
        return {
          success: true,
          data: {
            excludeInternalEmails: true,
            internalDomains: [],
            excludeAutoResponses: true,
            excludeDeliveryReports: true,
          },
        };
      }

      return {
        success: true,
        data: JSON.parse(config.value as string),
      };
    } catch (error) {
      console.error("Error getting exclusion config:", error);
      return {
        success: false,
        error: "Failed to get exclusion config",
        code: "CONFIG_FETCH_FAILED",
      };
    }
  }

  /**
   * Calcule la profondeur du thread
   */
  private async calculateThreadDepth(conversationId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from("tracked_emails")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conversationId);

      if (error) {
        console.warn("Error calculating thread depth:", error);
        return 1;
      }

      return (count || 0) + 1;
    } catch (error) {
      console.warn("Error calculating thread depth:", error);
      return 1;
    }
  }

  /**
   * Nettoie le sujet d'un email
   */
  private cleanSubject(subject: string): string {
    return subject
      .replace(/^(RE|FW|FWD|AW|WG|TR|SV|VS|VB):\s*/gi, "")
      .replace(/\[[^\]]*\]/g, "")
      .trim()
      .toLowerCase();
  }

  /**
   * Calcule la similarité entre deux sujets
   */
  private calculateSubjectSimilarity(
    subject1: string,
    subject2: string
  ): number {
    if (subject1 === subject2) return 1;

    const words1 = subject1.split(/\s+/);
    const words2 = subject2.split(/\s+/);

    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];

    return intersection.length / union.length;
  }

  /**
   * Vérifie si un email est une réponse automatique
   */
  private isAutoResponse(email: MicrosoftGraphEmailMessage): boolean {
    // Vérifier le sujet
    const autoResponseSubjects = [
      "auto-reply",
      "automatic reply",
      "out of office",
      "away",
      "vacation",
      "réponse automatique",
      "absent",
      "congés",
      "vacances",
    ];

    const subject = email.subject?.toLowerCase() || "";
    if (autoResponseSubjects.some(pattern => subject.includes(pattern))) {
      return true;
    }

    // Vérifier le corps du message (preview)
    const body = email.bodyPreview?.toLowerCase() || "";
    if (autoResponseSubjects.some(pattern => body.includes(pattern))) {
      return true;
    }

    return false;
  }

  /**
   * Vérifie si un email est un rapport de livraison
   */
  private isDeliveryReport(email: MicrosoftGraphEmailMessage): boolean {
    const deliveryIndicators = [
      "delivery receipt",
      "read receipt",
      "delivery notification",
      "accusé de réception",
      "confirmation de lecture",
    ];

    const subject = email.subject?.toLowerCase() || "";
    return deliveryIndicators.some(pattern => subject.includes(pattern));
  }

  /**
   * Log une tentative de détection
   */
  private async logDetectionAttempt(
    email: MicrosoftGraphEmailMessage,
    result: DetectionResult,
    _mailboxId: string
  ): Promise<void> {
    try {
      await this.supabase.from("detection_logs").insert({
        microsoft_message_id: email.id,
        conversation_id: email.conversationId,
        is_response: result.isResponse,
        tracked_email_id: result.originalTrackedEmailId ?? null,
        detection_method: result.threadingMethod,
        rejection_reason: result.isResponse ? null : "not_detected",
        detection_time_ms: 0, // TODO: Mesurer le temps réel de détection
      });
    } catch (error) {
      console.warn("Failed to log detection attempt:", error);
    }
  }
}

/**
 * Instance singleton du service de détection
 */
export const emailDetectionService = new EmailDetectionService();
