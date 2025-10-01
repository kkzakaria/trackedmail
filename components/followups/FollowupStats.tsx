"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { followupService } from "@/lib/services/followup.service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Send,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import type { FollowupStatistics } from "@/lib/types/followup.types";

interface FollowupStatsProps {
  className?: string;
  showFilters?: boolean;
  compactMode?: boolean;
}

interface PerformanceMetrics {
  total_followups: number;
  success_rate: number;
  average_response_time_hours: number;
  templates_performance: Array<{
    template_id: string;
    name: string;
    sent_count: number;
    success_rate: number;
  }>;
  trends: Array<{
    date: string;
    sent: number;
    responses: number;
    success_rate: number;
  }>;
}

const CHART_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#84cc16", // Lime
  "#f97316", // Orange
];

export function FollowupStats({
  className = "",
  showFilters = true,
  compactMode = false,
}: FollowupStatsProps) {
  // State management
  const [statistics, setStatistics] = useState<FollowupStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<string>("30");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("all");

  // Load statistics
  const loadStatistics = useCallback(async () => {
    try {
      setLoading(true);

      const endDate = new Date();
      const startDate = subDays(endDate, parseInt(timeRange));

      const filters = {
        date_from: startOfDay(startDate).toISOString(),
        date_to: endOfDay(endDate).toISOString(),
      };

      const stats = await followupService.getStatistics(filters);
      setStatistics(stats);
    } catch (error) {
      console.error("Erreur lors du chargement des statistiques:", error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // Computed metrics
  const metrics = useMemo((): PerformanceMetrics | null => {
    if (!statistics) return null;

    const total_followups =
      statistics.total_sent +
      statistics.total_scheduled +
      statistics.total_failed +
      statistics.total_cancelled;

    // Simulate trend data (in a real app, this would come from the backend)
    const trends = Array.from({ length: parseInt(timeRange) }, (_, i) => {
      const date = format(
        subDays(new Date(), parseInt(timeRange) - i - 1),
        "yyyy-MM-dd"
      );
      const sent = Math.floor(Math.random() * 20) + 5;
      const responses = Math.floor(sent * (statistics.success_rate / 100));

      return {
        date,
        sent,
        responses,
        success_rate: sent > 0 ? (responses / sent) * 100 : 0,
      };
    });

    return {
      total_followups,
      success_rate: statistics.success_rate,
      average_response_time_hours: statistics.average_response_time_hours,
      templates_performance: statistics.by_template.map(template => ({
        template_id: template.template_id,
        name: template.template_name,
        sent_count: template.sent_count,
        success_rate: template.success_rate,
      })),
      trends,
    };
  }, [statistics, timeRange]);

  // Chart data processing
  const templateChartData = useMemo(() => {
    if (!metrics) return [];

    return metrics.templates_performance
      .filter(
        template =>
          selectedTemplate === "all" ||
          template.template_id === selectedTemplate
      )
      .map((template, index) => ({
        name:
          template.name.length > 20
            ? template.name.substring(0, 20) + "..."
            : template.name,
        fullName: template.name,
        sent: template.sent_count,
        success_rate: template.success_rate,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [metrics, selectedTemplate]);

  const followupLevelData = useMemo(() => {
    if (!statistics) return [];

    return statistics.by_followup_number.map((level, index) => ({
      level: `Relance ${level.followup_number}`,
      sent: level.sent_count,
      success_rate: level.success_rate,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [statistics]);

  const statusDistribution = useMemo(() => {
    if (!statistics) return [];

    return [
      { name: "Envoyés", value: statistics.total_sent, color: CHART_COLORS[1] },
      {
        name: "Programmés",
        value: statistics.total_scheduled,
        color: CHART_COLORS[0],
      },
      {
        name: "Échecs",
        value: statistics.total_failed,
        color: CHART_COLORS[3],
      },
      {
        name: "Annulés",
        value: statistics.total_cancelled,
        color: CHART_COLORS[2],
      },
    ].filter(item => item.value > 0);
  }, [statistics]);

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="mb-2 h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!statistics || !metrics) {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <p className="text-gray-500">Aucune donnée disponible</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres d&apos;Analyse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Période d&apos;analyse
                </label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 derniers jours</SelectItem>
                    <SelectItem value="30">30 derniers jours</SelectItem>
                    <SelectItem value="90">90 derniers jours</SelectItem>
                    <SelectItem value="365">Année complète</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Modèle spécifique
                </label>
                <Select
                  value={selectedTemplate}
                  onValueChange={setSelectedTemplate}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les modèles</SelectItem>
                    {metrics.templates_performance.map(template => (
                      <SelectItem
                        key={template.template_id}
                        value={template.template_id}
                      >
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={loadStatistics}
                  className="w-full"
                >
                  Actualiser
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Relances
            </CardTitle>
            <Send className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total_followups}</div>
            <p className="text-muted-foreground text-xs">
              {statistics.total_sent} envoyées avec succès
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taux de Succès
            </CardTitle>
            <Target className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.success_rate.toFixed(1)}%
            </div>
            <div className="text-muted-foreground flex items-center text-xs">
              {metrics.success_rate > 20 ? (
                <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="mr-1 h-3 w-3 text-red-500" />
              )}
              {metrics.success_rate > 20 ? "Bon taux" : "À améliorer"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Temps de Réponse
            </CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.average_response_time_hours.toFixed(0)}h
            </div>
            <p className="text-muted-foreground text-xs">
              Temps moyen de réponse
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Échecs</CardTitle>
            <AlertTriangle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.total_failed}</div>
            <p className="text-muted-foreground text-xs">
              {statistics.total_cancelled} annulées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Performance by Template */}
        <Card>
          <CardHeader>
            <CardTitle>Performance par Modèle</CardTitle>
            <CardDescription>
              Nombre d&apos;envois et taux de succès par modèle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={templateChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.length && payload[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-white p-3 shadow-lg">
                          <p className="font-medium">{data.fullName}</p>
                          <p className="text-sm">
                            <span className="font-medium">Envois:</span>{" "}
                            {data.sent}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Succès:</span>{" "}
                            {data.success_rate.toFixed(1)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="sent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance by Followup Level */}
        <Card>
          <CardHeader>
            <CardTitle>Performance par Niveau</CardTitle>
            <CardDescription>
              Efficacité des relances par niveau (1, 2, 3)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={followupLevelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="level"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar
                  yAxisId="left"
                  dataKey="sent"
                  fill="#10b981"
                  name="Envois"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="success_rate"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  name="Taux de succès (%)"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition des Statuts</CardTitle>
            <CardDescription>
              Distribution des relances par statut
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Tendances</CardTitle>
            <CardDescription>
              Évolution des envois et réponses dans le temps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={metrics.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  fontSize={12}
                  tickFormatter={value => format(new Date(value), "dd/MM")}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={value =>
                    format(new Date(value), "dd MMMM yyyy", { locale: fr })
                  }
                  formatter={(value: number, name: string) => [
                    value,
                    name === "sent"
                      ? "Envois"
                      : name === "responses"
                        ? "Réponses"
                        : name,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="responses"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Template Performance Details */}
      {!compactMode && metrics.templates_performance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Détails des Modèles</CardTitle>
            <CardDescription>
              Performance détaillée de chaque modèle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.templates_performance.map(template => (
                <div
                  key={template.template_id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="text-sm text-gray-600">
                      {template.sent_count} envois
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {template.success_rate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">Taux de succès</p>
                    </div>
                    <Badge
                      variant={
                        template.success_rate > 25
                          ? "default"
                          : template.success_rate > 15
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {template.success_rate > 25
                        ? "Excellent"
                        : template.success_rate > 15
                          ? "Bon"
                          : "À améliorer"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
