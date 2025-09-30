/**
 * Vérification d'éligibilité des emails pour les créneaux horaires
 * Logique de sélection et filtrage des emails éligibles pour relance
 */

import type {
  EdgeSupabaseClient,
  EmailEligibleForSlot,
  FollowupConfig,
  FollowupInfo,
  TrackedEmailWithMailbox
} from './shared-types.ts'

/**
 * Récupère les emails éligibles pour un créneau horaire donné
 * Logique: email pending + délai minimum respecté + max 2 relances/jour + pas bounced
 * @param supabase Client Supabase avec droits service
 * @param timeSlot Créneau horaire ('07:00', '12:00', '16:00')
 * @param config Configuration du système de relances
 * @returns Liste des emails éligibles avec leurs informations de relance
 * @throws Error si la requête échoue
 */
export async function getEmailsEligibleForTimeSlot(
  supabase: EdgeSupabaseClient,
  timeSlot: string,
  config: FollowupConfig
): Promise<EmailEligibleForSlot[]> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Requête pour récupérer les emails potentiellement éligibles
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
    .order('sent_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch emails: ${error.message}`)
  }

  if (!rawEmails || rawEmails.length === 0) {
    return []
  }

  // Enrichir chaque email avec les données de relance et vérifier l'éligibilité
  const eligibleEmails: EmailEligibleForSlot[] = []

  for (const email of rawEmails) {
    try {
      // Récupérer les informations de relances pour cet email
      const followupInfo = await getFollowupInfoForEmail(supabase, email.id, todayStart)

      // Vérifier l'éligibilité pour ce créneau
      if (isEligibleForTimeSlot(email, followupInfo, timeSlot, config, now)) {
        eligibleEmails.push({
          ...email,
          ...followupInfo
        })
      }
    } catch (error) {
      console.error(`Error processing email ${email.id}:`, error)
    }
  }

  return eligibleEmails
}

/**
 * Récupère les informations de relances pour un email spécifique
 * @param supabase Client Supabase
 * @param emailId ID de l'email tracké
 * @param todayStart Date de début de la journée
 * @returns Informations complètes sur les relances de l'email
 */
export async function getFollowupInfoForEmail(
  supabase: EdgeSupabaseClient,
  emailId: string,
  todayStart: Date
): Promise<FollowupInfo> {
  // Récupérer le total de relances pour cet email
  const { data: totalCount } = await supabase
    .rpc('get_total_followup_count', { p_tracked_email_id: emailId })

  // Récupérer la dernière relance automatique
  const { data: lastFollowup } = await supabase
    .from('followups')
    .select('followup_number, sent_at')
    .eq('tracked_email_id', emailId)
    .order('followup_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Compter les relances envoyées aujourd'hui
  const { count: todayCount } = await supabase
    .from('followups')
    .select('*', { count: 'exact', head: true })
    .eq('tracked_email_id', emailId)
    .gte('sent_at', todayStart.toISOString())

  // Récupérer la dernière relance manuelle si applicable
  const { data: lastManual } = await supabase
    .from('manual_followups')
    .select('detected_at')
    .eq('tracked_email_id', emailId)
    .order('detected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastFollowupNumber = lastFollowup?.followup_number || 0
  const nextFollowupNumber = lastFollowupNumber + 1

  // Déterminer la dernière activité
  const lastAutomaticAt = lastFollowup?.sent_at ? new Date(lastFollowup.sent_at) : null
  const lastManualAt = lastManual?.detected_at ? new Date(lastManual.detected_at) : null

  let lastActivityAt: Date
  let lastActivityType: 'automatic' | 'manual' | 'original'

  if (lastAutomaticAt && lastManualAt) {
    if (lastAutomaticAt > lastManualAt) {
      lastActivityAt = lastAutomaticAt
      lastActivityType = 'automatic'
    } else {
      lastActivityAt = lastManualAt
      lastActivityType = 'manual'
    }
  } else if (lastAutomaticAt) {
    lastActivityAt = lastAutomaticAt
    lastActivityType = 'automatic'
  } else if (lastManualAt) {
    lastActivityAt = lastManualAt
    lastActivityType = 'manual'
  } else {
    lastActivityAt = new Date() // Will be set to email sent_at in caller
    lastActivityType = 'original'
  }

  return {
    last_followup_number: lastFollowupNumber,
    next_followup_number: nextFollowupNumber,
    last_followup_at: lastFollowup?.sent_at,
    last_activity_at: lastActivityAt.toISOString(),
    last_activity_type: lastActivityType,
    total_followups: totalCount || 0,
    followups_sent_today: todayCount || 0
  }
}

/**
 * Vérifie si un email est éligible pour un créneau horaire donné
 * @param email Email avec informations de mailbox
 * @param followupInfo Informations de relances de l'email
 * @param _timeSlot Créneau horaire (non utilisé actuellement)
 * @param config Configuration du système
 * @param now Date/heure actuelle
 * @returns true si l'email est éligible pour ce créneau
 */
export function isEligibleForTimeSlot(
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
  } = followupInfo

  // 1. Vérifier qu'on n'a pas atteint le maximum de relances
  if (total_followups >= config.max_followups) {
    return false
  }

  // 2. Vérifier qu'on n'a pas atteint le maximum par jour
  if (followups_sent_today >= config.max_per_day) {
    return false
  }

  // 3. Déterminer la date de référence pour le délai
  let referenceDate: Date
  if (last_activity_type === 'original') {
    referenceDate = new Date(email.sent_at)
  } else {
    referenceDate = new Date(last_activity_at)
  }

  // 4. Vérifier le délai minimum selon le numéro de relance
  const minDelayKey = `followup_${next_followup_number}`
  const minDelayHours = config.min_delay_hours?.[minDelayKey] || 24

  const timeSinceLastActivity = (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60)

  if (timeSinceLastActivity < minDelayHours) {
    return false
  }

  // 5. Vérifier qu'on est dans les 48h (timeframe total)
  const originalSentAt = new Date(email.sent_at)
  const timeSinceOriginal = (now.getTime() - originalSentAt.getTime()) / (1000 * 60 * 60)

  if (timeSinceOriginal > config.total_timeframe_hours) {
    return false
  }

  return true
}