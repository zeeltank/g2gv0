import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'
import type { IntelligenceEnvelope } from '@/types/intelligence'

/**
 * THE INTELLIGENCE CLIENT.
 *
 * One read-only call. Authorisation is the route (`profile:admin,hr`, resolved from the TOKEN OWNER on the server);
 * the profile_id withLaravelParams sends is a UI hint and decides nothing. An employee receives a 403, which the
 * screen renders as "not for your profile" rather than as an empty result.
 */
export const intelligenceService = {
  /** GET /api/intelligence/overview */
  overview: (context: LaravelContext) =>
    apiClient.get<IntelligenceEnvelope>('/intelligence/overview', withLaravelParams(context)),
}
