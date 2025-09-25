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

  return (
    <>
      {/* Fixed AppBar at the top */}
      <AppBar />

      {/* Main content with padding to account for fixed AppBar */}
      <main className="pt-16">{children}</main>
    </>
  );
}
