"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Plus,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X
} from "lucide-react";
import { format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isValid,
  parseISO
} from "date-fns";
import { fr } from "date-fns/locale";

interface HolidaysManagerProps {
  holidays: string[];
  timezone: string;
  onChange: (holidays: string[]) => void;
}

// Jours fériés prédéfinis pour la France
const FRENCH_HOLIDAYS_2024 = [
  { date: "2024-01-01", name: "Jour de l'An" },
  { date: "2024-04-01", name: "Lundi de Pâques" },
  { date: "2024-05-01", name: "Fête du Travail" },
  { date: "2024-05-08", name: "Victoire 1945" },
  { date: "2024-05-09", name: "Ascension" },
  { date: "2024-05-20", name: "Lundi de Pentecôte" },
  { date: "2024-07-14", name: "Fête Nationale" },
  { date: "2024-08-15", name: "Assomption" },
  { date: "2024-11-01", name: "Toussaint" },
  { date: "2024-11-11", name: "Armistice 1918" },
  { date: "2024-12-25", name: "Noël" },
];

const FRENCH_HOLIDAYS_2025 = [
  { date: "2025-01-01", name: "Jour de l'An" },
  { date: "2025-04-21", name: "Lundi de Pâques" },
  { date: "2025-05-01", name: "Fête du Travail" },
  { date: "2025-05-08", name: "Victoire 1945" },
  { date: "2025-05-29", name: "Ascension" },
  { date: "2025-06-09", name: "Lundi de Pentecôte" },
  { date: "2025-07-14", name: "Fête Nationale" },
  { date: "2025-08-15", name: "Assomption" },
  { date: "2025-11-01", name: "Toussaint" },
  { date: "2025-11-11", name: "Armistice 1918" },
  { date: "2025-12-25", name: "Noël" },
];

const PREDEFINED_HOLIDAYS = {
  "france-2024": FRENCH_HOLIDAYS_2024,
  "france-2025": FRENCH_HOLIDAYS_2025,
};

export function HolidaysManager({ holidays, timezone, onChange }: HolidaysManagerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [manualDate, setManualDate] = useState("");

  // Validate and parse holidays
  const validHolidays = useMemo(() => {
    return holidays.filter(holiday => {
      try {
        const date = parseISO(holiday);
        return isValid(date);
      } catch {
        return false;
      }
    }).sort();
  }, [holidays]);

  // Calendar generation
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const isHoliday = (date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");
    return validHolidays.includes(dateString);
  };

  const addHoliday = (dateString: string) => {
    if (!dateString) return;

    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return;

      const formattedDate = format(date, "yyyy-MM-dd");
      if (!validHolidays.includes(formattedDate)) {
        onChange([...holidays, formattedDate]);
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout du jour férié:", error);
    }
  };

  const removeHoliday = (dateString: string) => {
    onChange(holidays.filter(h => h !== dateString));
  };

  const handleDayClick = (date: Date) => {
    const dateString = format(date, "yyyy-MM-dd");

    if (isHoliday(date)) {
      removeHoliday(dateString);
    } else {
      addHoliday(dateString);
    }
  };

  const handleManualAdd = () => {
    if (manualDate) {
      addHoliday(manualDate);
      setManualDate("");
    }
  };

  const importPredefinedHolidays = (key: string) => {
    const predefined = PREDEFINED_HOLIDAYS[key as keyof typeof PREDEFINED_HOLIDAYS];
    if (predefined) {
      const newHolidays = predefined.map(h => h.date);
      const combinedHolidays = [...new Set([...holidays, ...newHolidays])];
      onChange(combinedHolidays);
    }
  };

  const clearAllHolidays = () => {
    onChange([]);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar">Calendrier</TabsTrigger>
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="import">Import/Export</TabsTrigger>
        </TabsList>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>Calendrier des Jours Fériés</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-lg font-medium min-w-[150px] text-center">
                    {format(currentMonth, "MMMM yyyy", { locale: fr })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Cliquez sur une date pour l'ajouter ou la retirer des jours fériés
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, index) => {
                  const isCurrentMonth = isSameMonth(date, currentMonth);
                  const isToday = isSameDay(date, new Date());
                  const isHolidayDate = isHoliday(date);

                  return (
                    <button
                      key={index}
                      onClick={() => handleDayClick(date)}
                      disabled={!isCurrentMonth}
                      className={`
                        p-2 text-sm border rounded transition-colors
                        ${!isCurrentMonth ? "text-gray-300 cursor-not-allowed" : "cursor-pointer"}
                        ${isToday ? "border-blue-500 font-bold" : "border-gray-200"}
                        ${isHolidayDate
                          ? "bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                          : "hover:bg-gray-100"
                        }
                      `}
                    >
                      {format(date, "d")}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ajout Manuel</CardTitle>
              <CardDescription>
                Ajoutez une date spécifique comme jour férié
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Label htmlFor="manual-date">Date (YYYY-MM-DD)</Label>
                  <Input
                    id="manual-date"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    placeholder="2024-12-25"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleManualAdd} disabled={!manualDate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Jours Fériés Configurés ({validHolidays.length})</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllHolidays}
                  disabled={validHolidays.length === 0}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Tout supprimer
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {validHolidays.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    Aucun jour férié configuré
                  </div>
                ) : (
                  <div className="space-y-2">
                    {validHolidays.map((holiday, index) => {
                      try {
                        const date = parseISO(holiday);
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <div className="font-medium">
                                {format(date, "EEEE d MMMM yyyy", { locale: fr })}
                              </div>
                              <div className="text-sm text-gray-500">{holiday}</div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeHoliday(holiday)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      } catch {
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border rounded-lg border-red-200 bg-red-50"
                          >
                            <div>
                              <div className="font-medium text-red-600">Date invalide</div>
                              <div className="text-sm text-red-500">{holiday}</div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeHoliday(holiday)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import/Export Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Import de Jours Fériés Prédéfinis</span>
              </CardTitle>
              <CardDescription>
                Importez rapidement les jours fériés officiels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => importPredefinedHolidays("france-2024")}
                    className="h-auto p-4 text-left"
                  >
                    <div>
                      <div className="font-medium">Jours Fériés France 2024</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {FRENCH_HOLIDAYS_2024.length} jours fériés officiels
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => importPredefinedHolidays("france-2025")}
                    className="h-auto p-4 text-left"
                  >
                    <div>
                      <div className="font-medium">Jours Fériés France 2025</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {FRENCH_HOLIDAYS_2025.length} jours fériés officiels
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {validHolidays.length}
                  </div>
                  <div className="text-sm text-gray-600">Jours configurés</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {timezone}
                  </div>
                  <div className="text-sm text-gray-600">Fuseau horaire</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {holidays.length - validHolidays.length}
                  </div>
                  <div className="text-sm text-gray-600">Dates invalides</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Warning for invalid dates */}
      {holidays.length !== validHolidays.length && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {holidays.length - validHolidays.length} date(s) invalide(s) détectée(s).
            Utilisez l'onglet "Liste" pour les supprimer.
          </AlertDescription>
        </Alert>
      )}

      {/* Information Alert */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Les relances programmées pendant les jours fériés seront automatiquement reportées
          au prochain jour ouvrable disponible.
        </AlertDescription>
      </Alert>
    </div>
  );
}