import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/app-bar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication check
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (error || !user) {
    redirect("/login");
  }

  // Fetch complete user data from the database
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  // Merge auth user with database user data
  const userProfile = userData || {
    id: user.id,
    email: user.email || "",
    full_name: user.email?.split("@")[0] || "User",
    role: "utilisateur",
    timezone: "Europe/Paris",
    is_active: true,
  };

  return (
    <>
      {/* Fixed AppBar at the top */}
      <AppBar user={userProfile} />

      {/* Main content with padding to account for fixed AppBar */}
      <main className="pt-16">{children}</main>
    </>
  );
}
