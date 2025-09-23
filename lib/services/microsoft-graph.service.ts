/**
 * Microsoft Graph Client Service
 * Service principal pour l'authentification et l'interaction avec Microsoft Graph API
 * Utilise Application Permissions pour l'accès backend serveur-à-serveur
 */

import {
  Client,
  AuthenticationProvider,
  AuthenticationProviderOptions,
} from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { createClient } from "@/lib/supabase/client";
import type {
  MicrosoftGraphAuthConfig,
  MicrosoftGraphEmailMessage,
  MicrosoftGraphUser,
  WebhookSubscriptionRequest,
  WebhookSubscriptionResponse,
  MicrosoftGraphApiError,
  MicrosoftGraphConfig,
} from "@/lib/types/microsoft-graph";

/**
 * Configuration par défaut pour Microsoft Graph
 */
const DEFAULT_CONFIG: MicrosoftGraphConfig = {
  baseUrl: "https://graph.microsoft.com",
  apiVersion: "v1.0",
  maxRetries: 3,
  timeoutMs: 30000,
  rateLimitDelay: 1000,
};

/**
 * Scopes nécessaires pour l'application (Application Permissions)
 */
const REQUIRED_SCOPES = [
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read.All",
];

/**
 * Service principal pour Microsoft Graph
 */
export class MicrosoftGraphService {
  private client: Client | null = null;
  private credential: ClientSecretCredential | null = null;
  private config: MicrosoftGraphConfig;
  private supabase = createClient();
  private tokenCache: Map<string, { token: string; expiresAt: Date }> =
    new Map();

  constructor(config: Partial<MicrosoftGraphConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialise le client Microsoft Graph avec les credentials
   */
  private async initializeClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    const authConfig = await this.getAuthConfig();

    this.credential = new ClientSecretCredential(
      authConfig.tenantId,
      authConfig.clientId,
      authConfig.clientSecret
    );

    // Configuration du middleware d'authentification
    const authProvider: AuthenticationProvider = {
      getAccessToken: async (
        authenticationProviderOptions?: AuthenticationProviderOptions
      ) => {
        const requestedScopes =
          authenticationProviderOptions?.scopes || REQUIRED_SCOPES;
        const cacheKey = requestedScopes.join(",");

        // Vérifier le cache
        const cached = this.tokenCache.get(cacheKey);
        if (cached && cached.expiresAt > new Date()) {
          return cached.token;
        }

        try {
          if (!this.credential) {
            throw new Error("Credential not initialized");
          }
          const tokenResponse = await this.credential.getToken(requestedScopes);

          if (!tokenResponse) {
            throw new Error("Failed to acquire access token");
          }

          // Mettre en cache le token
          const expiresAt = new Date(tokenResponse.expiresOnTimestamp);
          this.tokenCache.set(cacheKey, {
            token: tokenResponse.token,
            expiresAt,
          });

          // Stocker le token en base (chiffré)
          await this.storeTokenSecurely(
            tokenResponse.token,
            expiresAt,
            requestedScopes
          );

          return tokenResponse.token;
        } catch (error) {
          console.error("Error acquiring access token:", error);
          throw this.createGraphError(
            "AUTH_FAILED",
            "Failed to acquire access token",
            error
          );
        }
      },
    };

    this.client = Client.initWithMiddleware({
      authProvider,
      defaultVersion: this.config.apiVersion,
      debugLogging: process.env.NODE_ENV === "development",
    });

    return this.client;
  }

  /**
   * Récupère la configuration d'authentification depuis les variables d'environnement
   */
  private async getAuthConfig(): Promise<MicrosoftGraphAuthConfig> {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      throw new Error(
        "Microsoft Graph credentials not configured. Please set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_TENANT_ID"
      );
    }

