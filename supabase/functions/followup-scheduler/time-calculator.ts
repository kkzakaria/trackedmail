import {
  EdgeSupabaseClient,
  WorkingHoursConfig,
  SchedulingResult
} from './shared-types.ts';

/**
 * Récupère la configuration des heures ouvrables depuis la base de données
 */
export async function getWorkingHoursConfig(
  supabase: EdgeSupabaseClient
): Promise<WorkingHoursConfig> {
  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'working_hours')
    .single();

  if (error || !data) {
    // Configuration par défaut
    return {
      timezone: 'UTC',
      start: '07:00',
      end: '18:00',
      working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      holidays: []
    };
  }

  return data.value as WorkingHoursConfig;
}

/**
 * Calcule le prochain créneau d'envoi en respectant les heures ouvrables
 */
export function calculateNextSendTime(
  baseDate: Date,
  delayHours: number,
  workingHours: WorkingHoursConfig
): SchedulingResult {
  const originalTarget = new Date(baseDate.getTime() + delayHours * 60 * 60 * 1000);

  // Ajuster pour les heures ouvrables
  const adjustedTime = adjustForWorkingHours(originalTarget, workingHours);

  const actualDelay = (adjustedTime.getTime() - baseDate.getTime()) / (1000 * 60 * 60);

  return {
    scheduled_for: adjustedTime.toISOString(),
    original_target: originalTarget.toISOString(),
    adjusted_for_working_hours: adjustedTime.getTime() !== originalTarget.getTime(),
    delay_applied_hours: actualDelay
  };
}

/**
 * Ajuste une date pour respecter les heures ouvrables
 */
export function adjustForWorkingHours(
  targetTime: Date,
  workingHours: WorkingHoursConfig
): Date {
  const adjustedTime = new Date(targetTime);

  // Vérifier si c'est déjà dans les heures ouvrables
  if (isWorkingTime(adjustedTime, workingHours)) {
    return adjustedTime;
  }

  // Trouver le prochain créneau de travail
  return findNextWorkingTime(adjustedTime, workingHours);
}

/**
 * Vérifie si une date/heure est dans les heures ouvrables
 */
export function isWorkingTime(dateTime: Date, workingHours: WorkingHoursConfig): boolean {
  return isWorkingDay(dateTime, workingHours) && isWithinWorkingHours(dateTime, workingHours);
}

/**
 * Vérifie si c'est un jour ouvrable (hors week-end et jours fériés)
 */
export function isWorkingDay(date: Date, workingHours: WorkingHoursConfig): boolean {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];

  return workingHours.working_days.includes(dayName) && !isHoliday(date, workingHours);
}

/**
 * Vérifie si l'heure est dans la plage de travail
 */
export function isWithinWorkingHours(dateTime: Date, workingHours: WorkingHoursConfig): boolean {
  const [startHour, startMinute] = workingHours.start.split(':').map(Number);
  const [endHour, endMinute] = workingHours.end.split(':').map(Number);

  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  const currentTime = dateTime.getHours() * 60 + dateTime.getMinutes();

  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Vérifie si c'est un jour férié
 */
export function isHoliday(date: Date, workingHours: WorkingHoursConfig): boolean {
  const dateString = date.toISOString().split('T')[0];
  return workingHours.holidays.includes(dateString);
}

/**
 * Trouve le prochain créneau de travail disponible
 */
export function findNextWorkingTime(fromTime: Date, workingHours: WorkingHoursConfig): Date {
  const maxIterations = 14; // 2 semaines max pour éviter les boucles infinies
  let iterations = 0;
  let current = new Date(fromTime);

  while (iterations < maxIterations) {
    if (isWorkingDay(current, workingHours)) {
      const adjustedTime = adjustTimeToWorkingHours(current, workingHours);

      if (adjustedTime >= fromTime) {
        return adjustedTime;
      }
    }

    // Passer au jour suivant
    current = new Date(current);
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);

    iterations++;
  }

  // Solution de secours : dans 24h si aucun créneau trouvé
  console.warn('No working time found within 2 weeks, falling back to +24h');
  return new Date(fromTime.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Ajuste l'heure pour être dans les heures de travail
 */
export function adjustTimeToWorkingHours(
  date: Date,
  workingHours: WorkingHoursConfig
): Date {
  const result = new Date(date);
  const [startHour, startMinute] = workingHours.start.split(':').map(Number);
  const [endHour, endMinute] = workingHours.end.split(':').map(Number);

  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  const currentTime = result.getHours() * 60 + result.getMinutes();

  if (currentTime < startTime) {
    // Trop tôt, programmer au début des heures ouvrables
    result.setHours(startHour, startMinute, 0, 0);
  } else if (currentTime >= endTime) {
    // Trop tard, programmer au début du jour ouvrable suivant
    result.setDate(result.getDate() + 1);
    result.setHours(startHour, startMinute, 0, 0);
  }

  return result;
}

/**
 * Calcule le nombre d'heures ouvrables entre deux dates
 */
export function calculateWorkingHoursBetween(
  startDate: Date,
  endDate: Date,
  workingHours: WorkingHoursConfig
): number {
  if (startDate >= endDate) return 0;

  const [startHour, startMinute] = workingHours.start.split(':').map(Number);
  const [endHour, endMinute] = workingHours.end.split(':').map(Number);
  const _dailyWorkingMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);

  let totalMinutes = 0;
  let current = new Date(startDate);

  while (current < endDate) {
    if (isWorkingDay(current, workingHours)) {
      const dayStart = new Date(current);
      dayStart.setHours(startHour, startMinute, 0, 0);

      const dayEnd = new Date(current);
      dayEnd.setHours(endHour, endMinute, 0, 0);

      const effectiveStart = current > dayStart ? current : dayStart;
      const effectiveEnd = endDate < dayEnd ? endDate : dayEnd;

      if (effectiveStart < effectiveEnd) {
        totalMinutes += (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60);
      }
    }

    // Passer au jour suivant
    current = new Date(current);
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return totalMinutes / 60; // Convertir en heures
}

/**
 * Valide une configuration d'heures ouvrables
 */
export function validateWorkingHoursConfig(config: WorkingHoursConfig): string[] {
  const errors: string[] = [];

  // Vérifier le format des heures
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(config.start)) {
    errors.push('Start time must be in HH:MM format');
  }
  if (!timeRegex.test(config.end)) {
    errors.push('End time must be in HH:MM format');
  }

  // Vérifier que l'heure de fin est après l'heure de début
  if (config.start >= config.end) {
    errors.push('End time must be after start time');
  }

  // Vérifier qu'il y a au moins un jour ouvrable
  if (!config.working_days || config.working_days.length === 0) {
    errors.push('At least one working day must be specified');
  }

  // Vérifier les jours valides
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of config.working_days) {
    if (!validDays.includes(day)) {
      errors.push(`Invalid working day: ${day}`);
    }
  }

  return errors;
}