'use client'

/**
 * Capability Explorer — the competency graph.
 *
 * Was an embedded third-party demo (skill-ontology-neo4j.vercel.app),
 * flagged on-screen as "not built from your organisation's own role and
 * competency mapping." Replaced with a real reader of
 * `JobRoleGraphController::show()` — this organisation's own Neo4j graph:
 * REQUIRES_SKILL/KNOWLEDGE/ABILITY/ATTITUDE edges (plus REQUIRES_BEHAVIOUR,
 * one hop further, off each skill). That endpoint existed with zero
 * frontend callers — orphaned because its original query crashed on any
 * well-populated role (a cartesian product across every relationship
 * family at once); fixed server-side as decorrelated per-relationship
 * queries, so this is the first real caller.
 *
 * Job-role search reuses `competencyLibrariesService.list(..., 'jobrole')`
 * — the same endpoint the Competency Library's own Job Role tab already
 * calls — rather than building a second job-role search.
 */

import { useEffect, useMemo, useState } from 'react'
import { Network, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { getLaravelContext } from '@/lib/laravel-context'
import { useAuth } from '@/hooks/use-auth'
import { competencyLibrariesService, type JobroleRow } from '@/services/competency/libraries'
import { graphService, type GraphNode } from '@/services/competency/graph'

/** A node, grouped under the relationship type that reached it. */
type GroupedEdges = Record<string, GraphNode[]>

const RELATIONSHIP_GROUPS: Array<{ type: string; heading: string }> = [
  { type: 'REQUIRES_SKILL', heading: 'Skills required' },
  { type: 'REQUIRES_KNOWLEDGE', heading: 'Knowledge required' },
  { type: 'REQUIRES_ABILITY', heading: 'Abilities required' },
  // Not a typo: the graph itself stores this relationship type without the
  // final D (confirmed against live data — 984 real edges, all spelled
  // this way). See JobRoleGraphController::show() on the backend.
  { type: 'REQUIRES_ATTITUTE', heading: 'Attitudes required' },
  { type: 'REQUIRES_BEHAVIOUR', heading: 'Behaviours' },
]

function labelOf(node: GraphNode): string {
  const p = node.properties || {}
  const name = p.jobrole ?? p.title ?? p.name ?? p.displayLabel ?? p.label
  return name !== undefined && name !== null && name !== ''
    ? String(name)
    : `${node.labels[0] ?? 'Node'} ${node.id}`
}

export function CmTaxonomyOntology() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const subInstituteId = context.subInstituteId

  const [searchTerm, setSearchTerm] = useState('')
  const [roles, setRoles] = useState<JobroleRow[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)

  const [rootLabel, setRootLabel] = useState<string | null>(null)
  const [grouped, setGrouped] = useState<GroupedEdges>({})
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState<string | null>(null)

  useEffect(() => {
    if (!subInstituteId) return
    let cancelled = false
    setRolesLoading(true)

    competencyLibrariesService
      .list<JobroleRow>(context, 'jobrole', searchTerm ? { search: searchTerm } : undefined)
      .then((res) => {
        if (!cancelled) setRoles(res.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setRoles([])
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subInstituteId, searchTerm])

  const loadGraph = async (roleId: number) => {
    setSelectedRoleId(roleId)
    setGraphLoading(true)
    setGraphError(null)

    try {
      const result = await graphService.jobRole(context, roleId)

      if (!result.rootNode) {
        setRootLabel(null)
        setGrouped({})
        setGraphError("This role has no taxonomy edges in the graph yet.")
        return
      }

      setRootLabel(labelOf(result.rootNode))

      const nodesById = new Map<number, GraphNode>()
      result.nodes.forEach((n) => nodesById.set(n.id, n))
      nodesById.set(result.rootNode.id, result.rootNode)

      const next: GroupedEdges = {}
      result.relationships.forEach((rel) => {
        const target = nodesById.get(rel.endNode)
        if (!target) return
        next[rel.type] = next[rel.type] ?? []
        if (!next[rel.type].some((n) => n.id === target.id)) next[rel.type].push(target)
      })
      setGrouped(next)
    } catch (e: unknown) {
      setGraphError(e instanceof Error ? e.message : "Couldn't load that role's graph.")
      setGrouped({})
    } finally {
      setGraphLoading(false)
    }
  }

  const hasAnyEdges = useMemo(() => Object.keys(grouped).length > 0, [grouped])

  if (!subInstituteId) {
    return (
      <EmptyState
        icon={<Network className="h-8 w-8" />}
        title="No organisation selected"
        description="The competency graph is scoped to one organisation, so it needs an active session to load."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-primary/10 bg-card/50 p-5 shadow-sm backdrop-blur-xl">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Network className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Capability Explorer</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              This organisation&apos;s own competency graph — search a job role to see what it
              actually requires, read live from Neo4j.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="border-b border-border/60 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search job roles"
                className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="max-h-[34rem] divide-y divide-border/60 overflow-auto">
            {rolesLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : roles.length === 0 ? (
              <p className="px-4 py-8 text-xs text-muted-foreground">Nothing matches that search.</p>
            ) : (
              roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => void loadGraph(role.id)}
                  className={`flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors hover:bg-muted/60 ${
                    selectedRoleId === role.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className="truncate text-sm font-medium text-foreground">{role.jobrole}</span>
                  {role.department && (
                    <span className="truncate text-[11px] text-muted-foreground">{role.department}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          {graphLoading ? (
            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : !selectedRoleId ? (
            <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-border bg-card/40 p-8 text-center">
              <Network className="mb-3 h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">Pick a job role on the left to explore it.</p>
            </div>
          ) : graphError ? (
            <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-2xl border border-border bg-card/40 p-8 text-center">
              <Network className="mb-3 h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">{graphError}</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card/40 p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Job role
                </p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">{rootLabel}</h2>
              </div>

              {!hasAnyEdges ? (
                <div className="rounded-2xl border border-border bg-card/40 p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    This job role has no taxonomy edges in the graph yet.
                  </p>
                </div>
              ) : (
                RELATIONSHIP_GROUPS.map(({ type, heading }) => {
                  const items = grouped[type]
                  if (!items?.length) return null
                  return (
                    <div key={type} className="overflow-hidden rounded-2xl border border-border bg-card/40">
                      <div className="border-b border-border/60 px-5 py-3">
                        <p className="text-sm font-semibold text-foreground">{heading}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 p-5">
                        {items.map((node) => (
                          <span
                            key={node.id}
                            className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                          >
                            {labelOf(node)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
