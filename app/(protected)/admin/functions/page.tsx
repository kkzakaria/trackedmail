import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FunctionsPageClient } from "./functions-page-client";

export default async function FunctionsPage() {
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

  // Redirect if not authorized (admin only for functions management)
  if (!userData || userData.role !== "administrateur") {
    redirect("/dashboard");
  }

  // Get available mailboxes for function parameters
  const { data: mailboxes } = await supabase
    .from("mailboxes")
    .select("id, email_address, is_active")
    .eq("is_active", true)
    .order("email_address");

  // Filter out mailboxes with null is_active and ensure type safety
  const availableMailboxes = (mailboxes || []).filter(
    (m): m is { id: string; email_address: string; is_active: boolean } =>
      m.is_active === true
  );

  // Render the client component with proper authorization
  return (
    <FunctionsPageClient
      userRole={userData.role}
      currentUserId={user.id}
      availableMailboxes={availableMailboxes}
    />
  );
}
