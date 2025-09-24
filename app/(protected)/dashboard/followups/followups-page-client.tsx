"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { followupService } from "@/lib/services/followup.service";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Clock,
  Send,
  AlertTriangle,
  Ban,
  Calendar,
  Filter,
  Search,
  MoreHorizontal,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  ArrowRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import type {
  FollowupWithEmail,
  FollowupStatus,
  FollowupFilters,
  PaginationParams,
} from "@/lib/types/followup.types";

interface FollowupMetrics {
  total_scheduled: number;
  total_sent: number;
  total_failed: number;
  total_cancelled: number;
  scheduled_today: number;
  sent_today: number;
  next_scheduled_count: number;
}

export function FollowupsPageClient() {
  // State management
  const [followups, setFollowups] = useState<FollowupWithEmail[]>([]);
  const [metrics, setMetrics] = useState<FollowupMetrics>({
    total_scheduled: 0,
    total_sent: 0,
    total_failed: 0,
    total_cancelled: 0,
    scheduled_today: 0,
    sent_today: 0,
    next_scheduled_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedFollowups, setSelectedFollowups] = useState<string[]>([]);

  // Filters and pagination
  const [filters, setFilters] = useState<FollowupFilters>({});
  const [pagination] = useState<PaginationParams>({
    page: 1,
    per_page: 20,
    sort_by: "scheduled_for",
    sort_order: "asc",
  });
  const [totalCount, setTotalCount] = useState(0);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [rescheduleDialog, setRescheduleDialog] = useState<{
    open: boolean;
    followupId: string | null;
    newDate: string;
  }>({
    open: false,
    followupId: null,
    newDate: "",
  });

  // Load followups data
  const loadFollowups = useCallback(async () => {
    try {
      setLoading(true);
      const result = await followupService.getFollowups({
        pagination,
        filters: {
          ...filters,
          search_query: searchQuery || undefined,
        },
        include_email_data: true,
      });

      setFollowups((result.data || []) as unknown as FollowupWithEmail[]);
      setTotalCount(result.pagination.total);
    } catch (error) {
      console.error("Erreur lors du chargement des relances:", error);
      toast.error("Impossible de charger les relances");
    } finally {
      setLoading(false);
    }
  }, [pagination, filters, searchQuery]);

  // Load metrics
  const loadMetrics = async () => {
    try {
      const today = new Date().toISOString().split("T")[0] || "";
      const tomorrow =
        new Date(Date.now() + 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0] || "";

      // Get all followups for metrics calculation
      const allFollowups = await followupService.getFollowups({
        pagination: { page: 1, per_page: 1000 },
        include_email_data: true,
      });

      const followupsData = (allFollowups.data ||
        []) as unknown as FollowupWithEmail[];

      // Calculate metrics
      const newMetrics: FollowupMetrics = {
        total_scheduled: followupsData.filter(f => f.status === "scheduled")
          .length,
        total_sent: followupsData.filter(f => f.status === "sent").length,
        total_failed: followupsData.filter(f => f.status === "failed").length,
        total_cancelled: followupsData.filter(f => f.status === "cancelled")
          .length,
        scheduled_today: followupsData.filter(
          f => f.status === "scheduled" && f.scheduled_for?.startsWith(today)
        ).length,
        sent_today: followupsData.filter(
          f => f.status === "sent" && f.sent_at?.startsWith(today)
        ).length,
        next_scheduled_count: followupsData.filter(
          f => f.status === "scheduled" && f.scheduled_for?.startsWith(tomorrow)
        ).length,
      };

      setMetrics(newMetrics);
    } catch (error) {
      console.error("Erreur lors du chargement des métriques:", error);
    }
  };

  // Effects
  useEffect(() => {
    loadFollowups();
  }, [loadFollowups]);

  useEffect(() => {
    loadMetrics();
  }, []);

  // Status badge variant
  const getStatusBadge = (status: FollowupStatus) => {
    const config = {
      scheduled: {
        variant: "default" as const,
        label: "Programmé",
        icon: Clock,
      },
      sent: { variant: "default" as const, label: "Envoyé", icon: CheckCircle },
      failed: {
        variant: "destructive" as const,
        label: "Échec",
        icon: XCircle,
      },
      cancelled: { variant: "secondary" as const, label: "Annulé", icon: Ban },
    };

    const { variant, label, icon: Icon } = config[status] || config.scheduled;

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  // Handle bulk actions
  const handleBulkCancel = async () => {
    if (selectedFollowups.length === 0) return;

    try {
      for (const followupId of selectedFollowups) {
        const followup = followups.find(f => f.id === followupId);
        if (followup?.tracked_email?.id) {
          await followupService.cancelFollowups(
            followup.tracked_email.id,
            "Annulé manuellement depuis le dashboard"
          );
        }
      }

      setSelectedFollowups([]);
      await loadFollowups();
      await loadMetrics();

      toast.success(
        `${selectedFollowups.length} relance(s) annulée(s) avec succès`
      );
    } catch (error) {
      console.error("Erreur lors de l'annulation:", error);
      toast.error("Impossible d'annuler les relances");
    }
  };

  // Handle reschedule
  const handleReschedule = async () => {
    if (!rescheduleDialog.followupId || !rescheduleDialog.newDate) return;

    try {
      await followupService.rescheduleFollowup(
        rescheduleDialog.followupId,
        new Date(rescheduleDialog.newDate).toISOString()
      );

      setRescheduleDialog({ open: false, followupId: null, newDate: "" });
      await loadFollowups();

      toast.success("La relance a été reprogrammée avec succès");
    } catch (error) {
      console.error("Erreur lors de la reprogrammation:", error);
      toast.error("Impossible de reprogrammer la relance");
    }
  };

  // Memoized filtered data for performance
  const filteredData = useMemo(() => {
    return followups;
  }, [followups]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Mail className="text-primary mr-3 h-8 w-8" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Relances Programmées
                </h1>
                <p className="text-sm text-gray-500">
                  Gestion et suivi des relances automatiques
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadFollowups();
                  loadMetrics();
                }}
                disabled={loading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualiser
              </Button>
              <Link href="/dashboard/followups/calendar">
                <Button variant="outline" size="sm">
                  <Calendar className="mr-2 h-4 w-4" />
                  Vue Calendrier
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Metrics Cards */}
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Programmées
                </CardTitle>
                <Clock className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.total_scheduled}
                </div>
                <p className="text-muted-foreground text-xs">
                  {metrics.scheduled_today} aujourd&apos;hui
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Envoyées</CardTitle>
                <Send className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.total_sent}</div>
                <p className="text-muted-foreground text-xs">
                  {metrics.sent_today} aujourd&apos;hui
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Échecs</CardTitle>
                <AlertTriangle className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.total_failed}</div>
                <p className="text-muted-foreground text-xs">
                  Nécessitent une attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annulées</CardTitle>
                <Ban className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.total_cancelled}
                </div>
                <p className="text-muted-foreground text-xs">
                  {metrics.next_scheduled_count} demain
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtres et Recherche
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <Label htmlFor="search">Recherche</Label>
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                    <Input
                      id="search"
                      placeholder="Rechercher par sujet..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="status">Statut</Label>
                  <Select
                    value={filters.status?.[0] || "all"}
                    onValueChange={value =>
                      setFilters({
                        ...filters,
                        status:
                          value === "all"
                            ? undefined
                            : [value as FollowupStatus],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="scheduled">Programmé</SelectItem>
                      <SelectItem value="sent">Envoyé</SelectItem>
                      <SelectItem value="failed">Échec</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="followup_number">Niveau</Label>
                  <Select
                    value={filters.followup_number?.toString() || "all"}
                    onValueChange={value =>
                      setFilters({
                        ...filters,
                        followup_number:
                          value === "all" ? undefined : parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les niveaux" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les niveaux</SelectItem>
                      <SelectItem value="1">Relance 1</SelectItem>
                      <SelectItem value="2">Relance 2</SelectItem>
                      <SelectItem value="3">Relance 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFilters({});
                      setSearchQuery("");
                    }}
                    className="w-full"
                  >
                    Réinitialiser
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          {selectedFollowups.length > 0 && (
            <Card className="mb-6 border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800">
                      {selectedFollowups.length} relance(s) sélectionnée(s)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFollowups([])}
                    >
                      Désélectionner
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkCancel}
                    >
                      Annuler la sélection
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Followups Table */}
          <Card>
            <CardHeader>
              <CardTitle>Liste des Relances</CardTitle>
              <CardDescription>
                {totalCount} relance(s) au total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedFollowups.length === filteredData.length &&
                          filteredData.length > 0
                        }
                        onCheckedChange={checked => {
                          if (checked) {
                            setSelectedFollowups(filteredData.map(f => f.id));
                          } else {
                            setSelectedFollowups([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Email Original</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Programmé pour</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center">
                        Chargement...
                      </TableCell>
                    </TableRow>
                  ) : filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center">
                        Aucune relance trouvée
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map(followup => (
                      <TableRow key={followup.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedFollowups.includes(followup.id)}
                            onCheckedChange={checked => {
                              if (checked) {
                                setSelectedFollowups([
                                  ...selectedFollowups,
                                  followup.id,
                                ]);
                              } else {
                                setSelectedFollowups(
                                  selectedFollowups.filter(
                                    id => id !== followup.id
                                  )
                                );
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <Link
                              href={`/dashboard/followups/${followup.id}`}
                              className="font-medium hover:underline"
                            >
                              {followup.tracked_email?.subject || "Sans sujet"}
                            </Link>
                            <span className="text-muted-foreground text-sm">
                              {followup.tracked_email?.recipient_emails?.[0]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            Relance {followup.followup_number}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(followup.status as FollowupStatus)}
                        </TableCell>
                        <TableCell>
                          {followup.scheduled_for ? (
                            <div className="flex flex-col">
                              <span>
                                {format(
                                  parseISO(followup.scheduled_for),
                                  "dd/MM/yyyy",
                                  {
                                    locale: fr,
                                  }
                                )}
                              </span>
                              <span className="text-muted-foreground text-sm">
                                {format(
                                  parseISO(followup.scheduled_for),
                                  "HH:mm",
                                  {
                                    locale: fr,
                                  }
                                )}
                              </span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {followup.template?.name || "Template supprimé"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/followups/${followup.id}`}
                                >
                                  <ArrowRight className="mr-2 h-4 w-4" />
                                  Voir détails
                                </Link>
                              </DropdownMenuItem>
                              {followup.status === "scheduled" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setRescheduleDialog({
                                      open: true,
                                      followupId: followup.id,
                                      newDate: followup.scheduled_for || "",
                                    })
                                  }
                                >
                                  <Calendar className="mr-2 h-4 w-4" />
                                  Reprogrammer
                                </DropdownMenuItem>
                              )}
                              {followup.status === "scheduled" && (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    if (followup.tracked_email?.id) {
                                      await followupService.cancelFollowups(
                                        followup.tracked_email.id,
                                        "Annulé manuellement"
                                      );
                                      loadFollowups();
                                      loadMetrics();
                                    }
                                  }}
                                  className="text-red-600"
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Annuler
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Reschedule Dialog */}
      <Dialog
        open={rescheduleDialog.open}
        onOpenChange={open =>
          setRescheduleDialog({ ...rescheduleDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprogrammer la relance</DialogTitle>
            <DialogDescription>
              Choisissez une nouvelle date et heure pour cette relance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="new-date">Nouvelle date et heure</Label>
              <Input
                id="new-date"
                type="datetime-local"
                value={rescheduleDialog.newDate.slice(0, 16)}
                onChange={e =>
                  setRescheduleDialog({
                    ...rescheduleDialog,
                    newDate: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setRescheduleDialog({
                  open: false,
                  followupId: null,
                  newDate: "",
                })
              }
            >
              Annuler
            </Button>
            <Button onClick={handleReschedule}>Reprogrammer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
