/**
 * Module de validation de sécurité pour les webhooks Microsoft Graph
 */

import {
  WebhookPayload,
  NotificationWithEncryption,
  SecurityContext
} from './shared-types.ts'
import { timingSafeEqual, logSecurityEvent } from './utils.ts'

/**
 * Valide la sécurité complète du webhook
 */
export async function validateWebhookSecurity(
  req: Request,
  payload: WebhookPayload
): Promise<SecurityContext> {
  try {
    const webhookSecret = Deno.env.get('MICROSOFT_WEBHOOK_SECRET')
    if (!webhookSecret) {
      console.warn('MICROSOFT_WEBHOOK_SECRET not configured')
      return {
        isValid: false,
        validationType: 'clientState',
        failureReason: 'Secret not configured'
      }
    }

    // Vérification du client state si disponible
    if (payload.value && payload.value.length > 0) {
      const clientState = payload.value[0].clientState
      if (clientState !== webhookSecret) {
        console.warn('Invalid client state')
        logSecurityEvent('invalid_client_state', req, { provided: clientState?.substring(0, 5) + '...' })
        return {
          isValid: false,
          validationType: 'clientState',
          failureReason: 'Client state mismatch'
        }
      }
    }

    // Validation de signature selon les recommandations OWASP et Microsoft Graph
    const signatureValid = await validateWebhookSignature(req, payload, webhookSecret)
    if (!signatureValid.isValid) {
      return signatureValid
    }

    return {
      isValid: true,
      metadata: { validationTypes: ['clientState', 'signature'] }
    }
  } catch (error) {
    console.error('Error validating webhook security:', error)
    return {
      isValid: false,
      failureReason: error instanceof Error ? error.message : 'Unknown validation error'
    }
  }
}

/**
 * Valide la signature du webhook selon les recommandations OWASP et Microsoft Graph
 */
