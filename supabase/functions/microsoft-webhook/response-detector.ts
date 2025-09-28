/**
 * Module de détection des réponses aux emails trackés
 */

import {
  EdgeSupabaseClient,
  EmailMessage,
  TrackedEmail,
  ResponseType,
  DetectionResult
} from './shared-types.ts'
import {
  hasReplyPrefix,
  hasForwardPrefix,
  getElapsedTime,
  parseReferences,
  hasHeader
} from './utils.ts'
import { logDetectionAttempt } from './database-manager.ts'

/**
 * Détecte si un email est une réponse à un autre email
 * Basé sur les headers et le sujet
 */
export function detectIsReply(message: EmailMessage): boolean {
  // 1. Vérifier les headers de threading
  if (message.internetMessageHeaders && message.internetMessageHeaders.length > 0) {
    const replyHeaders = ['In-Reply-To', 'References']
    for (const header of message.internetMessageHeaders) {
      if (replyHeaders.includes(header.name) && header.value) {
        console.log(`Email detected as reply based on header: ${header.name}`)
        return true
      }
    }
  }

  // 2. Vérifier le sujet pour les préfixes de réponse
  if (hasReplyPrefix(message.subject)) {
    console.log(`Email detected as reply based on subject prefix`)
    return true
  }

  // 3. Vérifier la profondeur du conversationIndex
  // Un conversationIndex plus long que la base indique une réponse
  if (message.conversationIndex) {
    // Base = 22 bytes (44 caractères hex), chaque réponse ajoute 5 bytes (10 caractères)
    const isReply = message.conversationIndex.length > 44
    if (isReply) {
      console.log(`Email detected as reply based on conversationIndex length: ${message.conversationIndex.length}`)
      return true
    }
  }

  return false
}

/**
 * Trouve l'email original tracké correspondant à une réponse
 */
export async function findOriginalTrackedEmail(
  supabase: EdgeSupabaseClient,
  responseMessage: EmailMessage
): Promise<TrackedEmail | null> {
  try {
    console.log(`Searching for original tracked email for response: ${responseMessage.id}`)

    // Méthode 1: Recherche par conversationId + inReplyTo (le plus fiable)
    if (responseMessage.conversationId && responseMessage.inReplyTo) {
      console.log(`Searching by conversationId + inReplyTo: ${responseMessage.conversationId} / ${responseMessage.inReplyTo}`)

      const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('conversation_id', responseMessage.conversationId)
        .eq('internet_message_id', responseMessage.inReplyTo)
        .eq('status', 'pending')
        .single()

      if (!error && data) {
        console.log(`Found original email by inReplyTo: ${data.id}`)
        return data as TrackedEmail
      }
    }

    // Méthode 2: Recherche par conversationId + references
    if (responseMessage.conversationId && responseMessage.references) {
      console.log(`Searching by conversationId + references: ${responseMessage.conversationId}`)

      const references = parseReferences(responseMessage.references)

      for (const ref of references) {
        const { data, error } = await supabase
          .from('tracked_emails')
          .select('*')
          .eq('conversation_id', responseMessage.conversationId)
          .eq('internet_message_id', ref.trim())
          .eq('status', 'pending')
          .single()

        if (!error && data) {
          console.log(`Found original email by reference: ${data.id}`)
          return data as TrackedEmail
        }
      }
    }

    // Méthode 3: Fallback par conversationId seul (dernière tentative)
    if (responseMessage.conversationId) {
      console.log(`Fallback search by conversationId only: ${responseMessage.conversationId}`)

      const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('conversation_id', responseMessage.conversationId)
        .eq('status', 'pending')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data) {
        console.log(`Found original email by conversationId fallback: ${data.id}`)
        return data as TrackedEmail
      }
    }

    console.log('No original tracked email found')
    return null

  } catch (error) {
    console.error('Error finding original tracked email:', error)
    return null
  }
}

/**
 * Gère les emails de réponse (ne les tracke pas, mais marque l'original comme responded)
 */
