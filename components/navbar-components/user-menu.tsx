"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOutIcon, UserIcon } from "lucide-react";
import { ProfileDialog } from "@/components/profile-dialog";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  user: {
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

export default function UserMenu({ user }: UserMenuProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Handle profile dialog
  const handleProfileClick = () => {
    setIsProfileOpen(true);
  };

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Generate initials for avatar fallback
  const getInitials = () => {
    if (user.full_name) {
      return user.full_name
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email[0]?.toUpperCase() || "U";
  };

  // Use user data or defaults
  const displayName =
    user.full_name || user.email.split("@")[0] || "Utilisateur";
  const displayEmail = user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto cursor-pointer p-0 hover:bg-transparent"
        >
          <Avatar>
            <AvatarImage
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${displayEmail}`}
              alt="Profile image"
            />
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-w-64" align="end">
        <DropdownMenuLabel className="flex min-w-0 flex-col">
          <span className="text-foreground truncate text-sm font-medium">
            {displayName}
          </span>
          <span className="text-muted-foreground truncate text-xs font-normal">
            {displayEmail}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={handleProfileClick}
          >
            <UserIcon size={16} className="opacity-60" aria-hidden="true" />
            <span>Mon profil</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOutIcon size={16} className="opacity-60" aria-hidden="true" />
          <span>Déconnexion</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <ProfileDialog
        user={user}
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
      />
    </DropdownMenu>
  );
}
