/**
 * Where Intelligence is reached from the shell.
 *
 * It lives in the PLATFORM SERVICES bar (components/shell/platform-services-subheader.tsx), next to Workflows, Schedules, Integrations and the other
 * platform consoles. It is NOT in the sidebar: the sidebar is exactly what the server sent, and nothing is added to it.
 */
export const INTELLIGENCE_LINK = '/intelligence'

export function isGlobalIntelligencePath(pathname: string | null | undefined): boolean {
  return isIntelligencePath(pathname) && !pathname?.startsWith(`${INTELLIGENCE_LINK}/module/`)
}

export function moduleIntelligencePath(key: string): string {
  return `${INTELLIGENCE_LINK}/module/${encodeURIComponent(key)}`
}

export function isModuleIntelligencePath(pathname: string | null | undefined, key: string): boolean {
  const path = moduleIntelligencePath(key)
  return pathname === path || pathname?.startsWith(`${path}/`) === true
}

/** Whether this path is Intelligence or any page below it (so the Platform Services link is shown as the current page). */
export function isIntelligencePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname === INTELLIGENCE_LINK || pathname.startsWith(`${INTELLIGENCE_LINK}/`)
}
