/**
 * Microsoft Graph Auth Service
 * Service spécialisé pour la gestion des tokens Microsoft Graph
 * Gestion du chiffrement, du stockage sécurisé et du renouvellement automatique
 */

import { createClient } from "@/lib/supabase/client";
import { ClientSecretCredential } from "@azure/identity";
import type {
  MicrosoftGraphToken,
  MicrosoftGraphAuthConfig,
  MicrosoftGraphApiError,
} from "@/lib/types/microsoft-graph";

/**
 * Configuration pour le service d'authentification
 */
interface AuthServiceConfig {
  encryptionKey?: string;
  tokenRefreshThresholdMinutes?: number;
  maxRetries?: number;
}

/**
 * Informations sur un token stocké
 */
interface StoredTokenInfo {
  id: string;
  token_type: string;
  encrypted_token: string;
  expires_at: string;
  scope: string;
  last_refreshed_at: string;
  created_at: string;
}

/**
 * Service d'authentification Microsoft Graph
 */
export class MicrosoftAuthService {
  private supabase = createClient();
  private config: Required<AuthServiceConfig>;
  private credential: ClientSecretCredential | null = null;

  constructor(config: AuthServiceConfig = {}) {
    this.config = {
      encryptionKey:
        config.encryptionKey ||
        process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY ||
        "default-key-for-dev",
      tokenRefreshThresholdMinutes: config.tokenRefreshThresholdMinutes || 30,
      maxRetries: config.maxRetries || 3,
    };
  }

  /**
   * Initialise les credentials Microsoft Graph
   */
  private async initializeCredential(): Promise<ClientSecretCredential> {
    if (this.credential) {
      return this.credential;
    }

    const authConfig = await this.getAuthConfig();

    this.credential = new ClientSecretCredential(
      authConfig.tenantId,
      authConfig.clientId,
      authConfig.clientSecret
    );

    return this.credential;
  }

  /**
   * Récupère la configuration d'authentification
   */
  private async getAuthConfig(): Promise<MicrosoftGraphAuthConfig> {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      throw new Error("Microsoft Graph credentials not configured");
    }

