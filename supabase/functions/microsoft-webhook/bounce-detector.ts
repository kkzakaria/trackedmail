/**
 * Bounce Detection Module for Microsoft Graph Webhook
 *
 * Detects and processes Non-Delivery Reports (NDR) / bounce emails
 * to automatically stop followups and maintain sender reputation
 */

import { EdgeSupabaseClient, EmailMessage } from './shared-types.ts'

// NDR Detection Patterns
const NDR_PATTERNS = {
  // Subject patterns that indicate NDR
  subjects: [
    /^Undeliverable:/i,
    /^Mail delivery failed/i,
    /^Delivery Status Notification/i,
    /^Returned mail:/i,
    /^Failure Notice/i,
    /^Mail System Error/i,
    /^Delivery has failed/i,
    /^Non.?remis/i, // French NDR
    /^Non.?recapitabile/i // Italian NDR
  ],

  // Common NDR sender addresses
  senders: [
    'postmaster@',
    'mailer-daemon@',
    'no-reply@',
    'noreply@',
    'MAILER-DAEMON@',
    'Mail Delivery System',
    'Mail Delivery Subsystem',
    'Internet Mail Delivery'
  ],

  // Content types that indicate NDR
  contentTypes: [
    'multipart/report',
    'message/delivery-status',
    'message/disposition-notification'
  ],

  // Headers that indicate NDR
  headers: {
    'X-Failed-Recipients': true,
    'X-MS-Exchange-Message-Is-Ndr': true,
    'Auto-Submitted': 'auto-replied',
    'X-Autoreply': 'yes'
  } as { [key: string]: boolean | string }
}

// SMTP Status Code Analysis
const SMTP_CODE_PATTERNS: Record<string, BounceClassification> = {
  // Permanent failures (5.x.x) - Hard bounces
  '5.1': { type: 'hard', category: 'invalid_recipient', description: 'Invalid recipient address' },
  '5.2.1': { type: 'hard', category: 'invalid_recipient', description: 'Mailbox disabled' },
  '5.2.2': { type: 'soft', category: 'mailbox_full', description: 'Mailbox full' },
  '5.2.3': { type: 'soft', category: 'message_too_large', description: 'Message too large' },
  '5.3': { type: 'hard', category: 'invalid_recipient', description: 'Mail system error' },
  '5.4': { type: 'hard', category: 'network_error', description: 'Unable to route' },
  '5.5': { type: 'hard', category: 'other', description: 'Protocol error' },
  '5.7.1': { type: 'hard', category: 'spam_rejection', description: 'Message rejected as spam' },
  '5.7': { type: 'hard', category: 'policy_rejection', description: 'Security/Policy rejection' },

  // Temporary failures (4.x.x) - Soft bounces
  '4.2.1': { type: 'soft', category: 'temporary_failure', description: 'Mailbox temporarily disabled' },
  '4.2.2': { type: 'soft', category: 'mailbox_full', description: 'Mailbox full (temporary)' },
  '4.3': { type: 'soft', category: 'temporary_failure', description: 'Mail system congestion' },
  '4.4': { type: 'soft', category: 'network_error', description: 'Network timeout' },
  '4.5': { type: 'soft', category: 'temporary_failure', description: 'Mail system congestion' },
  '4.7': { type: 'soft', category: 'temporary_failure', description: 'Temporary authentication failure' }
}

export interface BounceClassification {
  type: 'hard' | 'soft' | 'unknown'
  category: string
  description: string
}

export interface BounceDetectionResult {
  isNDR: boolean
  confidence: number
  bounceType?: 'hard' | 'soft' | 'unknown'
  bounceCategory?: string
  bounceCode?: string
  bounceReason?: string
  failedRecipients?: string[]
  originalEmailId?: string
  diagnosticCode?: string
  reportingMTA?: string
}

/**
 * Main function to detect if an email is an NDR/bounce
 */
export async function detectBounce(
  supabase: EdgeSupabaseClient,
  messageDetails: EmailMessage
): Promise<BounceDetectionResult> {
  console.log(`🔍 Checking if email is NDR: ${messageDetails.subject}`)

  // Check multiple indicators
  const subjectMatch = checkSubjectPatterns(messageDetails.subject)
  const senderMatch = checkSenderPatterns(messageDetails.sender.emailAddress.address, messageDetails.sender.emailAddress.name)
  const contentTypeMatch = checkContentType(messageDetails)
  const headerMatch = checkHeaders(messageDetails)

  // Calculate confidence score
  let confidence = 0
  if (subjectMatch) confidence += 40
  if (senderMatch) confidence += 30
  if (contentTypeMatch) confidence += 20
  if (headerMatch) confidence += 10

  const isNDR = confidence >= 50

  if (!isNDR) {
    return {
      isNDR: false,
      confidence
    }
  }

  console.log(`✅ NDR detected with ${confidence}% confidence`)

  // Extract bounce details
  const bounceDetails = await extractBounceDetails(messageDetails)

  // Find the original tracked email
  const originalEmailId = await findOriginalTrackedEmail(supabase, messageDetails, bounceDetails)

  return {
    isNDR: true,
    confidence,
    ...bounceDetails,
    originalEmailId
  }
}

