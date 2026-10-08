'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { platformServicesAccessService } from '@/services/platform/access'
import type { PlatformServicesAccess } from '@/services/platform/access'

export interface PlatformServicesAccessResult {
  modules: PlatformServicesAccess['modules']
  eventBus: boolean
  audit: boolean
  platformAdministration: boolean
  whatsComing: boolean
  documentLibrary: boolean
  ai: PlatformServicesAccess['ai']
  /** At least one of the six module rows — what the unscoped backend calls (e.g. `/api/platform/registry`) also grant on. */
  anyModule: boolean
  loading: boolean
}

const EMPTY_MODULES: PlatformServicesAccess['modules'] = {
  organization: false,
  hrms: false,
  talent: false,
  lms: false,
  competency: false,
  task: false,
}

const EMPTY_AI: PlatformServicesAccess['ai'] = {
  providers: false,
  models: false,
  prompts: false,
  policies: false,
  agents: false,
  conversational: false,
  knowledge_rag: false,
  recommendations: false,
  knowledge_graph: false,
  evaluation: false,
  usage_cost: false,
  audit: false,
}

/**
 * What the signed-in user can actually reach in Platform Services AND AI &
 * Intelligence, from the same tblgroupwise_rights_g2g rows
 * routes/platform.php's and routes/ai.php's `platformright` middleware
 * enforce server-side — not a hardcoded role check. Mirrors
 * useSidebarNavigation's own react-query pattern (same staleTime, same
 * context-derived query key) since it's fetching the same kind of
 * caller-scoped, server-filtered permission data.
 */
export function usePlatformServicesAccess(): PlatformServicesAccessResult {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)

  const query = useQuery({
    queryKey: ['platform-services-access', context.token, context.subInstituteId, context.profileId],
    queryFn: () => platformServicesAccessService.get(context),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  })

  return useMemo(() => {
    const data = query.data?.data
    const modules = data?.modules ?? EMPTY_MODULES

    return {
      modules,
      eventBus: data?.event_bus ?? false,
      audit: data?.audit ?? false,
      platformAdministration: data?.platform_administration ?? false,
      whatsComing: data?.whats_coming ?? false,
      documentLibrary: data?.document_library ?? false,
      ai: data?.ai ?? EMPTY_AI,
      anyModule: Object.values(modules).some(Boolean),
      loading: ready && query.isLoading,
    }
  }, [query.data, query.isLoading, ready])
}