    return {
      clientId,
      clientSecret,
      tenantId,
      scopes: [
        "https://graph.microsoft.com/Mail.ReadWrite",
        "https://graph.microsoft.com/Mail.Send",
        "https://graph.microsoft.com/User.Read.All",
      ],
    };
  }

  /**
   * Acquiert un nouveau token d'accès
   */
  async acquireAccessToken(scopes?: string[]): Promise<MicrosoftGraphToken> {
    try {
      const credential = await this.initializeCredential();
      const authConfig = await this.getAuthConfig();
      const requestedScopes = scopes || authConfig.scopes;

      const tokenResponse = await credential.getToken(requestedScopes);

      if (!tokenResponse) {
        throw new Error("Failed to acquire access token");
      }

      const token: MicrosoftGraphToken = {
        access_token: tokenResponse.token,
        token_type: "Bearer",
        expires_in: Math.floor(
          (tokenResponse.expiresOnTimestamp - Date.now()) / 1000
        ),
        scope: requestedScopes.join(" "),
        expires_at: new Date(tokenResponse.expiresOnTimestamp),
      };

      // Stocker le token de manière sécurisée
      await this.storeToken(token, requestedScopes);

      return token;
    } catch (error) {
      throw this.createAuthError(
        "TOKEN_ACQUISITION_FAILED",
        "Failed to acquire access token",
        error
      );
    }
  }

  /**
   * Récupère un token valide (depuis le cache ou en acquiert un nouveau)
   */
  async getValidToken(scopes?: string[]): Promise<string> {
    try {
      const authConfig = await this.getAuthConfig();
      const requestedScopes = scopes || authConfig.scopes;
      const scopeKey = requestedScopes.join(" ");

      // Vérifier si un token valide existe en base
      const storedToken = await this.getStoredToken(scopeKey);

      if (storedToken && this.isTokenValid(storedToken)) {
        const decryptedToken = await this.decryptToken(
          storedToken.encrypted_token
        );
        return decryptedToken;
      }

      // Acquérir un nouveau token
      const newToken = await this.acquireAccessToken(requestedScopes);
      return newToken.access_token;
    } catch (error) {
      throw this.createAuthError(
        "TOKEN_RETRIEVAL_FAILED",
        "Failed to get valid token",
        error
      );
    }
  }

  /**
   * Renouvelle un token existant
   */
  async refreshToken(scopes?: string[]): Promise<MicrosoftGraphToken> {
    try {
      console.warn("Refreshing Microsoft Graph token...");
      return await this.acquireAccessToken(scopes);
    } catch (error) {
      throw this.createAuthError(
        "TOKEN_REFRESH_FAILED",
        "Failed to refresh token",
        error
      );
    }
  }

  /**
   * Vérifie si un token doit être renouvelé
   */
  async shouldRefreshToken(scopes?: string[]): Promise<boolean> {
    try {
      const authConfig = await this.getAuthConfig();
      const requestedScopes = scopes || authConfig.scopes;
      const scopeKey = requestedScopes.join(" ");

      const storedToken = await this.getStoredToken(scopeKey);

      if (!storedToken) {
        return true; // Aucun token, on doit en acquérir un
      }

      const expiresAt = new Date(storedToken.expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      const thresholdMs = this.config.tokenRefreshThresholdMinutes * 60 * 1000;

      return timeUntilExpiry <= thresholdMs;
    } catch (error) {
      console.warn("Error checking if token should be refreshed:", error);
      return true; // En cas d'erreur, on préfère renouveler
    }
  }

  /**
   * Valide un token (vérifie l'expiration et la structure)
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      // Vérification basique de la structure du token JWT
      const parts = token.split(".");
      if (parts.length !== 3) {
        return false;
      }

      // Décoder le payload pour vérifier l'expiration
      const secondPart = parts[1];
      if (!secondPart) {
        return false;
      }
      const payload = JSON.parse(atob(secondPart));
      const exp = payload.exp;

      if (!exp) {
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      return exp > now;
    } catch (error) {
      console.warn("Error validating token:", error);
      return false;
    }
  }

  /**
   * Supprime tous les tokens stockés
   */
  async clearTokens(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("microsoft_graph_tokens")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) {
        throw error;
      }

      console.warn("All Microsoft Graph tokens cleared");
    } catch (error) {
      throw this.createAuthError(
        "TOKEN_CLEAR_FAILED",
        "Failed to clear tokens",
        error
      );
    }
  }

  /**
   * Obtient des statistiques sur les tokens
   */
  async getTokenStats(): Promise<{
    totalTokens: number;
    validTokens: number;
    expiringSoon: number;
    lastRefresh?: Date;
  }> {
    try {
      const { data: tokens, error } = await this.supabase
        .from("microsoft_graph_tokens")
        .select("expires_at, last_refreshed_at");

      if (error) {
        throw error;
      }

      const now = new Date();
      const thresholdMs = this.config.tokenRefreshThresholdMinutes * 60 * 1000;

      let validTokens = 0;
      let expiringSoon = 0;
      let lastRefresh: Date | undefined;

      for (const token of tokens || []) {
        const expiresAt = new Date(token.expires_at);
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();

        if (timeUntilExpiry > 0) {
          validTokens++;

          if (timeUntilExpiry <= thresholdMs) {
            expiringSoon++;
          }
        }

        const refreshedAt = token.last_refreshed_at
          ? new Date(token.last_refreshed_at)
          : new Date();
        if (!lastRefresh || refreshedAt > lastRefresh) {
          lastRefresh = refreshedAt;
        }
      }

      const stats: {
        totalTokens: number;
        validTokens: number;
        expiringSoon: number;
        lastRefresh?: Date;
      } = {
        totalTokens: tokens?.length || 0,
        validTokens,
        expiringSoon,
      };

      if (lastRefresh) {
        stats.lastRefresh = lastRefresh;
      }

      return stats;
    } catch (error) {
      throw this.createAuthError(
        "TOKEN_STATS_FAILED",
        "Failed to get token stats",
        error
      );
    }
  }

  /**
   * Stocke un token de manière sécurisée
   */
  private async storeToken(
    token: MicrosoftGraphToken,
    scopes: string[]
  ): Promise<void> {
    try {
      const encryptedToken = await this.encryptToken(token.access_token);

      const { error } = await this.supabase
        .from("microsoft_graph_tokens")
        .upsert(
          {
            token_type: token.token_type.toLowerCase(),
            encrypted_token: encryptedToken,
            expires_at: token.expires_at.toISOString(),
            scope: scopes.join(" "),
            last_refreshed_at: new Date().toISOString(),
          },
          {
            onConflict: "token_type",
          }
        );

      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn("Failed to store token:", error);
      throw this.createAuthError(
        "TOKEN_STORAGE_FAILED",
        "Failed to store token",
        error
      );
    }
  }

  /**
   * Récupère un token stocké
   */
  private async getStoredToken(scope: string): Promise<StoredTokenInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from("microsoft_graph_tokens")
        .select("*")
        .eq("scope", scope)
        .eq("token_type", "bearer")
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = not found
        throw error;
      }

      return data as StoredTokenInfo | null;
    } catch (error) {
      console.warn("Failed to get stored token:", error);
      return null;
    }
  }

  /**
   * Vérifie si un token stocké est encore valide
   */
  private isTokenValid(tokenInfo: StoredTokenInfo): boolean {
    const expiresAt = new Date(tokenInfo.expires_at);
    const now = new Date();
    const buffer = 5 * 60 * 1000; // 5 minutes de marge

    return expiresAt.getTime() > now.getTime() + buffer;
  }

  /**
   * Chiffre un token (implémentation simplifiée pour la démo)
   * Dans un environnement de production, utiliser un chiffrement plus robuste
   */
  private async encryptToken(token: string): Promise<string> {
    // Note: Implémentation simplifiée pour la démo
    // En production, utiliser crypto.subtle ou une librairie de chiffrement
    const buffer = Buffer.from(token, "utf8");
    return buffer.toString("base64");
  }

  /**
   * Déchiffre un token
   */
  private async decryptToken(encryptedToken: string): Promise<string> {
    // Note: Implémentation simplifiée pour la démo
    const buffer = Buffer.from(encryptedToken, "base64");
    return buffer.toString("utf8");
  }

  /**
   * Crée une erreur d'authentification standardisée
   */
  private createAuthError(
    code: string,
    message: string,
    originalError?: unknown
  ): MicrosoftGraphApiError {
    const error = new Error(message) as MicrosoftGraphApiError;
    error.name = "MicrosoftGraphAuthError";
    error.code = code;
    error.statusCode =
      (originalError as { status?: number; statusCode?: number })?.status ||
      (originalError as { status?: number; statusCode?: number })?.statusCode ||
      401;
    error.timestamp = new Date();

    return error;
  }

  /**
   * Libère les ressources
   */
  dispose(): void {
    this.credential = null;
  }
}

/**
 * Instance singleton du service d'authentification
 */
export const microsoftAuthService = new MicrosoftAuthService();
