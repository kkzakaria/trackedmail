/**
 * Module de suivi avancé des conversations
 * Gère la détection des emails de suite de conversation et améliore la détection des réponses
 */

import {
  EdgeSupabaseClient,
  EmailMessage,
  TrackedEmail
} from './shared-types.ts'
import {
  cleanSubject,
  hasReplyPrefix,
  calculateThreadPosition,
  getHeaderValue
} from './utils.ts'

/**
 * Structure pour analyser le contexte d'une conversation
 */
export interface ConversationContext {
  conversationId: string
  threadPosition: number
  hasExistingTrackedEmails: boolean
  lastTrackedEmail?: TrackedEmail
  lastResponseTime?: Date
  isPartOfActiveConversation: boolean
  conversationStartedByUs: boolean
  hasReceivedResponse: boolean
  totalMessagesInThread: number
}

/**
 * Analyse si un email sortant fait partie d'une conversation existante
 * plutôt qu'un nouvel email initial
 */
export async function analyzeConversationContext(
  supabase: EdgeSupabaseClient,
  message: EmailMessage
): Promise<ConversationContext> {
  const conversationId = message.conversationId
  const threadPosition = calculateThreadPosition(message.conversationIndex)

  // Rechercher tous les emails trackés de cette conversation
  const { data: trackedEmails } = await supabase
    .from('tracked_emails')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: false })

  const hasExistingTrackedEmails = !!(trackedEmails && trackedEmails.length > 0)
  const lastTrackedEmail = trackedEmails?.[0] as TrackedEmail | undefined

  // Vérifier s'il y a eu des réponses dans cette conversation
  let hasReceivedResponse = false
  let lastResponseTime: Date | undefined

  if (lastTrackedEmail) {
    const { data: responses } = await supabase
      .from('email_responses')
      .select('received_at')
      .eq('tracked_email_id', lastTrackedEmail.id)
      .order('received_at', { ascending: false })
      .limit(1)

    if (responses && responses.length > 0) {
      hasReceivedResponse = true
      lastResponseTime = new Date(responses[0].received_at)
    }
  }

  // Compter le nombre total de messages dans le thread
  const totalMessagesInThread = (trackedEmails?.length || 0) + threadPosition

  // Déterminer si c'est une conversation active
  const isPartOfActiveConversation = !!(
    hasExistingTrackedEmails &&
    (threadPosition > 1 || hasReceivedResponse)
  )

  // Vérifier si nous avons initié la conversation
  const conversationStartedByUs = !!(
    hasExistingTrackedEmails &&
    lastTrackedEmail &&
    lastTrackedEmail.status === 'responded' // Si on a eu une réponse, c'est qu'on a initié
  )

  return {
    conversationId,
    threadPosition,
    hasExistingTrackedEmails,
    lastTrackedEmail,
    lastResponseTime,
    isPartOfActiveConversation,
    conversationStartedByUs,
    hasReceivedResponse,
    totalMessagesInThread
  }
}

/**
 * Détection améliorée des followups automatiques en utilisant TOUS les headers
 */
export function isAutomatedFollowup(message: EmailMessage): {
  isFollowup: boolean
  followupNumber?: number
  trackedEmailId?: string
  followupId?: string
} {
  if (!message.internetMessageHeaders) {
    return { isFollowup: false }
  }

  // Vérifier les headers de followup
  const followupHeader = getHeaderValue(message.internetMessageHeaders, 'X-TrackedMail-Followup')
  const systemHeader = getHeaderValue(message.internetMessageHeaders, 'X-TrackedMail-System')
  const dataHeader = getHeaderValue(message.internetMessageHeaders, 'X-TrackedMail-Data')

  // Si on a au moins le header principal ou le header système
  if (followupHeader === 'true' || systemHeader === 'automated-followup') {
    // Parser les données si disponibles
    if (dataHeader) {
      const parts = dataHeader.split(':')
      return {
        isFollowup: true,
        followupNumber: parseInt(parts[0]) || undefined,
        trackedEmailId: parts[1] || undefined,
        followupId: parts[2] || undefined
      }
    }

    return { isFollowup: true }
  }

  return { isFollowup: false }
}

/**
 * Détermine si un email sortant est une suite de conversation
 * et non un nouvel email initial à tracker
 */
