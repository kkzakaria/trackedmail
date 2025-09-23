"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, Eye, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { followupTemplateService } from "@/lib/services/followup-template.service";
import { FollowupTemplateWithStats } from "@/lib/types/followup.types";
import Link from "next/link";

export default function FollowupTemplatesPage() {
  const [templates, setTemplates] = useState<FollowupTemplateWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Charger les templates
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const result = await followupTemplateService.getTemplates({
        pagination: {
          page,
          per_page: 10,
          sort_by: "created_at",
          sort_order: "desc",
        },
        filters: {
          ...(statusFilter !== "all" && {
            is_active: statusFilter === "active",
          }),
          ...(levelFilter !== "all" && {
            followup_number: parseInt(levelFilter),
          }),
          ...(searchQuery && { search_query: searchQuery }),
        },
        include_stats: true,
      });

      setTemplates(result.data as FollowupTemplateWithStats[]);
      setTotalPages(result.pagination.total_pages);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Erreur lors du chargement des templates");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, levelFilter, searchQuery]);

  useEffect(() => {
    loadTemplates();
  }, [page, statusFilter, levelFilter, searchQuery, loadTemplates]);

  // Activer/désactiver un template
  const toggleTemplateStatus = async (
    templateId: string,
    currentStatus: boolean
  ) => {
    try {
      await followupTemplateService.toggleTemplateStatus(
        templateId,
        !currentStatus
      );
      toast.success(
        `Template ${!currentStatus ? "activé" : "désactivé"} avec succès`
      );
      loadTemplates();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la modification du statut"
      );
    }
  };

  // Supprimer un template
  const deleteTemplate = async (templateId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce template ?")) {
      return;
    }

    try {
      await followupTemplateService.deleteTemplate(templateId);
      toast.success("Template supprimé avec succès");
      loadTemplates();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la suppression"
      );
    }
  };

  // Obtenir le badge de statut
  const getStatusBadge = (isActive: boolean) => {
    return (
      <Badge variant={isActive ? "default" : "secondary"}>
        {isActive ? "Actif" : "Inactif"}
      </Badge>
    );
  };

  // Obtenir le badge de niveau
  const getLevelBadge = (level: number) => {
    const colors = {
      1: "bg-blue-100 text-blue-800",
      2: "bg-orange-100 text-orange-800",
      3: "bg-red-100 text-red-800",
    };

    return (
      <Badge
        className={
          colors[level as keyof typeof colors] || "bg-gray-100 text-gray-800"
        }
      >
        Relance {level}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Chargement des templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Templates de Relances
          </h1>
          <p className="text-muted-foreground">
            Gérez vos templates de relances automatiques
          </p>
        </div>
        <Link href="/admin/followup-templates/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau Template
          </Button>
        </Link>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Templates Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {templates.filter(t => t.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Utilisation Totale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.reduce((sum, t) => sum + (t.usage_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Taux de Succès Moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {templates.length > 0
                ? Math.round(
                    templates.reduce(
                      (sum, t) => sum + (t.success_rate || 0),
                      0
                    ) / templates.length
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Input
                placeholder="Rechercher par nom ou sujet..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les niveaux</SelectItem>
                <SelectItem value="1">Relance 1</SelectItem>
                <SelectItem value="2">Relance 2</SelectItem>
                <SelectItem value="3">Relance 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table des templates */}
      <Card>
        <CardHeader>
          <CardTitle>Templates ({templates.length})</CardTitle>
          <CardDescription>
            Liste de tous vos templates de relances avec leurs statistiques
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Délai</TableHead>
                <TableHead>Utilisation</TableHead>
                <TableHead>Taux de Succès</TableHead>
                <TableHead>Dernière MAJ</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(template => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-muted-foreground max-w-[200px] truncate text-sm">
                        {template.subject}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getLevelBadge(template.followup_number)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(template.is_active || false)}
                  </TableCell>
                  <TableCell>
                    {template.delay_hours || 0}h
                    {(template.delay_hours || 0) >= 24 && (
                      <span className="text-muted-foreground ml-1">
                        ({Math.floor((template.delay_hours || 0) / 24)}j)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {template.usage_count || 0} envois
                    </div>
                  </TableCell>
                  <TableCell>
                    <div
                      className={`text-sm font-medium ${
                        (template.success_rate || 0) > 20
                          ? "text-green-600"
                          : (template.success_rate || 0) > 10
                            ? "text-orange-600"
                            : "text-red-600"
                      }`}
                    >
                      {template.success_rate || 0}%
                    </div>
                  </TableCell>
                  <TableCell>
                    {template.updated_at
                      ? new Date(template.updated_at).toLocaleDateString(
                          "fr-FR"
                        )
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/followup-templates/${template.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link
                        href={`/admin/followup-templates/${template.id}/edit`}
                      >
                        <Button variant="ghost" size="sm">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          toggleTemplateStatus(
                            template.id,
                            template.is_active || false
                          )
                        }
                      >
                        {template.is_active ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTemplate(template.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {templates.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-muted-foreground mb-4">
                Aucun template trouvé
              </div>
              <Link href="/admin/followup-templates/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer votre premier template
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Précédent
          </Button>
          <span className="text-muted-foreground px-4 py-2 text-sm">
            Page {page} sur {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}
