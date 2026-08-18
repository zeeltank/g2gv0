'use client'

/**
 * COMPETENCY DEFINITIONS — the screen that makes `CmCompetencyComposer` reachable.
 *
 * WHY THIS FILE EXISTS
 *
 * `CmCompetencyComposer` was fully built, called the right endpoint
 * (`POST /competency/definitions`), and could not be opened by anybody: it was
 * absent from `hooks/content-map-m2.ts` and from the domain barrel. The
 * `competency` table has exactly two writers and NEITHER was reachable from a
 * screen, so its 209 rows arrived by provisioning and no customer could add a
 * 210th. G-UI-01 all over again — a correct component nothing mapped to.
 *
 * The composer is a CONTROLLED SUB-COMPONENT (`skills`, `onSubmit`, `canCreate`),
 * not a screen; the content map renders prop-less components. So it needs a host,
 * and the host is also where the existing definitions get listed — a create form
 * with no list of what already exists is how duplicates get made.
 *
 * ROLE: `canCreate` only hides UI. The route carries `profile:admin,hr` matched on
 * exact role_key, and an employee receives 403 from the server whatever this
 * screen shows. The UI's own `user.role` is derived by SUBSTRING from the profile
 * display name (`mapProfileNameToRole`) — the very matching the server stopped
 * doing. It is good enough to hide a button and is not, and must never become, the
 * thing that decides.
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2, AlertTriangle, Layers } from 'lucide-react'

import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  competencyDefinitionsService,
  KASBA_TYPES,
  type CompetencyDefinition,
  type CompetencyDefinitionInput,
  type KasbaType,
} from '@/services/competency/definitions'
import { competencyLibrariesService, type LibraryTabId } from '@/services/competency'
import { CmCompetencyComposer } from './cm-competency-composer'
// The tenant's frameworks, so a new competency can be filed under one.
// WITHOUT THIS THE PICKER NEVER RENDERS: the composer's `frameworks` prop is
// optional, and an optional prop nothing passes is a control that silently does
// nothing — the same shape as a default that hides an absence.
import { useCompetencyStudio } from '@/hooks/use-competency-studio'

export function CmCompetencyDefinitions() {
  const { user } = useAuth()
  // The framework list the composer needs. Read here rather than in the composer
  // so the form stays a pure input component with no fetching of its own.
  const { frameworks } = useCompetencyStudio()

  const [definitions, setDefinitions] = useState<CompetencyDefinition[]>([])
  const [optionsByType, setOptionsByType] = useState<Partial<Record<KasbaType, { id: number; title: string }[]>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canCreate = user?.role === 'admin' || user?.role === 'hr'

  const load = useCallback(async () => {
    const ctx = getLaravelContext(user)
    if (!isLaravelContextReady(ctx)) return
    setLoading(true)
    setError(null)
    try {
      const res = await competencyDefinitionsService.list(ctx)
      setDefinitions(res?.data ?? [])
    } catch {
      setError('Could not load competency definitions.')
      setDefinitions([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  /* ALL FIVE dimensions have a canonical table and all five resolve by key. The
     library tab id and the KASBA type share a vocabulary except for `skill`,
     whose tab is also `skill`. Each list is loaded independently so one failing
     dimension does not blank the others. */
  useEffect(() => {
    const ctx = getLaravelContext(user)
    if (!isLaravelContextReady(ctx)) return
    const tabFor: Record<KasbaType, LibraryTabId> = {
      skill: 'skill', knowledge: 'knowledge', ability: 'ability',
      attitude: 'attitude', behaviour: 'behaviour',
    }
    for (const kind of KASBA_TYPES) {
      competencyLibrariesService.list(ctx, tabFor[kind], { per_page: 500 })
        .then((res) => {
          const rows = (res?.data ?? []) as Array<Record<string, unknown>>
          const opts = rows
            .map((r) => ({ id: Number(r.id), title: String(r.title ?? '') }))
            .filter((o) => o.id && o.title)
          setOptionsByType((prev) => ({ ...prev, [kind]: opts }))
        })
        .catch(() => setOptionsByType((prev) => ({ ...prev, [kind]: [] })))
    }
  }, [user])

  const submit = async (input: CompetencyDefinitionInput) => {
    const ctx = getLaravelContext(user)
    if (!isLaravelContextReady(ctx)) return
    await competencyDefinitionsService.create(ctx, input)
    await load()
  }

  return (
    <div className="w-full flex-1 space-y-6 p-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Competency Definitions</h2>
        <p className="text-sm text-muted-foreground mt-1">
          A competency is a named bundle of knowledge, skills, abilities, behaviours and attitudes.
          Role requirements are chosen from this list, so a role cannot require anything that is not
          defined here first.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </p>
      )}

      <section>
        <h3 className="text-sm font-medium text-foreground mb-2">
          Defined in this organisation {loading ? '' : `(${definitions.length})`}
        </h3>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : definitions.length === 0 ? (
          <EmptyState
            title="No competencies defined yet"
            description="Nothing has been defined for this organisation. Until at least one exists, no job role can be given a requirement and no gap can be calculated."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Name</th>
                  <th className="text-left font-medium px-4 py-2 w-32">Code</th>
                  <th className="text-left font-medium px-4 py-2 w-28">Items</th>
                  <th className="text-left font-medium px-4 py-2 w-40">Unresolved</th>
                </tr>
              </thead>
              <tbody>
                {definitions.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-4 py-2">{d.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{d.code ?? '—'}</td>
                    <td className="px-4 py-2">{d.items?.length ?? 0}</td>
                    <td className="px-4 py-2">
                      {d.unresolved_items > 0 ? (
                        <span className="text-amber-600 dark:text-amber-500">
                          {d.unresolved_items} held by label
                        </span>
                      ) : (
                        <span className="text-muted-foreground">all resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> Define a competency
        </h3>
        {!canCreate && (
          <p className="text-sm text-muted-foreground mb-2">
            Defining competencies is limited to HR and administrators.
          </p>
        )}
        <CmCompetencyComposer optionsByType={optionsByType} frameworks={frameworks} onSubmit={submit} canCreate={canCreate} />
      </section>
    </div>
  )
}
