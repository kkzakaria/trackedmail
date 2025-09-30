/**
 * Gestion de la configuration pour followup-processor
 * Récupération des paramètres système et templates
 */

import type { EdgeSupabaseClient } from './shared-types.ts'
import type { FollowupConfig, FollowupTemplate } from './shared-types.ts'

/**
 * Récupère la configuration du système de relances depuis system_config
 * @param supabase Client Supabase avec droits service
 * @returns Configuration des followups
 * @throws Error si la récupération échoue
 */
export async function getFollowupConfig(supabase: EdgeSupabaseClient): Promise<FollowupConfig> {
  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'followup_settings')
    .single()

  if (error) {
    throw new Error(`Failed to get followup config: ${error.message}`)
  }

  return data.value as FollowupConfig
}

/**
 * Vérifie si le système de relances est activé
 * @param supabase Client Supabase avec droits service
 * @returns true si le système est activé, false sinon
 */
export async function checkFollowupSystemEnabled(supabase: EdgeSupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'followup_settings')
      .single()

    if (error) {
      console.error('Failed to check followup system status:', error)
      return false
    }

    const settings = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
    return settings.enabled !== false
  } catch (error) {
    console.error('Error parsing followup settings:', error)
    return false
  }
}

/**
 * Récupère les templates de relance actifs
 * @param supabase Client Supabase avec droits service
 * @returns Liste des templates actifs triés par numéro de relance
 * @throws Error si la récupération échoue
 */
export async function getActiveTemplates(supabase: EdgeSupabaseClient): Promise<FollowupTemplate[]> {
  const { data, error } = await supabase
    .from('followup_templates')
    .select('*')
    .eq('is_active', true)
    .order('followup_number', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`)
  }

  return data || []
}