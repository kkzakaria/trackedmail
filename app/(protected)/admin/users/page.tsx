import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsersPageClient } from "./users-page-client";

export default async function UsersPage() {
  // Server-side authentication check
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Redirect if not authenticated
  if (error || !user) {
    redirect("/login");
  }

  // Check user role from the database
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // Redirect if not authorized (admin or manager only for user management)
  if (
    !userData ||
    (userData.role !== "administrateur" && userData.role !== "manager")
  ) {
    redirect("/dashboard");
  }

  // Render the client component with proper authorization
  return <UsersPageClient userRole={userData.role} currentUserId={user.id} />;
}
