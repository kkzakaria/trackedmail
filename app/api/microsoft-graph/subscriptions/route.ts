/**
 * API Route - Microsoft Graph Subscriptions Management
 * Endpoints pour la gestion des abonnements webhook Microsoft Graph
 */

import { NextRequest, NextResponse } from "next/server";
import { webhookService } from "@/lib/services/webhook.service";
import { createClient } from "@/lib/supabase/server";

/**
 * GET - Liste les abonnements avec filtres optionnels
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const mailboxId = searchParams.get("mailboxId");
    const isActive = searchParams.get("isActive");
    const expiringSoon = searchParams.get("expiringSoon");

    const filters: {
      mailboxId?: string;
      isActive?: boolean;
      expiringSoon?: boolean;
    } = {};
    if (mailboxId) filters.mailboxId = mailboxId;
    if (isActive !== null) filters.isActive = isActive === "true";
    if (expiringSoon === "true") filters.expiringSoon = true;

    const result = await webhookService.listSubscriptions(filters);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subscriptions: result.data,
    });
  } catch (error) {
    console.error("Error listing subscriptions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Crée un nouvel abonnement webhook
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
    const { mailboxId, microsoftUserId, options = {} } = body;

    if (!mailboxId || !microsoftUserId) {
      return NextResponse.json(
        { error: "mailboxId and microsoftUserId are required" },
        { status: 400 }
      );
    }

    const result = await webhookService.createSubscription(
      mailboxId,
      microsoftUserId,
      options
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        subscription: result.data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
