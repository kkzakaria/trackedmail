/**
 * API Route - Individual Subscription Management
 * Endpoints pour la gestion d'un abonnement spécifique
 */

import { NextRequest, NextResponse } from "next/server";
import { webhookService } from "@/lib/services/webhook.service";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT - Renouvelle un abonnement existant
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const subscriptionId = resolvedParams.id;
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
    const { expirationHours = 72 } = body;

    const result = await webhookService.renewSubscription(
      subscriptionId,
      expirationHours
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: result.data,
    });
  } catch (error) {
    console.error("Error renewing subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Supprime un abonnement
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const subscriptionId = resolvedParams.id;
    const supabase = await createClient();

    // Vérification de l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await webhookService.deleteSubscription(subscriptionId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Subscription deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
