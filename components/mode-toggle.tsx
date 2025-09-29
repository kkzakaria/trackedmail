"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Toggle } from "@/components/ui/toggle";

export function ModeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Éviter l'hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Toggle
        variant="outline"
        className="group data-[state=on]:hover:bg-muted size-9 cursor-pointer data-[state=on]:bg-transparent"
        aria-label="Basculer le thème"
      >
        <Sun
          size={16}
          className="shrink-0 scale-100 opacity-100"
          aria-hidden="true"
        />
      </Toggle>
    );
  }

  const isDark = resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Toggle
      variant="outline"
      className="group data-[state=on]:hover:bg-muted size-9 cursor-pointer data-[state=on]:bg-transparent"
      pressed={isDark}
      onPressedChange={toggleTheme}
      aria-label={`Basculer vers le mode ${isDark ? "clair" : "sombre"}`}
    >
      <Moon
        size={16}
        className="shrink-0 scale-0 opacity-0 transition-all group-data-[state=on]:scale-100 group-data-[state=on]:opacity-100"
        aria-hidden="true"
      />
      <Sun
        size={16}
        className="absolute shrink-0 scale-100 opacity-100 transition-all group-data-[state=on]:scale-0 group-data-[state=on]:opacity-0"
        aria-hidden="true"
      />
    </Toggle>
  );
}
