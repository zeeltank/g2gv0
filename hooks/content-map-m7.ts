import { createLazyComponent, type ContentRoute } from './use-content-map-utils'
import {
  AG_AGENT_DASHBOARD_ACCESS_LINK,
  AG_CREATE_AGENT_ACCESS_LINK,
  AG_AGENT_LIBRARY_ACCESS_LINK,
  AG_RUN_LOG_ACCESS_LINK,
  AG_ANALYTICS_ACCESS_LINK,
  AG_MULTI_AGENT_ACCESS_LINK,
  AG_REFLECTION_ACCESS_LINK,
} from '@/lib/gtg-navigation'

const AgAgentDashboard = createLazyComponent(() => import('@/domain/agentic/ag-agent-dashboard').then((m) => ({ default: m.AgAgentDashboard })))
const AgAgentLibrary = createLazyComponent(() => import('@/domain/agentic/ag-agent-library').then((m) => ({ default: m.AgAgentLibrary })))
const AgCreateAgent = createLazyComponent(() => import('@/domain/agentic/ag-create-agent').then((m) => ({ default: m.AgCreateAgent })))
const AgRunLog = createLazyComponent(() => import('@/domain/agentic/ag-run-log').then((m) => ({ default: m.AgRunLog })))
const AgAnalytics = createLazyComponent(() => import('@/domain/agentic/ag-analytics').then((m) => ({ default: m.AgAnalytics })))
const AgMultiAgent = createLazyComponent(() => import('@/domain/agentic/ag-multi-agent').then((m) => ({ default: m.AgMultiAgent })))
const AgReflection = createLazyComponent(() => import('@/domain/agentic/ag-reflection').then((m) => ({ default: m.AgReflection })))
const AgAgentWorkspace = createLazyComponent(() => import('@/domain/agentic/ag-agent-workspace').then((m) => ({ default: m.AgAgentWorkspace })))

/*
 * Every entry now carries both its real tblmenumaster_g2g id (confirmed
 * against `Docs\phase3\_changes\backup-tblmenumaster_g2g-2026-08-05.sql` and
 * `Docs\phase3\_evidence\menu-tree.txt`: 188=Dashboard, 189=Create Agent,
 * 190=Run Log, 191=Analytics, 192=Multi-Agent, 193=Reflection, 194=Agentic
 * Library) and its accessLink, which `loadContentRoute` matches first.
 *
 * Previously only 4 entries had an accessLink, and the other 3 (Dashboard,
 * Multi-Agent, Reflection) carried STALE menuId values from before these ids
 * were confirmed. Dashboard's happened to be right by coincidence; Multi-Agent
 * and Reflection's did not (193/194 belonged to the entries after them in
 * this array), so loadContentRoute's menuId fallback matched the WRONG
 * component for both: visiting the real Multi-Agent screen (192) rendered
 * Analytics (whose stale menuId was 192), and visiting the real Reflection
 * screen (193) rendered Multi-Agent (whose stale menuId was 193) — traced by
 * hand through loadContentRoute's match order, not merely suspected. Every
 * entry having a correct accessLink now makes the numeric menuId purely a
 * defensive fallback, as it already was for the other four.
 */
export const M7_CONTENT: ContentRoute[] = [
  { accessLink: AG_AGENT_DASHBOARD_ACCESS_LINK, menuId: '188', component: AgAgentDashboard },
  { accessLink: AG_CREATE_AGENT_ACCESS_LINK, menuId: '189', component: AgCreateAgent },
  { accessLink: AG_RUN_LOG_ACCESS_LINK, menuId: '190', component: AgRunLog },
  { accessLink: AG_ANALYTICS_ACCESS_LINK, menuId: '191', component: AgAnalytics },
  { accessLink: AG_MULTI_AGENT_ACCESS_LINK, menuId: '192', component: AgMultiAgent },
  { accessLink: AG_REFLECTION_ACCESS_LINK, menuId: '193', component: AgReflection },
  { accessLink: AG_AGENT_LIBRARY_ACCESS_LINK, menuId: '194', component: AgAgentLibrary },
  { menuId: '195', component: AgAgentWorkspace },
]