export function isConversationContinuation(
  context: ConversationContext,
  message: EmailMessage
): boolean {
  // Cas 1: C'est un followup automatique (ne jamais tracker)
  const followupCheck = isAutomatedFollowup(message)
  if (followupCheck.isFollowup) {
    console.log('Email is an automated followup, skip tracking')
    return true
  }

  // Cas 2: Position dans le thread > 1 avec emails trackés existants
  if (context.threadPosition > 1 && context.hasExistingTrackedEmails) {
    console.log('Email is part of existing conversation thread (position: ' + context.threadPosition + ')')
    return true
  }

  // Cas 3: Réponse après avoir reçu une réponse (ping-pong)
  if (context.hasReceivedResponse && context.lastResponseTime) {
    const messageTime = new Date(message.sentDateTime)
    const timeDiff = messageTime.getTime() - context.lastResponseTime.getTime()
    const hoursDiff = timeDiff / (1000 * 60 * 60)

    // Si on répond dans les 72 heures après une réponse, c'est une suite
    if (hoursDiff < 72) {
      console.log('Email is a follow-up to received response (within 72 hours)')
      return true
    }
  }

  // Cas 4: Préfixe de réponse dans le sujet avec conversation existante
  if (hasReplyPrefix(message.subject) && context.hasExistingTrackedEmails) {
    console.log('Email has reply prefix and existing tracked emails')
    return true
  }

  // Cas 5: Headers de réponse (In-Reply-To, References)
  if ((message.inReplyTo || message.references) && context.hasExistingTrackedEmails) {
    console.log('Email has reply headers and existing conversation')
    return true
  }

  // Cas 6: Même conversationId avec activité récente
  if (context.hasExistingTrackedEmails && context.lastTrackedEmail) {
    const lastEmailTime = new Date(context.lastTrackedEmail.sent_at)
    const currentEmailTime = new Date(message.sentDateTime)
    const daysDiff = (currentEmailTime.getTime() - lastEmailTime.getTime()) / (1000 * 60 * 60 * 24)

    // Si email dans la même conversation dans les 7 jours
    if (daysDiff < 7) {
      console.log('Email in same conversation within 7 days')
      return true
    }
  }

  return false
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
    // Méthode 4: Analyse du contenu (confiance faible)
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

/**
 * Détermine si on doit créer un nouvel email tracké
 */
export async function shouldCreateNewTrackedEmail(
  supabase: EdgeSupabaseClient,
  message: EmailMessage,
  context: ConversationContext
): Promise<{
  shouldCreate: boolean
  reason: string
  existingEmailId?: string
}> {
  // Vérifier si c'est un followup automatique
  const followupCheck = isAutomatedFollowup(message)
  if (followupCheck.isFollowup) {
    return {
      shouldCreate: false,
      reason: 'automated_followup',
      existingEmailId: followupCheck.trackedEmailId
    }
  }

  // Ne pas créer si c'est une suite de conversation
  if (isConversationContinuation(context, message)) {
    return {
      shouldCreate: false,
      reason: 'conversation_continuation',
      existingEmailId: context.lastTrackedEmail?.id
    }
  }

  // Vérifier si l'email n'est pas déjà tracké
  const { data: existing } = await supabase
    .from('tracked_emails')
    .select('id')
    .eq('internet_message_id', message.internetMessageId)
    .single()

  if (existing) {
    return {
      shouldCreate: false,
      reason: 'already_tracked',
      existingEmailId: existing.id
    }
  }

  // OK pour créer un nouvel email tracké
  return {
    shouldCreate: true,
    reason: 'new_conversation_starter'
  }
}

/**
 * Log les décisions de conversation pour analyse
 */
export async function logConversationDecision(
  supabase: EdgeSupabaseClient,
  message: EmailMessage,
  context: ConversationContext,
  decision: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await supabase
      .from('detection_logs')
      .insert({
        microsoft_message_id: message.id,
        detection_type: 'conversation_analysis',
        detection_successful: decision === 'new_conversation_starter',
        detection_method: 'conversation_tracker',
        confidence_score: context.threadPosition,
        rejection_reason: decision !== 'new_conversation_starter' ? decision : null,
        processing_time_ms: 0,
        metadata: {
          conversationId: context.conversationId,
          threadPosition: context.threadPosition,
          hasExistingTrackedEmails: context.hasExistingTrackedEmails,
          hasReceivedResponse: context.hasReceivedResponse,
          totalMessagesInThread: context.totalMessagesInThread,
          decision,
          details
        }
      })
  } catch (error) {
    console.error('Error logging conversation decision:', error)
  }
}