export async function handleEmailResponse(
  supabase: EdgeSupabaseClient,
  responseMessage: EmailMessage,
  startTime: number
): Promise<DetectionResult> {
  try {
    console.log(`Handling email response: ${responseMessage.subject}`)

    // Trouver l'email original
    const originalEmail = await findOriginalTrackedEmail(supabase, responseMessage)

    if (!originalEmail) {
      console.log('No original tracked email found for this response, logging as orphaned response')
      await logDetectionAttempt(
        supabase,
        responseMessage,
        false,
        null,
        'response_orphaned',
        'original_not_found',
        getElapsedTime(startTime)
      )
      return {
        detected: false,
        type: 'response_orphaned',
        rejectionReason: 'original_not_found'
      }
    }

    // Déterminer le type de réponse
    const responseType = determineResponseType(responseMessage)

    // Insérer dans email_responses (le trigger se chargera de mettre à jour le statut)
    const { error } = await supabase
      .from('email_responses')
      .insert({
        tracked_email_id: originalEmail.id,
        microsoft_message_id: responseMessage.id,
        sender_email: responseMessage.sender.emailAddress.address,
        subject: responseMessage.subject,
        body_preview: responseMessage.bodyPreview,
        received_at: responseMessage.sentDateTime,
        response_type: responseType,
        is_auto_response: responseType === 'auto_reply'
      })

    if (error) {
      console.error('Error inserting email response:', error)
      throw error
    }

    // Logger la détection réussie
    await logDetectionAttempt(
      supabase,
      responseMessage,
      true,
      originalEmail.id,
      'response_detected',
      null,
      getElapsedTime(startTime)
    )

    console.log(`Successfully processed response: ${responseMessage.subject} -> Original: ${originalEmail.subject}`)

    return {
      detected: true,
      type: 'response_detected',
      trackedEmailId: originalEmail.id,
      detectionMethod: 'threading'
    }

  } catch (error) {
    console.error('Error handling email response:', error)

    // Logger l'erreur
    await logDetectionAttempt(
      supabase,
      responseMessage,
      false,
      null,
      'response_error',
      error instanceof Error ? error.message : 'unknown_error',
      getElapsedTime(startTime)
    )

    return {
      detected: false,
      type: 'response_error',
      rejectionReason: error instanceof Error ? error.message : 'unknown_error'
    }
  }
}

/**
 * Détermine le type de réponse d'un email
 */
export function determineResponseType(message: EmailMessage): ResponseType {
  // Vérifier les auto-replies en premier
  if (message.internetMessageHeaders && message.internetMessageHeaders.length > 0) {
    for (const header of message.internetMessageHeaders) {
      const headerName = header.name.toLowerCase()
      const headerValue = header.value?.toLowerCase() || ''

      // Headers d'auto-reply
      if (headerName === 'auto-submitted' && headerValue.includes('auto-replied')) {
        return 'auto_reply'
      }
      if (headerName === 'x-autoreply' || headerName === 'x-autorespond') {
        return 'auto_reply'
      }
      if (headerName === 'x-mailer' && headerValue.includes('auto')) {
        return 'auto_reply'
      }

      // Headers de bounce
      if (headerName === 'x-failed-recipients' || headerName === 'x-delivery-status') {
        return 'bounce'
      }
    }
  }

  // Vérifier le sujet pour forward
  if (hasForwardPrefix(message.subject)) {
    return 'forward'
  }

  // Par défaut, c'est une réponse directe
  return 'direct_reply'
}

/**
 * Analyse approfondie pour détecter les patterns de réponse
 */
export function analyzeResponsePatterns(message: EmailMessage): {
  isReply: boolean
  confidence: number
  indicators: string[]
} {
  const indicators: string[] = []
  let confidence = 0

  // Vérifier les headers
  if (hasHeader(message.internetMessageHeaders, 'In-Reply-To')) {
    indicators.push('has_in_reply_to_header')
    confidence += 40
  }

  if (hasHeader(message.internetMessageHeaders, 'References')) {
    indicators.push('has_references_header')
    confidence += 30
  }

  // Vérifier le sujet
  if (hasReplyPrefix(message.subject)) {
    indicators.push('has_reply_prefix')
    confidence += 20
  }

  // Vérifier le conversationIndex
  if (message.conversationIndex && message.conversationIndex.length > 44) {
    indicators.push('extended_conversation_index')
    confidence += 10
  }

  const isReply = confidence >= 30

  return {
    isReply,
    confidence,
    indicators
  }
}

/**
 * Calcule les métriques de détection
 */
export function calculateDetectionMetrics(
  startTime: number,
  detected: boolean,
  method?: string
): {
  success: boolean
  elapsedMs: number
  method?: string
} {
  return {
    success: detected,
    elapsedMs: getElapsedTime(startTime),
    method
  }
}