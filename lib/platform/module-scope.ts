/**
 * Which Platform Services module a screen belongs to, worked out from the menu and the address
 * alone: no AI Stack descriptor, no database.
 *
 * WHY THIS EXISTS. The top bar scopes itself (label "ORGANISATION", every link `?module=organization`)
 * from `useActiveModule().platformKey`, and that key used to come ONLY from the AI Stack descriptor
 * table (`lib/ai-stack/central.ts`). Sales & Marketing has no descriptor (it has no `ai_modules` row),
 * so its key was always `null` and the bar fell back to the central "Platform services" view, with
 * links that carried no `?module=`. The scope of a module is a fact about the menu, not about whether
 * the module has an AI Stack, so it is answered here, from the level-1 menu link.
 *
 * Pure and dependency-free on purpose (type-only imports), so it can be tested without a browser.
 */

import type { DecentralizedModuleKey } from './access-links'

/** `/module/<slug>/...` is the shape of every level-1 menu link; the slug names the module. */
const PLATFORM_KEY_BY_MODULE_SLUG: Readonly<Record<string, DecentralizedModuleKey>> = {
  'organizational-management': 'organization',
  'hrit-solutions': 'hrms',
  'talent-management': 'talent',
  lms: 'lms',
  'capability-intelligence': 'competency',
  'task-management': 'task',
  crm: 'crm',
}

/** The module a level-1 menu link belongs to (`/module/crm` -> `crm`), or `null` for a module outside Platform Services. */
export function platformKeyForMenuLink(accessLink: string | null | undefined): DecentralizedModuleKey | null {
  const slug = /^\/module\/([^/?#]+)/.exec(accessLink ?? '')?.[1]

  return slug ? (PLATFORM_KEY_BY_MODULE_SLUG[slug] ?? null) : null
}

/**
 * Screens of Sales & Marketing that do not live under `/module/crm`: the GTM screens, Market Signals and
 * its family (`lib/signals-nav.ts`). Used before the menu tree has loaded, so the bar is scoped from the
 * first paint instead of flashing "Platform services".
 */
export const CRM_PATH_PREFIXES = ['/module/crm', '/gtm', '/signals', '/ingestion', '/portfolio', '/partners', '/signal-review'] as const

/** True for the prefix itself and for anything below it (`/gtm` and `/gtm/outreach`, never `/gtmx`). */
export function isCrmPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false

  return CRM_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/** The id of the menu module that belongs to a Platform Services key, from the live tree, or `null` when the tree has none. */
export function moduleIdForPlatformKey(
  modules: ReadonlyArray<{ id: string; accessLink?: string | null }>,
  key: DecentralizedModuleKey,
): string | null {
  return modules.find((candidate) => platformKeyForMenuLink(candidate.accessLink) === key)?.id ?? null
}
