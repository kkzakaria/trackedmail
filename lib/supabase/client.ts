import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.types";

// Client-side Supabase client (for browser components)
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
