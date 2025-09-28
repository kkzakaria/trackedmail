/**
 * Module de détection et gestion des relances (automatiques et manuelles)
 */

import {
  EdgeSupabaseClient,
  EmailMessage,
  DetectionResult
} from './shared-types.ts'
import { getElapsedTime } from './utils.ts'
import { logDetectionAttempt } from './database-manager.ts'

/**
 * Vérifie si un email est une relance automatique via les headers personnalisés
 */
export function isFollowupEmail(message: EmailMessage): boolean {
  if (!message.internetMessageHeaders || message.internetMessageHeaders.length === 0) {
    return false
  }

  // Rechercher les headers TrackedMail
  for (const header of message.internetMessageHeaders) {
    if (header.name === 'X-TrackedMail-Followup' && header.value === 'true') {
      console.log('📌 Detected X-TrackedMail-Followup header')
      return true
    }
    if (header.name === 'X-TrackedMail-System' && header.value === 'automated-followup') {
      console.log('📌 Detected X-TrackedMail-System automated-followup header')
      return true
    }
  }

  return false
}

/**
 * Récupère le numéro de relance depuis les headers (format condensé)
 */
export function getFollowupNumber(message: EmailMessage): number | null {
  if (!message.internetMessageHeaders) return null

  const dataHeader = message.internetMessageHeaders.find(
    h => h.name === 'X-TrackedMail-Data'
  )

  if (dataHeader) {
    const parts = dataHeader.value.split(':')
    return parts[0] ? parseInt(parts[0]) : null
  }

  return null
}

/**
 * Récupère l'ID de l'email original tracké depuis les headers (format condensé)
 */
export function getOriginalTrackedEmailId(message: EmailMessage): string | null {
  if (!message.internetMessageHeaders) return null

  const dataHeader = message.internetMessageHeaders.find(
    h => h.name === 'X-TrackedMail-Data'
  )

  if (dataHeader) {
    const parts = dataHeader.value.split(':')
    return parts[1] || null
  }

  return null
}

/**
 * Gère la détection et le traitement des relances manuelles
 */
export async function handlePotentialManualFollowup(
  supabase: EdgeSupabaseClient,
  messageDetails: EmailMessage,
  startTime: number
): Promise<DetectionResult> {
  try {
    console.log(`🔍 Checking for manual followup in conversation: ${messageDetails.conversationId}`)

    // Chercher un email original tracké dans la même conversation
    const { data: originalEmail, error: originalError } = await supabase
      .from('tracked_emails')
      .select('id, status, sent_at, subject, sender_email')
      .eq('conversation_id', messageDetails.conversationId)
      .eq('status', 'pending')
      .single()

    if (originalError || !originalEmail) {
      console.log(`📭 No tracked email found for conversation ${messageDetails.conversationId}`)
      return {
        detected: false,
        type: 'not_detected',
        rejectionReason: 'no_tracked_email_in_conversation'
      }
    }

    // Vérifier que c'est bien une relance manuelle (même expéditeur que l'email original)
    const isSameSender = messageDetails.sender.emailAddress.address.toLowerCase() ===
                        originalEmail.sender_email.toLowerCase()

    if (!isSameSender) {
      console.log(`👤 Different sender detected - not a manual followup`)
      console.log(`   Original: ${originalEmail.sender_email}, Reply: ${messageDetails.sender.emailAddress.address}`)
      return {
        detected: false,
        type: 'not_detected',
        rejectionReason: 'different_sender'
      }
    }

    console.log(`🎯 Manual followup confirmed for email: ${originalEmail.id}`)
    console.log(`   Original: "${originalEmail.subject}"`)
    console.log(`   Manual followup: "${messageDetails.subject}"`)

    // Compter le nombre total de relances existantes
    const totalFollowups = await getTotalFollowupCount(supabase, originalEmail.id)
    const nextSequenceNumber = totalFollowups + 1

    console.log(`📊 Total existing followups: ${totalFollowups}, next sequence: ${nextSequenceNumber}`)

    // Enregistrer la relance manuelle
    const { error: insertError } = await supabase
      .from('manual_followups')
      .insert({
        tracked_email_id: originalEmail.id,
        microsoft_message_id: messageDetails.id,
        conversation_id: messageDetails.conversationId,
        sender_email: messageDetails.sender.emailAddress.address,
        subject: messageDetails.subject,
        followup_sequence_number: nextSequenceNumber,
        detected_at: messageDetails.sentDateTime
      })

    if (insertError) {
      console.error(`❌ Failed to insert manual followup:`, insertError)
      return {
        detected: false,
        type: 'response_error',
        rejectionReason: insertError.message
      }
    }

    // Reprogrammer les relances automatiques
    const rescheduledCount = await rescheduleAutomaticFollowups(
      supabase,
      originalEmail.id,
      messageDetails.sentDateTime
    )

    console.log(`📅 Rescheduled ${rescheduledCount} automatic followups`)

    // Logger la détection réussie
    await logDetectionAttempt(
      supabase,
      messageDetails,
      true,
      originalEmail.id,
      'manual_followup_detected',
      null,
      getElapsedTime(startTime)
    )

    console.log(`✅ Manual followup successfully processed`)

    return {
      detected: true,
      type: 'manual_followup_detected',
      trackedEmailId: originalEmail.id,
      detectionMethod: 'conversation_matching'
    }

  } catch (error) {
    console.error(`❌ Error handling manual followup:`, error)
    return {
      detected: false,
      type: 'response_error',
      rejectionReason: error instanceof Error ? error.message : 'unknown_error'
    }
  }
}

