/**
 * "What Platform Services AND AI & Intelligence can I, the signed-in caller,
 * actually reach" — backed by the same tblgroupwise_rights_g2g rows
 * routes/platform.php's and routes/ai.php's `platformright` middleware
 * enforce server-side, not a hardcoded role.
 */

import { webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface PlatformServicesAccess {
  modules: Record<'organization' | 'hrms' | 'talent' | 'lms' | 'competency' | 'task', boolean>
  event_bus: boolean
  audit: boolean
  platform_administration: boolean
  whats_coming: boolean
  document_library: boolean
  ai: Record<
    | 'providers'
    | 'models'
    | 'prompts'
    | 'policies'
    | 'agents'
    | 'conversational'
    | 'knowledge_rag'
    | 'recommendations'
    | 'knowledge_graph'
    | 'evaluation'
    | 'usage_cost'
    | 'audit',
    boolean
  >
}

export interface PlatformServicesAccessResponse {
  status_code: number
  message: string
  data: PlatformServicesAccess
}

export const platformServicesAccessService = {
  get: (context: LaravelContext) =>
    webClient.get<PlatformServicesAccessResponse>(
      '/user/ajax_platform_services_rights_g2g',
      withLaravelParams(context),
    ),
}
