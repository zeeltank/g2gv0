import { createLazyComponent, type ContentRoute } from './use-content-map-utils'
import {
  AG_CREATE_AGENT_ACCESS_LINK,
  AG_AGENT_LIBRARY_ACCESS_LINK,
  AG_RUN_LOG_ACCESS_LINK,
  AG_ANALYTICS_ACCESS_LINK,
} from '@/lib/gtg-navigation'

const AgAgentDashboard = createLazyComponent(() => import('@/domain/agentic/ag-agent-dashboard').then((m) => ({ default: m.AgAgentDashboard })))
const AgAgentLibrary = createLazyComponent(() => import('@/domain/agentic/ag-agent-library').then((m) => ({ default: m.AgAgentLibrary })))
const AgCreateAgent = createLazyComponent(() => import('@/domain/agentic/ag-create-agent').then((m) => ({ default: m.AgCreateAgent })))
const AgRunLog = createLazyComponent(() => import('@/domain/agentic/ag-run-log').then((m) => ({ default: m.AgRunLog })))
const AgAnalytics = createLazyComponent(() => import('@/domain/agentic/ag-analytics').then((m) => ({ default: m.AgAnalytics })))
const AgMultiAgent = createLazyComponent(() => import('@/domain/agentic/ag-multi-agent').then((m) => ({ default: m.AgMultiAgent })))
const AgReflection = createLazyComponent(() => import('@/domain/agentic/ag-reflection').then((m) => ({ default: m.AgReflection })))
const AgAgentWorkspace = createLazyComponent(() => import('@/domain/agentic/ag-agent-workspace').then((m) => ({ default: m.AgAgentWorkspace })))

// accessLink is set for the 4 submenus that already have a known
// tblmenumaster_g2g access_link constant in lib/gtg-navigation.ts; the rest
// only have their synthetic numeric menuId until the backend rows (and
// their access_link) for this module are confirmed.
export const M7_CONTENT: ContentRoute[] = [
  { menuId: '188', component: AgAgentDashboard },
  { accessLink: AG_AGENT_LIBRARY_ACCESS_LINK, menuId: '189', component: AgAgentLibrary },
  { accessLink: AG_CREATE_AGENT_ACCESS_LINK, menuId: '190', component: AgCreateAgent },
  { accessLink: AG_RUN_LOG_ACCESS_LINK, menuId: '191', component: AgRunLog },
  { accessLink: AG_ANALYTICS_ACCESS_LINK, menuId: '192', component: AgAnalytics },
  { menuId: '193', component: AgMultiAgent },
  { menuId: '194', component: AgReflection },
  { menuId: '195', component: AgAgentWorkspace },
]
