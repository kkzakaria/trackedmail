/**
 * Module de classification des emails
 */

import {
  EdgeSupabaseClient,
  EmailMessage,
  EmailClassification,
  TenantConfig,
  MailboxRow
} from './shared-types.ts'

/**
 * Classifie un email comme sortant, entrant ou inconnu
 */
export function classifyEmailType(
  messageDetails: EmailMessage,
  mailbox: MailboxRow
): EmailClassification {
  try {
    const senderEmail = messageDetails.sender.emailAddress.address.toLowerCase()
    const mailboxEmail = mailbox.email_address.toLowerCase()

    // Méthode 1: Vérifier si l'expéditeur est la mailbox elle-même (email sortant)
    if (senderEmail === mailboxEmail) {
      console.log(`Email classified as outgoing (sender matches mailbox): ${senderEmail}`)
      return 'outgoing'
    }

    // Méthode 2: Vérifier le domaine pour les emails internes
    const senderDomain = extractDomain(senderEmail)
    const mailboxDomain = extractDomain(mailboxEmail)

    // Si même domaine et expéditeur différent, c'est probablement entrant
    if (senderDomain === mailboxDomain && senderEmail !== mailboxEmail) {
      console.log(`Email classified as incoming (same domain, different sender): ${senderEmail}`)
      return 'incoming'
    }

    // Méthode 3: Email externe - probablement entrant (réponse)
    if (senderDomain !== mailboxDomain) {
      console.log(`Email classified as incoming (external sender): ${senderEmail}`)
      return 'incoming'
    }

    console.log(`Unable to classify email: sender=${senderEmail}, mailbox=${mailboxEmail}`)
    return 'unknown'

  } catch (error) {
    console.error('Error classifying email type:', error)
    return 'unknown'
  }
}

/**
 * Vérifie si un email doit être exclu (email interne)
 */
export async function shouldExcludeEmail(
  supabase: EdgeSupabaseClient,
  message: EmailMessage
): Promise<boolean> {
  try {
    // Récupérer la configuration du tenant
    const tenantConfig = await getTenantConfig(supabase)
    if (!tenantConfig) {
      return false
    }

    if (!tenantConfig.exclude_internal_emails || !tenantConfig.domain) {
      return false
    }

    // Vérifier si l'expéditeur est interne
    const senderDomain = extractDomain(message.sender.emailAddress.address)
    const tenantDomain = tenantConfig.domain.replace('@', '')

    if (senderDomain === tenantDomain) {
      console.log(`Email excluded: internal email from ${message.sender.emailAddress.address}`)
      return true
    }

    return false
  } catch (error) {
    console.warn('Error checking if email should be excluded:', error)
    return false
  }
}

/**
 * Récupère la configuration du tenant
 */
export async function getTenantConfig(
  supabase: EdgeSupabaseClient
): Promise<TenantConfig | null> {
  try {
    const { data: config } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'tenant_config')
      .single()

    if (!config?.value) {
      return null
    }

    const tenantConfig: TenantConfig = typeof config.value === 'string'
      ? JSON.parse(config.value)
      : config.value

    return tenantConfig
  } catch (error) {
    console.error('Error getting tenant config:', error)
    return null
  }
}

/**
 * Vérifie si un email est interne au tenant
 */
export function isInternalEmail(
  message: EmailMessage,
  tenantDomain: string
): boolean {
  const senderDomain = extractDomain(message.sender.emailAddress.address)
  const cleanTenantDomain = tenantDomain.replace('@', '')
  return senderDomain === cleanTenantDomain
}

/**
 * Extrait le domaine d'une adresse email
 */
function extractDomain(email: string): string {
  const parts = email.toLowerCase().split('@')
  return parts.length === 2 ? parts[1] : ''
}

/**
 * Détermine si un email est une notification système
 */
export function isSystemNotification(message: EmailMessage): boolean {
  const systemSenders = [
    'postmaster',
    'mailer-daemon',
    'noreply',
    'no-reply',
    'donotreply',
    'do-not-reply',
    'automated',
    'system',
    'notification'
  ]

  const senderEmail = message.sender.emailAddress.address.toLowerCase()
  const senderName = message.sender.emailAddress.name.toLowerCase()

  return systemSenders.some(pattern =>
    senderEmail.includes(pattern) || senderName.includes(pattern)
  )
}

/**
 * Détermine si un email est une réponse automatique
 */
export function isAutoReply(message: EmailMessage): boolean {
  if (!message.internetMessageHeaders) {
    return false
  }

  // Headers spécifiques aux réponses automatiques
  const autoReplyHeaders = [
    'Auto-Submitted',
    'X-Autoreply',
    'X-Autorespond',
    'X-Auto-Response-Suppress',
    'Precedence'
  ]

  for (const header of message.internetMessageHeaders) {
    const headerName = header.name.toLowerCase()
    const headerValue = header.value?.toLowerCase() || ''

    // Vérifier les headers d'auto-reply
    if (headerName === 'auto-submitted' && headerValue !== 'no') {
      return true
    }
    if (headerName === 'x-autoreply' && headerValue === 'yes') {
      return true
    }
    if (headerName === 'precedence' && (headerValue === 'bulk' || headerValue === 'auto_reply')) {
      return true
    }
    if (headerName === 'x-auto-response-suppress') {
      return true
    }
  }

  // Vérifier les patterns dans le sujet
  const autoPatterns = [
    /out of office/i,
    /automatic reply/i,
    /auto.?reply/i,
    /vacation/i,
    /absence/i,
    /absent/i,
    /away from/i
  ]

  return autoPatterns.some(pattern => pattern.test(message.subject))
}