/**
 * Compte le nombre total de relances (automatiques + manuelles)
 */
export async function getTotalFollowupCount(
  supabase: EdgeSupabaseClient,
  trackedEmailId: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .rpc('get_total_followup_count', { p_tracked_email_id: trackedEmailId })

    if (error) {
      console.error(`Error getting total followup count:`, error)
      return 0
    }

    return data || 0
  } catch (error) {
    console.error(`Error calling get_total_followup_count:`, error)
    return 0
  }
}

/**
 * Reprogramme les relances automatiques après une relance manuelle
 */
export async function rescheduleAutomaticFollowups(
  supabase: EdgeSupabaseClient,
  trackedEmailId: string,
  manualSentAt: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .rpc('reschedule_pending_followups', {
        p_tracked_email_id: trackedEmailId,
        p_base_time: manualSentAt,
        p_adjustment_hours: 4 // Même intervalle que le système (4h)
      })

    if (error) {
      console.error(`Error rescheduling followups:`, error)
      return 0
    }

    return data || 0
  } catch (error) {
    console.error(`Error calling reschedule_pending_followups:`, error)
    return 0
  }
}

/**
 * Détecte si un email est une relance basée sur les patterns de conversation
 */
export function detectFollowupPattern(
  message: EmailMessage,
  originalSubject?: string
): {
  isFollowup: boolean
  confidence: number
  indicators: string[]
} {
  const indicators: string[] = []
  let confidence = 0

  // Vérifier les headers personnalisés
  if (isFollowupEmail(message)) {
    indicators.push('has_trackedmail_headers')
    confidence += 100 // Certitude absolue
  }

  // Vérifier les patterns dans le sujet
  const followupPatterns = [
    /follow.?up/i,
    /following up/i,
    /checking in/i,
    /circling back/i,
    /reminder:/i,
    /relance:/i,
    /gentle reminder/i,
    /quick reminder/i,
    /friendly reminder/i,
    /just wanted to follow up/i
  ]

  for (const pattern of followupPatterns) {
    if (pattern.test(message.subject) || pattern.test(message.bodyPreview)) {
      indicators.push(`matches_pattern_${pattern.source}`)
      confidence += 30
      break
    }
  }

  // Vérifier la similarité avec le sujet original
  if (originalSubject) {
    const similarity = calculateSubjectSimilarity(message.subject, originalSubject)
    if (similarity > 0.8) {
      indicators.push('high_subject_similarity')
      confidence += 20
    }
  }

  const isFollowup = confidence >= 30

  return {
    isFollowup,
    confidence,
    indicators
  }
}

/**
 * Calcule la similarité entre deux sujets d'email
 */
function calculateSubjectSimilarity(subject1: string, subject2: string): number {
  // Nettoyer les sujets (enlever les préfixes)
  const clean1 = cleanSubjectForComparison(subject1)
  const clean2 = cleanSubjectForComparison(subject2)

  // Calcul simple de similarité basé sur les mots communs
  const words1 = new Set(clean1.toLowerCase().split(/\s+/))
  const words2 = new Set(clean2.toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return union.size > 0 ? intersection.size / union.size : 0
}

/**
 * Nettoie un sujet pour comparaison
 */
function cleanSubjectForComparison(subject: string): string {
  return subject
    .replace(/^(RE:|FW:|FWD:|TR:|Réf:|REF:|RES:|Res:|res:)\s*/gi, '')
    .replace(/^\[.*?\]\s*/, '')
    .replace(/follow.?up:?\s*/gi, '')
    .replace(/reminder:?\s*/gi, '')
    .replace(/relance:?\s*/gi, '')
    .trim()
}