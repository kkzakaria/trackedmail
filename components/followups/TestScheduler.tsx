"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TestTube,
  Play,
  Calendar,
  Clock,
  Mail,
  AlertCircle,
  Info,
  ArrowRight,
} from "lucide-react";
import { format, addHours, addDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

import type {
  WorkingHoursConfig,
  FollowupSettings,
} from "@/lib/types/followup.types";

interface TestSchedulerProps {
  workingHours: WorkingHoursConfig;
  globalSettings: FollowupSettings;
}

interface SimulationResult {
  followup_number: number;
  original_scheduled: string;
  adjusted_scheduled: string;
  is_adjusted: boolean;
  reason: string | undefined;
  is_working_hour: boolean;
  is_working_day: boolean;
  is_holiday: boolean;
}

export function TestScheduler({
  workingHours,
  globalSettings,
}: TestSchedulerProps) {
  const [testDate, setTestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [testTime, setTestTime] = useState("09:00");
  const [simulationResults, setSimulationResults] = useState<
    SimulationResult[]
  >([]);
  const [isRunning, setIsRunning] = useState(false);

  const isWorkingDay = (date: Date): boolean => {
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ] as const;
    const dayOfWeek = date.getDay();
    if (dayOfWeek < 0 || dayOfWeek >= dayNames.length) return false;
    const dayName = dayNames[dayOfWeek];
    if (!dayName) return false;
    return workingHours.working_days.includes(dayName);
  };

  const isHoliday = (date: Date): boolean => {
    const dateString = format(date, "yyyy-MM-dd");
    return workingHours.holidays.includes(dateString);
  };

  const isWorkingHour = (date: Date): boolean => {
    const timeString = format(date, "HH:mm");
    return timeString >= workingHours.start && timeString <= workingHours.end;
  };

  const adjustToWorkingHours = (
    date: Date
  ): { adjusted: Date; reason: string | undefined } => {
    let adjusted = new Date(date);
    let reason: string | undefined;

    // Check if it's a holiday
    if (isHoliday(adjusted)) {
      // Move to next day
      adjusted = addDays(adjusted, 1);
      reason = "Jour férié détecté";
    }

    // Check working days
    while (!isWorkingDay(adjusted)) {
      adjusted = addDays(adjusted, 1);
      reason = reason ? `${reason}, jour non ouvrable` : "Jour non ouvrable";
    }

    // Check working hours
    const timeString = format(adjusted, "HH:mm");
    if (timeString < workingHours.start) {
      // Set to start of working hours
      const timeParts = workingHours.start.split(":").map(Number);
      const hours = timeParts[0] || 0;
      const minutes = timeParts[1] || 0;
      adjusted.setHours(hours, minutes, 0, 0);
      reason = reason
        ? `${reason}, heure ajustée au début`
        : "Heure ajustée au début des heures ouvrables";
    } else if (timeString > workingHours.end) {
      // Move to next working day at start time
      adjusted = addDays(adjusted, 1);
      const timeParts = workingHours.start.split(":").map(Number);
      const hours = timeParts[0] || 0;
      const minutes = timeParts[1] || 0;
      adjusted.setHours(hours, minutes, 0, 0);

      // Recheck if new day is working day
      while (!isWorkingDay(adjusted) || isHoliday(adjusted)) {
        adjusted = addDays(adjusted, 1);
      }

      reason = reason
        ? `${reason}, reporté au jour suivant`
        : "Reporté au jour ouvrable suivant";
    }

    return { adjusted, reason };
  };

  const runSimulation = () => {
    setIsRunning(true);

    try {
      const startDateTime = parseISO(`${testDate}T${testTime}:00`);
      const results: SimulationResult[] = [];

      let currentScheduleTime = new Date(startDateTime);

      for (let i = 1; i <= globalSettings.max_followups; i++) {
        // Calculate original schedule time
        currentScheduleTime = addHours(
          currentScheduleTime,
          globalSettings.default_interval_hours
        );

        const originalScheduled = new Date(currentScheduleTime);

        // Check if adjustment is needed
        const { adjusted: adjustedScheduled, reason } =
          adjustToWorkingHours(currentScheduleTime);

        const isAdjusted =
          originalScheduled.getTime() !== adjustedScheduled.getTime();

        results.push({
          followup_number: i,
          original_scheduled: originalScheduled.toISOString(),
          adjusted_scheduled: adjustedScheduled.toISOString(),
          is_adjusted: isAdjusted,
          reason,
          is_working_hour: isWorkingHour(originalScheduled),
          is_working_day: isWorkingDay(originalScheduled),
          is_holiday: isHoliday(originalScheduled),
        });

        // Use adjusted time for next calculation
        currentScheduleTime = adjustedScheduled;
      }

      setSimulationResults(results);
    } catch (error) {
      console.error("Erreur lors de la simulation:", error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusBadge = (result: SimulationResult) => {
    if (result.is_adjusted) {
      return <Badge variant="destructive">Ajusté</Badge>;
    }
    return <Badge variant="default">Conforme</Badge>;
  };

  const getTotalAdjustments = () => {
    return simulationResults.filter(r => r.is_adjusted).length;
  };

  return (
    <div className="space-y-6">
      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="h-4 w-4" />
            <span>Configuration du Test</span>
          </CardTitle>
          <CardDescription>
            Simulez la planification des relances à partir d&apos;une date et
            heure données
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="test-date">Date de Test</Label>
              <Input
                id="test-date"
                type="date"
                value={testDate}
                onChange={e => setTestDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-time">Heure de Test</Label>
              <Input
                id="test-time"
                type="time"
                value={testTime}
                onChange={e => setTestTime(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={runSimulation}
                disabled={isRunning}
                className="w-full"
              >
                <Play className="mr-2 h-4 w-4" />
                {isRunning ? "Simulation..." : "Lancer la Simulation"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Results */}
      {simulationResults.length > 0 && (
        <>
          {/* Summary */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-800">
                Résumé de la Simulation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-4">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {globalSettings.max_followups}
                  </div>
                  <div className="text-sm text-blue-700">
                    Relances planifiées
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {simulationResults.length - getTotalAdjustments()}
                  </div>
                  <div className="text-sm text-green-700">Conformes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {getTotalAdjustments()}
                  </div>
                  <div className="text-sm text-orange-700">Ajustées</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {globalSettings.default_interval_hours}h
                  </div>
                  <div className="text-sm text-purple-700">Intervalle</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Results */}
          <Card>
            <CardHeader>
              <CardTitle>Résultats Détaillés</CardTitle>
              <CardDescription>
                Planification de chaque relance avec ajustements appliqués
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {simulationResults.map((result, index) => (
                    <div key={index} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">
                            Relance #{result.followup_number}
                          </Badge>
                          {getStatusBadge(result)}
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Mail className="h-4 w-4" />
                          <span>
                            {format(
                              parseISO(result.adjusted_scheduled),
                              "EEEE d MMMM",
                              { locale: fr }
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Original Schedule */}
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-700">
                            Planification Initiale
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              {format(
                                parseISO(result.original_scheduled),
                                "dd/MM/yyyy",
                                { locale: fr }
                              )}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              {format(
                                parseISO(result.original_scheduled),
                                "HH:mm",
                                { locale: fr }
                              )}
                            </span>
                          </div>

                          {/* Status indicators */}
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge
                              variant={
                                result.is_working_day
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {result.is_working_day
                                ? "Jour ouvrable"
                                : "Jour non ouvrable"}
                            </Badge>
                            <Badge
                              variant={
                                result.is_working_hour
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs"
                            >
                              {result.is_working_hour
                                ? "Heure ouvrable"
                                : "Heure non ouvrable"}
                            </Badge>
                            {result.is_holiday && (
                              <Badge variant="destructive" className="text-xs">
                                Jour férié
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Adjusted Schedule */}
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-green-700">
                            Planification Finale
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">
                              {format(
                                parseISO(result.adjusted_scheduled),
                                "dd/MM/yyyy",
                                { locale: fr }
                              )}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">
                              {format(
                                parseISO(result.adjusted_scheduled),
                                "HH:mm",
                                { locale: fr }
                              )}
                            </span>
                          </div>

                          {/* Adjustment reason */}
                          {result.is_adjusted && result.reason && (
                            <Alert className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                {result.reason}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>

                      {/* Arrow indicator for adjustments */}
                      {result.is_adjusted && (
                        <div className="mt-3 flex justify-center">
                          <div className="flex items-center space-x-2 text-orange-600">
                            <ArrowRight className="h-4 w-4" />
                            <span className="text-xs font-medium">
                              Ajustement appliqué
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Utilisée</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 font-medium">Heures Ouvrables</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Plage horaire :</strong> {workingHours.start} -{" "}
                  {workingHours.end}
                </div>
                <div>
                  <strong>Fuseau horaire :</strong> {workingHours.timezone}
                </div>
                <div>
                  <strong>Jours ouvrables :</strong>{" "}
                  {workingHours.working_days.join(", ")}
                </div>
                <div>
                  <strong>Jours fériés :</strong> {workingHours.holidays.length}{" "}
                  configurés
                </div>
              </div>
            </div>
            <div>
              <h4 className="mb-3 font-medium">Paramètres de Relance</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Max relances :</strong> {globalSettings.max_followups}
                </div>
                <div>
                  <strong>Intervalle :</strong>{" "}
                  {globalSettings.default_interval_hours}h
                </div>
                <div>
                  <strong>Expiration :</strong> {globalSettings.stop_after_days}{" "}
                  jours
                </div>
                <div>
                  <strong>Système :</strong>{" "}
                  <Badge
                    variant={
                      globalSettings.system_enabled ? "default" : "destructive"
                    }
                  >
                    {globalSettings.system_enabled ? "Activé" : "Désactivé"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Information */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Cette simulation vous permet de vérifier comment vos paramètres
          affectent la planification des relances. Les ajustements automatiques
          garantissent que les relances sont envoyées uniquement pendant les
          heures ouvrables.
        </AlertDescription>
      </Alert>
    </div>
  );
}
