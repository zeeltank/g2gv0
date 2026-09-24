/**
 * The package's public surface.
 *
 * Everything a consumer needs to render a menu entry, a console row or a service page,
 * and nothing that would let one invent a thirteenth service locally.
 */

import { PLATFORM_SERVICES } from './registry'
import type { PlatformService, PlatformServiceStatus } from './types'

export { PLATFORM_SERVICES } from './registry'
export { PLATFORM_MENU_SECTION, servicesInSection } from './sections'
export type { MenuColumn, MenuSectionLayout } from './sections'
export type {
  PlatformDestination,
  PlatformSection,
  PlatformService,
  PlatformServiceStatus,
} from './types'

export function getPlatformService(id: string): PlatformService | undefined {
  return PLATFORM_SERVICES.find((service) => service.id === id)
}

export function getPlatformServiceBySlug(slug: string): PlatformService | undefined {
  return PLATFORM_SERVICES.find((service) => service.slug === slug)
}

/**
 * Where a menu entry or a console row should point.
 *
 * `existing-screen` is deliberately NOT resolved here: a module path differs per
 * deployment and per profile, so it can only be resolved against the signed-in user's
 * own menu tree. This returns the service page for that case, and the caller — which has
 * `useSidebarNavigation()` — substitutes the real path when it can. That way a profile
 * with no rights to the target lands on a page explaining the service rather than on a
 * 404, which is the honest failure.
 */
export function platformServiceHref(service: PlatformService): string {
  const { destination } = service

  if (destination.kind === 'existing-route' || destination.kind === 'own-route') {
    return destination.href
  }

  return `/platform-services/${service.slug}`
}

export function platformStatusCounts(): Record<PlatformServiceStatus, number> {
  return PLATFORM_SERVICES.reduce(
    (counts, service) => {
      counts[service.status] += 1
      return counts
    },
    { live: 0, 'in-progress': 0, 'coming-soon': 0 } as Record<PlatformServiceStatus, number>,
  )
}

/*
 * THERE IS DELIBERATELY NO `platformStatusLabel` HERE.
 *
 * An earlier draft had one, and it was the third place in the repo spelling "Live" /
 * "In progress" / "Coming soon" — beside `capabilityStatusLabel` in
 * `ai-intelligence-core` and the chip itself. Three copies of three words that must
 * agree across screens listing both kinds of record side by side.
 *
 * `components/shared/console-ui.tsx` renders the words, once. A package that also
 * spelled them would be inviting a fourth.
 */
