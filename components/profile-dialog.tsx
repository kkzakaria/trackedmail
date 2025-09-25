"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CalendarIcon,
  ClockIcon,
  MailIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react";

interface ProfileDialogProps {
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({
  user,
  open,
  onOpenChange,
}: ProfileDialogProps) {
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

  // Format role for display
  const getRoleDisplay = (role?: string) => {
    switch (role) {
      case "administrateur":
        return "Administrateur";
      case "manager":
        return "Manager";
      case "utilisateur":
        return "Utilisateur";
      default:
        return "Utilisateur";
    }
  };

  // Format role color
  const getRoleColor = (role?: string) => {
    switch (role) {
      case "administrateur":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      case "manager":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
    }
  };

  // Format date
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Non disponible";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const displayName =
    user.full_name || user.email.split("@")[0] || "Utilisateur";
  const displayEmail = user.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <UserIcon size={20} />
            Mon profil
          </DialogTitle>
          <DialogDescription>
            Informations de votre compte utilisateur
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Avatar and Basic Info */}
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${displayEmail}`}
                alt="Photo de profil"
              />
              <AvatarFallback className="text-lg">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{displayName}</h3>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <MailIcon size={14} />
                {displayEmail}
              </div>
              <Badge className={getRoleColor(user.role)}>
                <ShieldIcon size={12} className="mr-1" />
                {getRoleDisplay(user.role)}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Account Details */}
          <div className="space-y-4">
            <h4 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              Détails du compte
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-muted-foreground" />
                  <span className="text-sm">Compte créé</span>
                </div>
                <span className="font-mono text-sm">
                  {formatDate(user.created_at)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClockIcon size={16} className="text-muted-foreground" />
                  <span className="text-sm">Dernière modification</span>
                </div>
                <span className="font-mono text-sm">
                  {formatDate(user.updated_at)}
                </span>
              </div>

              {user.timezone && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClockIcon size={16} className="text-muted-foreground" />
                    <span className="text-sm">Fuseau horaire</span>
                  </div>
                  <span className="font-mono text-sm">{user.timezone}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      user.is_active ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm">Statut</span>
                </div>
                <Badge variant={user.is_active ? "default" : "secondary"}>
                  {user.is_active ? "Actif" : "Inactif"}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
