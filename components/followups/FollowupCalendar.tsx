"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { followupService } from "@/lib/services/followup.service";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  AlertTriangle,
  Ban,
  List,
  Grid,
  Eye,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import type {
  FollowupWithEmail,
  FollowupStatus,
} from "@/lib/types/followup.types";

interface FollowupCalendarProps {
  className?: string;
  selectedMailboxId?: string;
  onDateSelect?: (date: Date) => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  followups: FollowupWithEmail[];
  stats: {
    scheduled: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
}

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  status: FollowupStatus;
  followup: FollowupWithEmail;
}

type ViewMode = "month" | "week" | "day";

export function FollowupCalendar({
  className = "",
  selectedMailboxId,
  onDateSelect,
}: FollowupCalendarProps) {
  // State management
  const [followups, setFollowups] = useState<FollowupWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<FollowupStatus | "all">(
    "all"
  );

  // Load followups for calendar period
  const loadFollowups = useCallback(async () => {
    try {
      setLoading(true);

      let startDate: Date;
      let endDate: Date;

      switch (viewMode) {
        case "month":
          startDate = startOfWeek(startOfMonth(currentDate), {
            weekStartsOn: 1,
          });
          endDate = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
          break;
        case "week":
          startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
          endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
          break;
        case "day":
          startDate = new Date(currentDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(currentDate);
          endDate.setHours(23, 59, 59, 999);
          break;
      }

      const filters = {
        date_from: startDate.toISOString(),
        date_to: endDate.toISOString(),
        mailbox_id: selectedMailboxId,
        status: statusFilter === "all" ? undefined : [statusFilter],
      };

      const result = await followupService.getFollowups({
        pagination: { page: 1, per_page: 1000 },
        filters,
        include_email_data: true,
      });

      setFollowups(result.data as unknown as FollowupWithEmail[]);
    } catch (error) {
      console.error("Erreur lors du chargement du calendrier:", error);
      toast.error("Impossible de charger le calendrier");
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, selectedMailboxId, statusFilter]);

  // Calendar data computation
  const calendarData = useMemo(() => {
    if (viewMode !== "month") return [];

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return days.map((date): CalendarDay => {
      const dayFollowups = followups.filter(f => {
        const followupDate = f.scheduled_for || f.sent_at || f.created_at;
        return followupDate && isSameDay(new Date(followupDate), date);
      });

      return {
        date,
        isCurrentMonth: isSameMonth(date, currentDate),
        isToday: isToday(date),
        followups: dayFollowups,
        stats: {
          scheduled: dayFollowups.filter(f => f.status === "scheduled").length,
          sent: dayFollowups.filter(f => f.status === "sent").length,
          failed: dayFollowups.filter(f => f.status === "failed").length,
          cancelled: dayFollowups.filter(f => f.status === "cancelled").length,
        },
      };
    });
  }, [currentDate, followups, viewMode]);

  // Week data computation
  const weekData = useMemo(() => {
    if (viewMode !== "week") return [];

    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return days.map((date): CalendarDay => {
      const dayFollowups = followups.filter(f => {
        const followupDate = f.scheduled_for || f.sent_at || f.created_at;
        return followupDate && isSameDay(new Date(followupDate), date);
      });

      return {
        date,
        isCurrentMonth: true,
        isToday: isToday(date),
        followups: dayFollowups,
        stats: {
          scheduled: dayFollowups.filter(f => f.status === "scheduled").length,
          sent: dayFollowups.filter(f => f.status === "sent").length,
          failed: dayFollowups.filter(f => f.status === "failed").length,
          cancelled: dayFollowups.filter(f => f.status === "cancelled").length,
        },
      };
    });
  }, [currentDate, followups, viewMode]);

  // Day events computation
  const dayEvents = useMemo((): CalendarEvent[] => {
    if (viewMode !== "day") return [];

    const dayFollowups = followups.filter(f => {
      const followupDate = f.scheduled_for || f.sent_at || f.created_at;
      return followupDate && isSameDay(new Date(followupDate), currentDate);
    });

    return dayFollowups
      .map((followup): CalendarEvent => {
        const eventDate =
          followup.scheduled_for || followup.sent_at || followup.created_at;
        return {
          id: followup.id,
          title: followup.tracked_email?.subject || "Sans sujet",
          time: eventDate ? format(new Date(eventDate), "HH:mm") : "—",
          status: followup.status as FollowupStatus,
          followup,
        };
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [currentDate, followups, viewMode]);

  // Effects
  useEffect(() => {
    loadFollowups();
  }, [currentDate, viewMode, selectedMailboxId, statusFilter, loadFollowups]);

  // Navigation handlers
  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(
      direction === "next"
        ? addMonths(currentDate, 1)
        : subMonths(currentDate, 1)
    );
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    setCurrentDate(newDate);
  };

  const navigateDay = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    setCurrentDate(newDate);
  };

  const handleNavigation = (direction: "prev" | "next") => {
    switch (viewMode) {
      case "month":
        navigateMonth(direction);
        break;
      case "week":
        navigateWeek(direction);
        break;
      case "day":
        navigateDay(direction);
        break;
    }
  };

  // Status badge configuration
  const getStatusBadge = (status: FollowupStatus, count: number) => {
    if (count === 0) return null;

    const config = {
      scheduled: { variant: "default" as const, label: count.toString() },
      sent: { variant: "default" as const, label: count.toString() },
      failed: { variant: "destructive" as const, label: count.toString() },
      cancelled: { variant: "secondary" as const, label: count.toString() },
    };

    const { variant, label } = config[status];
    return (
      <Badge variant={variant} className="px-1 py-0 text-xs">
        {label}
      </Badge>
    );
  };

  // Get period title
  const getPeriodTitle = () => {
    switch (viewMode) {
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: fr });
      case "week":
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, "dd MMM", { locale: fr })} - ${format(weekEnd, "dd MMM yyyy", { locale: fr })}`;
      case "day":
        return format(currentDate, "EEEE dd MMMM yyyy", { locale: fr });
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 42 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigation("prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="min-w-[200px] text-center text-lg font-semibold">
                  {getPeriodTitle()}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigation("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Aujourd&apos;hui
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={viewMode}
                onValueChange={value => setViewMode(value as ViewMode)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">
                    <div className="flex items-center gap-2">
                      <Grid className="h-4 w-4" />
                      Mois
                    </div>
                  </SelectItem>
                  <SelectItem value="week">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      Semaine
                    </div>
                  </SelectItem>
                  <SelectItem value="day">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Jour
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={value =>
                  setStatusFilter(value as FollowupStatus | "all")
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="scheduled">Programmées</SelectItem>
                  <SelectItem value="sent">Envoyées</SelectItem>
                  <SelectItem value="failed">Échecs</SelectItem>
                  <SelectItem value="cancelled">Annulées</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Views */}
      <Card>
        <CardContent className="p-6">
          {viewMode === "month" && (
            <div className="space-y-4">
              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-2">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(day => (
                  <div
                    key={day}
                    className="p-2 text-center text-sm font-medium text-gray-500"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarData.map((day, index) => (
                  <TooltipProvider key={index}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`min-h-[100px] cursor-pointer rounded-lg border p-2 transition-colors ${day.isCurrentMonth ? "bg-white hover:bg-gray-50" : "bg-gray-50 text-gray-400"} ${day.isToday ? "border-blue-500 bg-blue-50" : "border-gray-200"} ${selectedDate && isSameDay(day.date, selectedDate) ? "ring-2 ring-blue-500" : ""} `}
                          onClick={() => {
                            setSelectedDate(day.date);
                            onDateSelect?.(day.date);
                          }}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span
                              className={`text-sm ${day.isToday ? "font-bold text-blue-600" : ""}`}
                            >
                              {format(day.date, "d")}
                            </span>
                            <div className="flex gap-1">
                              {day.stats.scheduled > 0 &&
                                getStatusBadge(
                                  "scheduled",
                                  day.stats.scheduled
                                )}
                              {day.stats.sent > 0 &&
                                getStatusBadge("sent", day.stats.sent)}
                              {day.stats.failed > 0 &&
                                getStatusBadge("failed", day.stats.failed)}
                            </div>
                          </div>

                          <div className="space-y-1">
                            {day.followups.slice(0, 3).map(followup => (
                              <div
                                key={followup.id}
                                className="truncate rounded bg-gray-100 p-1 text-xs"
                              >
                                {followup.tracked_email?.subject ||
                                  "Sans sujet"}
                              </div>
                            ))}
                            {day.followups.length > 3 && (
                              <div className="text-xs text-gray-500">
                                +{day.followups.length - 3} autres
                              </div>
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-medium">
                            {format(day.date, "dd MMMM yyyy", { locale: fr })}
                          </p>
                          <p className="text-sm">
                            {day.followups.length} relance
                            {day.followups.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
          )}

          {viewMode === "week" && (
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-4">
                {weekData.map((day, index) => (
                  <div key={index} className="space-y-2">
                    <div
                      className={`rounded p-2 text-center ${day.isToday ? "bg-blue-500 text-white" : "bg-gray-100"}`}
                    >
                      <div className="text-sm font-medium">
                        {format(day.date, "EEE", { locale: fr })}
                      </div>
                      <div className="text-lg">{format(day.date, "d")}</div>
                    </div>

                    <div className="min-h-[200px] space-y-1">
                      {day.followups.map(followup => (
                        <Dialog key={followup.id}>
                          <DialogTrigger asChild>
                            <div
                              className={`cursor-pointer rounded border-l-4 p-2 text-xs ${
                                followup.status === "scheduled"
                                  ? "border-blue-500 bg-blue-50"
                                  : followup.status === "sent"
                                    ? "border-green-500 bg-green-50"
                                    : followup.status === "failed"
                                      ? "border-red-500 bg-red-50"
                                      : "border-gray-500 bg-gray-50"
                              } `}
                            >
                              <div className="truncate font-medium">
                                {followup.tracked_email?.subject ||
                                  "Sans sujet"}
                              </div>
                              <div className="text-gray-500">
                                {followup.scheduled_for &&
                                  format(
                                    new Date(followup.scheduled_for),
                                    "HH:mm"
                                  )}
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Relance {followup.followup_number}
                              </DialogTitle>
                              <DialogDescription>
                                {followup.tracked_email?.subject}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-medium">
                                  Destinataire
                                </p>
                                <p className="text-sm text-gray-600">
                                  {
                                    followup.tracked_email
                                      ?.recipient_emails?.[0]
                                  }
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Statut</p>
                                <Badge>{followup.status}</Badge>
                              </div>
                              <Link
                                href={`/dashboard/followups/${followup.id}`}
                              >
                                <Button className="w-full">
                                  Voir les détails
                                </Button>
                              </Link>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === "day" && (
            <div className="space-y-4">
              {dayEvents.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  Aucune relance programmée pour cette journée
                </div>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map(event => (
                    <Link
                      key={event.id}
                      href={`/dashboard/followups/${event.id}`}
                    >
                      <div
                        className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 hover:bg-gray-50 ${
                          event.status === "scheduled"
                            ? "border-l-4 border-l-blue-500"
                            : event.status === "sent"
                              ? "border-l-4 border-l-green-500"
                              : event.status === "failed"
                                ? "border-l-4 border-l-red-500"
                                : "border-l-4 border-l-gray-500"
                        } `}
                      >
                        <div className="w-16 font-mono text-sm text-gray-500">
                          {event.time}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{event.title}</p>
                          <p className="text-sm text-gray-600">
                            Relance {event.followup.followup_number} •{" "}
                            {
                              event.followup.tracked_email
                                ?.recipient_emails?.[0]
                            }
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              event.status === "scheduled"
                                ? "default"
                                : event.status === "sent"
                                  ? "default"
                                  : event.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                            }
                          >
                            {event.status}
                          </Badge>
                          {event.status === "scheduled" && (
                            <Clock className="h-4 w-4 text-gray-400" />
                          )}
                          {event.status === "sent" && (
                            <Send className="h-4 w-4 text-green-500" />
                          )}
                          {event.status === "failed" && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          {event.status === "cancelled" && (
                            <Ban className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