/**
 * Check if subject matches NDR patterns
 */
function checkSubjectPatterns(subject: string): boolean {
  if (!subject) return false
  return NDR_PATTERNS.subjects.some(pattern => pattern.test(subject))
}

/**
 * Check if sender matches NDR patterns
 */
function checkSenderPatterns(email: string, name?: string): boolean {
  if (!email) return false

  const lowerEmail = email.toLowerCase()
  const lowerName = (name || '').toLowerCase()

  return NDR_PATTERNS.senders.some(pattern => {
    const lowerPattern = pattern.toLowerCase()
    return lowerEmail.includes(lowerPattern) ||
           lowerEmail.startsWith(lowerPattern) ||
           lowerName.includes(lowerPattern)
  })
}

/**
 * Check content type headers
 */
function checkContentType(messageDetails: EmailMessage): boolean {
  // Check main content type
  if (messageDetails.body?.contentType) {
    const contentType = messageDetails.body.contentType.toLowerCase()
    if (NDR_PATTERNS.contentTypes.some(ct => contentType.includes(ct))) {
      return true
    }
  }

  // Check internet headers if available
  if (messageDetails.internetMessageHeaders) {
    const contentTypeHeader = messageDetails.internetMessageHeaders.find(
      h => h.name.toLowerCase() === 'content-type'
    )
    if (contentTypeHeader) {
      const value = contentTypeHeader.value.toLowerCase()
      return NDR_PATTERNS.contentTypes.some(ct => value.includes(ct))
    }
  }

  return false
}

/**
 * Check for NDR-specific headers
 */
function checkHeaders(messageDetails: EmailMessage): boolean {
  if (!messageDetails.internetMessageHeaders) return false

  return messageDetails.internetMessageHeaders.some(header => {
    const headerName = header.name
    const headerValue = header.value

    // Check specific NDR headers
    if (NDR_PATTERNS.headers[headerName]) {
      if (typeof NDR_PATTERNS.headers[headerName] === 'string') {
        return headerValue === NDR_PATTERNS.headers[headerName]
      }
      return true
    }

    // Check for Exchange NDR header
    if (headerName === 'X-MS-Exchange-Message-Is-Ndr' && headerValue === 'True') {
      return true
    }

    return false
  })
}

/**
 * Extract detailed bounce information from the NDR
 */
function extractBounceDetails(messageDetails: EmailMessage): Partial<BounceDetectionResult> {
  const bodyText = messageDetails.bodyPreview || messageDetails.body?.content || ''

  // Extract SMTP status code
  const smtpCodeMatch = bodyText.match(/\b([45]\.\d+\.\d+)\b/)
  const bounceCode = smtpCodeMatch ? smtpCodeMatch[1] : undefined

  // Classify the bounce type
  const classification = classifyBounce(bounceCode, bodyText)

  // Extract failed recipients
  const failedRecipients = extractFailedRecipients(messageDetails, bodyText)

  // Extract diagnostic code
  const diagnosticCode = extractDiagnosticCode(bodyText)

  // Extract reporting MTA
  const reportingMTA = extractReportingMTA(bodyText)

  // Extract reason
  const bounceReason = extractBounceReason(bodyText, classification.description)

  return {
    bounceType: classification.type,
    bounceCategory: classification.category,
    bounceCode,
    bounceReason,
    failedRecipients,
    diagnosticCode,
    reportingMTA
  }
}

/**
 * Classify bounce based on SMTP code and content
 */
