"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle,
  Info,
} from "lucide-react";

import type { WorkingHoursConfig as WorkingHoursConfigType } from "@/lib/types/followup.types";

interface WorkingHoursConfigProps {
  config: WorkingHoursConfigType;
  onChange: (config: WorkingHoursConfigType) => void;
}

const TIMEZONES = [
  { value: "UTC", label: "UTC (Temps Universel Coordonné)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
];

const DAYS_OF_WEEK = [
  { key: "monday", label: "Lundi", shortLabel: "Lun" },
  { key: "tuesday", label: "Mardi", shortLabel: "Mar" },
  { key: "wednesday", label: "Mercredi", shortLabel: "Mer" },
  { key: "thursday", label: "Jeudi", shortLabel: "Jeu" },
  { key: "friday", label: "Vendredi", shortLabel: "Ven" },
  { key: "saturday", label: "Samedi", shortLabel: "Sam" },
  { key: "sunday", label: "Dimanche", shortLabel: "Dim" },
] as const;

export function WorkingHoursConfig({
  config,
  onChange,
}: WorkingHoursConfigProps) {
  const [errors, setErrors] = useState<string[]>([]);

  // Validate configuration
  const validateConfig = useCallback(() => {
    const newErrors: string[] = [];

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(config.start)) {
      newErrors.push(
        "L&apos;heure de début doit être au format HH:mm (ex: 07:00)"
      );
    }
    if (!timeRegex.test(config.end)) {
      newErrors.push(
        "L&apos;heure de fin doit être au format HH:mm (ex: 18:00)"
      );
    }

    // Validate time logic
    if (config.start >= config.end) {
      newErrors.push(
        "L&apos;heure de fin doit être postérieure à l&apos;heure de début"
      );
    }

    // Validate working days
    if (config.working_days.length === 0) {
      newErrors.push("Au moins un jour ouvrable doit être sélectionné");
    }

    setErrors(newErrors);
  }, [config]);

  useEffect(() => {
    validateConfig();
  }, [validateConfig]);

  const updateConfig = (updates: Partial<WorkingHoursConfigType>) => {
    onChange({ ...config, ...updates });
  };

  const handleWorkingDayToggle = (day: string, checked: boolean) => {
    const currentDays = config.working_days;
    const newDays = checked
      ? [...currentDays, day as WorkingHoursConfigType["working_days"][number]]
      : currentDays.filter(d => d !== day);

    updateConfig({
      working_days: newDays as WorkingHoursConfigType["working_days"],
    });
  };

  const getScheduleSummary = () => {
    if (errors.length > 0) return null;

    const workingDaysCount = config.working_days.length;
    const totalHours = calculateDailyHours() * workingDaysCount;
    const timezone =
      TIMEZONES.find(tz => tz.value === config.timezone)?.label ||
      config.timezone;

    return {
      dailyHours: calculateDailyHours(),
      weeklyHours: totalHours,
      workingDaysCount,
      timezone,
    };
  };

  const calculateDailyHours = () => {
    const startParts = config.start.split(":").map(Number);
    const endParts = config.end.split(":").map(Number);

    const startHour = startParts[0] || 0;
    const startMinute = startParts[1] || 0;
    const endHour = endParts[0] || 0;
    const endMinute = endParts[1] || 0;

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return (endMinutes - startMinutes) / 60;
  };

  const summary = getScheduleSummary();

  return (
    <div className="space-y-6">
      {/* Timezone Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-lg">
            <MapPin className="h-4 w-4" />
            <span>Fuseau Horaire</span>
          </CardTitle>
          <CardDescription>
            Sélectionnez le fuseau horaire de référence pour les heures
            ouvrables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label htmlFor="timezone">Fuseau Horaire de Référence</Label>
            <Select
              value={config.timezone}
              onValueChange={value => updateConfig({ timezone: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un fuseau horaire" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Time Range Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Clock className="h-4 w-4" />
            <span>Heures de Travail</span>
          </CardTitle>
          <CardDescription>
            Définissez la plage horaire pendant laquelle les relances peuvent
            être envoyées
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-time">Heure de Début</Label>
              <Input
                id="start-time"
                type="time"
                value={config.start}
                onChange={e => updateConfig({ start: e.target.value })}
                className="text-center"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">Heure de Fin</Label>
              <Input
                id="end-time"
                type="time"
                value={config.end}
                onChange={e => updateConfig({ end: e.target.value })}
                className="text-center"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Working Days Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-lg">
            <Calendar className="h-4 w-4" />
            <span>Jours Ouvrables</span>
          </CardTitle>
          <CardDescription>
            Sélectionnez les jours de la semaine pendant lesquels les relances
            peuvent être envoyées
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
              {DAYS_OF_WEEK.map(day => (
                <div
                  key={day.key}
                  className={`flex items-center space-x-2 rounded-lg border p-3 transition-colors ${
                    config.working_days.includes(day.key)
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <Checkbox
                    id={day.key}
                    checked={config.working_days.includes(day.key)}
                    onCheckedChange={checked =>
                      handleWorkingDayToggle(day.key, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={day.key}
                    className="cursor-pointer text-sm font-medium"
                  >
                    <span className="hidden md:inline">{day.label}</span>
                    <span className="md:hidden">{day.shortLabel}</span>
                  </Label>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateConfig({
                    working_days: [
                      "monday",
                      "tuesday",
                      "wednesday",
                      "thursday",
                      "friday",
                    ],
                  })
                }
              >
                Lun-Ven
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateConfig({
                    working_days: [...DAYS_OF_WEEK.map(day => day.key)],
                  })
                }
              >
                Tous les jours
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateConfig({ working_days: [] })}
              >
                Aucun jour
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {errors.map((error, index) => (
                <div key={index}>• {error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Summary */}
      {summary && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-lg text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span>Résumé de la Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {summary.dailyHours.toFixed(1)}h
                </div>
                <div className="text-sm text-green-700">Par jour</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {summary.weeklyHours.toFixed(1)}h
                </div>
                <div className="text-sm text-green-700">Par semaine</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {summary.workingDaysCount}
                </div>
                <div className="text-sm text-green-700">Jours ouvrables</div>
              </div>
              <div className="text-center">
                <Badge
                  variant="outline"
                  className="border-green-300 text-green-600"
                >
                  {config.timezone}
                </Badge>
                <div className="mt-1 text-sm text-green-700">
                  Fuseau horaire
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="text-center">
              <div className="text-sm text-green-700">
                <strong>Plage horaire :</strong> {config.start} - {config.end} (
                {summary.timezone})
              </div>
              <div className="mt-1 text-sm text-green-700">
                <strong>Jours actifs :</strong>{" "}
                {config.working_days
                  .map(day => DAYS_OF_WEEK.find(d => d.key === day)?.label)
                  .join(", ")}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Les relances seront automatiquement programmées uniquement pendant les
          heures et jours ouvrables définis. Si une relance est programmée en
          dehors de ces créneaux, elle sera reportée au prochain créneau
          disponible.
        </AlertDescription>
      </Alert>
    </div>
  );
}
