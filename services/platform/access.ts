/**
 * "What Platform Services can I, the signed-in caller, actually reach" —
 * backed by the same tblgroupwise_rights_g2g rows routes/platform.php's
 * `platformright` middleware enforces server-side, not a hardcoded role.
 */

import { webClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface PlatformServicesAccess {
  modules: Record<'organization' | 'hrms' | 'talent' | 'lms' | 'competency' | 'task', boolean>
  event_bus: boolean
  audit: boolean
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
