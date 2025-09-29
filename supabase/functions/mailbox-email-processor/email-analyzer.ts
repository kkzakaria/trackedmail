/**
 * Module d'analyse et classification des emails
 * Responsable de la logique de classification et des utilitaires d'analyse
 */

import { GraphEmail } from './enhanced-processor.ts'
import {
  EdgeSupabaseClient,
  MailboxRow,
  TenantConfig
} from './shared-types.ts'

/**
 * Vérifie si un email doit être exclu (email interne)
 */
export function shouldExcludeEmail(email: GraphEmail, tenantConfig: TenantConfig | null): boolean {
  if (!tenantConfig?.exclude_internal_emails || !tenantConfig.domain) {
    return false
  }

  try {
    const senderDomain = email.sender.emailAddress.address.split('@')[1]
    const tenantDomain = tenantConfig.domain.replace('@', '')

    const isInternal = senderDomain === tenantDomain
    if (isInternal) {
      console.log(`🏢 Excluding internal email from ${email.sender.emailAddress.address}`)
    }
    return isInternal
  } catch (error) {
    console.warn('⚠️ Error checking if email is internal:', error)
    return false
  }
}

/**
 * Classifie un email comme sortant, entrant ou inconnu
 */
export function classifyEmailType(
  email: GraphEmail,
  mailbox: MailboxRow
): 'outgoing' | 'incoming' | 'unknown' {
  try {
    const senderEmail = email.sender.emailAddress.address.toLowerCase()
    const mailboxEmail = mailbox.email_address.toLowerCase()

    // Email sortant: expéditeur est la mailbox
    if (senderEmail === mailboxEmail) {
      return 'outgoing'
    }

    // Email entrant: expéditeur différent de la mailbox
    return 'incoming'

  } catch (error) {
    console.error('❌ Error classifying email type:', error)
    return 'unknown'
  }
}

/**
 * Vérifie si un email existe déjà en base de données
 */
export async function emailExistsInDatabase(
  supabase: EdgeSupabaseClient,
  internetMessageId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('tracked_emails')
      .select('id')
      .eq('internet_message_id', internetMessageId)
      .single()

    return !error && !!data
  } catch (error) {
    console.error('❌ Error checking if email exists:', error)
    return false
  }
}

/**
 * Détecte si un email est une réponse
 */
export function detectIsReply(email: GraphEmail): boolean {
  // 1. Vérifier les headers
  if (email.internetMessageHeaders && email.internetMessageHeaders.length > 0) {
    const replyHeaders = ['In-Reply-To', 'References']
    for (const header of email.internetMessageHeaders) {
      if (replyHeaders.includes(header.name) && header.value) {
        return true
      }
    }
  }

  // 2. Vérifier le sujet pour les préfixes de réponse
  const replyPrefixes = [
    'RE:', 'Re:', 're:', 'Réf:', 'REF:',
    'FW:', 'Fw:', 'fw:', 'TR:', 'Tr:',
    'RES:', 'Res:', 'res:'
  ]

  const subject = email.subject?.trim() || ''
  for (const prefix of replyPrefixes) {
    if (subject.startsWith(prefix)) {
      return true
    }
  }

  // 3. Vérifier la profondeur du conversationIndex
  if (email.conversationIndex) {
    return email.conversationIndex.length > 44
  }

  return false
}

/**
 * Calcule la position d'un message dans un thread
 */
export function calculateThreadPosition(conversationIndex?: string): number {
  if (!conversationIndex) {
    return 1
  }

  try {
    const baseLength = 44
    const replyLength = 10

    if (conversationIndex.length <= baseLength) {
      return 1
    }

    const additionalLength = conversationIndex.length - baseLength
    return Math.floor(additionalLength / replyLength) + 1
  } catch (error) {
    console.warn('⚠️ Error calculating thread position:', error)
    return 1
  }
}

/**
 * Détermine le type de réponse
 */
export function determineResponseType(email: GraphEmail): 'direct_reply' | 'forward' | 'auto_reply' | 'bounce' {
  // Vérifier les auto-replies
  if (isAutoResponse(email)) {
    return 'auto_reply'
  }

  // Vérifier le sujet pour forward
  if (email.subject) {
    const subject = email.subject.toLowerCase()
    const forwardPrefixes = ['fw:', 'fwd:', 'tr:', 'enc:', 'weiterleitung:']

    for (const prefix of forwardPrefixes) {
      if (subject.startsWith(prefix)) {
        return 'forward'
      }
    }
  }

  return 'direct_reply'
}

/**
 * Vérifie si un email est une réponse automatique
 */
export function isAutoResponse(email: GraphEmail): boolean {
  if (!email.internetMessageHeaders || email.internetMessageHeaders.length === 0) {
    return false
  }

  for (const header of email.internetMessageHeaders) {
    const headerName = header.name.toLowerCase()
    const headerValue = header.value?.toLowerCase() || ''

    if (headerName === 'auto-submitted' && headerValue.includes('auto-replied')) {
      return true
    }
    if (headerName === 'x-autoreply' || headerName === 'x-autorespond') {
      return true
    }
    if (headerName === 'x-mailer' && headerValue.includes('auto')) {
      return true
    }
  }

  return false
}