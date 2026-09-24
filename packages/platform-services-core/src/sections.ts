/**
 * The menu layout, as data.
 *
 * WHY THE LAYOUT IS HERE AND NOT IN THE MENU COMPONENT
 *
 * LMS K-12 folded "Setup & configuration" into Platform Services as a second column
 * rather than leaving it a third peer section, and its reasoning is worth keeping: a
 * reader does not experience "what the platform provides" and "how this tenant is set
 * up" as two different menus — they experience three columns and have to guess which one
 * owns Mobile App Rights. The sub-heading keeps the distinction without making it a
 * top-level choice.
 *
 * Expressing that as data rather than as JSX means the component renders N sections in a
 * loop and never learns any section's name. Adding a third section later is a record
 * here, not a branch there.
 */

import { PLATFORM_SERVICES } from './registry'
import type { PlatformSection, PlatformService } from './types'

export interface MenuColumn {
  /** Rendered as a sub-heading above the column. The first column omits it — the
   *  section's own heading is its heading. */
  label?: string
  items: readonly PlatformService[]
}

export interface MenuSectionLayout {
  id: string
  label: string
  /** The section overview screen, which makes the heading a destination rather than a
   *  decoration. */
  href: string
  /** How many 220px columns the section occupies. */
  span: 1 | 2
  columns: readonly MenuColumn[]
}

export function servicesInSection(section: PlatformSection): readonly PlatformService[] {
  return PLATFORM_SERVICES.filter((service) => service.section === section)
}

/**
 * Platform Services, two columns wide.
 *
 * Computed once at module load from the registry, so a service added there appears here
 * without an edit — the failure mode this whole package exists to remove.
 */
export const PLATFORM_MENU_SECTION: MenuSectionLayout = {
  id: 'platform-services',
  label: 'Platform Services',
  href: '/platform-services',
  span: 2,
  columns: [
    { items: servicesInSection('services') },
    { label: 'Setup & configuration', items: servicesInSection('setup') },
  ],
}
