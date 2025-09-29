"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
// import InfoMenu from "@/components/navbar-components/info-menu";
import { Logo } from "@/components/ui/logo";
// import NotificationMenu from "@/components/navbar-components/notification-menu";
import UserMenu from "@/components/navbar-components/user-menu";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Base navigation links for TrackedMail application
const baseNavigationLinks = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/submissions", label: "Soumissions" },
  { href: "/documentation", label: "Documentations" },
  { href: "/analytics", label: "Analyses" },
];

interface AppBarProps {
  user?: {
    id: string;
    email: string;
    full_name?: string | null;
    role?: string;
    timezone?: string | null;
    is_active?: boolean;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
  };
}

export function AppBar({ user }: AppBarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [currentPath, setCurrentPath] = useState("");

  // Éviter l'hydratation mismatch et forcer la mise à jour du pathname
  useEffect(() => {
    setMounted(true);
    setCurrentPath(pathname);
  }, [pathname]);

  // Utiliser currentPath pour l'état actif, avec fallback sur pathname
  const activePath = mounted ? currentPath : pathname;

  // Build navigation links based on user role
  const navigationLinks = [...baseNavigationLinks];

  // Add Configuration link only for administrators and managers
  if (user?.role === "administrateur" || user?.role === "manager") {
    navigationLinks.push({ href: "/settings", label: "Configuration" });
  }

  return (
    <header className="bg-background fixed top-0 right-0 left-0 z-50 border-b px-4 md:px-6">
      <div className="flex h-16 items-center justify-between gap-4">
        {/* Left side */}
        <div className="flex items-center gap-2">
          {/* Mobile menu trigger */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="group size-8 md:hidden"
                variant="ghost"
                size="icon"
              >
                <svg
                  className="pointer-events-none"
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 12L20 12"
                    className="origin-center -translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-x-0 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[315deg]"
                  />
                  <path
                    d="M4 12H20"
                    className="origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.8)] group-aria-expanded:rotate-45"
                  />
                  <path
                    d="M4 12H20"
                    className="origin-center translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[135deg]"
                  />
                </svg>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-40 p-1 md:hidden">
              <NavigationMenu className="max-w-none *:w-full">
                <NavigationMenuList className="flex-col items-start gap-0 md:gap-2">
                  {navigationLinks.map(link => {
                    const isActive = activePath === link.href;
                    return (
                      <NavigationMenuItem key={link.href} className="w-full">
                        <NavigationMenuLink asChild>
                          <Link
                            href={link.href}
                            className={`block w-full rounded-md px-2 py-1.5 transition-colors ${
                              isActive
                                ? "bg-primary/10 text-primary dark:bg-primary/20"
                                : "hover:bg-accent/50"
                            }`}
                          >
                            {link.label}
                          </Link>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    );
                  })}
                </NavigationMenuList>
              </NavigationMenu>
            </PopoverContent>
          </Popover>
          {/* Main nav */}
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-primary hover:text-primary/90"
            >
              <Logo />
            </Link>
            {/* Navigation menu */}
            <NavigationMenu className="max-md:hidden">
              <NavigationMenuList className="gap-2">
                {navigationLinks.map(link => {
                  const isActive = activePath === link.href;
                  return (
                    <NavigationMenuItem key={link.href}>
                      <NavigationMenuLink asChild>
                        <Link
                          href={link.href}
                          className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary dark:bg-primary/20"
                              : "text-muted-foreground hover:text-primary hover:bg-accent/50"
                          }`}
                        >
                          {link.label}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  );
                })}
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>
        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <ModeToggle />
            {/* Info menu - désactivé temporairement */}
            {/* <InfoMenu /> */}
            {/* Notification - désactivé temporairement */}
            {/* <NotificationMenu /> */}
          </div>
          {/* User menu */}
          {user && <UserMenu user={user} />}
        </div>
      </div>
    </header>
  );
}
