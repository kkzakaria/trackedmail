import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  // Server-side authentication check
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect based on authentication status
  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
