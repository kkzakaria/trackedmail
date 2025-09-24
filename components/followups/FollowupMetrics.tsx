"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Clock,
  Send,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Zap,
  Activity,
  Bell,
  RefreshCw,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import type {
  FollowupMetrics,
  FollowupWithEmail,
} from "@/lib/types/followup.types";

interface FollowupMetricsProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
  showAlerts?: boolean;
  compactMode?: boolean;
}

interface ExtendedMetrics extends FollowupMetrics {
  health_score: number;
  alerts: Alert[];
  trends: {
    sent_trend: number;
    success_trend: number;
    failure_trend: number;
  };
}

interface Alert {
  id: string;
  type: "warning" | "error" | "info";
  title: string;
  message: string;
  action?: string;
}

export function FollowupMetrics({
  className = "",
  autoRefresh = true,
  refreshInterval = 30,
  showAlerts = true,
  compactMode = false,
}: FollowupMetricsProps) {
  // State management
  const [metrics, setMetrics] = useState<ExtendedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Load real-time metrics
  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);

      // Get current date ranges
      const now = new Date();
      const today = now.toISOString().split("T")[0] || "";

      // Load followups for metrics calculation
      const allFollowups = await followupService.getFollowups({
        pagination: { page: 1, per_page: 1000 },
        include_email_data: true,
      });

      const followupsData = (allFollowups.data ||
        []) as unknown as FollowupWithEmail[];

      // Calculate base metrics
      const baseMetrics: FollowupMetrics = {
        pending_count: followupsData.filter(f => f.status === "scheduled")
          .length,
        scheduled_today: followupsData.filter(
          f => f.status === "scheduled" && f.scheduled_for?.startsWith(today)
        ).length,
        sent_today: followupsData.filter(
          f => f.status === "sent" && f.sent_at?.startsWith(today)
        ).length,
        failed_today: followupsData.filter(
          f => f.status === "failed" && f.failed_at?.startsWith(today)
        ).length,
        next_scheduled: getNextScheduled(followupsData),
        templates_performance: getTemplatesPerformance(followupsData),
      };

      // Calculate extended metrics
      const extendedMetrics: ExtendedMetrics = {
        ...baseMetrics,
        health_score: calculateHealthScore(baseMetrics, followupsData),
        alerts: generateAlerts(baseMetrics, followupsData),
        trends: calculateTrends(followupsData),
      };

      setMetrics(extendedMetrics);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Erreur lors du chargement des métriques:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper functions
  const getNextScheduled = (followups: FollowupWithEmail[]) => {
    const scheduledFollowups = followups
      .filter(f => f.status === "scheduled" && f.scheduled_for)
      .sort(
        (a, b) =>
          new Date(a.scheduled_for).getTime() -
          new Date(b.scheduled_for).getTime()
      );

    if (scheduledFollowups.length === 0) return undefined;

    const firstFollowup = scheduledFollowups[0];
    if (!firstFollowup) return undefined;

    const nextDate = firstFollowup.scheduled_for;
    if (!nextDate) return undefined;

    const count = scheduledFollowups.filter(f =>
      f.scheduled_for?.startsWith(nextDate.split("T")[0] || "")
    ).length;

    return {
      datetime: nextDate,
      count,
    };
  };

  const getTemplatesPerformance = (followups: FollowupWithEmail[]) => {
    const templateStats = new Map();
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    followups
      .filter(f => f.template_id && f.sent_at && f.sent_at >= sevenDaysAgo)
      .forEach(f => {
        const templateId = f.template_id;
        if (!templateId) return;

        const key = templateId;
        if (!templateStats.has(key)) {
          templateStats.set(key, {
            template_id: templateId,
            name: `Template ${templateId.slice(0, 8)}`,
            usage_last_7_days: 0,
            success_rate_last_7_days: 0,
            responses: 0,
          });
        }

        const stats = templateStats.get(key);
        stats.usage_last_7_days++;

        // Simulate success rate (in real app, would track actual responses)
        if (Math.random() > 0.7) {
          stats.responses++;
        }
      });

    return Array.from(templateStats.values()).map(stats => ({
      ...stats,
      success_rate_last_7_days:
        stats.usage_last_7_days > 0
          ? (stats.responses / stats.usage_last_7_days) * 100
          : 0,
    }));
  };

  const calculateHealthScore = (
    metrics: FollowupMetrics,
    followups: FollowupWithEmail[]
  ): number => {
    let score = 100;

    // Penalize high failure rate
    const totalSent = followups.filter(f => f.status === "sent").length;
    const totalFailed = followups.filter(f => f.status === "failed").length;
    const failureRate = totalSent > 0 ? (totalFailed / totalSent) * 100 : 0;

    if (failureRate > 10) score -= 30;
    else if (failureRate > 5) score -= 15;

    // Penalize too many pending without activity
    if (metrics.pending_count > 50 && metrics.sent_today === 0) score -= 20;

    // Boost for good activity
    if (metrics.sent_today > 5 && metrics.failed_today === 0) score += 10;

    return Math.max(0, Math.min(100, score));
  };

  const generateAlerts = (
    metrics: FollowupMetrics,
    _followups: FollowupWithEmail[]
  ): Alert[] => {
    const alerts: Alert[] = [];

    // High failure rate alert
    if (metrics.failed_today > 5) {
      alerts.push({
        id: "high_failure",
        type: "error",
        title: "Taux d'échec élevé",
        message: `${metrics.failed_today} relances ont échoué aujourd&apos;hui`,
        action: "Vérifier les logs",
      });
    }

    // No activity alert
    if (metrics.sent_today === 0 && metrics.scheduled_today > 0) {
      alerts.push({
        id: "no_activity",
        type: "warning",
        title: "Aucune relance envoyée",
        message:
          "Aucune relance n&apos;a été envoyée aujourd&apos;hui malgré le planning",
        action: "Vérifier le système",
      });
    }

    // Upcoming batch alert
    if (metrics.next_scheduled && metrics.next_scheduled.count > 20) {
      alerts.push({
        id: "large_batch",
        type: "info",
        title: "Lot important programmé",
        message: `${metrics.next_scheduled.count} relances programmées prochainement`,
      });
    }

    return alerts;
  };

  const calculateTrends = (followups: FollowupWithEmail[]) => {
    const yesterday =
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0] ||
      "";
    const today = new Date().toISOString().split("T")[0] || "";

    const sentYesterday = followups.filter(
      f => f.status === "sent" && f.sent_at?.startsWith(yesterday)
    ).length;
    const sentToday = followups.filter(
      f => f.status === "sent" && f.sent_at?.startsWith(today)
    ).length;

    const failedYesterday = followups.filter(
      f => f.status === "failed" && f.failed_at?.startsWith(yesterday)
    ).length;
    const failedToday = followups.filter(
      f => f.status === "failed" && f.failed_at?.startsWith(today)
    ).length;

    return {
      sent_trend:
        sentYesterday > 0
          ? ((sentToday - sentYesterday) / sentYesterday) * 100
          : 0,
      success_trend: 0, // Would calculate from actual response data
      failure_trend:
        failedYesterday > 0
          ? ((failedToday - failedYesterday) / failedYesterday) * 100
          : 0,
    };
  };

  // Auto-refresh effect
  useEffect(() => {
    loadMetrics();

    if (autoRefresh) {
      const interval = setInterval(loadMetrics, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [loadMetrics, autoRefresh, refreshInterval]);

  // Render loading state
  if (loading && !metrics) {
    return (
      <div className={`space-y-4 ${className}`}>
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

  if (!metrics) {
    return (
      <Card className={className}>
        <CardContent className="flex h-32 items-center justify-center">
          <p className="text-gray-500">Aucune métrique disponible</p>
        </CardContent>
      </Card>
    );
  }

  const healthColor =
    metrics.health_score >= 80
      ? "text-green-600"
      : metrics.health_score >= 60
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Métriques Temps Réel</h3>
          <p className="text-sm text-gray-500">
            Dernière mise à jour : {format(lastUpdate, "HH:mm:ss")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadMetrics}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Actualiser
        </Button>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            État du Système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Score de Santé</span>
            <span className={`text-2xl font-bold ${healthColor}`}>
              {metrics.health_score}%
            </span>
          </div>
          <Progress value={metrics.health_score} className="mb-4" />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Relances en attente:</span>
              <span className="ml-2 font-medium">{metrics.pending_count}</span>
            </div>
            <div>
              <span className="text-gray-600">Envoyées aujourd&apos;hui:</span>
              <span className="ml-2 font-medium">{metrics.sent_today}</span>
              {metrics.trends.sent_trend !== 0 && (
                <span
                  className={`ml-1 text-xs ${metrics.trends.sent_trend > 0 ? "text-green-600" : "text-red-600"}`}
                >
                  ({metrics.trends.sent_trend > 0 ? "+" : ""}
                  {metrics.trends.sent_trend.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Programmées Aujourd&apos;hui
            </CardTitle>
            <Clock className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.scheduled_today}</div>
            <p className="text-muted-foreground text-xs">
              À envoyer aujourd&apos;hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Envoyées</CardTitle>
            <Send className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{metrics.sent_today}</div>
              {metrics.trends.sent_trend !== 0 && (
                <div
                  className={`flex items-center text-xs ${
                    metrics.trends.sent_trend > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {metrics.trends.sent_trend > 0 ? (
                    <TrendingUp className="mr-1 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-1 h-3 w-3" />
                  )}
                  {Math.abs(metrics.trends.sent_trend).toFixed(1)}%
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-xs">Depuis ce matin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Échecs</CardTitle>
            <XCircle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {metrics.failed_today}
            </div>
            <p className="text-muted-foreground text-xs">
              Erreurs aujourd&apos;hui
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Prochaine Vague
            </CardTitle>
            <Calendar className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            {metrics.next_scheduled ? (
              <>
                <div className="text-2xl font-bold">
                  {metrics.next_scheduled.count}
                </div>
                <p className="text-muted-foreground text-xs">
                  {isToday(new Date(metrics.next_scheduled.datetime))
                    ? "Aujourd&apos;hui"
                    : isTomorrow(new Date(metrics.next_scheduled.datetime))
                      ? "Demain"
                      : format(
                          new Date(metrics.next_scheduled.datetime),
                          "dd/MM"
                        )}
                  {" à "}
                  {format(new Date(metrics.next_scheduled.datetime), "HH:mm")}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">—</div>
                <p className="text-muted-foreground text-xs">
                  Aucune programmation
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {showAlerts && metrics.alerts.length > 0 && (
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 font-medium">
            <Bell className="h-4 w-4" />
            Alertes Système
          </h4>
          {metrics.alerts.map(alert => (
            <Alert
              key={alert.id}
              variant={alert.type === "error" ? "destructive" : "default"}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{alert.message}</span>
                {alert.action && (
                  <Button variant="outline" size="sm">
                    {alert.action}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Template Performance Overview */}
      {!compactMode && metrics.templates_performance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Templates (7j)
            </CardTitle>
            <CardDescription>
              Utilisation et efficacité des templates cette semaine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.templates_performance.slice(0, 5).map(template => (
                <div
                  key={template.template_id}
                  className="flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-gray-500">
                      {template.usage_last_7_days} utilisations
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        template.success_rate_last_7_days > 25
                          ? "default"
                          : template.success_rate_last_7_days > 15
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {template.success_rate_last_7_days.toFixed(0)}%
                    </Badge>
                    {template.usage_last_7_days > 10 && (
                      <Zap className="h-4 w-4 text-yellow-500" />
                    )}
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
