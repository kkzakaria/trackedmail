import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UserService } from "@/lib/services/user.service";

export async function GET(
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

    // Check user role and permissions
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    // Permission check: admins can see all stats, managers can see non-admin stats, users their own
    const canAccess =
      userData.role === "administrateur" ||
      userData.role === "manager" ||
      user.id === id;

    if (!canAccess) {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const userService = new UserService(supabase);

    // Check if target user exists first
    const targetUser = await userService.getUserById(id);
    if (!targetUser) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    // Managers cannot access admin statistics
    if (userData.role === "manager" && targetUser.role === "administrateur") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    // Get user statistics
    const statistics = await userService.getUserStatistics(id);

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("Error fetching user statistics:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des statistiques",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
