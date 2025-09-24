import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  EdgeSupabaseClient,
  TrackedEmailRow,
  FollowupTemplateRow,
  FollowupInsert
} from '../_shared/types.ts';

interface SchedulingResult {
  scheduled_for: string;
  original_target: string;
  adjusted_for_working_hours: boolean;
  delay_applied_hours: number;
}

interface WorkingHoursConfig {
  timezone: string;
  start: string;
  end: string;
  working_days: string[];
  holidays: string[];
}

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

console.log('🚀 Followup Scheduler Function Started');

serve(async (req) => {
  try {
    // Vérifier que c'est une requête POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    console.log('📅 Starting followup scheduling process...');

    // Créer le client Supabase avec les droits de service
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 0. Vérifier si le système de relances est activé
    const isFollowupEnabled = await checkFollowupSystemEnabled(supabase);
    if (!isFollowupEnabled) {
      console.log('⚠️ Followup system is disabled. Skipping scheduling.');
      return new Response(JSON.stringify({
        success: true,
        message: 'Followup system is disabled',
        processed: 0,
        emails_processed: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 1. Récupérer les emails nécessitant des relances
    const emailsNeedingFollowup = await getEmailsNeedingFollowup(supabase);
    console.log(`📧 Found ${emailsNeedingFollowup.length} emails needing followups`);

    if (emailsNeedingFollowup.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No emails need followups at this time',
        processed: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 2. Récupérer les templates actifs
    const activeTemplates = await getActiveTemplates(supabase);
    console.log(`📝 Found ${activeTemplates.length} active templates`);

    if (activeTemplates.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No active templates found',
        processed: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // 3. Récupérer la configuration des heures ouvrables
    const workingHours = await getWorkingHoursConfig(supabase);

    // 4. Traiter chaque email
    let processedCount = 0;
    const errors: string[] = [];

    for (const email of emailsNeedingFollowup) {
      try {
        const followupsCreated = await processEmailForFollowups(
          supabase,
          email,
          activeTemplates,
          workingHours
        );
        processedCount += followupsCreated.length;

        if (followupsCreated.length > 0) {
          console.log(`✅ Created ${followupsCreated.length} followups for email ${email.id}`);
        }
      } catch (error) {
        const errorMsg = `Error processing email ${email.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`🎯 Scheduling completed. Processed: ${processedCount} followups`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Followup scheduling completed',
      processed: processedCount,
      emails_processed: emailsNeedingFollowup.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Followup Scheduler Error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

/**
 * Récupère les emails nécessitant des relances
 */
async function getEmailsNeedingFollowup(supabase: EdgeSupabaseClient): Promise<TrackedEmailWithFollowupInfo[]> {
  // DEBUG MODE: Query simple directement sur les emails pour zakariakoffi@karta-holding.ci
  const { data: emailsData, error: emailsError } = await supabase
    .from('tracked_emails')
    .select('*')
    .eq('status', 'pending')
    .contains('recipient_emails', ['zakariakoffi@karta-holding.ci'])
    .order('sent_at', { ascending: true });

  console.log(`🔧 DEBUG: Direct query found ${emailsData?.length || 0} emails for zakariakoffi@karta-holding.ci`);

  if (emailsError) {
    throw new Error(`Failed to fetch emails: ${emailsError.message}`);
  }

  if (!emailsData || emailsData.length === 0) {
    return [];
  }

  // Pour chaque email, récupérer le statut des relances (automatiques + manuelles)
  const enrichedEmails = [];
  for (const email of emailsData) {
    // Récupérer les relances automatiques
    const { data: followupData, error: followupError } = await supabase
      .from('followups')
      .select('followup_number, sent_at')
      .eq('tracked_email_id', email.id)
      .order('followup_number', { ascending: false })
      .limit(1);

    if (followupError) {
      console.error(`Error fetching followups for ${email.id}:`, followupError);
    }

    // Récupérer les relances manuelles
    const { data: manualFollowupData, error: manualError } = await supabase
      .from('manual_followups')
      .select('followup_sequence_number, detected_at')
      .eq('tracked_email_id', email.id)
      .order('detected_at', { ascending: false })
      .limit(1);

    if (manualError) {
      console.error(`Error fetching manual followups for ${email.id}:`, manualError);
    }

    const lastAutomaticFollowup = followupData?.[0];
    const lastManualFollowup = manualFollowupData?.[0];

    // Déterminer la dernière activité (automatique ou manuelle)
    const automaticAt = lastAutomaticFollowup?.sent_at ? new Date(lastAutomaticFollowup.sent_at) : null;
    const manualAt = lastManualFollowup?.detected_at ? new Date(lastManualFollowup.detected_at) : null;

    let lastActivity: Date;
    let lastActivityType: 'automatic' | 'manual' | 'original';

    if (automaticAt && manualAt) {
      if (automaticAt > manualAt) {
        lastActivity = automaticAt;
        lastActivityType = 'automatic';
      } else {
        lastActivity = manualAt;
        lastActivityType = 'manual';
      }
    } else if (automaticAt) {
      lastActivity = automaticAt;
      lastActivityType = 'automatic';
    } else if (manualAt) {
      lastActivity = manualAt;
      lastActivityType = 'manual';
    } else {
      lastActivity = new Date(email.sent_at);
      lastActivityType = 'original';
    }

    // Calculer le nombre total de relances (automatiques + manuelles)
    const totalFollowups = await getTotalFollowupsForEmail(supabase, email.id);

    enrichedEmails.push({
      ...email,
      last_followup_number: lastAutomaticFollowup?.followup_number || 0,
      last_followup_at: lastAutomaticFollowup?.sent_at || null,
      last_manual_followup_at: lastManualFollowup?.detected_at || null,
      last_activity_at: lastActivity.toISOString(),
      last_activity_type: lastActivityType,
      total_followups: totalFollowups
    });
  }

  console.log(`📊 DEBUG: Enriched ${enrichedEmails.length} emails with followup data`);
  return enrichedEmails;
}

/**
 * Récupère les templates actifs
 */
async function getActiveTemplates(supabase: EdgeSupabaseClient): Promise<FollowupTemplateRow[]> {
  const { data, error } = await supabase
    .from('followup_templates')
    .select('*')
    .eq('is_active', true)
    .order('followup_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch active templates: ${error.message}`);
  }

  return data || [];
}

/**
 * Récupère la configuration des heures ouvrables
 */
async function getWorkingHoursConfig(supabase: any): Promise<WorkingHoursConfig> {
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
 * Calcule le nombre total de relances (automatiques + manuelles) pour un email
 */
async function getTotalFollowupsForEmail(
  supabase: EdgeSupabaseClient,
  trackedEmailId: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .rpc('get_total_followup_count', { p_tracked_email_id: trackedEmailId });

    if (error) {
      console.error(`Error getting total followup count for ${trackedEmailId}:`, error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error(`Error calling get_total_followup_count:`, error);
    return 0;
  }
}

/**
 * Traite un email pour créer les relances nécessaires
 */
interface TrackedEmailWithFollowupInfo extends TrackedEmailRow {
  last_followup_number?: number;
  last_followup_at?: string;
  last_manual_followup_at?: string;
  last_activity_at?: string;
  last_activity_type?: 'automatic' | 'manual' | 'original';
  total_followups?: number;
}

async function processEmailForFollowups(
  supabase: EdgeSupabaseClient,
  email: TrackedEmailWithFollowupInfo,
  templates: FollowupTemplateRow[],
  workingHours: WorkingHoursConfig
): Promise<any[]> {
  const followupsCreated = [];

  // Utiliser le nombre total de relances (automatiques + manuelles) pour le calcul
  const totalFollowupsSent = email.total_followups || 0;
  const nextAutomaticFollowupNumber = (email.last_followup_number || 0) + 1;

  // Récupérer la configuration des relances
  const { data: followupConfig } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'followup_settings')
    .single();

  const maxFollowups = followupConfig?.value?.max_followups || 3;

  // Vérifier qu'on n'a pas atteint le maximum total (automatiques + manuelles)
  if (totalFollowupsSent >= maxFollowups) {
    console.log(`⏭️ Email ${email.id} has reached max total followups (${totalFollowupsSent}/${maxFollowups})`);
    console.log(`   Including manual followups: ${email.total_followups}`);
    return [];
  }

  // Vérifier aussi que le prochain numéro automatique ne dépasse pas le max
  if (nextAutomaticFollowupNumber > maxFollowups) {
    console.log(`⏭️ Email ${email.id} next automatic followup would exceed max (${nextAutomaticFollowupNumber}>${maxFollowups})`);
    return [];
  }

  // Trouver le template pour le prochain niveau de relance
  const template = templates.find(t => t.followup_number === nextAutomaticFollowupNumber);
  if (!template) {
    console.log(`📝 No active template found for followup ${nextAutomaticFollowupNumber}`);
    return [];
  }

  // Vérifier qu'il n'y a pas déjà une relance programmée pour ce niveau
  const { data: existingFollowup } = await supabase
    .from('followups')
    .select('id')
    .eq('tracked_email_id', email.id)
    .eq('followup_number', nextAutomaticFollowupNumber)
    .eq('status', 'scheduled')
    .limit(1);

  if (existingFollowup && existingFollowup.length > 0) {
    console.log(`🔄 Followup ${nextAutomaticFollowupNumber} already scheduled for email ${email.id}`);
    return [];
  }

  // Calculer la date de programmation basée sur la dernière activité (automatique ou manuelle)
  const baseDate = email.last_activity_at
    ? new Date(email.last_activity_at)
    : new Date(email.sent_at);

  console.log(`📅 Base date for scheduling: ${baseDate.toISOString()} (activity type: ${email.last_activity_type || 'original'})`);

  // DEBUG MODE: Si le template a un délai < 24h, traiter comme des minutes
  const isDebugMode = template.delay_hours < 24;
  const delayInHours = isDebugMode ? template.delay_hours / 60 : template.delay_hours;

  console.log(`🔧 DEBUG: Template ${template.followup_number}, delay_hours=${template.delay_hours}, isDebugMode=${isDebugMode}, delayInHours=${delayInHours}`);

  const schedulingResult = calculateNextSendTime(
    baseDate,
    delayInHours,
    workingHours
  );

  // Rendre le template avec les variables
  const renderedTemplate = renderTemplate(template, email);

  // Créer la relance
  const followupData = {
    tracked_email_id: email.id,
    template_id: template.id,
    followup_number: nextAutomaticFollowupNumber,
    subject: renderedTemplate.subject,
    body: renderedTemplate.body,
    scheduled_for: schedulingResult.scheduled_for,
    status: 'scheduled'
  };

  const { data: createdFollowup, error } = await supabase
    .from('followups')
    .insert(followupData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create followup: ${error.message}`);
  }

  followupsCreated.push(createdFollowup);

  console.log(`📅 Scheduled followup ${nextAutomaticFollowupNumber} for email ${email.id} at ${schedulingResult.scheduled_for}`);

  return followupsCreated;
}

/**
 * Calcule le prochain créneau d'envoi en respectant les heures ouvrables
 */
function calculateNextSendTime(
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
function adjustForWorkingHours(targetTime: Date, workingHours: WorkingHoursConfig): Date {
  let adjustedTime = new Date(targetTime);

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
function isWorkingTime(dateTime: Date, workingHours: WorkingHoursConfig): boolean {
  return isWorkingDay(dateTime, workingHours) && isWithinWorkingHours(dateTime, workingHours);
}

/**
 * Vérifie si c'est un jour ouvrable
 */
function isWorkingDay(date: Date, workingHours: WorkingHoursConfig): boolean {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];

  return workingHours.working_days.includes(dayName) && !isHoliday(date, workingHours);
}

/**
 * Vérifie si l'heure est dans la plage de travail
 */
function isWithinWorkingHours(dateTime: Date, workingHours: WorkingHoursConfig): boolean {
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
function isHoliday(date: Date, workingHours: WorkingHoursConfig): boolean {
  const dateString = date.toISOString().split('T')[0];
  return workingHours.holidays.includes(dateString);
}

/**
 * Trouve le prochain créneau de travail
 */
function findNextWorkingTime(fromTime: Date, workingHours: WorkingHoursConfig): Date {
  const maxIterations = 14; // 2 semaines max
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

  // Solution de secours : dans 24h
  return new Date(fromTime.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Ajuste l'heure pour être dans les heures de travail
 */
function adjustTimeToWorkingHours(date: Date, workingHours: WorkingHoursConfig): Date {
  const result = new Date(date);
  const [startHour, startMinute] = workingHours.start.split(':').map(Number);
  const [endHour, endMinute] = workingHours.end.split(':').map(Number);

  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  const currentTime = result.getHours() * 60 + result.getMinutes();

  if (currentTime < startTime) {
    result.setHours(startHour, startMinute, 0, 0);
  } else if (currentTime >= endTime) {
    result.setDate(result.getDate() + 1);
    result.setHours(startHour, startMinute, 0, 0);
  }

  return result;
}

/**
 * Rend un template avec les variables dynamiques
 */
function renderTemplate(template: FollowupTemplateRow, email: TrackedEmailWithFollowupInfo): { subject: string; body: string } {
  // Variables disponibles
  const variables = {
    destinataire_nom: extractNameFromEmail(email.recipient_emails[0] || ''),
    destinataire_entreprise: extractCompanyFromEmail(email.recipient_emails[0] || ''),
    objet_original: email.subject,
    date_envoi_original: new Date(email.sent_at).toLocaleDateString('fr-FR'),
    numero_relance: template.followup_number,
    jours_depuis_envoi: Math.floor((Date.now() - new Date(email.sent_at).getTime()) / (1000 * 60 * 60 * 24)),
    expediteur_nom: extractNameFromEmail(email.sender_email),
    expediteur_email: email.sender_email
  };

  // Rendre le sujet et le corps
  let renderedSubject = template.subject;
  let renderedBody = template.body;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    renderedSubject = renderedSubject.replace(regex, String(value));
    renderedBody = renderedBody.replace(regex, String(value));
  });

  return {
    subject: renderedSubject,
    body: renderedBody
  };
}

/**
 * Extrait le nom depuis une adresse email
 */
function extractNameFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  return localPart
    .split(/[._-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Extrait le nom de l'entreprise depuis une adresse email
 */
function extractCompanyFromEmail(email: string): string {
  const domain = email.split('@')[1];
  if (!domain) return 'Entreprise';

  const company = domain.split('.')[0];
  return company.charAt(0).toUpperCase() + company.slice(1);
}

/**
 * Vérifie si le système de relances est activé
 */
async function checkFollowupSystemEnabled(supabase: EdgeSupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'followup_settings')
      .single();

    if (error) {
      console.error('Failed to check followup system status:', error);
      return false;
    }

    const settings = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    return settings.enabled !== false; // Par défaut activé si pas spécifié
  } catch (error) {
    console.error('Error parsing followup settings:', error);
    return false;
  }
}