function classifyBounce(smtpCode: string | undefined, bodyText: string): BounceClassification {
  if (smtpCode) {
    // Try exact match first
    if (SMTP_CODE_PATTERNS[smtpCode]) {
      return SMTP_CODE_PATTERNS[smtpCode]
    }

    // Try prefix match (e.g., 5.1 for 5.1.1)
    const prefix = smtpCode.substring(0, 3)
    if (SMTP_CODE_PATTERNS[prefix]) {
      return SMTP_CODE_PATTERNS[prefix]
    }

    // Generic classification based on first digit
    if (smtpCode.startsWith('5')) {
      return { type: 'hard', category: 'other', description: 'Permanent failure' }
    } else if (smtpCode.startsWith('4')) {
      return { type: 'soft', category: 'temporary_failure', description: 'Temporary failure' }
    }
  }

  // Analyze body text for patterns
  const lowerBody = bodyText.toLowerCase()

  if (lowerBody.includes('user unknown') ||
      lowerBody.includes('no such user') ||
      lowerBody.includes('recipient address rejected')) {
    return { type: 'hard', category: 'invalid_recipient', description: 'Recipient does not exist' }
  }

  if (lowerBody.includes('mailbox full') ||
      lowerBody.includes('over quota') ||
      lowerBody.includes('insufficient storage')) {
    return { type: 'soft', category: 'mailbox_full', description: 'Mailbox full' }
  }

  if (lowerBody.includes('spam') ||
      lowerBody.includes('blocked') ||
      lowerBody.includes('rejected')) {
    return { type: 'hard', category: 'spam_rejection', description: 'Message rejected' }
  }

  if (lowerBody.includes('temporary') ||
      lowerBody.includes('try again') ||
      lowerBody.includes('retry')) {
    return { type: 'soft', category: 'temporary_failure', description: 'Temporary failure' }
  }

  return { type: 'unknown', category: 'other', description: 'Unknown bounce reason' }
}

/**
 * Extract failed recipient addresses
 */
function extractFailedRecipients(messageDetails: EmailMessage, bodyText: string): string[] {
  const recipients: string[] = []

  // Check To recipients (NDRs often put failed address here)
  if (messageDetails.toRecipients) {
    messageDetails.toRecipients.forEach(recipient => {
      if (recipient.emailAddress.address) {
        recipients.push(recipient.emailAddress.address)
      }
    })
  }

  // Check X-Failed-Recipients header
  if (messageDetails.internetMessageHeaders) {
    const failedRecipientsHeader = messageDetails.internetMessageHeaders.find(
      h => h.name === 'X-Failed-Recipients'
    )
    if (failedRecipientsHeader) {
      const addresses = failedRecipientsHeader.value.split(/[,;]/).map(a => a.trim())
      recipients.push(...addresses)
    }
  }

  // Extract from body using regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  const bodyEmails = bodyText.match(emailRegex) || []

  // Filter to likely failed recipients (not sender addresses)
  const filteredEmails = bodyEmails.filter(email => {
    const lower = email.toLowerCase()
    return !lower.includes('postmaster') &&
           !lower.includes('mailer-daemon') &&
           !lower.includes('no-reply')
  })

  recipients.push(...filteredEmails)

  // Remove duplicates
  return [...new Set(recipients)]
}

/**
 * Extract diagnostic code from bounce message
 */
