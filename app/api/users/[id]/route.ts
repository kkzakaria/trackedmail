import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UserService } from "@/lib/services/user.service";
import type { UserUpdateData } from "@/lib/types/user-management";

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

    // Admins can see all users, managers can see non-admin users, users can only see themselves
    const canAccess =
      userData.role === "administrateur" ||
      (userData.role === "manager" && user.id !== id) ||
      user.id === id;

    if (!canAccess) {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const userService = new UserService(supabase);
    const targetUser = await userService.getUserById(id);

    // If manager trying to access admin, deny
    if (userData.role === "manager" && targetUser.role === "administrateur") {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: targetUser,
    });
  } catch (error) {
    console.error("Error fetching user:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Erreur lors de la récupération de l'utilisateur",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
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

    // Get target user to check permissions
    const userService = new UserService(supabase);
    const targetUser = await userService.getUserById(id);

    // Permission logic:
    // - Admins can update anyone
    // - Managers can update non-admin users (but not other managers' sensitive fields)
    // - Users can update themselves (limited fields)
    const canUpdate =
      userData.role === "administrateur" ||
      (userData.role === "manager" && targetUser.role !== "administrateur") ||
      user.id === id;

    if (!canUpdate) {
      return NextResponse.json(
        { error: "Permissions insuffisantes" },
        { status: 403 }
      );
    }

    const updates = (await req.json()) as UserUpdateData;

    // Restrict updates based on role
    if (user.id === id && userData.role !== "administrateur") {
      // Users can only update their own basic info
      const allowedFields = ["full_name", "timezone"];

      if (Object.keys(updates).some(key => !allowedFields.includes(key))) {
        return NextResponse.json(
          { error: "Vous ne pouvez modifier que votre nom et fuseau horaire" },
          { status: 403 }
        );
      }
    }

    // Managers cannot change roles or activate/deactivate users
    if (userData.role === "manager" && user.id !== id) {
      if (updates.role || updates.is_active !== undefined) {
        return NextResponse.json(
          {
            error:
              "Seuls les administrateurs peuvent modifier le rôle et le statut",
          },
          { status: 403 }
        );
      }
    }

    // Validate role if being updated
    if (updates.role) {
      const validRoles = ["administrateur", "manager", "utilisateur"];
      if (!validRoles.includes(updates.role)) {
        return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
      }
    }

    // Prevent self-deactivation
    if (user.id === id && updates.is_active === false) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous désactiver vous-même" },
        { status: 400 }
      );
    }

    // Clean and validate email if provided
    if (updates.email) {
      updates.email = updates.email.toLowerCase().trim();
    }

    // Clean full name if provided
    if (updates.full_name) {
      updates.full_name = updates.full_name.trim();
    }

    const updatedUser = await userService.updateUser(id, updates);

    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Erreur lors de la mise à jour de l'utilisateur",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Only admins can soft delete users
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "administrateur") {
      return NextResponse.json(
        {
          error:
            "Permissions insuffisantes. Seuls les administrateurs peuvent supprimer des utilisateurs.",
        },
        { status: 403 }
      );
    }

    // Prevent self-deletion
    if (user.id === id) {
      return NextResponse.json(
        {
          error: "Auto-désactivation interdite",
          details:
            "Pour des raisons de sécurité, vous ne pouvez pas désactiver votre propre compte. Contactez un autre administrateur si nécessaire.",
        },
        { status: 400 }
      );
    }

    const userService = new UserService(supabase);

    // Check if user exists and get details
    const targetUser = await userService.getUserById(id);

    if (!targetUser) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    // Soft delete the user
    const deletedUser = await userService.softDeleteUser(id);

    return NextResponse.json({
      success: true,
      data: deletedUser,
      message: "Utilisateur supprimé avec succès",
    });
  } catch (error) {
    console.error("Error deleting user:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Erreur lors de la suppression de l'utilisateur",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
