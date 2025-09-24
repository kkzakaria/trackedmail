import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UserService } from "@/lib/services/user.service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only admins can restore users
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "administrateur") {
      return NextResponse.json(
        {
          error:
            "Permissions insuffisantes. Seuls les administrateurs peuvent restaurer des utilisateurs.",
        },
        { status: 403 }
      );
    }

    const userService = new UserService(supabase);

    // Check if user exists
    const targetUser = await userService.getUserById(id);

    if (!targetUser) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    // Check if user is actually deactivated
    if (targetUser.is_active) {
      return NextResponse.json(
        { error: "L'utilisateur est déjà actif" },
        { status: 400 }
      );
    }

    // Restore the user
    const restoredUser = await userService.restoreUser(id);

    return NextResponse.json({
      success: true,
      data: restoredUser,
      message: "Utilisateur restauré avec succès",
    });
  } catch (error) {
    console.error("Error restoring user:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Erreur lors de la restauration de l'utilisateur",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