function extractDiagnosticCode(bodyText: string): string | undefined {
  // Look for diagnostic code patterns
  const patterns = [
    /Diagnostic[- ]Code:?\s*(.+?)(?:\n|$)/i,
    /Diagnostic:?\s*(.+?)(?:\n|$)/i,
    /Remote[- ]MTA[- ]diagnostic:?\s*(.+?)(?:\n|$)/i
  ]

  for (const pattern of patterns) {
    const match = bodyText.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return undefined
}

/**
 * Extract reporting MTA
 */
function extractReportingMTA(bodyText: string): string | undefined {
  // Look for reporting MTA patterns
  const patterns = [
    /Reporting[- ]MTA:?\s*(?:dns;)?(.+?)(?:\n|$)/i,
    /Remote[- ]MTA:?\s*(?:dns;)?(.+?)(?:\n|$)/i,
    /Received[- ]From[- ]MTA:?\s*(?:dns;)?(.+?)(?:\n|$)/i
  ]

  for (const pattern of patterns) {
    const match = bodyText.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return undefined
}

/**
 * Extract human-readable bounce reason
 */
function extractBounceReason(bodyText: string, defaultReason: string): string {
  // Look for action/status lines
  const actionMatch = bodyText.match(/Action:\s*(.+?)(?:\n|$)/i)
  const statusMatch = bodyText.match(/Status:\s*(.+?)(?:\n|$)/i)

  if (actionMatch && statusMatch) {
    return `${actionMatch[1]} - ${statusMatch[1]}`
  }

  // Look for common error messages
  const errorPatterns = [
    /The following message .+? could not be delivered/i,
    /Your message .+? could not be delivered/i,
    /Delivery to .+? failed/i,
    /Message blocked/i,
    /User unknown/i,
    /Mailbox full/i
  ]

  for (const pattern of errorPatterns) {
    const match = bodyText.match(pattern)
    if (match) {
      return match[0]
    }
  }

  return defaultReason
}

/**
 * Find the original tracked email that bounced
 */
async function findOriginalTrackedEmail(
  supabase: EdgeSupabaseClient,
  ndrMessage: EmailMessage,
  bounceDetails: Partial<BounceDetectionResult>
): Promise<string | undefined> {
  // Strategy 1: Check if NDR is a reply to original message
  if (ndrMessage.conversationId) {
    const { data: trackedEmail } = await supabase
      .from('tracked_emails')
      .select('id')
      .eq('conversation_id', ndrMessage.conversationId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    if (trackedEmail) {
      console.log(`Found original email via conversation ID: ${trackedEmail.id}`)
      return trackedEmail.id
    }
  }

  // Strategy 2: Check InReplyTo header
  if (ndrMessage.internetMessageHeaders) {
    const inReplyToHeader = ndrMessage.internetMessageHeaders.find(
      h => h.name.toLowerCase() === 'in-reply-to'
    )

    if (inReplyToHeader) {
      const messageId = inReplyToHeader.value.replace(/[<>]/g, '')
      const { data: trackedEmail } = await supabase
        .from('tracked_emails')
        .select('id')
        .eq('internet_message_id', messageId)
        .single()

      if (trackedEmail) {
        console.log(`Found original email via In-Reply-To header: ${trackedEmail.id}`)
        return trackedEmail.id
      }
    }
  }

  // Strategy 3: Match by recipient email (if we have failed recipients)
  if (bounceDetails.failedRecipients && bounceDetails.failedRecipients.length > 0) {
    // Look for recent email to this recipient
    const { data: trackedEmails } = await supabase
      .from('tracked_emails')
      .select('id, subject, sent_at')
      .contains('recipient_emails', bounceDetails.failedRecipients)
      .eq('status', 'pending')
      .order('sent_at', { ascending: false })
      .limit(1)

    if (trackedEmails && trackedEmails.length > 0) {
      console.log(`Found original email via recipient match: ${trackedEmails[0].id}`)
      return trackedEmails[0].id
    }
  }

  // Strategy 4: Parse subject for original subject
  const subjectMatch = ndrMessage.subject.match(/Undeliverable:\s*(.+)/i)
  if (subjectMatch) {
    const originalSubject = subjectMatch[1]
    const { data: trackedEmail } = await supabase
      .from('tracked_emails')
      .select('id')
      .eq('subject', originalSubject)
      .eq('status', 'pending')
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    if (trackedEmail) {
      console.log(`Found original email via subject match: ${trackedEmail.id}`)
      return trackedEmail.id
    }
  }

  console.log('Could not find original tracked email for NDR')
  return undefined
}

/**
 * Process and store bounce information
 */
export async function processBounce(
  supabase: EdgeSupabaseClient,
  messageDetails: EmailMessage,
  bounceResult: BounceDetectionResult
): Promise<void> {
  if (!bounceResult.isNDR) return

  try {
    // Store bounce record
    const bounceData = {
      tracked_email_id: bounceResult.originalEmailId || null,
      microsoft_message_id: messageDetails.id,
      bounce_type: bounceResult.bounceType || 'unknown',
      bounce_code: bounceResult.bounceCode,
      bounce_category: bounceResult.bounceCategory || 'other',
      bounce_reason: bounceResult.bounceReason,
      failed_recipients: bounceResult.failedRecipients || [],
      diagnostic_code: bounceResult.diagnosticCode,
      reporting_mta: bounceResult.reportingMTA,
      original_subject: extractOriginalSubject(messageDetails.subject),
      ndr_sender: messageDetails.sender.emailAddress.address,
      ndr_received_at: messageDetails.sentDateTime,
      ndr_headers: {
        message_id: messageDetails.id,
        conversation_id: messageDetails.conversationId,
        internet_message_id: messageDetails.internetMessageId
      },
      processed: bounceResult.originalEmailId ? true : false,
      processed_at: bounceResult.originalEmailId ? new Date().toISOString() : null
    }

    const { error } = await supabase
      .from('email_bounces')
      .insert(bounceData)

    if (error) {
      console.error('Failed to store bounce record:', error)
      // Don't throw - we don't want to fail the whole webhook processing
    } else {
      console.log(`✅ Bounce record stored for ${bounceResult.originalEmailId || 'unknown email'}`)
    }

  } catch (error) {
    console.error('Error processing bounce:', error)
  }
}

/**
 * Extract original subject from NDR subject
 */
function extractOriginalSubject(ndrSubject: string): string {
  // Remove common NDR prefixes
  const prefixes = [
    'Undeliverable:',
    'Mail delivery failed:',
    'Returned mail:',
    'Delivery Status Notification:',
    'Failure Notice:'
  ]

  let subject = ndrSubject
  for (const prefix of prefixes) {
    if (subject.startsWith(prefix)) {
      subject = subject.substring(prefix.length).trim()
      break
    }
  }

  return subject
}