/**
 * Agentic AI service barrel.
 *
 * Backed by the Laravel /api/agentic/* API, token authenticated and tenant
 * scoped. The module this replaces talked to two public HuggingFace Spaces with
 * neither, and three of its seven screens had no backend at all.
 */

export * from './agents'
export { agentService } from './agents'

export * from './runs'
export { runService, toolService } from './runs'

export * from './workflows'
export { workflowService } from './workflows'

export * from './insights'
export { analyticsService, reflectionService } from './insights'

export * from './excel'
export { excelAgentService } from './excel'
