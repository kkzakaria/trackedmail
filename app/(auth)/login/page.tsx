import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginPageClient } from "./login-page-client";

export default async function LoginPage() {
  // Server-side authentication check
  const supabase = await createClient();

  // Check if user is already authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to dashboard if already logged in
  if (user) {
    redirect("/dashboard");
  }

  // Render login form if not authenticated
  return <LoginPageClient />;
}
