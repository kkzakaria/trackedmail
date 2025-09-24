import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { microsoftGraphService } from "@/lib/services/microsoft-graph.service";

export async function POST(req: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient();
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
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    // Récupérer l'email à valider
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    // Vérifier si l'email existe déjà dans la base
    const { data: existingMailbox } = await supabase
      .from("mailboxes")
      .select("id, email_address")
      .eq("email_address", email)
      .single();

    if (existingMailbox) {
      return NextResponse.json(
        { error: "Cette boîte mail existe déjà dans le système" },
        { status: 409 }
      );
    }

    // Résoudre l'email vers un ID Microsoft
    const microsoftUserId =
      await microsoftGraphService.resolveEmailToUserId(email);

    if (!microsoftUserId) {
      return NextResponse.json(
        {
          error: "Email non trouvé dans le tenant Microsoft",
          details:
            "L'adresse email n'existe pas ou n'est pas accessible avec les permissions actuelles",
        },
        { status: 404 }
      );
    }

    // Récupérer les informations complètes de l'utilisateur
    try {
      const userInfo = await microsoftGraphService.getUser(microsoftUserId);

      return NextResponse.json({
        success: true,
        data: {
          microsoft_user_id: microsoftUserId,
          email_address: userInfo.mail || userInfo.userPrincipalName || email,
          display_name:
            userInfo.displayName ||
            `${userInfo.givenName || ""} ${userInfo.surname || ""}`.trim() ||
            null,
          job_title: userInfo.jobTitle || null,
          department: userInfo.department || null,
        },
      });
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des infos utilisateur:",
        error
      );

      // Si on ne peut pas récupérer les détails mais qu'on a l'ID, on retourne quand même
      return NextResponse.json({
        success: true,
        data: {
          microsoft_user_id: microsoftUserId,
          email_address: email,
          display_name: null,
        },
      });
    }
  } catch (error) {
    console.error("Erreur lors de la validation de l'email:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la validation",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
