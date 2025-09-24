import type { Database } from "./database.types";

// Type aliases for easier use
export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

// User role type
export type UserRole = "administrateur" | "manager" | "utilisateur";

// Auth session type
export interface AuthUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: UserRole;
  timezone: string;
  is_active: boolean;
}

// Auth context type
export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    userData: Partial<AuthUser>
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
}
