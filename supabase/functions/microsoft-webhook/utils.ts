/**
 * Fonctions utilitaires pour le webhook Microsoft Graph
 */

/**
 * Comparaison sécurisée pour éviter les attaques de timing (recommandation OWASP)
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Log des événements de sécurité pour traçabilité et monitoring
 */
export function logSecurityEvent(
  eventType: string,
  req: Request,
  details: Record<string, unknown>
): void {
  const securityLog = {
    timestamp: new Date().toISOString(),
    event_type: eventType,
    ip_address: req.headers.get('X-Forwarded-For') || req.headers.get('CF-Connecting-IP') || 'unknown',
    user_agent: req.headers.get('User-Agent') || 'unknown',
    url: req.url,
    details
  }

  console.log('[SECURITY_LOG]', JSON.stringify(securityLog))
}

/**
 * Nettoie le sujet d'un email (enlève les préfixes de réponse/transfert)
 */
export function cleanSubject(subject: string): string {
  return subject
    .replace(/^(RE:|FW:|FWD:|TR:|Réf:|REF:|RES:|Res:|res:)\s*/gi, '')
    .replace(/^\[.*?\]\s*/, '') // Enlever les tags
    .trim()
}

/**
 * Parse les références d'un header References
 */
export function parseReferences(references: string): string[] {
  return references
    .split(/\s+/)
    .map(ref => ref.trim())
    .filter(ref => ref.length > 0)
}

/**
 * Calcule la position d'un message dans un thread de conversation
 * Basé sur le conversationIndex Microsoft
 */
export function calculateThreadPosition(conversationIndex?: string): number {
  if (!conversationIndex) {
    return 1
  }

  try {
    // Le conversationIndex Microsoft utilise un format spécifique :
    // - 22 bytes (44 caractères hex) pour le message initial
    // - 5 bytes supplémentaires (10 caractères) pour chaque réponse
    const baseLength = 44
    const replyLength = 10

    if (conversationIndex.length <= baseLength) {
      return 1 // Message initial
    }

    // Calculer le nombre de réponses
    const additionalLength = conversationIndex.length - baseLength
    const position = Math.floor(additionalLength / replyLength) + 1

    console.log(`Thread position calculated: ${position} (index length: ${conversationIndex.length})`)
    return position

  } catch (error) {
    console.warn('Error calculating thread position:', error)
    return 1
  }
}

/**
 * Extrait les identifiants depuis une resource Microsoft Graph
 * Format: /users/{userId}/messages/{messageId}
 */
export function extractResourceIdentifiers(resource: string): { userId?: string; messageId?: string } {
  const resourceParts = resource.split('/')
  const userIdIndex = resourceParts.findIndex(part => part.toLowerCase() === 'users') + 1
  const messageIdIndex = resourceParts.findIndex(part => part.toLowerCase() === 'messages') + 1

  return {
    userId: userIdIndex > 0 ? resourceParts[userIdIndex] : undefined,
    messageId: messageIdIndex > 0 ? resourceParts[messageIdIndex] : undefined
  }
}

/**
 * Vérifie si un header existe dans la liste des headers
 */
export function hasHeader(headers: Array<{name: string, value: string}> | undefined, headerName: string): boolean {
  if (!headers) return false
  return headers.some(h => h.name.toLowerCase() === headerName.toLowerCase())
}

/**
 * Récupère la valeur d'un header
 */
export function getHeaderValue(headers: Array<{name: string, value: string}> | undefined, headerName: string): string | null {
  if (!headers) return null
  const header = headers.find(h => h.name.toLowerCase() === headerName.toLowerCase())
  return header?.value || null
}

/**
 * Détermine si un sujet indique une réponse
 */
export function hasReplyPrefix(subject: string): boolean {
  const replyPrefixes = [
    'RE:', 'Re:', 're:', 'Réf:', 'REF:',
    'RES:', 'Res:', 'res:'
  ]

  const trimmedSubject = subject.trim()
  return replyPrefixes.some(prefix => trimmedSubject.startsWith(prefix))
}

/**
 * Détermine si un sujet indique un forward
 */
export function hasForwardPrefix(subject: string): boolean {
  const forwardPrefixes = [
    'FW:', 'Fw:', 'fw:', 'FWD:', 'Fwd:', 'fwd:',
    'TR:', 'Tr:', 'tr:', 'ENC:', 'Enc:', 'enc:',
    'WEITERLEITUNG:', 'Weiterleitung:', 'weiterleitung:'
  ]

  const trimmedSubject = subject.trim()
  return forwardPrefixes.some(prefix => trimmedSubject.startsWith(prefix))
}

/**
 * Formatte un timestamp pour les logs
 */
export function formatLogTimestamp(date: Date = new Date()): string {
  return date.toISOString()
}

/**
 * Calcule le temps écoulé en millisecondes
 */
export function getElapsedTime(startTime: number): number {
  return Date.now() - startTime
}

/**
 * Calcule la distance de Levenshtein entre 2 chaînes
 * (nombre minimal d'opérations pour transformer s1 en s2)
 */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length
  const len2 = s2.length

  // Optimisation: si une des chaînes est vide
  if (len1 === 0) return len2
  if (len2 === 0) return len1

  // Matrice de programmation dynamique
  const matrix: number[][] = []

  // Initialisation de la première ligne et colonne
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Remplissage de la matrice
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Suppression
        matrix[i][j - 1] + 1,      // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * Calcule la similarité entre 2 sujets d'emails (0-1)
 * Utilise l'algorithme Levenshtein normalisé
 *
 * @returns Valeur entre 0 (aucune similarité) et 1 (identique)
 */
export function calculateSubjectSimilarity(subject1: string, subject2: string): number {
  // Normaliser les sujets (minuscules, trim)
  const s1 = subject1.toLowerCase().trim()
  const s2 = subject2.toLowerCase().trim()

  // Cas identiques
  if (s1 === s2) return 1.0

  // Cas vides
  if (s1.length === 0 || s2.length === 0) return 0.0

  // Calculer la distance de Levenshtein
  const distance = levenshteinDistance(s1, s2)
  const maxLength = Math.max(s1.length, s2.length)

  // Normaliser: 1 - (distance / longueur max)
  const similarity = 1 - (distance / maxLength)

  return Math.max(0, Math.min(1, similarity)) // Clamp entre 0 et 1
}

/**
 * Calcule un bonus basé sur la proximité temporelle
 * - < 24h: 100% (1.0)
 * - < 72h: 50% (0.5)
 * - < 168h (7j): 25% (0.25)
 * - > 7j: 0% (0)
 *
 * @returns Valeur entre 0 et 1
 */
export function calculateTimingBonus(sentDate: Date, receivedDate: Date): number {
  const hoursDiff = Math.abs(receivedDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60)

  if (hoursDiff < 24) {
    return 1.0 // Réponse dans les 24h
  } else if (hoursDiff < 72) {
    return 0.5 // Réponse dans les 72h
  } else if (hoursDiff < 168) {
    return 0.25 // Réponse dans les 7 jours
  } else {
    return 0.0 // Trop vieux
  }
}