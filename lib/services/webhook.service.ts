/**
 * Webhook Service
 * Service pour la gestion des abonnements webhook Microsoft Graph
 * Interface entre l'application Next.js et les Edge Functions Supabase
 */

import { createClient } from "@/lib/supabase/client";
import { microsoftGraphService } from "./microsoft-graph.service";
import type {
  WebhookSubscriptionRequest,
  SubscriptionStatus,
  ApiResponse,
  WebhookServiceConfig,
} from "@/lib/types/microsoft-graph";

/**
 * Configuration par défaut du service webhook
 */
const DEFAULT_CONFIG: WebhookServiceConfig = {
  baseUrl:
    process.env.MICROSOFT_WEBHOOK_BASE_URL ||
    "http://127.0.0.1:54321/functions/v1",
  maxRenewalsPerDay: 10,
  renewBeforeExpiryHours: 1,
};

/**
 * Service de gestion des webhooks Microsoft Graph
 */
export class WebhookService {
  private supabase = createClient();
  private config: WebhookServiceConfig;

  constructor(config: Partial<WebhookServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Crée un nouvel abonnement webhook pour une mailbox
   */
  async createSubscription(
    mailboxId: string,
    microsoftUserId: string,
    options: {
      changeTypes?: string[];
      expirationHours?: number;
      includeResourceData?: boolean;
    } = {}
  ): Promise<ApiResponse<SubscriptionStatus>> {
    try {
      // Vérifier que la mailbox existe et est active
      const { data: mailbox, error: mailboxError } = await this.supabase
        .from("mailboxes")
        .select("*")
        .eq("id", mailboxId)
        .eq("is_active", true)
        .single();

      if (mailboxError || !mailbox) {
        return {
          success: false,
          error: "Mailbox not found or inactive",
        };
      }

      // Vérifier qu'il n'y a pas déjà un abonnement actif
      const existingSubscription = await this.getActiveSubscription(mailboxId);
      if (existingSubscription.success && existingSubscription.data) {
        return {
          success: false,
          error: "An active subscription already exists for this mailbox",
          code: "SUBSCRIPTION_EXISTS",
        };
      }

      // Préparer les paramètres de l'abonnement
      const {
        changeTypes = ["created"],
        expirationHours = 72, // Maximum Microsoft Graph
        includeResourceData = false,
      } = options;

      const expirationDateTime = new Date(
        Date.now() + expirationHours * 60 * 60 * 1000
      );
      const notificationUrl = `${this.config.baseUrl}/microsoft-webhook`;

      const subscriptionRequest: WebhookSubscriptionRequest = {
        changeType: changeTypes.join(","),
        notificationUrl,
        resource: `/users/${microsoftUserId}/mailFolders/sentitems/messages`,
        expirationDateTime: expirationDateTime.toISOString(),
        // clientState sera géré par l'Edge Function avec le secret Supabase
        clientState: "managed-by-edge-function",
        includeResourceData,
      };

      // Créer l'abonnement via Microsoft Graph
      const graphSubscription =
        await microsoftGraphService.createSubscription(subscriptionRequest);

      // Stocker l'abonnement en base de données
      const { error: storeError } = await this.supabase
        .from("webhook_subscriptions")
        .insert({
          subscription_id: graphSubscription.id,
          resource: graphSubscription.resource,
          change_type: graphSubscription.changeType,
          notification_url: graphSubscription.notificationUrl,
          expiration_date_time: graphSubscription.expirationDateTime,
          client_state: graphSubscription.clientState,
          mailbox_id: mailboxId,
          include_resource_data: graphSubscription.includeResourceData,
          is_active: true,
          renewal_count: 0,
        })
        .select()
        .single();

      if (storeError) {
        // Tentative de nettoyage si l'insertion échoue
        try {
          await microsoftGraphService.deleteSubscription(graphSubscription.id);
        } catch (cleanupError) {
          console.warn(
            "Failed to cleanup Graph subscription after store error:",
            cleanupError
          );
        }
        throw storeError;
      }

      const subscriptionStatus: SubscriptionStatus = {
        id: graphSubscription.id,
        isActive: true,
        expiresAt: new Date(graphSubscription.expirationDateTime),
        renewalCount: 0,
        resource: graphSubscription.resource,
        mailboxId,
      };

      return {
        success: true,
        data: subscriptionStatus,
      };
    } catch (error) {
      console.error("Error creating webhook subscription:", error);
      return {
        success: false,
        error: "Failed to create webhook subscription",
        code:
          error instanceof Error && "code" in error
            ? (error as Error & { code: string }).code
            : "SUBSCRIPTION_CREATION_FAILED",
      };
    }
  }

  /**
   * Renouvelle un abonnement existant
   */
  async renewSubscription(
    subscriptionId: string,
    expirationHours: number = 72
  ): Promise<ApiResponse<SubscriptionStatus>> {
    try {
      // Récupérer l'abonnement existant
      const { data: subscription, error: subError } = await this.supabase
        .from("webhook_subscriptions")
        .select("*")
        .eq("subscription_id", subscriptionId)
        .eq("is_active", true)
        .single();

      if (subError || !subscription) {
        return {
          success: false,
          error: "Subscription not found or inactive",
          code: "SUBSCRIPTION_NOT_FOUND",
        };
      }

      // Vérifier le nombre de renouvellements par jour
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (subscription.last_renewed_at) {
        const lastRenewal = new Date(subscription.last_renewed_at);
        lastRenewal.setHours(0, 0, 0, 0);

        if (
          lastRenewal.getTime() === today.getTime() &&
          (subscription.renewal_count || 0) >= this.config.maxRenewalsPerDay
        ) {
          return {
            success: false,
            error: "Maximum renewals per day reached",
            code: "MAX_RENEWALS_EXCEEDED",
          };
        }
      }

      // Calculer la nouvelle date d'expiration
      const newExpirationDateTime = new Date(
        Date.now() + expirationHours * 60 * 60 * 1000
      );

      // Renouveler via Microsoft Graph
      const updatedSubscription =
        await microsoftGraphService.updateSubscription(
          subscriptionId,
          newExpirationDateTime.toISOString()
        );

      // Mettre à jour en base de données
      const { error: updateError } = await this.supabase
        .from("webhook_subscriptions")
        .update({
          expiration_date_time: updatedSubscription.expirationDateTime,
          last_renewed_at: new Date().toISOString(),
          renewal_count: (subscription.renewal_count || 0) + 1,
        })
        .eq("subscription_id", subscriptionId);

      if (updateError) {
        throw updateError;
      }

      const subscriptionStatus: SubscriptionStatus = {
        id: updatedSubscription.id,
        isActive: true,
        expiresAt: new Date(updatedSubscription.expirationDateTime),
        lastRenewal: new Date(),
        renewalCount: (subscription.renewal_count || 0) + 1,
        resource: updatedSubscription.resource,
        mailboxId: subscription.mailbox_id || "",
      };

      return {
        success: true,
        data: subscriptionStatus,
      };
    } catch (error) {
      console.error("Error renewing webhook subscription:", error);
      return {
        success: false,
        error: "Failed to renew webhook subscription",
        code: "SUBSCRIPTION_RENEWAL_FAILED",
      };
    }
  }

  /**
   * Supprime un abonnement webhook
   */
  async deleteSubscription(subscriptionId: string): Promise<ApiResponse<void>> {
    try {
      // Supprimer de Microsoft Graph
      try {
        await microsoftGraphService.deleteSubscription(subscriptionId);
      } catch (graphError) {
        console.warn(
          "Failed to delete from Microsoft Graph (may already be deleted):",
          graphError
        );
      }

      // Marquer comme inactif en base de données
      const { error: updateError } = await this.supabase
        .from("webhook_subscriptions")
        .update({ is_active: false })
        .eq("subscription_id", subscriptionId);

      if (updateError) {
        throw updateError;
      }

      return { success: true };
    } catch (error) {
      console.error("Error deleting webhook subscription:", error);
      return {
        success: false,
        error: "Failed to delete webhook subscription",
        code: "SUBSCRIPTION_DELETION_FAILED",
      };
    }
  }

  /**
   * Supprime tous les abonnements d'une mailbox
   */
  async deleteMailboxSubscriptions(
    mailboxId: string
  ): Promise<ApiResponse<{ deleted: number }>> {
    try {
      // Récupérer tous les abonnements actifs de la mailbox
      const { data: subscriptions, error: fetchError } = await this.supabase
        .from("webhook_subscriptions")
        .select("subscription_id")
        .eq("mailbox_id", mailboxId)
        .eq("is_active", true);

      if (fetchError) {
        throw fetchError;
      }

      if (!subscriptions || subscriptions.length === 0) {
        return {
          success: true,
          data: { deleted: 0 },
        };
      }

      // Supprimer chaque abonnement de Microsoft Graph
      const deletionResults = await Promise.allSettled(
        subscriptions.map(sub =>
          microsoftGraphService.deleteSubscription(sub.subscription_id)
        )
      );

      // Marquer tous comme inactifs en base
      const { error: updateError } = await this.supabase
        .from("webhook_subscriptions")
        .update({ is_active: false })
        .eq("mailbox_id", mailboxId);

      if (updateError) {
        throw updateError;
      }

      const successful = deletionResults.filter(
        r => r.status === "fulfilled"
      ).length;

      return {
        success: true,
        data: { deleted: successful },
      };
    } catch (error) {
      console.error("Error deleting mailbox subscriptions:", error);
      return {
        success: false,
        error: "Failed to delete mailbox subscriptions",
        code: "MAILBOX_SUBSCRIPTIONS_DELETION_FAILED",
      };
    }
  }

  /**
   * Récupère l'abonnement actif d'une mailbox
   */
  async getActiveSubscription(
    mailboxId: string
  ): Promise<ApiResponse<SubscriptionStatus>> {
    try {
      const { data: subscription, error } = await this.supabase
        .from("webhook_subscriptions")
        .select("*")
        .eq("mailbox_id", mailboxId)
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = not found
        throw error;
      }

      if (!subscription) {
        return {
          success: false,
          error: "No active subscription found",
          code: "SUBSCRIPTION_NOT_FOUND",
        };
      }

      const subscriptionStatus: SubscriptionStatus = {
        id: subscription.subscription_id,
        isActive: subscription.is_active || false,
        expiresAt: new Date(subscription.expiration_date_time),
        renewalCount: subscription.renewal_count || 0,
        resource: subscription.resource,
        mailboxId: subscription.mailbox_id || "",
      };

      if (subscription.last_renewed_at) {
        subscriptionStatus.lastRenewal = new Date(subscription.last_renewed_at);
      }

      return {
        success: true,
        data: subscriptionStatus,
      };
    } catch (error) {
      console.error("Error getting active subscription:", error);
      return {
        success: false,
        error: "Failed to get active subscription",
        code: "SUBSCRIPTION_FETCH_FAILED",
      };
    }
  }