async function validateWebhookSignature(
  req: Request,
  payload: WebhookPayload,
  webhookSecret: string
): Promise<SecurityContext> {
  try {
    console.log('[SECURITY] Starting webhook signature validation')

    // 1. Validation des JWT tokens (recommandation Microsoft Graph)
    if (payload.validationTokens && payload.validationTokens.length > 0) {
      console.log('[SECURITY] Validating JWT tokens from payload')

      for (const token of payload.validationTokens) {
        const jwtValidation = validateJWTToken(token)
        if (!jwtValidation.isValid) {
          logSecurityEvent('jwt_validation_failed', req, {
            token: token.substring(0, 20) + '...',
            reason: jwtValidation.failureReason
          })
          return jwtValidation
        }
      }
    }

    // 2. Validation HMAC-SHA256 pour les données chiffrées (recommandation OWASP)
    if (payload.value && payload.value.length > 0) {
      for (const notification of payload.value) {
        const notificationWithEncryption = notification as NotificationWithEncryption
        if (notificationWithEncryption.encryptedContent && notificationWithEncryption.dataSignature) {
          const hmacValidation = await validateHMACSignature(
            notificationWithEncryption.encryptedContent,
            notificationWithEncryption.dataSignature,
            webhookSecret
          )
          if (!hmacValidation) {
            logSecurityEvent('hmac_validation_failed', req, {
              notificationId: notification.resourceData.id
            })
            return {
              isValid: false,
              validationType: 'hmac',
              failureReason: 'HMAC signature validation failed'
            }
          }
        }
      }
    }

    // 3. Protection contre les attaques de replay (timestamp validation)
    const timestamp = req.headers.get('timestamp') || req.headers.get('x-timestamp')
    if (timestamp) {
      const timestampValidation = validateTimestamp(timestamp)
      if (!timestampValidation.isValid) {
        logSecurityEvent('replay_attack_detected', req, {
          timestamp,
          reason: timestampValidation.failureReason
        })
        return timestampValidation
      }
    }

    console.log('[SECURITY] Webhook signature validation successful')
    logSecurityEvent('signature_validation_success', req, {})

    return {
      isValid: true,
      metadata: { allValidationsPassed: true }
    }

  } catch (error) {
    console.error('[SECURITY] Error during signature validation:', error)
    logSecurityEvent('signature_validation_error', req, {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      isValid: false,
      failureReason: 'Signature validation error'
    }
  }
}

/**
 * Valide un JWT token selon les spécifications Microsoft Graph
 */
export function validateJWTToken(token: string): SecurityContext {
  try {
    // Validation basique de la structure JWT
    const parts = token.split('.')
    if (parts.length !== 3) {
      return {
        isValid: false,
        validationType: 'jwt',
        failureReason: 'Invalid JWT structure'
      }
    }

    // Décoder le payload
    const payload = JSON.parse(atob(parts[1]))

    // Vérifier l'expiration
    const exp = payload.exp
    if (!exp || exp <= Math.floor(Date.now() / 1000)) {
      return {
        isValid: false,
        validationType: 'jwt',
        failureReason: 'JWT token expired'
      }
    }

    // Vérifier l'émetteur Microsoft Graph (recommandation Microsoft)
    const azp = payload.azp
    if (azp !== '0bf30f3b-4a52-48df-9a82-234910c4a086') {
      return {
        isValid: false,
        validationType: 'jwt',
        failureReason: `Invalid JWT issuer: ${azp}`
      }
    }

    // Vérifier l'audience (notre webhook URL)
    const webhookBaseUrl = Deno.env.get('MICROSOFT_WEBHOOK_BASE_URL')
    if (webhookBaseUrl && payload.aud && !payload.aud.includes(webhookBaseUrl)) {
      return {
        isValid: false,
        validationType: 'jwt',
        failureReason: 'Invalid JWT audience'
      }
    }

    return {
      isValid: true,
      validationType: 'jwt',
      metadata: { exp: payload.exp, azp: payload.azp }
    }
  } catch (error) {
    console.warn('[SECURITY] JWT token validation error:', error)
    return {
      isValid: false,
      validationType: 'jwt',
      failureReason: 'JWT validation error'
    }
  }
}

/**
 * Valide la signature HMAC-SHA256 selon les recommandations OWASP
 */
async function validateHMACSignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(data)

    // Importer la clé pour HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )

    // Calculer la signature HMAC-SHA256
    const calculatedSignature = await crypto.subtle.sign('HMAC', key, messageData)
    const calculatedSignatureBase64 = btoa(String.fromCharCode(...new Uint8Array(calculatedSignature)))

    // Comparaison sécurisée pour éviter les attaques de timing
    return timingSafeEqual(calculatedSignatureBase64, signature)
  } catch (error) {
    console.warn('[SECURITY] HMAC validation error:', error)
    return false
  }
}

/**
 * Validation de timestamp pour protection contre les attaques de replay
 */
export function validateTimestamp(timestamp: string): SecurityContext {
  try {
    const requestTime = parseInt(timestamp) * 1000 // Convertir en millisecondes
    const currentTime = Date.now()
    const timeDiff = Math.abs(currentTime - requestTime)

    // Fenêtre de tolérance de 5 minutes (recommandation OWASP)
    const tolerance = 5 * 60 * 1000 // 5 minutes en millisecondes

    if (timeDiff > tolerance) {
      return {
        isValid: false,
        validationType: 'timestamp',
        failureReason: `Timestamp outside tolerance window (${timeDiff}ms > ${tolerance}ms)`
      }
    }

    return {
      isValid: true,
      validationType: 'timestamp',
      metadata: { timeDiff, tolerance }
    }
  } catch (error) {
    console.warn('[SECURITY] Timestamp validation error:', error)
    return {
      isValid: false,
      validationType: 'timestamp',
      failureReason: 'Invalid timestamp format'
    }
  }
}

/**
 * Valide un token de validation Microsoft Graph
 */
export function handleValidationChallenge(validationToken: string): Response {
  console.log(`[VALIDATION] Returning validation token: ${validationToken}`)
  return new Response(validationToken, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  })
}