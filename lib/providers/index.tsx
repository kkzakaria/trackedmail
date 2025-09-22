"use client";

import { ReactNode } from "react";
import { AuthProvider } from "./auth-provider";
import { QueryProvider } from "./query-provider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  );
}

export { AuthProvider, QueryProvider };