  /**
   * Liste tous les abonnements (avec filtres optionnels)
   */
  async listSubscriptions(
    filters: {
      mailboxId?: string;
      isActive?: boolean;
      expiringSoon?: boolean;
    } = {}
  ): Promise<ApiResponse<SubscriptionStatus[]>> {
    try {
      let query = this.supabase
        .from("webhook_subscriptions")
        .select(
          `
          *,
          mailboxes (
            email_address,
            display_name
          )
        `
        )
        .order("created_at", { ascending: false });

      if (filters.mailboxId) {
        query = query.eq("mailbox_id", filters.mailboxId);
      }

      if (filters.isActive !== undefined) {
        query = query.eq("is_active", filters.isActive);
      }

      if (filters.expiringSoon) {
        const thresholdDate = new Date(
          Date.now() + this.config.renewBeforeExpiryHours * 60 * 60 * 1000
        );
        query = query.lt("expiration_date_time", thresholdDate.toISOString());
      }

      const { data: subscriptions, error } = await query;

      if (error) {
        throw error;
      }

      const subscriptionStatuses: SubscriptionStatus[] = (
        subscriptions || []
      ).map(sub => {
        const status: SubscriptionStatus = {
          id: sub.subscription_id,
          isActive: sub.is_active || false,
          expiresAt: new Date(sub.expiration_date_time),
          renewalCount: sub.renewal_count || 0,
          resource: sub.resource,
          mailboxId: sub.mailbox_id || "",
        };

        if (sub.last_renewed_at) {
          status.lastRenewal = new Date(sub.last_renewed_at);
        }

        return status;
      });

      return {
        success: true,
        data: subscriptionStatuses,
      };
    } catch (error) {
      console.error("Error listing subscriptions:", error);
      return {
        success: false,
        error: "Failed to list subscriptions",
        code: "SUBSCRIPTIONS_LIST_FAILED",
      };
    }
  }

