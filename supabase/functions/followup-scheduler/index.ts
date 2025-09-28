import { createClient } from '@supabase/supabase-js';
import {
  EdgeSupabaseClient,
  FollowupTemplateRow,
  TrackedEmailWithFollowupInfo,
  WorkingHoursConfig,
  SchedulingStats
} from './shared-types.ts';
import { getEmailsNeedingFollowup } from './email-analyzer.ts';
import { getActiveTemplates, renderTemplate } from './template-manager.ts';
import { getWorkingHoursConfig, calculateNextSendTime } from './time-calculator.ts';

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

console.log('🚀 Followup Scheduler Function Started');

Deno.serve(async (req) => {
  try {
    // Vérifier que c'est une requête POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    console.log('📅 Starting followup scheduling process...');

    // Créer le client Supabase avec les droits de service
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Vérifier si le système de relances est activé
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

    // Orchestrer le processus de planification
    const result = await orchestrateFollowupScheduling(supabase);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400
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
 * Orchestre le processus complet de planification des relances
 */
async function orchestrateFollowupScheduling(supabase: EdgeSupabaseClient): Promise<SchedulingStats> {
  // 1. Récupérer les emails nécessitant des relances
  const emailsNeedingFollowup = await getEmailsNeedingFollowup(supabase);
  console.log(`📧 Found ${emailsNeedingFollowup.length} emails needing followups`);

  if (emailsNeedingFollowup.length === 0) {
    return {
      success: true,
      message: 'No emails need followups at this time',
      processed: 0,
      emails_processed: 0
    };
  }

  // 2. Récupérer les templates actifs
  const activeTemplates = await getActiveTemplates(supabase);
  console.log(`📝 Found ${activeTemplates.length} active templates`);

  if (activeTemplates.length === 0) {
    return {
      success: false,
      message: 'No active templates found',
      processed: 0,
      emails_processed: 0
    };
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

  return {
    success: true,
    message: 'Followup scheduling completed',
    processed: processedCount,
    emails_processed: emailsNeedingFollowup.length,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Traite un email pour créer les relances nécessaires
 */
async function processEmailForFollowups(
  supabase: EdgeSupabaseClient,
  email: TrackedEmailWithFollowupInfo,
  templates: FollowupTemplateRow[],
  workingHours: WorkingHoursConfig
): Promise<object[]> {
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

  // Vérifier qu'on n'a pas atteint le maximum total
  if (totalFollowupsSent >= maxFollowups) {
    console.log(`⏭️ Email ${email.id} has reached max total followups (${totalFollowupsSent}/${maxFollowups})`);
    return [];
  }

  // Vérifier que le prochain numéro automatique ne dépasse pas le max
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

  // Calculer la date de programmation basée sur la dernière activité
  const baseDate = email.last_activity_at
    ? new Date(email.last_activity_at)
    : new Date(email.sent_at);

  console.log(`📅 Base date for scheduling: ${baseDate.toISOString()} (activity type: ${email.last_activity_type || 'original'})`);

  // Utiliser le délai en heures configuré dans le template
  const delayInHours = template.delay_hours;
  console.log(`⏱️ Template ${template.followup_number}, delay_hours=${template.delay_hours}`);

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