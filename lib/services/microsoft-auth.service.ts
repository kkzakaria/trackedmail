/**
 * Microsoft Graph Auth Service
 * Service spécialisé pour la gestion des tokens Microsoft Graph
 * Gestion du chiffrement, du stockage sécurisé et du renouvellement automatique
 */

import { createClient } from "@/lib/supabase/client";
import type {
  MicrosoftGraphToken,
  MicrosoftGraphApiError,
} from "@/lib/types/microsoft-graph";

/**
 * Configuration pour le service d'authentification
 */
interface AuthServiceConfig {
  tokenRefreshThresholdMinutes?: number;
  maxRetries?: number;
}

// Interface StoredTokenInfo supprimée - gestion déléguée à l'Edge Function

/**
 * Service d'authentification Microsoft Graph
 */
export class MicrosoftAuthService {
  private supabase = createClient();
  private config: Required<AuthServiceConfig>;
  private baseUrl: string;

  constructor(config: AuthServiceConfig = {}) {
    this.config = {
      tokenRefreshThresholdMinutes: config.tokenRefreshThresholdMinutes || 30,
      maxRetries: config.maxRetries || 3,
    };

    // URL de l'Edge Function microsoft-auth
    this.baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
      : "http://127.0.0.1:54321/functions/v1";
  }

  /**
   * Appelle l'Edge Function microsoft-auth
   */
  private async callEdgeFunction(
    action: string,
    data?: Record<string, unknown>
  ): Promise<{
    success: boolean;
    access_token?: string;
    expires_in?: number;
    expires_at?: string;
    error?: string;
  }> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    if (!session) {
      throw new Error("No authenticated session");
    }

    const response = await fetch(`${this.baseUrl}/microsoft-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...data }),
    });

    if (!response.ok) {
      throw new Error(`Edge Function call failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Configuration supprimée - gérée par l'Edge Function

  /**
   * Acquiert un nouveau token d'accès
   */
  async acquireAccessToken(scopes?: string[]): Promise<MicrosoftGraphToken> {
    try {
      const defaultScopes = ["https://graph.microsoft.com/.default"];
      const requestedScopes = scopes || defaultScopes;

      const response = await this.callEdgeFunction("acquire", {
        scopes: requestedScopes,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to acquire token");
      }

      if (
        !response.access_token ||
        !response.expires_in ||
        !response.expires_at
      ) {
        throw new Error("Invalid token response from Edge Function");
      }

      const token: MicrosoftGraphToken = {
        access_token: response.access_token,
        token_type: "Bearer",
        expires_in: response.expires_in,
        expires_at: new Date(response.expires_at),
        scope: requestedScopes.join(" "),
      };

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
      // Acquérir un token via l'Edge Function
      // L'Edge Function gère la vérification du cache et le renouvellement automatique
      const token = await this.acquireAccessToken(scopes);
      return token.access_token;
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
   * Vérifie si un token doit être renouvelé (délégué à l'Edge Function)
   */
  async shouldRefreshToken(_scopes?: string[]): Promise<boolean> {
    // L'Edge Function gère automatiquement la vérification de l'expiration
    // Cette méthode retourne toujours false car l'Edge Function s'occupe du refresh
    return false;
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

  // Méthodes de stockage et validation supprimées
  // Gestion complète déléguée à l'Edge Function microsoft-auth

  // Les méthodes de chiffrement ont été supprimées
  // Le chiffrement est maintenant géré par les Edge Functions Supabase

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
   * Libère les ressources (rien à faire, Edge Function gère tout)
   */
  dispose(): void {
    // Rien à libérer, Edge Function gère les credentials
  }
}

/**
 * Instance singleton du service d'authentification
 */
export const microsoftAuthService = new MicrosoftAuthService();