  /**
   * Vérifie la santé des abonnements et identifie ceux à renouveler
   */
  async checkSubscriptionHealth(): Promise<
    ApiResponse<{
      total: number;
      active: number;
      expiringSoon: number;
      expired: number;
      needingRenewal: string[];
    }>
  > {
    try {
      const { data: subscriptions, error } = await this.supabase
        .from("webhook_subscriptions")
        .select("subscription_id, expiration_date_time, is_active");

      if (error) {
        throw error;
      }

      const now = new Date();
      const renewThreshold = new Date(
        now.getTime() + this.config.renewBeforeExpiryHours * 60 * 60 * 1000
      );

      let active = 0;
      let expiringSoon = 0;
      let expired = 0;
      const needingRenewal: string[] = [];

      for (const sub of subscriptions || []) {
        const expiresAt = new Date(sub.expiration_date_time);

        if (!sub.is_active || expiresAt <= now) {
          expired++;
        } else if (expiresAt <= renewThreshold) {
          expiringSoon++;
          needingRenewal.push(sub.subscription_id);
          active++;
        } else {
          active++;
        }
      }

      return {
        success: true,
        data: {
          total: subscriptions?.length || 0,
          active,
          expiringSoon,
          expired,
          needingRenewal,
        },
      };
    } catch (error) {
      console.error("Error checking subscription health:", error);
      return {
        success: false,
        error: "Failed to check subscription health",
        code: "HEALTH_CHECK_FAILED",
      };
    }
  }

