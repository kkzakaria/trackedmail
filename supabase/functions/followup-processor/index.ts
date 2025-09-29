import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  EdgeSupabaseClient
} from '../_shared/types.ts';

// Types pour le nouveau système de créneaux fixes
interface TimeSlotProcessor {
  time_slot: '07:00' | '12:00' | '16:00';
  source?: string;
  timestamp?: string;
}

interface EmailEligibleForSlot {
  id: string;
  sender_email: string;
  recipient_emails: string[];
  subject: string;
  body_preview?: string;
  sent_at: string;
  status: string;
  last_followup_number: number;
  next_followup_number: number;
  last_followup_at?: string;
  last_activity_at: string;
  last_activity_type: 'automatic' | 'manual' | 'original';
  total_followups: number;
  followups_sent_today: number;
  mailbox: {
    id: string;
    email_address: string;
    microsoft_user_id: string;
  };
}

interface FollowupTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  followup_number: number;
  delay_hours: number;
  is_active: boolean;
}

interface ProcessingStats {
  success: boolean;
  message: string;
  time_slot: string;
  emails_analyzed: number;
  emails_eligible: number;
  followups_sent: number;
  followups_failed: number;
  errors?: string[];
}

// Interface pour la configuration des followups
interface FollowupConfig {
  max_followups: number;
  max_per_day: number;
  followup_1: number;
  followup_2: number;
  followup_3: number;
  followup_4: number;
  total_timeframe_hours: number;
  min_delay_hours?: {
    [key: string]: number;
  };
  working_hours: {
    start: string;
    end: string;
    timezone: string;
  };
}

// Interface pour les informations de followup d'un email
interface FollowupInfo {
  last_followup_number: number;
  next_followup_number: number;
  last_followup_at?: string;
  last_activity_at: string;
  last_activity_type: 'automatic' | 'manual' | 'original';
  total_followups: number;
  followups_sent_today: number;
}

// Interface pour les emails avec informations de mailbox
interface TrackedEmailWithMailbox {
  id: string;
  sender_email: string;
  recipient_emails: string[];
  subject: string;
  body_preview?: string;
  sent_at: string;
  status: string;
  mailbox: {
    id: string;
    email_address: string;
    microsoft_user_id: string;
    is_active: boolean;
  };
}

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID')!;
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;
const MICROSOFT_TENANT_ID = Deno.env.get('MICROSOFT_TENANT_ID')!;

console.log('🕐 Followup Processor Function Started');

// 🚨 SAFETY CHECK: Protection contre l'envoi d'emails en développement
const isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production';
const allowRealEmails = Deno.env.get('ALLOW_REAL_EMAILS') === 'true';

if (isDevelopment && !allowRealEmails) {
  console.log('🛡️ DEVELOPMENT SAFETY MODE: Real email sending is DISABLED');
  console.log('💡 Set ALLOW_REAL_EMAILS=true to override (BE CAREFUL!)');
}

