/**
 * One job role's competency graph, straight from Neo4j.
 *
 * `JobRoleGraphController::show()` existed with zero frontend callers before
 * this — orphaned since whatever cartesian-product query it originally ran
 * crashed on any well-populated job role (189 REQUIRES_SKILL edges was
 * enough to exhaust PHP's memory limit outright). Fixed server-side as
 * decorrelated per-relationship queries; this is the first real caller.
 */

import { apiClient } from '@/services/core'
import type { LaravelContext } from '@/lib/laravel-context'
import { withLaravelParams } from '@/lib/laravel-context'

export interface GraphNode {
  id: number
  labels: string[]
  properties: Record<string, unknown>
}

export interface GraphRelationship {
  id: number
  type: string
  startNode: number
  endNode: number
  properties: Record<string, unknown>
}

export interface JobRoleGraphResponse {
  rootNode: GraphNode | null
  nodes: GraphNode[]
  relationships: GraphRelationship[]
}

export const graphService = {
  jobRole: (context: LaravelContext, jobRoleId: number) =>
    apiClient.get<JobRoleGraphResponse>(
      `/jobroles/${jobRoleId}/graph`,
      withLaravelParams(context),
    ),
}
