import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UserService } from "@/lib/services/user.service";
import type { UserRole } from "@/lib/types/auth";
import type { UserCreateData, UserFilters } from "@/lib/types/user-management";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Check user role - only admins and managers can list users
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
            "Permissions insuffisantes. Seuls les administrateurs et managers peuvent consulter les utilisateurs.",
        },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const isActive = url.searchParams.get("isActive");
    const role = url.searchParams.get("role");
    const search = url.searchParams.get("search");
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");

    const filters: UserFilters = {};
    if (isActive !== null) filters.isActive = isActive === "true";
    if (role) filters.role = role as UserRole;
    if (search) filters.search = search;
    if (limit) filters.limit = parseInt(limit);
    if (offset) filters.offset = parseInt(offset);

    const userService = new UserService(supabase);
    const result = await userService.getUsers(filters);

    // Calculate pagination info
    const pageSize = filters.limit || 10;
    const currentPage = Math.floor((filters.offset || 0) / pageSize) + 1;
    const totalPages = Math.ceil((result.count || 0) / pageSize);

    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.count,
      page: currentPage,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des utilisateurs",
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

    // Vérifier le rôle (admin uniquement pour créer des utilisateurs)
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData || userData.role !== "administrateur") {
      return NextResponse.json(
        {
          error:
            "Permissions insuffisantes. Seuls les administrateurs peuvent créer des utilisateurs.",
        },
        { status: 403 }
      );
    }

    // Récupérer les données de l'utilisateur
    const createData = (await req.json()) as UserCreateData;

    if (!createData.email || !createData.full_name || !createData.role) {
      return NextResponse.json(
        { error: "Email, nom complet et rôle sont requis" },
        { status: 400 }
      );
    }

    // Valider le rôle
    const validRoles = ["administrateur", "manager", "utilisateur"];
    if (!validRoles.includes(createData.role)) {
      return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
    }

    // Créer le service avec le client authentifié
    const userService = new UserService(supabase);

    // Préparer les données utilisateur
    const userToCreate = {
      id: crypto.randomUUID(), // Generate UUID for new user
      email: createData.email.toLowerCase().trim(),
      full_name: createData.full_name.trim(),
      role: createData.role,
      timezone: createData.timezone || "Europe/Paris",
      is_active: createData.is_active ?? true,
    };

    // Créer l'utilisateur
    const newUser = await userService.createUser(userToCreate);

    return NextResponse.json({
      success: true,
      data: newUser,
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";

    return NextResponse.json(
      {
        error: "Erreur lors de la création de l'utilisateur",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