Deno.serve(async (req) => {
  try {
    // Vérifier que c'est une requête POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const requestBody = await req.json() as TimeSlotProcessor;
    const { time_slot, source = 'unknown' } = requestBody;

    console.log(`🕐 Processing followups for time slot: ${time_slot} (source: ${source})`);

    // Créer le client Supabase avec les droits de service
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Vérifier si le système de relances est activé
    const isFollowupEnabled = await checkFollowupSystemEnabled(supabase);
    if (!isFollowupEnabled) {
      console.log('⚠️ Followup system is disabled. Skipping processing.');
      return new Response(JSON.stringify({
        success: true,
        message: 'Followup system is disabled',
        time_slot,
        emails_analyzed: 0,
        followups_sent: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Traiter le créneau horaire
    const result = await processTimeSlot(supabase, time_slot);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400
    });

  } catch (error) {
    console.error('❌ Followup Processor Error:', error);

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
 * Traite un créneau horaire spécifique (7h, 12h, ou 16h)
 */
async function processTimeSlot(
  supabase: EdgeSupabaseClient,
  timeSlot: string
): Promise<ProcessingStats> {
  const startTime = Date.now();

  console.log(`🕐 Starting time slot processing: ${timeSlot}`);

  // 1. Récupérer la configuration système
  const config = await getFollowupConfig(supabase);

  // 2. Récupérer les emails éligibles pour ce créneau
  const emailsEligible = await getEmailsEligibleForTimeSlot(supabase, timeSlot, config);

  console.log(`📧 Found ${emailsEligible.length} emails eligible for time slot ${timeSlot}`);

  if (emailsEligible.length === 0) {
    return {
      success: true,
      message: `No emails eligible for time slot ${timeSlot}`,
      time_slot: timeSlot,
      emails_analyzed: 0,
      emails_eligible: 0,
      followups_sent: 0,
      followups_failed: 0
    };
  }

  // 3. Récupérer les templates actifs
  const templates = await getActiveTemplates(supabase);

  // 4. Obtenir token Microsoft Graph
  const accessToken = await getMicrosoftGraphToken();

  // 5. Traiter chaque email éligible
  let followupsSent = 0;
  let followupsFailed = 0;
  const errors: string[] = [];

  for (const email of emailsEligible) {
    try {
      // Trouver le template approprié
      const template = templates.find(t => t.followup_number === email.next_followup_number);
      if (!template) {
        console.log(`📝 No template found for followup ${email.next_followup_number}`);
        continue;
      }

      // Envoyer la relance
      const renderedTemplate = renderTemplate(template, email);
      await sendFollowup(supabase, email, template, renderedTemplate, accessToken);
      followupsSent++;

      console.log(`✅ Sent followup ${email.next_followup_number} for email ${email.id} at slot ${timeSlot}`);

      // Vérifier si on a atteint 4 relances sans réponse
      if (email.next_followup_number === 4) {
        await markEmailForManualHandling(supabase, email.id);
      }

    } catch (error) {
      const errorMsg = `Failed to process email ${email.id}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
      followupsFailed++;
    }
  }

  const processingTime = Date.now() - startTime;

  console.log(`🎯 Time slot ${timeSlot} completed in ${processingTime}ms:`);
  console.log(`   📧 Emails analyzed: ${emailsEligible.length}`);
  console.log(`   ✅ Followups sent: ${followupsSent}`);
  console.log(`   ❌ Failed: ${followupsFailed}`);

  return {
    success: true,
    message: `Time slot ${timeSlot} processing completed`,
    time_slot: timeSlot,
    emails_analyzed: emailsEligible.length,
    emails_eligible: emailsEligible.length,
    followups_sent: followupsSent,
    followups_failed: followupsFailed,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Récupère la configuration du système de relances
 */
async function getFollowupConfig(supabase: EdgeSupabaseClient): Promise<FollowupConfig> {
  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'followup_settings')
    .single();

  if (error) {
    throw new Error(`Failed to get followup config: ${error.message}`);
  }

  return data.value as FollowupConfig;
}

/**
 * Récupère les emails éligibles pour un créneau horaire donné
 * Logique: email pending + délai minimum respecté + max 2 relances/jour + pas bounced
 */
async function getEmailsEligibleForTimeSlot(
  supabase: EdgeSupabaseClient,
  timeSlot: string,
  config: FollowupConfig
): Promise<EmailEligibleForSlot[]> {

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Requête complexe pour récupérer les emails éligibles
  const { data: rawEmails, error } = await supabase
    .from('tracked_emails')
    .select(`
      *,
      mailbox:mailboxes!inner(
        id,
        email_address,
        microsoft_user_id,
        is_active
      )
    `)
    .eq('status', 'pending')
    .eq('mailbox.is_active', true)
    .is('bounce_type', null)
    .order('sent_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch emails: ${error.message}`);
  }

  if (!rawEmails || rawEmails.length === 0) {
    return [];
  }

  // Enrichir chaque email avec les données de relance et vérifier l'éligibilité
  const eligibleEmails: EmailEligibleForSlot[] = [];

  for (const email of rawEmails) {
    try {
      // Récupérer les informations de relances pour cet email
      const followupInfo = await getFollowupInfoForEmail(supabase, email.id, todayStart);

      // Vérifier l'éligibilité pour ce créneau
      if (isEligibleForTimeSlot(email, followupInfo, timeSlot, config, now)) {
        eligibleEmails.push({
          ...email,
          ...followupInfo
        });
      }
    } catch (error) {
      console.error(`Error processing email ${email.id}:`, error);
    }
  }

  return eligibleEmails;
}

/**
 * Récupère les informations de relances pour un email
 */
async function getFollowupInfoForEmail(
  supabase: EdgeSupabaseClient,
  emailId: string,
  todayStart: Date
) {
  // Récupérer le total de relances pour cet email
  const { data: totalCount } = await supabase
    .rpc('get_total_followup_count', { p_tracked_email_id: emailId });

  // Récupérer la dernière relance automatique
  const { data: lastFollowup } = await supabase
    .from('followups')
    .select('followup_number, sent_at')
    .eq('tracked_email_id', emailId)
    .order('followup_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Compter les relances envoyées aujourd'hui
  const { count: todayCount } = await supabase
    .from('followups')
    .select('*', { count: 'exact', head: true })
    .eq('tracked_email_id', emailId)
    .gte('sent_at', todayStart.toISOString());

  // Récupérer la dernière relance manuelle si applicable
  const { data: lastManual } = await supabase
    .from('manual_followups')
    .select('detected_at')
    .eq('tracked_email_id', emailId)
    .order('detected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastFollowupNumber = lastFollowup?.followup_number || 0;
  const nextFollowupNumber = lastFollowupNumber + 1;

  // Déterminer la dernière activité
  const lastAutomaticAt = lastFollowup?.sent_at ? new Date(lastFollowup.sent_at) : null;
  const lastManualAt = lastManual?.detected_at ? new Date(lastManual.detected_at) : null;

  let lastActivityAt: Date;
  let lastActivityType: 'automatic' | 'manual' | 'original';

  if (lastAutomaticAt && lastManualAt) {
    if (lastAutomaticAt > lastManualAt) {
      lastActivityAt = lastAutomaticAt;
      lastActivityType = 'automatic';
    } else {
      lastActivityAt = lastManualAt;
      lastActivityType = 'manual';
    }
  } else if (lastAutomaticAt) {
    lastActivityAt = lastAutomaticAt;
    lastActivityType = 'automatic';
  } else if (lastManualAt) {
    lastActivityAt = lastManualAt;
    lastActivityType = 'manual';
  } else {
    lastActivityAt = new Date(); // Will be set to email sent_at in caller
    lastActivityType = 'original';
  }

  return {
    last_followup_number: lastFollowupNumber,
    next_followup_number: nextFollowupNumber,
    last_followup_at: lastFollowup?.sent_at,
    last_activity_at: lastActivityAt.toISOString(),
    last_activity_type: lastActivityType,
    total_followups: totalCount || 0,
    followups_sent_today: todayCount || 0
  };
}

/**
 * Vérifie si un email est éligible pour un créneau horaire donné
 */
function isEligibleForTimeSlot(
  email: TrackedEmailWithMailbox,
  followupInfo: FollowupInfo,
  _timeSlot: string,
  config: FollowupConfig,
  now: Date
): boolean {
  const {
    next_followup_number,
    total_followups,
    followups_sent_today,
    last_activity_at,
    last_activity_type
  } = followupInfo;

  // 1. Vérifier qu'on n'a pas atteint le maximum de relances
  if (total_followups >= config.max_followups) {
    return false;
  }

  // 2. Vérifier qu'on n'a pas atteint le maximum par jour
  if (followups_sent_today >= config.max_per_day) {
    return false;
  }

  // 3. Déterminer la date de référence pour le délai
  let referenceDate: Date;
  if (last_activity_type === 'original') {
    referenceDate = new Date(email.sent_at);
  } else {
    referenceDate = new Date(last_activity_at);
  }

  // 4. Vérifier le délai minimum selon le numéro de relance
  const minDelayKey = `followup_${next_followup_number}`;
  const minDelayHours = config.min_delay_hours?.[minDelayKey] || 24;

  const timeSinceLastActivity = (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60);

  if (timeSinceLastActivity < minDelayHours) {
    return false;
  }

  // 5. Vérifier qu'on est dans les 48h (timeframe total)
  const originalSentAt = new Date(email.sent_at);
  const timeSinceOriginal = (now.getTime() - originalSentAt.getTime()) / (1000 * 60 * 60);

  if (timeSinceOriginal > config.total_timeframe_hours) {
    return false;
  }

  return true;
}

/**
 * Récupère les templates actifs
 */
async function getActiveTemplates(supabase: EdgeSupabaseClient): Promise<FollowupTemplate[]> {
  const { data, error } = await supabase
    .from('followup_templates')
    .select('*')
    .eq('is_active', true)
    .order('followup_number', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`);
  }

  return data || [];
}

/**
 * Obtient un token d'accès Microsoft Graph
 */
async function getMicrosoftGraphToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', MICROSOFT_CLIENT_ID);
  params.append('client_secret', MICROSOFT_CLIENT_SECRET);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Microsoft Graph token: ${response.status} ${errorText}`);
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

/**
 * Envoie une relance immédiatement
 */
async function sendFollowup(
  supabase: EdgeSupabaseClient,
  email: EmailEligibleForSlot,
  template: FollowupTemplate,
  renderedTemplate: { subject: string; body: string },
  accessToken: string
): Promise<void> {

  // Récupérer les informations de threading de l'email original
  const { data: originalEmail, error: emailError } = await supabase
    .from('tracked_emails')
    .select('internet_message_id, conversation_id, microsoft_message_id')
    .eq('id', email.id)
    .single();

  if (emailError || !originalEmail) {
    throw new Error(`Failed to fetch original email details: ${emailError?.message || 'Not found'}`);
  }

  console.log(`📨 Sending followup ${template.followup_number} for email ${email.id}`);

  // 🚨 SAFETY CHECK: Bloquer l'envoi en développement
  if (isDevelopment && !allowRealEmails) {
    console.log('🛡️ BLOCKED: Real email sending disabled in development');
    console.log(`📧 Would send to: ${email.recipient_emails.join(', ')}`);
    console.log(`📝 Subject: ${renderedTemplate.subject}`);

    // Simuler l'envoi en sauvegardant comme "sent" mais sans vraiment envoyer
    await recordFollowupSent(supabase, email.id, template, renderedTemplate);
    console.log('✅ Simulated email send (DEVELOPMENT MODE)');
    return;
  }

  // Construire le message avec threading
  const messageData = {
    subject: renderedTemplate.subject,
    body: {
      contentType: 'HTML',
      content: convertTextToHtml(renderedTemplate.body)
    },
    toRecipients: email.recipient_emails.map(emailAddr => ({
      emailAddress: { address: emailAddr }
    })),
    from: {
      emailAddress: { address: email.mailbox.email_address }
    },
    internetMessageHeaders: [
      {
        name: 'X-TrackedMail-Followup',
        value: 'true'
      },
      {
        name: 'X-TrackedMail-System',
        value: 'fixed-schedule-processor'
      },
      {
        name: 'X-TrackedMail-Data',
        value: `${template.followup_number}:${email.id}:${new Date().toISOString()}`
      }
    ],
    conversationId: originalEmail.conversation_id
  };

  // Choisir l'API appropriée
  let graphUrl: string;
  let requestBody: { message: typeof messageData };

  if (originalEmail.microsoft_message_id) {
    // Utiliser Reply API pour threading natif
    graphUrl = `https://graph.microsoft.com/v1.0/users/${email.mailbox.microsoft_user_id}/messages/${originalEmail.microsoft_message_id}/reply`;
    requestBody = { message: messageData };
  } else {
    // Utiliser SendMail avec headers custom
    graphUrl = `https://graph.microsoft.com/v1.0/users/${email.mailbox.microsoft_user_id}/sendMail`;
    requestBody = { message: messageData };
  }

  const response = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send followup via Microsoft Graph: ${response.status} ${errorText}`);
  }

  // Enregistrer la relance en base
  await recordFollowupSent(supabase, email.id, template, renderedTemplate);
}

/**
 * Rend un template avec les variables de l'email
 */
function renderTemplate(template: FollowupTemplate, email: EmailEligibleForSlot) {
  const variables = {
    // Noms français (pour compatibilité avec templates existants)
    destinataire_nom: extractNameFromEmail(email.recipient_emails[0] || ''),
    destinataire_entreprise: extractCompanyFromEmail(email.recipient_emails[0] || ''),
    objet_original: email.subject,
    date_envoi_original: new Date(email.sent_at).toLocaleDateString('fr-FR'),
    numero_relance: template.followup_number,
    jours_depuis_envoi: Math.floor(
      (Date.now() - new Date(email.sent_at).getTime()) / (1000 * 60 * 60 * 24)
    ),
    expediteur_nom: extractNameFromEmail(email.sender_email),
    expediteur_email: email.sender_email,
    // Noms anglais (pour templates qui utilisent la nomenclature anglaise)
    recipient_name: extractNameFromEmail(email.recipient_emails[0] || ''),
    recipient_company: extractCompanyFromEmail(email.recipient_emails[0] || ''),
    original_subject: email.subject,
    original_message: email.body_preview || 'Message précédent non disponible',
    sender_name: extractNameFromEmail(email.sender_email),
    sender_email: email.sender_email
  };

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
 * Convertit le texte en HTML simple
 */
function convertTextToHtml(text: string): string {
  return text
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

/**
 * Enregistre une relance envoyée en base de données
 */
async function recordFollowupSent(
  supabase: EdgeSupabaseClient,
  emailId: string,
  template: FollowupTemplate,
  renderedTemplate: { subject: string; body: string }
): Promise<void> {
  const { error } = await supabase
    .from('followups')
    .insert({
      tracked_email_id: emailId,
      template_id: template.id,
      followup_number: template.followup_number,
      subject: renderedTemplate.subject, // Template rendu
      body: renderedTemplate.body,       // Template rendu
      scheduled_for: new Date().toISOString(), // Immédiat
      sent_at: new Date().toISOString(),
      status: 'sent'
    });

  if (error) {
    console.error(`Failed to record followup sent:`, error);
    // Ne pas faire échouer l'envoi pour un problème d'enregistrement
  }
}

/**
 * Marque un email pour prise en charge manuelle (4 relances sans réponse)
 */
async function markEmailForManualHandling(
  supabase: EdgeSupabaseClient,
  emailId: string
): Promise<void> {
  const { error } = await supabase
    .from('tracked_emails')
    .update({
      status: 'requires_manual_handling',
      updated_at: new Date().toISOString()
    })
    .eq('id', emailId);

  if (error) {
    console.error(`Failed to mark email for manual handling:`, error);
  } else {
    console.log(`📋 Email ${emailId} marked for manual handling (4 followups completed)`);
  }
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
    return settings.enabled !== false;
  } catch (error) {
    console.error('Error parsing followup settings:', error);
    return false;
  }
}