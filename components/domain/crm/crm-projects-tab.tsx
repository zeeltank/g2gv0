'use client'

/**
 * Generic "linked Task-Management Projects" list for a CRM record's own
 * Projects tab. One component, used by both Organization and Opportunity
 * detail pages (splice-spec in the integration report) — the shape is
 * identical on both sides: `GET crm/organizations/{id}/projects` and
 * `GET crm/opportunities/{id}/projects` return the same row shape.
 *
 * ── WHY A ROW OPENS THE PROJECTS LIST, NOT ONE PROJECT ──────────────────────
 *
 * Every other cross-link tab in this codebase (Organization → Opportunities,
 * Organization → Quotes, Opportunity → Quotes) navigates straight to the
 * linked record's own detail page via a `/module/.../{id}` URL. Task
 * Management's Projects screen has no such URL: reading
 * `projects-list-view.tsx` shows project selection lives in a plain
 * `useState` (`selectedId`), with its own comment admitting "selection lives
 * in memory, so a refresh returns to the list" — there is no `/projects/{id}`
 * route anywhere in this app, for ANY caller, to deep-link into.
 *
 * So a row here opens the Projects & Workstreams screen, and the user picks
 * the project by name on arrival — the best this app's navigation model
 * allows today. Giving `ProjectsListView` a `?project=` URL param so a true
 * deep link becomes possible is outside this gap's scope; see the
 * integration report for this file for the one-line note on it.
 */

import { useRouter } from 'next/navigation'
import { Briefcase } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'

/** One row of `GET crm/organizations/{id}/projects` / `GET crm/opportunities/{id}/projects`. */
export interface LinkedProject {
  id: string
  code: string
  name: string
  status: string
  priority: string | null
}

export function CrmProjectsTab({ projects, loading }: { projects: LinkedProject[]; loading: boolean }) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const goToProjectsList = () => router.push(resolveAccessLink('/module/task-management/projects-and-workstreams'))

  return (
    <div className="space-y-3">
      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner className="size-4" aria-hidden="true" />
          Loading projects…
        </div>
      )}

      {!loading && projects.length === 0 && (
        <EmptyState
          icon={<Briefcase className="size-8" aria-hidden="true" />}
          title="No projects linked yet"
          description="Link this record to a Task Management project from the project's own edit form."
        />
      )}

      {!loading && projects.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={goToProjectsList}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50"
              title="Open Projects & Workstreams - this app has no direct per-project link yet"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Briefcase className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{project.name}</p>
                <p className="truncate text-xs text-muted-foreground">{project.code}{project.priority ? ` · ${project.priority} priority` : ''}</p>
              </div>
              <StatusBadge status={project.status} size="sm">{project.status}</StatusBadge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
