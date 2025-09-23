"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FollowupCalendar } from "@/components/followups/FollowupCalendar";
import { FollowupMetrics } from "@/components/followups/FollowupMetrics";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  BarChart3,
  List,
} from "lucide-react";
import Link from "next/link";

export default function FollowupCalendarPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/dashboard/followups">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Calendrier des Relances
                </h1>
                <p className="text-sm text-gray-500">
                  Vue calendrier des relances programmées et envoyées
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/dashboard/followups">
                <Button variant="outline" size="sm">
                  <List className="mr-2 h-4 w-4" />
                  Vue Liste
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <Tabs defaultValue="calendar" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Vue Calendrier
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Métriques Temps Réel
              </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-6">
              {/* Calendar Component */}
              <FollowupCalendar onDateSelect={handleDateSelect} />

              {/* Selected Date Info */}
              {selectedDate && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Détails du {selectedDate.toLocaleDateString("fr-FR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </CardTitle>
                    <CardDescription>
                      Relances programmées et actions pour cette date
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-gray-500">
                      Sélectionnez une date dans le calendrier pour voir les détails
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="metrics" className="space-y-6">
              {/* Real-time Metrics */}
              <FollowupMetrics
                autoRefresh={true}
                refreshInterval={30}
                showAlerts={true}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}