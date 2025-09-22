"use client";

import { ReactNode } from "react";
import { AuthContext, useAuthContext } from "@/lib/hooks/use-auth";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const authContext = useAuthContext();

  return (
    <AuthContext.Provider value={authContext}>{children}</AuthContext.Provider>
  );
}
