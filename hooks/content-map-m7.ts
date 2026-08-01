import { createLazyComponent, type ContentRoute } from './use-content-map-utils'

const AgAgentDashboard = createLazyComponent(() => import('@/domain/agentic/ag-agent-dashboard').then((m) => ({ default: m.AgAgentDashboard })))
const AgAgentLibrary = createLazyComponent(() => import('@/domain/agentic/ag-agent-library').then((m) => ({ default: m.AgAgentLibrary })))
const AgCreateAgent = createLazyComponent(() => import('@/domain/agentic/ag-create-agent').then((m) => ({ default: m.AgCreateAgent })))
const AgRunLog = createLazyComponent(() => import('@/domain/agentic/ag-run-log').then((m) => ({ default: m.AgRunLog })))
const AgAnalytics = createLazyComponent(() => import('@/domain/agentic/ag-analytics').then((m) => ({ default: m.AgAnalytics })))
const AgMultiAgent = createLazyComponent(() => import('@/domain/agentic/ag-multi-agent').then((m) => ({ default: m.AgMultiAgent })))
const AgReflection = createLazyComponent(() => import('@/domain/agentic/ag-reflection').then((m) => ({ default: m.AgReflection })))
const AgAgentWorkspace = createLazyComponent(() => import('@/domain/agentic/ag-agent-workspace').then((m) => ({ default: m.AgAgentWorkspace })))

export const M7_CONTENT: ContentRoute[] = [
  { submenuId: 'ag-agent-dashboard', component: AgAgentDashboard },
  { submenuId: 'ag-agent-library', component: AgAgentLibrary },
  { submenuId: 'ag-create-agent', component: AgCreateAgent },
  { submenuId: 'ag-run-log', component: AgRunLog },
  { submenuId: 'ag-analytics', component: AgAnalytics },
  { submenuId: 'ag-multi-agent', component: AgMultiAgent },
  { submenuId: 'ag-reflection', component: AgReflection },
  { submenuId: 'ag-agent-workspace', component: AgAgentWorkspace },
]
