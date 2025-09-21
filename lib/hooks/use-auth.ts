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
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          return;
        }

        if (profile) {
          setUser({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role as UserRole,
            mailbox_address: profile.mailbox_address,
            timezone: profile.timezone || "UTC",
            pause_relances: profile.pause_relances || false,
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await fetchUserProfile(session.user);
      }

      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchUserProfile(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
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
  };

  const signUp = async (
    email: string,
    password: string,
    userData: Partial<AuthUser>
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // If user is created, insert profile data
    if (data.user) {
      const { error: profileError } = await supabase.from("users").insert({
        id: data.user.id,
        email,
        full_name: userData.full_name || null,
        role: userData.role || "utilisateur",
        mailbox_address: userData.mailbox_address || null,
        timezone: userData.timezone || "UTC",
        pause_relances: userData.pause_relances || false,
      });

      if (profileError) {
        throw profileError;
      }
    }
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
