/**
 * API Route - Microsoft Graph Health Check
 * Endpoint pour vérifier l'état de santé de l'intégration Microsoft Graph
 */

import { NextRequest, NextResponse } from "next/server";
import { webhookService } from "@/lib/services/webhook.service";
import { microsoftAuthService } from "@/lib/services/microsoft-auth.service";
import { createClient } from "@/lib/supabase/server";

/**
 * GET - Vérification de l'état de santé de Microsoft Graph
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Vérification de l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Vérifier l'état des tokens
    const tokenStatus = await microsoftAuthService.getTokenStats();

    // Vérifier l'état des abonnements
    const subscriptionHealth = await webhookService.checkSubscriptionHealth();

    // Vérifier la connectivité Microsoft Graph
    const graphConnectivity = await checkMicrosoftGraphConnectivity();

    const overallHealth = {
      status: "healthy" as "healthy" | "warning" | "error",
      timestamp: new Date().toISOString(),
      components: {
        tokens: {
          status: tokenStatus ? "healthy" : "error",
          details: tokenStatus || { error: "No token stats available" },
        },
        subscriptions: {
          status: subscriptionHealth.success ? "healthy" : "error",
          details: subscriptionHealth.data || {
            error: subscriptionHealth.error,
          },
        },
        graph_connectivity: {
          status: graphConnectivity.success ? "healthy" : "error",
          details: graphConnectivity.data || { error: graphConnectivity.error },
        },
      },
    };

    // Déterminer le statut global
    const componentStatuses = Object.values(overallHealth.components).map(
      c => c.status
    );
    if (componentStatuses.includes("error")) {
      overallHealth.status = "error";
    } else if (componentStatuses.includes("warning")) {
      overallHealth.status = "warning";
    }

    const statusCode =
      overallHealth.status === "healthy"
        ? 200
        : overallHealth.status === "warning"
          ? 200
          : 503;

    return NextResponse.json(overallHealth, { status: statusCode });
  } catch (error) {
    console.error("Error checking health:", error);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Déclenche le renouvellement automatique des abonnements
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérification de l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "renew_expiring":
        const renewResult = await webhookService.renewExpiringSoon();
        return NextResponse.json({
          success: true,
          action: "renew_expiring",
          result: renewResult.data,
        });

      case "cleanup_expired":
        const cleanupResult =
          await webhookService.cleanupExpiredSubscriptions();
        return NextResponse.json({
          success: true,
          action: "cleanup_expired",
          result: cleanupResult.data,
        });

      default:
        return NextResponse.json(
          {
            error: "Invalid action. Supported: renew_expiring, cleanup_expired",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error executing health action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Vérifie la connectivité avec Microsoft Graph
 */
async function checkMicrosoftGraphConnectivity(): Promise<{
  success: boolean;
  data?: {
    token_acquired: boolean;
    expires_in: number;
    timestamp: string;
  };
  error?: string;
}> {
  try {
    // Tenter d'acquérir un token pour vérifier la connectivité
    const tokenResult = await microsoftAuthService.acquireAccessToken();

    if (!tokenResult.access_token) {
      return {
        success: false,
        error: "Failed to acquire access token",
      };
    }

    return {
      success: true,
      data: {
        token_acquired: true,
        expires_in: tokenResult.expires_in,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Connectivity check failed",
    };
  }
}
