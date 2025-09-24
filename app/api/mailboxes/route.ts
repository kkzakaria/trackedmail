import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MailboxService } from "@/lib/services/mailbox.service";
import type { TablesInsert } from "@/lib/types/database.types";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const isActive = url.searchParams.get("isActive");
    const search = url.searchParams.get("search");
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");

    const filters: {
      isActive?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    } = {};
    if (isActive !== null) filters.isActive = isActive === "true";
    if (search) filters.search = search;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const mailboxService = new MailboxService(supabase);

    let mailboxes;
    if (userId) {
      mailboxes = await mailboxService.getUserMailboxes(userId);
    } else {
      mailboxes = await mailboxService.getMailboxes(filters);
    }

    return NextResponse.json({ data: mailboxes });
  } catch (error) {
    console.error("Error fetching mailboxes:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des boîtes mail",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Créer le client Supabase avec session
    const supabase = await createClient();

    // Vérifier l'authentification
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier le rôle (admin ou manager uniquement)
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (
      !userData ||
      (userData.role !== "administrateur" && userData.role !== "manager")
    ) {
      return NextResponse.json(
        {
          error:
            "Permissions insuffisantes. Seuls les administrateurs et managers peuvent créer des boîtes mail.",
        },
        { status: 403 }
      );
    }

    // Récupérer les données de la mailbox
    const mailboxData = (await req.json()) as TablesInsert<"mailboxes">;

    if (!mailboxData.email_address) {
      return NextResponse.json(
        { error: "Adresse email requise" },
        { status: 400 }
      );
    }

    // Créer le service avec le client authentifié
    const mailboxService = new MailboxService(supabase);

    // Créer la mailbox
    const mailbox = await mailboxService.createMailbox(mailboxData);

    return NextResponse.json({
      success: true,
      data: mailbox,
    });
  } catch (error) {
    console.error("Erreur lors de la création de la mailbox:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";

    return NextResponse.json(
      {
        error: "Erreur lors de la création de la boîte mail",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
