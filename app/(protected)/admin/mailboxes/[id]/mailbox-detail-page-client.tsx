"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMailbox,
  useDeleteMailbox,
  useToggleMailboxStatus,
  useSyncMailbox,
} from "@/lib/hooks/use-mailboxes";
import { useMailboxUsers } from "@/lib/hooks/use-assignments";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Power,
  RefreshCw,
  Users,
  Mail,
  Calendar,
  User,
} from "lucide-react";
import Link from "next/link";

interface User {
  role: string;
}

interface MailboxDetailPageClientProps {
  mailboxId: string;
  user: User;
}

export function MailboxDetailPageClient({
  mailboxId,
  user,
}: MailboxDetailPageClientProps) {
  const router = useRouter();

  const { data: mailbox, isLoading, error } = useMailbox(mailboxId);
  const { data: assignedUsers, isLoading: usersLoading } =
    useMailboxUsers(mailboxId);

  const deleteMailboxMutation = useDeleteMailbox();
  const toggleStatusMutation = useToggleMailboxStatus();
  const syncMailboxMutation = useSyncMailbox();

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !mailbox) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">
              {error?.message || "Boîte mail introuvable"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDelete = async () => {
    if (
      window.confirm(
        `Êtes-vous sûr de vouloir supprimer la boîte mail ${mailbox.email_address} ?`
      )
    ) {
      try {
        await deleteMailboxMutation.mutateAsync(mailbox.id);
        router.push("/admin/mailboxes");
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        alert("Erreur lors de la suppression de la boîte mail");
      }
    }
  };

  const handleToggleStatus = async () => {
    try {
      await toggleStatusMutation.mutateAsync(mailbox.id);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      alert("Erreur lors de la mise à jour du statut");
    }
  };

  const handleSync = async () => {
    try {
      await syncMailboxMutation.mutateAsync(mailbox.id);
    } catch (error) {
      console.error("Erreur lors de la synchronisation:", error);
      alert("Erreur lors de la synchronisation");
    }
  };

  const canManageMailboxes =
    user.role === "administrateur" || user.role === "manager";

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/mailboxes">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Link>
            </Button>

            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                {mailbox.email_address}
                <Badge variant={mailbox.is_active ? "default" : "secondary"}>
                  {mailbox.is_active ? "Active" : "Inactive"}
                </Badge>
              </h1>
              {mailbox.display_name && (
                <p className="text-muted-foreground">{mailbox.display_name}</p>
              )}
            </div>
          </div>

          {canManageMailboxes && (
            <div className="flex items-center gap-2">
              {/* Edit button */}
              <Button asChild variant="outline">
                <Link href={`/admin/mailboxes/${mailbox.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Modifier
                </Link>
              </Button>

              {/* Toggle status button */}
              <Button
                variant="outline"
                onClick={handleToggleStatus}
                disabled={toggleStatusMutation.isPending}
                className={
                  !mailbox.is_active ? "text-green-600" : "text-orange-600"
                }
              >
                <Power className="mr-2 h-4 w-4" />
                {mailbox.is_active ? "Désactiver" : "Activer"}
              </Button>

              {/* Sync button */}
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={syncMailboxMutation.isPending}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${syncMailboxMutation.isPending ? "animate-spin" : ""}`}
                />
                Synchroniser
              </Button>

              {/* Delete button (admin only) */}
              {user.role === "administrateur" && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMailboxMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Mailbox Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Informations de la boîte mail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-muted-foreground text-sm font-medium">
                  Adresse email
                </label>
                <p className="font-mono">{mailbox.email_address}</p>
              </div>

              {mailbox.display_name && (
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    Nom d&apos;affichage
                  </label>
                  <p>{mailbox.display_name}</p>
                </div>
              )}

              {mailbox.microsoft_user_id && (
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    ID utilisateur Microsoft
                  </label>
                  <p className="font-mono text-sm">
                    {mailbox.microsoft_user_id}
                  </p>
                </div>
              )}

              <div>
                <label className="text-muted-foreground text-sm font-medium">
                  Statut
                </label>
                <div className="mt-1">
                  <Badge variant={mailbox.is_active ? "default" : "secondary"}>
                    {mailbox.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    Créée le
                  </label>
                  <p className="text-sm">
                    {mailbox.created_at &&
                      new Date(mailbox.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </p>
                </div>

                <div>
                  <label className="text-muted-foreground text-sm font-medium">
                    Dernière synchronisation
                  </label>
                  <p className="text-sm">
                    {mailbox.last_sync
                      ? new Date(mailbox.last_sync).toLocaleDateString(
                          "fr-FR",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "Jamais synchronisée"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Utilisateurs assignés
              </CardTitle>
              <CardDescription>
                Utilisateurs ayant accès à cette boîte mail
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : assignedUsers && assignedUsers.length > 0 ? (
                <div className="space-y-4">
                  {assignedUsers.map(assignment => (
                    <div
                      key={assignment.id}
                      className="flex items-center gap-3"
                    >
                      <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {assignment.users?.full_name ||
                            assignment.users?.email}
                        </p>
                        <div className="text-muted-foreground flex items-center gap-2 text-sm">
                          <span>{assignment.users?.email}</span>
                          <Badge variant="outline" className="text-xs">
                            {assignment.users?.role}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {assignment.assigned_at &&
                            new Date(assignment.assigned_at).toLocaleDateString(
                              "fr-FR"
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Aucun utilisateur assigné à cette boîte mail.
                </p>
              )}

              {canManageMailboxes && (
                <div className="mt-4 border-t pt-4">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/admin/mailboxes/${mailbox.id}/assignments`}>
                      Gérer les assignations
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
