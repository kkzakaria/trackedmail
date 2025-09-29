/**
 * Types partagés pour Microsoft Subscriptions Edge Function
 */

import { createClient } from '@supabase/supabase-js'

export type EdgeSupabaseClient = ReturnType<typeof createClient>

/**
 * Interface pour les requêtes d'abonnement
 */
export interface SubscriptionRequest {
  action: 'create' | 'renew' | 'delete' | 'list' | 'cleanup'
  mailboxId?: string
  subscriptionId?: string
  userId?: string
  changeTypes?: string[]
  expirationHours?: number
}

/**
 * Interface pour le payload de création d'abonnement
 */
export interface SubscriptionPayload {
  changeType: string
  notificationUrl: string
  resource: string
  expirationDateTime: string
  clientState: string
  includeResourceData: boolean
}

/**
 * Interface pour les abonnements Microsoft Graph
 */
export interface GraphSubscription {
  id: string
  resource: string
  applicationId: string
  changeType: string
  clientState: string
  notificationUrl: string
  lifecycleNotificationUrl?: string
  expirationDateTime: string
  creatorId: string
  includeResourceData: boolean
  latestSupportedTlsVersion: string
}

/**
 * Interface pour les statistiques de santé
 */
export interface SubscriptionHealth {
  total: number
  active: number
  expiringSoon: number
  expired: number
  renewThresholdHours: number
}

/**
 * Configuration par défaut pour les abonnements
 */
export const SUBSCRIPTION_CONFIG = {
  defaultExpirationHours: 72, // Maximum pour Microsoft Graph
  renewBeforeHours: 1,
  maxSubscriptionsPerMailbox: 1,
  changeTypes: ['created'], // On ne s'intéresse qu'aux nouveaux emails
  includeResourceData: false
}