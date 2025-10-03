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
  hasHeader,
  cleanSubject,
  calculateSubjectSimilarity,
  calculateTimingBonus
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

/**
 * Détection améliorée des réponses avec méthodes supplémentaires
 */
export async function enhancedResponseDetection(
  supabase: EdgeSupabaseClient,
  message: EmailMessage
): Promise<{
  isResponse: boolean
  confidence: number
  method: string
  originalEmailId?: string
}> {
  const methods: Array<{
    name: string
    weight: number
    check: () => Promise<boolean | string | null>
  }> = [
    // Méthode 1: Headers standards (haute confiance)
    {
      name: 'headers',
      weight: 40,
      check: async () => {
        if (message.inReplyTo || message.references) {
          // Chercher l'email original par internetMessageId
          const messageIds = [
            message.inReplyTo,
            ...(message.references ? message.references.split(/\s+/) : [])
          ].filter(Boolean)

          for (const messageId of messageIds) {
            if (messageId) {
              const { data } = await supabase
                .from('tracked_emails')
                .select('id')
                .eq('internet_message_id', messageId.trim())
                .single()

              if (data) {
                return data.id
              }
            }
          }
          return true // Headers présents mais email original non trouvé
        }
        return false
      }
    },
    // Méthode 2: ConversationId + ConversationIndex (confiance élevée)
    {
      name: 'conversationThread',
      weight: 35,
      check: async () => {
        if (message.conversationId && message.conversationIndex && message.conversationIndex.length > 44) {
          // Chercher l'email le plus récent de cette conversation
          const { data } = await supabase
            .from('tracked_emails')
            .select('id, conversation_index')
            .eq('conversation_id', message.conversationId)
            .eq('status', 'pending')
            .order('sent_at', { ascending: false })

          if (data && data.length > 0) {
            // Trouver l'email qui correspond le mieux au threading
            for (const email of data) {
              // Si le conversationIndex actuel commence par celui de l'email tracké
              if (email.conversation_index &&
                  message.conversationIndex.startsWith(email.conversation_index)) {
                return email.id
              }
            }
            // Sinon retourner le plus récent
            return data[0].id
          }
        }
        return false
      }
    },
    // Méthode 3: Sujet avec préfixe et correspondance (confiance moyenne)
    {
      name: 'subjectMatching',
      weight: 20,
      check: async () => {
        if (hasReplyPrefix(message.subject)) {
          // Chercher par sujet nettoyé avec similarité
          const cleanedSubject = cleanSubject(message.subject)
          const { data } = await supabase
            .from('tracked_emails')
            .select('id, subject')
            .eq('status', 'pending')
            .order('sent_at', { ascending: false })
            .limit(20) // Augmenter la limite pour meilleure recherche

          if (data) {
            // Recherche exacte d'abord
            for (const email of data) {
              if (cleanSubject(email.subject) === cleanedSubject) {
                return email.id
              }
            }
            // Recherche par inclusion ensuite
            for (const email of data) {
              const trackedSubjectClean = cleanSubject(email.subject)
              if (cleanedSubject.includes(trackedSubjectClean) ||
                  trackedSubjectClean.includes(cleanedSubject)) {
                return email.id
              }
            }
          }
          return true
        }
        return false
      }
    },
    // Méthode 4: Détection manuelle de réponse (sans threading)
    {
      name: 'manualReplyDetection',
      weight: 30,
      check: async () => {
        // Récupérer emails trackés récents (7 derniers jours) avec status pending
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

        const { data: recentTracked } = await supabase
          .from('tracked_emails')
          .select('id, subject, recipient_emails, sent_at')
          .eq('status', 'pending')
          .gte('sent_at', sevenDaysAgo.toISOString())
          .order('sent_at', { ascending: false })

        if (!recentTracked || recentTracked.length === 0) {
          return false
        }

        let bestMatch: { id: string; score: number } | null = null

        for (const tracked of recentTracked) {
          let score = 0

          // Critère 1: Expéditeur dans les destinataires (40%)
          const senderEmail = message.sender.emailAddress.address.toLowerCase()
          const recipientEmails = tracked.recipient_emails.map((e: string) => e.toLowerCase())

          if (recipientEmails.includes(senderEmail)) {
            score += 40
          } else {
            continue // Si l'expéditeur n'est pas destinataire, skip
          }

          // Critère 2: Similarité du sujet (30%)
          const cleanedIncoming = cleanSubject(message.subject)
          const cleanedTracked = cleanSubject(tracked.subject)
          const similarity = calculateSubjectSimilarity(cleanedIncoming, cleanedTracked)
          score += similarity * 30

          // Critère 3: Proximité temporelle (30%)
          const timingBonus = calculateTimingBonus(
            new Date(tracked.sent_at),
            new Date(message.sentDateTime)
          )
          score += timingBonus * 30

          // Logs détaillés pour débogage
          console.log(`Manual reply check for tracked email ${tracked.id}:`)
          console.log(`  → Sender: ${senderEmail}`)
          console.log(`  → In recipients: ${recipientEmails.includes(senderEmail)}`)
          console.log(`  → Subject similarity: ${(similarity * 100).toFixed(1)}%`)
          console.log(`  → Timing bonus: ${(timingBonus * 100).toFixed(1)}%`)
          console.log(`  → Total score: ${score.toFixed(1)}%`)

          // Garder le meilleur match
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { id: tracked.id, score }
          }
        }

        // Retourner le match si score >= 60% (sur 100)
        if (bestMatch && bestMatch.score >= 60) {
          console.log(`✅ Manual reply detected with ${bestMatch.score.toFixed(1)}% confidence for email ${bestMatch.id}`)
          return bestMatch.id
        }

        return false
      }
    },
    // Méthode 5: Analyse du contenu (confiance faible)
    {
      name: 'bodyAnalysis',
      weight: 5,
      // deno-lint-ignore require-await
      check: async () => {
        const replyPatterns = [
          /^on .+ wrote:$/im,
          /^le .+ a écrit :$/im,
          /^-{3,} original message -+/im,
          /^>{1,}/m, // Lignes de citation
          /^from:\s+.+\nto:\s+.+\nsubject:\s+.+/im,
          /wrote:$/im,
          /a écrit :/im
        ]

        const bodyContent = message.bodyPreview || ''
        return replyPatterns.some(pattern => pattern.test(bodyContent))
      }
    }
  ]

  let totalConfidence = 0
  const detectedMethods: string[] = []
  let originalEmailId: string | undefined

  for (const method of methods) {
    try {
      const result = await method.check()
      if (result) {
        totalConfidence += method.weight
        detectedMethods.push(method.name)

        // Si on a trouvé un ID d'email original
        if (typeof result === 'string' && !originalEmailId) {
          originalEmailId = result
        }
      }
    } catch (error) {
      console.warn(`Error in ${method.name} detection:`, error)
    }
  }

  // Considérer comme réponse si confiance >= 25% (plus sensible)
  const isResponse = totalConfidence >= 25

  return {
    isResponse,
    confidence: totalConfidence,
    method: detectedMethods.join('+'),
    originalEmailId
  }
}