    return {
      clientId,
      clientSecret,
      tenantId,
      scopes: REQUIRED_SCOPES,
    };
  }

  /**
   * Stocke le token de manière sécurisée en base de données
   */
  private async storeTokenSecurely(
    token: string,
    expiresAt: Date,
    scopes: string[]
  ): Promise<void> {
    try {
      // Note: Dans un vrai environnement, on devrait chiffrer le token
      // Ici on utilise une approche simplifiée pour la démo
      const { error } = await this.supabase
        .from("microsoft_graph_tokens")
        .upsert(
          {
            token_type: "access_token",
            encrypted_token: token, // TODO: Implémenter le chiffrement
            expires_at: expiresAt.toISOString(),
            scope: scopes.join(" "),
            last_refreshed_at: new Date().toISOString(),
          },
          {
            onConflict: "token_type",
          }
        );

      if (error) {
        console.warn("Failed to store token in database:", error);
      }
    } catch (error) {
      console.warn("Error storing token:", error);
    }
  }

  /**
   * Récupère un utilisateur par son ID
   */
  async getUser(userId: string): Promise<MicrosoftGraphUser> {
    try {
      const client = await this.initializeClient();

      const user = await client
        .api(`/users/${userId}`)
        .select([
          "id",
          "userPrincipalName",
          "displayName",
          "givenName",
          "surname",
          "mail",
          "mobilePhone",
          "officeLocation",
          "preferredLanguage",
          "jobTitle",
          "department",
        ])
        .get();

      return user as MicrosoftGraphUser;
    } catch (error) {
      throw this.createGraphError(
        "USER_NOT_FOUND",
        `Failed to get user ${userId}`,
        error
      );
    }
  }

  /**
   * Résout un email vers l'ID utilisateur Microsoft
   */
  async resolveEmailToUserId(email: string): Promise<string | null> {
    try {
      const client = await this.initializeClient();

      const users = await client
        .api("/users")
        .filter(`mail eq '${email}' or userPrincipalName eq '${email}'`)
        .select(["id"])
        .get();

      if (users.value && users.value.length > 0) {
        return users.value[0].id;
      }

      return null;
    } catch (error) {
      console.warn(`Failed to resolve email ${email} to user ID:`, error);
      return null;
    }
  }

  /**
   * Récupère les messages d'une boîte mail
   */
  async getMessages(
    userId: string,
    options: {
      folderId?: string;
      filter?: string;
      orderBy?: string;
      select?: string[];
      top?: number;
    } = {}
  ): Promise<MicrosoftGraphEmailMessage[]> {
    try {
      const client = await this.initializeClient();

      const {
        folderId = "sentitems",
        filter,
        orderBy = "sentDateTime desc",
        select = [
          "id",
          "conversationId",
          "conversationIndex",
          "internetMessageId",
          "subject",
          "sender",
          "toRecipients",
          "ccRecipients",
          "sentDateTime",
          "hasAttachments",
          "importance",
          "bodyPreview",
        ],
        top = 50,
      } = options;

      let request = client
        .api(`/users/${userId}/mailFolders/${folderId}/messages`)
        .select(select)
        .orderby(orderBy)
        .top(top);

      if (filter) {
        request = request.filter(filter);
      }

      const response = await request.get();
      return response.value as MicrosoftGraphEmailMessage[];
    } catch (error) {
      throw this.createGraphError(
        "MESSAGES_FETCH_FAILED",
        `Failed to get messages for user ${userId}`,
        error
      );
    }
  }

  /**
   * Récupère un message spécifique avec tous les détails
   */
  async getMessage(
    userId: string,
    messageId: string,
    includeHeaders = true
  ): Promise<MicrosoftGraphEmailMessage> {
    try {
      const client = await this.initializeClient();

      let request = client.api(`/users/${userId}/messages/${messageId}`);

      if (includeHeaders) {
        request = request.expand("internetMessageHeaders");
      }

      const message = await request.get();
      return message as MicrosoftGraphEmailMessage;
    } catch (error) {
      throw this.createGraphError(
        "MESSAGE_NOT_FOUND",
        `Failed to get message ${messageId}`,
        error
      );
    }
  }

  /**
   * Crée un abonnement webhook
   */
  async createSubscription(
    request: WebhookSubscriptionRequest
  ): Promise<WebhookSubscriptionResponse> {
    try {
      const client = await this.initializeClient();

      const subscription = await client.api("/subscriptions").post(request);

      return subscription as WebhookSubscriptionResponse;
    } catch (error) {
      throw this.createGraphError(
        "SUBSCRIPTION_CREATION_FAILED",
        "Failed to create webhook subscription",
        error
      );
    }
  }

  /**
   * Met à jour un abonnement webhook
   */
  async updateSubscription(
    subscriptionId: string,
    expirationDateTime: string
  ): Promise<WebhookSubscriptionResponse> {
    try {
      const client = await this.initializeClient();

      const subscription = await client
        .api(`/subscriptions/${subscriptionId}`)
        .patch({
          expirationDateTime,
        });

      return subscription as WebhookSubscriptionResponse;
    } catch (error) {
      throw this.createGraphError(
        "SUBSCRIPTION_UPDATE_FAILED",
        `Failed to update subscription ${subscriptionId}`,
        error
      );
    }
  }

  /**
   * Supprime un abonnement webhook
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    try {
      const client = await this.initializeClient();

      await client.api(`/subscriptions/${subscriptionId}`).delete();
    } catch (error) {
      throw this.createGraphError(
        "SUBSCRIPTION_DELETION_FAILED",
        `Failed to delete subscription ${subscriptionId}`,
        error
      );
    }
  }

  /**
   * Liste tous les abonnements actifs
   */
  async listSubscriptions(): Promise<WebhookSubscriptionResponse[]> {
    try {
      const client = await this.initializeClient();

      const response = await client.api("/subscriptions").get();

      return response.value as WebhookSubscriptionResponse[];
    } catch (error) {
      throw this.createGraphError(
        "SUBSCRIPTIONS_LIST_FAILED",
        "Failed to list subscriptions",
        error
      );
    }
  }

  /**
   * Teste la connectivité et les permissions
   */
  async testConnection(): Promise<{
    success: boolean;
    error?: string;
    permissions?: string[];
  }> {
    try {
      const client = await this.initializeClient();

      // Test simple : récupérer les informations de l'application
      await client.api("/me").get();

      return {
        success: true,
        permissions: REQUIRED_SCOPES,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        permissions: REQUIRED_SCOPES,
      };
    }
  }

  /**
   * Nettoie le cache des tokens
   */
  clearTokenCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Crée une erreur Microsoft Graph standardisée
   */
  private createGraphError(
    code: string,
    message: string,
    originalError?: unknown
  ): MicrosoftGraphApiError {
    const error = new Error(message) as MicrosoftGraphApiError;
    error.name = "MicrosoftGraphApiError";
    error.code = code;
    error.statusCode =
      (originalError as { status?: number; statusCode?: number })?.status ||
      (originalError as { status?: number; statusCode?: number })?.statusCode ||
      500;

    const requestId = (originalError as { requestId?: string })?.requestId;
    if (requestId) {
      error.requestId = requestId;
    }

    error.timestamp = new Date();

    return error;
  }

  /**
   * Libère les ressources
   */
  dispose(): void {
    this.client = null;
    this.credential = null;
    this.clearTokenCache();
  }
}

/**
 * Instance singleton du service Microsoft Graph
 */
export const microsoftGraphService = new MicrosoftGraphService();
