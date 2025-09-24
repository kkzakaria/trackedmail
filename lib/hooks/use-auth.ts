"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { AuthUser, AuthContextType, UserRole } from "@/lib/types/auth";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useAuthContext() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const fetchUserProfile = useCallback(
    async (authUser: User) => {
      try {
        const { data: profile, error } = await supabase
          .from("active_users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          return;
        }

        if (profile?.id && profile?.email) {
          setUser({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role as UserRole,
            timezone: profile.timezone || "UTC",
            is_active: profile.is_active || true,
          });
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    },
    [supabase]
  );

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          await fetchUserProfile(session.user);
        }
      } catch (error) {
        console.error("Error getting initial session:", error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          await fetchUserProfile(session.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Error in auth state change:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, supabase.auth]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // Pattern Supabase : invalidation cache + redirection immédiate
    router.refresh(); // Équivalent client-side de revalidatePath()
    router.push("/dashboard"); // Redirection explicite recommandée par Supabase
  };

  const signUp = async (
    email: string,
    password: string,
    userData: Partial<AuthUser>
  ) => {
    // Store user metadata that will be automatically synced by triggers
    const userMetadata = {
      full_name: userData.full_name || email.split("@")[0],
      role: userData.role || "utilisateur",
      timezone: userData.timezone || "Europe/Paris",
      is_active: userData.is_active !== undefined ? userData.is_active : true,
    };

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userMetadata,
      },
    });

    if (error) {
      throw error;
    }

    // The user profile will be automatically created by triggers
    // No manual INSERT needed
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setUser(null);
    router.push("/login");
  };

  const updateProfile = async (data: Partial<AuthUser>) => {
    if (!user) {
      throw new Error("No user logged in");
    }

    // Check if user is still active before updating
    const { data: activeUser, error: checkError } = await supabase
      .from("active_users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (checkError || !activeUser) {
      throw new Error("User account is no longer active");
    }

    const { error } = await supabase
      .from("users")
      .update(data)
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    // Update local state
    setUser({ ...user, ...data });
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };
}

export { AuthContext };
