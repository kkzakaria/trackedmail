import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database.types";
import {
  WorkingHoursConfig,
  FollowupSettings,
  SchedulingOptions,
  SchedulingResult,
  FollowupCalculationItem,
} from "@/lib/types/followup.types";

export class SchedulingService {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseClient?: ReturnType<typeof createClient>) {
    this.supabase = supabaseClient || createClient();
  }

  /**
   * Récupère la configuration des heures ouvrables
   */
  async getWorkingHoursConfig(): Promise<WorkingHoursConfig> {
    const { data, error } = await this.supabase
      .from("system_config")
      .select("value")
      .eq("key", "working_hours")
      .single();

    if (error || !data) {
      // Retourner la configuration par défaut
      return this.getDefaultWorkingHours();
    }

    return data.value as unknown as WorkingHoursConfig;
  }

  /**
   * Met à jour la configuration des heures ouvrables
   */
  async updateWorkingHoursConfig(
    config: WorkingHoursConfig,
    userId?: string
  ): Promise<void> {
    // Valider la configuration
    this.validateWorkingHoursConfig(config);

    const { error } = await this.supabase
      .from("system_config")
      .update({
        value:
          config as unknown as Database["public"]["Tables"]["system_config"]["Row"]["value"],
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("key", "working_hours");

    if (error) {
      throw new Error(
        `Erreur lors de la mise à jour des heures ouvrables: ${error.message}`
      );
    }
  }

  /**
   * Récupère la configuration des relances
   */
  async getFollowupSettings(): Promise<FollowupSettings> {
    const { data, error } = await this.supabase
      .from("system_config")
      .select("value")
      .eq("key", "followup_settings")
      .single();

    if (error || !data) {
      // Retourner la configuration par défaut
      return this.getDefaultFollowupSettings();
    }

    return data.value as unknown as FollowupSettings;
  }

  /**
   * Met à jour la configuration des relances
   */
  async updateFollowupSettings(
    settings: FollowupSettings,
    userId?: string
  ): Promise<void> {
    // Valider la configuration
    this.validateFollowupSettings(settings);

    const { error } = await this.supabase
      .from("system_config")
      .update({
        value:
          settings as unknown as Database["public"]["Tables"]["system_config"]["Row"]["value"],
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("key", "followup_settings");

    if (error) {
      throw new Error(
        `Erreur lors de la mise à jour des paramètres de relance: ${error.message}`
      );
    }
  }

  /**
   * Calcule le prochain créneau d'envoi valide
   */
  async calculateNextSendTime(
    baseDate: Date,
    delayHours: number,
    options?: SchedulingOptions
  ): Promise<SchedulingResult> {
    const originalTarget = new Date(
      baseDate.getTime() + delayHours * 60 * 60 * 1000
    );

    // Si on ne respecte pas les heures ouvrables, retourner directement
    if (!options?.respect_working_hours) {
      return {
        scheduled_for: originalTarget.toISOString(),
        original_target: originalTarget.toISOString(),
        adjusted_for_working_hours: false,
        delay_applied_hours: delayHours,
      };
    }

    // Récupérer la configuration des heures ouvrables
    const workingHours =
      options?.custom_working_hours &&
      this.isCompleteWorkingHours(options.custom_working_hours)
        ? options.custom_working_hours
        : await this.getWorkingHoursConfig();

    // Ajuster pour les heures ouvrables
    const adjustedTime = this.adjustForWorkingHours(
      originalTarget,
      workingHours,
      options
    );

    const actualDelay =
      (adjustedTime.getTime() - baseDate.getTime()) / (1000 * 60 * 60);

    const result: SchedulingResult = {
      scheduled_for: adjustedTime.toISOString(),
      original_target: originalTarget.toISOString(),
      adjusted_for_working_hours:
        adjustedTime.getTime() !== originalTarget.getTime(),
      delay_applied_hours: actualDelay,
    };

    if (adjustedTime.getTime() !== originalTarget.getTime()) {
      result.next_working_time = adjustedTime.toISOString();
    }

    return result;
  }

  /**
   * Vérifie si une date/heure est dans les heures ouvrables
   */
  async isWorkingTime(
    dateTime: Date,
    config?: WorkingHoursConfig
  ): Promise<boolean> {
    const workingHours = config || (await this.getWorkingHoursConfig());
    return this.isWorkingTimeInternal(dateTime, workingHours);
  }

  /**
   * Récupère le prochain créneau de travail disponible
   */
  async getNextWorkingTime(
    fromDateTime: Date,
    config?: WorkingHoursConfig,
    excludeDates?: string[]
  ): Promise<Date> {
    const workingHours = config || (await this.getWorkingHoursConfig());
    return this.findNextWorkingTime(fromDateTime, workingHours, excludeDates);
  }

  /**
   * Vérifie si une date est un jour ouvrable
   */
  async isWorkingDay(
    date: Date,
    config?: WorkingHoursConfig
  ): Promise<boolean> {
    const workingHours = config || (await this.getWorkingHoursConfig());
    return this.isWorkingDayInternal(date, workingHours);
  }

  /**
   * Calcule les jours ouvrables entre deux dates
   */
  async getBusinessDaysBetween(
    startDate: Date,
    endDate: Date,
    config?: WorkingHoursConfig
  ): Promise<number> {
    const workingHours = config || (await this.getWorkingHoursConfig());
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      if (this.isWorkingDayInternal(current, workingHours)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Valide les options de planification
   */
  validateSchedulingOptions(options: SchedulingOptions): void {
    if (options.min_delay_hours && options.min_delay_hours < 0) {
      throw new Error("Le délai minimum doit être positif");
    }

    if (options.max_delay_hours && options.max_delay_hours < 0) {
      throw new Error("Le délai maximum doit être positif");
    }

    if (
      options.min_delay_hours &&
      options.max_delay_hours &&
      options.min_delay_hours > options.max_delay_hours
    ) {
      throw new Error(
        "Le délai minimum ne peut pas être supérieur au délai maximum"
      );
    }

    if (options.custom_working_hours) {
      this.validateWorkingHoursConfig(options.custom_working_hours);
    }
  }

  /**
   * Calcule le délai optimal basé sur les statistiques historiques
   */
  async calculateOptimalDelay(
    followupNumber: number,
    mailboxId?: string
  ): Promise<number> {
    // Récupérer les statistiques des relances précédentes
    let query = this.supabase
      .from("followups")
      .select(
        `
        followup_number,
        sent_at,
        tracked_email:tracked_emails!inner(
          sent_at,
          responded_at,
          mailbox_id
        )
      `
      )
      .eq("followup_number", followupNumber)
      .eq("status", "sent")
      .not("tracked_email.responded_at", "is", null);

    if (mailboxId) {
      query = query.eq("tracked_email.mailbox_id", mailboxId);
    }

    const { data, error } = await query.limit(100); // Analyser les 100 dernières relances

    if (error || !data || data.length === 0) {
      // Retourner le délai par défaut
      const settings = await this.getFollowupSettings();
      return settings.default_interval_hours;
    }

    // Calculer le délai moyen qui génère des réponses
    const responseTimes = data
      .map((f: FollowupCalculationItem) => {
        if (!f.sent_at) return 0;
        const originalSent = new Date(f.tracked_email.sent_at);
        const followupSent = new Date(f.sent_at);
        return (
          (followupSent.getTime() - originalSent.getTime()) / (1000 * 60 * 60)
        ); // en heures
      })
      .filter((delay: number) => delay > 0);

    if (responseTimes.length === 0) {
      const settings = await this.getFollowupSettings();
      return settings.default_interval_hours;
    }

    // Calculer la médiane pour éviter les valeurs aberrantes
    responseTimes.sort((a: number, b: number) => a - b);
    const median =
      responseTimes.length % 2 === 0
        ? ((responseTimes[responseTimes.length / 2 - 1] || 0) +
            (responseTimes[responseTimes.length / 2] || 0)) /
          2
        : responseTimes[Math.floor(responseTimes.length / 2)] || 0;

    // Arrondir à l'heure supérieure et s'assurer que c'est dans les limites raisonnables
    return Math.max(24, Math.min(168, Math.ceil(median || 96))); // Entre 1 jour et 1 semaine, défaut 96h
  }

  // Méthodes privées

  private adjustForWorkingHours(
    targetTime: Date,
    workingHours: WorkingHoursConfig,
    options?: SchedulingOptions
  ): Date {
    const adjustedTime = new Date(targetTime);

    // Vérifier si c'est déjà dans les heures ouvrables
    if (
      this.isWorkingTimeInternal(adjustedTime, workingHours) &&
      !this.isExcludedDate(adjustedTime, options?.exclude_dates)
    ) {
      return adjustedTime;
    }

    // Trouver le prochain créneau de travail
    return this.findNextWorkingTime(
      adjustedTime,
      workingHours,
      options?.exclude_dates
    );
  }

  private findNextWorkingTime(
    fromTime: Date,
    workingHours: WorkingHoursConfig,
    excludeDates?: string[]
  ): Date {
    const maxIterations = 14; // Éviter les boucles infinies (2 semaines max)
    let iterations = 0;
    let current = new Date(fromTime);

    while (iterations < maxIterations) {
      // Si c'est un jour ouvrable et pas exclu
      if (
        this.isWorkingDayInternal(current, workingHours) &&
        !this.isExcludedDate(current, excludeDates)
      ) {
        // Ajuster l'heure si nécessaire
        const adjustedTime = this.adjustTimeToWorkingHours(
          current,
          workingHours
        );

        // Si l'heure ajustée est après l'heure de fromTime, c'est bon
        if (adjustedTime >= fromTime) {
          return adjustedTime;
        }
      }

      // Passer au jour suivant
      current = new Date(current);
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0); // Commencer au début du jour

      iterations++;
    }

    // Si on n'a pas trouvé de créneau, retourner dans 24h (solution de secours)
    return new Date(fromTime.getTime() + 24 * 60 * 60 * 1000);
  }

  private adjustTimeToWorkingHours(
    date: Date,
    workingHours: WorkingHoursConfig
  ): Date {
    const result = new Date(date);
    const timeParts = workingHours.start.split(":");
    const startHour = parseInt(timeParts[0] || "0", 10);
    const startMinute = parseInt(timeParts[1] || "0", 10);

    const endTimeParts = workingHours.end.split(":");
    const endHour = parseInt(endTimeParts[0] || "0", 10);
    const endMinute = parseInt(endTimeParts[1] || "0", 10);

    const startTime = startHour * 60 + startMinute; // en minutes
    const endTime = endHour * 60 + endMinute; // en minutes
    const currentTime = result.getHours() * 60 + result.getMinutes(); // en minutes

    if (currentTime < startTime) {
      // Trop tôt, ajuster au début des heures de travail
      result.setHours(startHour, startMinute, 0, 0);
    } else if (currentTime >= endTime) {
      // Trop tard, passer au jour suivant
      result.setDate(result.getDate() + 1);
      result.setHours(startHour, startMinute, 0, 0);
    }

    return result;
  }

  private isWorkingTimeInternal(
    dateTime: Date,
    workingHours: WorkingHoursConfig
  ): boolean {
    return (
      this.isWorkingDayInternal(dateTime, workingHours) &&
      this.isWithinWorkingHours(dateTime, workingHours)
    );
  }

  private isWorkingDayInternal(
    date: Date,
    workingHours: WorkingHoursConfig
  ): boolean {
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[date.getDay()];

    return (
      workingHours.working_days.includes(
        dayName as
          | "monday"
          | "tuesday"
          | "wednesday"
          | "thursday"
          | "friday"
          | "saturday"
          | "sunday"
      ) && !this.isHoliday(date, workingHours)
    );
  }

  private isWithinWorkingHours(
    dateTime: Date,
    workingHours: WorkingHoursConfig
  ): boolean {
    const startTimeParts = workingHours.start.split(":");
    const startHour = parseInt(startTimeParts[0] || "0", 10);
    const startMinute = parseInt(startTimeParts[1] || "0", 10);

    const endTimeParts = workingHours.end.split(":");
    const endHour = parseInt(endTimeParts[0] || "0", 10);
    const endMinute = parseInt(endTimeParts[1] || "0", 10);

    const startTime = startHour * 60 + startMinute; // en minutes
    const endTime = endHour * 60 + endMinute; // en minutes
    const currentTime = dateTime.getHours() * 60 + dateTime.getMinutes(); // en minutes

    return currentTime >= startTime && currentTime < endTime;
  }

  private isHoliday(date: Date, workingHours: WorkingHoursConfig): boolean {
    const dateString = date.toISOString().split("T")[0] || ""; // Format YYYY-MM-DD
    return workingHours.holidays?.includes(dateString) || false;
  }

  private isExcludedDate(date: Date, excludeDates?: string[]): boolean {
    if (!excludeDates || excludeDates.length === 0) {
      return false;
    }

    const dateString = date.toISOString().split("T")[0] || ""; // Format YYYY-MM-DD
    return excludeDates?.includes(dateString) || false;
  }

  private validateWorkingHoursConfig(
    config: Partial<WorkingHoursConfig>
  ): void {
    if (config.start && config.end) {
      const startTime = this.parseTime(config.start);
      const endTime = this.parseTime(config.end);

      if (startTime >= endTime) {
        throw new Error("L'heure de fin doit être après l'heure de début");
      }
    }

    if (config.working_days && config.working_days.length === 0) {
      throw new Error("Au moins un jour ouvrable doit être défini");
    }

    if (config.holidays) {
      config.holidays.forEach(holiday => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday)) {
          throw new Error(
            `Format de date invalide pour le jour férié: ${holiday}`
          );
        }
      });
    }
  }

  private validateFollowupSettings(settings: Partial<FollowupSettings>): void {
    if (
      settings.max_followups !== undefined &&
      (settings.max_followups < 0 || settings.max_followups > 10)
    ) {
      throw new Error("Le nombre maximum de relances doit être entre 0 et 10");
    }

    if (
      settings.default_interval_hours !== undefined &&
      settings.default_interval_hours < 1
    ) {
      throw new Error("L'intervalle par défaut doit être d'au moins 1 heure");
    }

    if (
      settings.stop_after_days !== undefined &&
      settings.stop_after_days < 1
    ) {
      throw new Error("La durée d'arrêt doit être d'au moins 1 jour");
    }
  }

  private parseTime(timeString: string): number {
    const timeParts = timeString.split(":");
    const hours = parseInt(timeParts[0] || "0", 10);
    const minutes = parseInt(timeParts[1] || "0", 10);
    return hours * 60 + minutes; // Retourner en minutes
  }

  private getDefaultWorkingHours(): WorkingHoursConfig {
    return {
      timezone: "UTC",
      start: "07:00",
      end: "18:00",
      working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      holidays: [],
    };
  }

  private getDefaultFollowupSettings(): FollowupSettings {
    return {
      max_followups: 3,
      default_interval_hours: 96, // 4 jours
      stop_after_days: 30,
      rate_limit_per_hour: 100,
      system_enabled: true,
      stop_on_bounce: true,
      stop_on_unsubscribe: true,
    };
  }

  private isCompleteWorkingHours(
    config: Partial<WorkingHoursConfig>
  ): config is WorkingHoursConfig {
    return !!(
      config.timezone &&
      config.start &&
      config.end &&
      config.working_days
    );
  }
}

// Instance par défaut pour l'utilisation côté client
export const schedulingService = new SchedulingService();

// Factory pour utilisation côté serveur
export const createServerSchedulingService = (
  supabaseClient?: ReturnType<typeof createClient>
) => new SchedulingService(supabaseClient);
