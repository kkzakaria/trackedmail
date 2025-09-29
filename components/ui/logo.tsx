"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export function Logo({
  className = "",
  width = 48,
  height = 48,
  priority = false,
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Éviter l'hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Rendu pendant l'hydratation - utilise le logo light par défaut
    return (
      <Image
        src="/logo-light.png"
        alt="TrackedMail"
        width={width}
        height={height}
        className={className}
        priority={priority}
      />
    );
  }

  // Détermine quel logo utiliser selon le thème
  const logoSrc =
    resolvedTheme === "dark" ? "/logo-dark.png" : "/logo-light.png";

  return (
    <Image
      src={logoSrc}
      alt="TrackedMail"
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