  /**
   * Renouvelle automatiquement les abonnements qui expirent bientôt
   */
  async renewExpiringSoon(): Promise<
    ApiResponse<{
      checked: number;
      renewed: number;
      failed: number;
      errors: string[];
    }>
  > {
    try {
      const healthCheck = await this.checkSubscriptionHealth();
      if (!healthCheck.success || !healthCheck.data) {
        throw new Error("Failed to check subscription health");
      }

      const { needingRenewal } = healthCheck.data;
      const results = await Promise.allSettled(
        needingRenewal.map(subscriptionId =>
          this.renewSubscription(subscriptionId)
        )
      );

      let renewed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.success) {
          renewed++;
        } else {
          failed++;
          const error =
            result.status === "rejected" ? result.reason : result.value.error;
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }

      return {
        success: true,
        data: {
          checked: needingRenewal.length,
          renewed,
          failed,
          errors,
        },
      };
    } catch (error) {
      console.error("Error renewing expiring subscriptions:", error);
      return {
        success: false,
        error: "Failed to renew expiring subscriptions",
        code: "AUTO_RENEWAL_FAILED",
      };
    }
  }

  /**
   * Nettoie les abonnements expirés
   */
  async cleanupExpiredSubscriptions(): Promise<
    ApiResponse<{ cleaned: number }>
  > {
    try {
      const now = new Date();

      // Marquer les abonnements expirés comme inactifs
      const { count, error } = await this.supabase
        .from("webhook_subscriptions")
        .update({ is_active: false })
        .eq("is_active", true)
        .lt("expiration_date_time", now.toISOString());

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: { cleaned: count || 0 },
      };
    } catch (error) {
      console.error("Error cleaning up expired subscriptions:", error);
      return {
        success: false,
        error: "Failed to cleanup expired subscriptions",
        code: "CLEANUP_FAILED",
      };
    }
  }
}

/**
 * Instance singleton du service webhook
 */
export const webhookService = new WebhookService();
