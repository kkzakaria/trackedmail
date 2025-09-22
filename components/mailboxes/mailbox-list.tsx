"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMailboxes,
  useDeleteMailbox,
  useToggleMailboxStatus,
  useSyncMailbox,
} from "@/lib/hooks/use-mailboxes";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  Eye,
  Edit,
  Trash2,
  Power,
  RefreshCw,
  Search,
  Plus,
} from "lucide-react";
import Link from "next/link";

interface MailboxListProps {
  onCreateNew?: () => void;
}

export function MailboxList({ onCreateNew }: MailboxListProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Build filters
  const filters = {
    ...(search && { search }),
    ...(statusFilter !== "all" && { isActive: statusFilter === "active" }),
    limit: 50 as number,
    offset: 0 as number,
  };

  const { data: mailboxData, isLoading, error } = useMailboxes(filters);
  const deleteMailboxMutation = useDeleteMailbox();
  const toggleStatusMutation = useToggleMailboxStatus();
  const syncMailboxMutation = useSyncMailbox();

  const mailboxes = mailboxData?.data || [];

  const handleDelete = async (id: string, email: string) => {
    if (
      window.confirm(
        `Êtes-vous sûr de vouloir supprimer la boîte mail ${email} ?`
      )
    ) {
      try {
        await deleteMailboxMutation.mutateAsync(id);
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        alert("Erreur lors de la suppression de la boîte mail");
      }
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleStatusMutation.mutateAsync(id);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      alert("Erreur lors de la mise à jour du statut");
    }
  };

  const handleSync = async (id: string) => {
    try {
      await syncMailboxMutation.mutateAsync(id);
    } catch (error) {
      console.error("Erreur lors de la synchronisation:", error);
      alert("Erreur lors de la synchronisation");
    }
  };

  const canManageMailboxes =
    user?.role === "administrateur" || user?.role === "manager";

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">
            Erreur lors du chargement des boîtes mail: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and filters */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">Boîtes mail</h2>
          <p className="text-muted-foreground">
            Gérez les boîtes mail suivies par l&apos;application
          </p>
        </div>

        {canManageMailboxes && (
          <Button onClick={onCreateNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle boîte mail
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Rechercher par email ou nom..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value: "all" | "active" | "inactive") =>
            setStatusFilter(value)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {!isLoading && (
        <p className="text-muted-foreground text-sm">
          {mailboxData?.count} boîte{(mailboxData?.count ?? 0) > 1 ? "s" : ""}{" "}
          mail trouvée{(mailboxData?.count ?? 0) > 1 ? "s" : ""}
        </p>
      )}

      {/* Mailboxes grid */}
      <div className="grid gap-4">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : mailboxes.length > 0 ? (
          mailboxes.map(mailbox => (
            <Card key={mailbox.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{mailbox.email_address}</h3>
                      <Badge
                        variant={mailbox.is_active ? "default" : "secondary"}
                      >
                        {mailbox.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {mailbox.display_name && (
                      <p className="text-muted-foreground text-sm">
                        {mailbox.display_name}
                      </p>
                    )}

                    <div className="text-muted-foreground flex items-center gap-4 text-xs">
                      {mailbox.last_sync ? (
                        <span>
                          Dernière sync:{" "}
                          {new Date(mailbox.last_sync).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      ) : (
                        <span>Jamais synchronisée</span>
                      )}

                      {mailbox.microsoft_user_id && (
                        <span>
                          ID Microsoft: {mailbox.microsoft_user_id.slice(0, 8)}
                          ...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View button */}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/mailboxes/${mailbox.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>

                    {canManageMailboxes && (
                      <>
                        {/* Edit button */}
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/mailboxes/${mailbox.id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>

                        {/* Toggle status button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(mailbox.id)}
                          disabled={toggleStatusMutation.isPending}
                          className={
                            !mailbox.is_active
                              ? "text-green-600"
                              : "text-orange-600"
                          }
                        >
                          <Power className="h-4 w-4" />
                        </Button>

                        {/* Sync button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(mailbox.id)}
                          disabled={syncMailboxMutation.isPending}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${syncMailboxMutation.isPending ? "animate-spin" : ""}`}
                          />
                        </Button>

                        {/* Delete button */}
                        {user?.role === "administrateur" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleDelete(mailbox.id, mailbox.email_address)
                            }
                            disabled={deleteMailboxMutation.isPending}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          // Empty state
          <Card>
            <CardHeader>
              <CardTitle>Aucune boîte mail trouvée</CardTitle>
              <CardDescription>
                {search || statusFilter !== "all"
                  ? "Aucune boîte mail ne correspond à vos critères de recherche."
                  : "Aucune boîte mail n&apos;a encore été ajoutée."}
              </CardDescription>
            </CardHeader>
            {canManageMailboxes && !search && statusFilter === "all" && (
              <CardContent>
                <Button onClick={onCreateNew}>
                  Ajouter la première boîte mail
                </Button>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
