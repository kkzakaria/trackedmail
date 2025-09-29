/**
 * Gestionnaire de mailboxes et récupération de données
 * Responsable de la gestion des mailboxes actives et de l'obtention des tokens d'accès
 */

import {
  EdgeSupabaseClient,
  MailboxRow
} from './shared-types.ts'

/**
 * Récupère les mailboxes actives selon les filtres
 */
export async function getActiveMailboxes(
  supabase: EdgeSupabaseClient,
  mailboxIds?: string[]
): Promise<MailboxRow[]> {
  try {
    console.log('📋 Retrieving active mailboxes...')

    let query = supabase
      .from('mailboxes')
      .select('*')
      .eq('is_active', true)

    if (mailboxIds?.length) {
      query = query.in('id', mailboxIds)
      console.log(`🔍 Filtering by specific mailboxes: ${mailboxIds.join(', ')}`)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    console.log(`✅ Found ${data?.length || 0} active mailboxes`)
    return data || []
  } catch (error) {
    console.error('❌ Error getting active mailboxes:', error)
    throw error
  }
}

/**
 * Obtient un token d'accès Microsoft Graph
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    console.log('🔑 Acquiring Microsoft Graph access token...')

    const tokenResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/microsoft-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        action: 'acquire'
      })
    })

    if (!tokenResponse.ok) {
      console.error('❌ Failed to get access token:', tokenResponse.status)
      return null
    }

    const tokenData = await tokenResponse.json()
    if (!tokenData.success || !tokenData.access_token) {
      console.error('❌ Invalid token response:', tokenData)
      return null
    }

    console.log('✅ Access token acquired successfully')
    return tokenData.access_token
  } catch (error) {
    console.error('❌ Error getting access token:', error)
    return null
  }
}

/**
 * Récupère la configuration tenant
 */
export async function getTenantConfig(supabase: EdgeSupabaseClient): Promise<{
  domain: string
  microsoft_tenant_id: string
  exclude_internal_emails: boolean
} | null> {
  try {
    console.log('⚙️ Retrieving tenant configuration...')

    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'tenant_config')
      .single()

    if (error || !(data as any)?.value) {
      console.warn('⚠️ No tenant config found, using defaults')
      return null
    }

    const config = typeof (data as any).value === 'string'
      ? JSON.parse((data as any).value)
      : (data as any).value

    console.log('✅ Tenant configuration loaded')
    return config
  } catch (error) {
    console.warn('⚠️ Error getting tenant config:', error)
    return null
  }
}