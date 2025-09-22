/**
 * API Route - Microsoft Graph Webhooks
 * Endpoint Next.js pour recevoir et traiter les webhooks Microsoft Graph
 * Interface entre les webhooks externes et les services internes
 */

import { NextRequest, NextResponse } from "next/server";
import { emailProcessingService } from "@/lib/services/email-processing.service";

/**
 * Interface pour les notifications webhook Microsoft Graph
 */
interface WebhookNotification {
  subscriptionId: string;
  changeType: "created" | "updated" | "deleted";
  tenantId: string;
  clientState: string;
  subscriptionExpirationDateTime: string;
  resource: string;
  resourceData: {
    "@odata.type": string;
    "@odata.id": string;
    "@odata.etag"?: string;
    id: string;
  };
}

interface WebhookPayload {
  value: WebhookNotification[];
  validationTokens?: string[];
}

/**
 * POST - Traitement des webhooks Microsoft Graph
 */
export async function POST(request: NextRequest) {
  try {
    // Vérification de l'origine et sécurité basique
    const userAgent = request.headers.get("user-agent") || "";
    if (
      !userAgent.includes("Microsoft") &&
      process.env.NODE_ENV === "production"
    ) {
      return NextResponse.json(
        { error: "Invalid user agent" },
        { status: 403 }
      );
    }

    // Lecture du payload
    const payload: WebhookPayload = await request.json();

    // Gestion de la validation initiale du webhook
    if (payload.validationTokens && payload.validationTokens.length > 0) {
      console.warn("Webhook validation requested");
      return new Response(payload.validationTokens[0], {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Vérifier qu'il y a des notifications à traiter
    if (!payload.value || payload.value.length === 0) {
      return NextResponse.json(
        { error: "No notifications in payload" },
        { status: 400 }
      );
    }

    console.warn(`Processing ${payload.value.length} webhook notifications`);

    // Traiter chaque notification
    const results = await Promise.allSettled(
      payload.value.map(notification => processNotification(notification))
    );

    // Compter les résultats
    const successful = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    console.warn(
      `Webhook processing complete: ${successful} successful, ${failed} failed`
    );

    return NextResponse.json({
      success: true,
      processed: payload.value.length,
      successful,
      failed,
    });
  } catch (error) {
    console.error("Error processing webhook:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Traite une notification individuelle
 */
async function processNotification(
  notification: WebhookNotification
): Promise<void> {
  try {
    console.warn(
      `Processing notification: ${notification.changeType} for ${notification.resource}`
    );

    // Vérifier que c'est bien un message email
    if (!notification.resource.includes("/messages/")) {
      console.warn("Notification is not for an email message, skipping");
      return;
    }

    // Seuls les emails créés nous intéressent pour le tracking
    if (notification.changeType !== "created") {
      console.warn(
        `Notification type ${notification.changeType} not relevant for tracking`
      );
      return;
    }

    // Extraire l'ID du message et l'ID utilisateur depuis la resource
    const resourceParts = notification.resource.split("/");
    const userIdIndex = resourceParts.findIndex(part => part === "users") + 1;
    const messageIdIndex =
      resourceParts.findIndex(part => part === "messages") + 1;

    if (userIdIndex <= 0 || messageIdIndex <= 0) {
      throw new Error("Could not extract user ID and message ID from resource");
    }

    const userId = resourceParts[userIdIndex];
    const messageId = resourceParts[messageIdIndex];

    // Vérifier si l'email provient du dossier "Sent Items"
    const isSentEmail =
      notification.resource.toLowerCase().includes("sentitems") ||
      notification.resource.toLowerCase().includes("sent items");

    if (!isSentEmail) {
      console.warn(`Email ${messageId} not from sent folder, skipping`);
      return;
    }

    if (!userId) {
      console.warn("No user ID found in notification resource");
      return;
    }

    // Récupérer la mailbox correspondante
    const mailbox = await getMailboxByUserId(userId);
    if (!mailbox) {
      console.warn(`No mailbox found for user ${userId}`);
      return;
    }

    if (!messageId) {
      console.warn("No message ID found in notification resource");
      return;
    }

    // Traiter l'email via le service de traitement
    const result = await emailProcessingService.processEmailFromWebhook(
      messageId,
      mailbox.id,
      {
        skipDuplicateCheck: false,
        enableAdvancedThreading: true,
      }
    );

    if (!result.success) {
      console.error(`Failed to process email ${messageId}:`, result.error);
      return;
    }

    console.warn(
      `Successfully processed email ${messageId}: ${result.data?.action}`
    );
  } catch (error) {
    console.error("Error processing notification:", error);
    throw error;
  }
}

/**
 * Récupère la mailbox par user ID Microsoft
 */
async function getMailboxByUserId(
  microsoftUserId: string
): Promise<{ id: string } | null> {
  try {
    // Utiliser l'API interne pour récupérer la mailbox
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/mailboxes/by-user/${microsoftUserId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // Ajouter un token interne si nécessaire
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.mailbox || null;
  } catch (error) {
    console.error(`Error getting mailbox for user ${microsoftUserId}:`, error);
    return null;
  }
}

/**
 * OPTIONS - Gestion CORS pour les webhooks
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
