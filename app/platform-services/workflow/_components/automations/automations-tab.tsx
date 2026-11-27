'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ListSearch } from '@/components/shared/scaffolds/list-search'
import { NativeSelect } from './native-select'
import { RecordDrawer } from '@/components/shared/scaffolds/record-drawer'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { useListQuery } from '@/components/shared/scaffolds/use-list-query'
import type { ListQueryConfig } from '@/components/shared/scaffolds/list-query'
import { useGtmCanWrite, useGtmReady } from '@/components/domain/gtm/gtm-shared'
import { duplicateInput } from '@/lib/workflows/draft'
import { workflowErrorMessage } from '@/lib/workflows/messages'
import { needsApproval } from '@/lib/workflows/catalog'
import { rowSentence } from '@/lib/workflows/sentence'
import { archiveQuestion, filterAutomations, SHOW_FILTER_LABEL, SHOW_FILTERS, switchPlan } from '@/lib/workflows/status'
import { NOTE_TONE } from '@/lib/workflows/tones'
import { cn } from '@/lib/utils'
import { workflowsService, type GtmWorkflow, type WorkflowCatalog, type WorkflowHealth, type WorkflowRecipe } from '@/services/gtm/workflows'
import { AutomationRow } from './automation-row'
import { BuilderDrawer } from './builder-drawer'
import { RecipeGallery, type RecipesState } from './recipe-gallery'
import { StatusStrip } from './status-strip'
import { TryItPanel } from './try-it-panel'

/** The search is `q` and the status filter is `show`; both live in the address, beside the tab and the module the shell keeps there. */
const LIST_CONFIG: ListQueryConfig = { filters: { show: { default: 'all', allowed: SHOW_FILTERS } } }

/** From this many rows on, the browser may skip drawing the rows that are off screen. */
const LONG_LIST = 50

interface Loaded {
  catalog: WorkflowCatalog
  items: GtmWorkflow[]
}

type Notice = { tone: 'success' | 'error'; text: string }

/**
 * The Automations tab: every automation of the organisation as one plain sentence with an On/Off switch; a ready-made gallery when there are none; a
 * builder in a drawer; and Try it. Rights are the engine's own (an administrator writes, an executive reads), and the data is organisation-wide: the
 * engine has no per-module split, and the tab says so.
 */
export function AutomationsTab() {
  const ready = useGtmReady()
  const canWrite = useGtmCanWrite()
  const { query, setQuery, setSearch, setFilter } = useListQuery(LIST_CONFIG)
  const { confirm, confirmDialog } = useConfirm()

  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(() => new Date(0))
  const [health, setHealth] = useState<WorkflowHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [recipes, setRecipes] = useState<RecipesState>({ status: 'loading' })
  const [builder, setBuilder] = useState<{ workflow: GtmWorkflow | null; key: number } | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [tryFor, setTryFor] = useState<GtmWorkflow | null>(null)
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const load = useCallback(async () => {
    try {
      const [c, l] = await Promise.all([workflowsService.catalog(), workflowsService.list()])
      setData({ catalog: c.data, items: l.data.items })
      setNow(new Date())
      setError(null)
    } catch (e) {
      setError(workflowErrorMessage(e, 'The automations could not be loaded. Check your connection and try again.'))
    }
  }, [])

  const loadHealth = useCallback(async () => {
    try {
      setHealth((await workflowsService.health()).data)
    } catch {
      setHealth(null)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  const loadRecipes = useCallback(async () => {
    setRecipes((r) => (r.status === 'ready' ? r : { status: 'loading' }))
    try {
      setRecipes({ status: 'ready', items: (await workflowsService.recipes()).data.items })
    } catch (e) {
      setRecipes({ status: 'error', message: workflowErrorMessage(e, 'Check your connection and try again.') })
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    queueMicrotask(() => { void load(); void loadHealth(); void loadRecipes() })
  }, [ready, load, loadHealth, loadRecipes])

  const sentenceOf = useCallback((w: GtmWorkflow) => (data ? rowSentence(w, data.catalog, needsApproval(w, data.catalog)) : ''), [data])
  const visible = useMemo(
    () => (data ? filterAutomations(data.items, { q: query.q, show: query.filters.show }, sentenceOf) : []),
    [data, query.q, query.filters.show, sentenceOf],
  )

  const say = (tone: Notice['tone'], text: string) => setNotice({ tone, text })
  const mark = (id: number, on: boolean) => setPending((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next })

  /** Runs one change to one automation, with its row marked busy, and reloads the list from the server's answer. */
  const change = async (w: GtmWorkflow, work: () => Promise<string>) => {
    mark(w.id, true)
    setNotice(null)
    try {
      say('success', await work())
      await load()
    } catch (e) {
      say('error', workflowErrorMessage(e, 'That did not work. Check your connection and try again.', data?.catalog))
    } finally {
      mark(w.id, false)
    }
  }

  const toggle = async (w: GtmWorkflow) => {
    if (!data) return
    const plan = switchPlan(w, data.catalog, canWrite)
    if (plan.next === null) return
    if (plan.confirm && !(await confirm({ ...plan.confirm, tone: 'default' }))) return
    const next = plan.next
    await change(w, async () => {
      await workflowsService.setStatus(w.id, next)
      return next === 'active' ? `Turned on “${w.name}”. It reacts to new events from now on, not to past ones.` : `Turned off “${w.name}”.`
    })
  }

  const archive = async (w: GtmWorkflow) => {
    if (!(await confirm({ ...archiveQuestion(w, w.last_run?.waiting ?? 0), tone: 'destructive' }))) return
    await change(w, async () => {
      const r = await workflowsService.setStatus(w.id, 'archived', true)
      const cancelled = r.data.runs_cancelled
      return `Archived “${w.name}”.${cancelled > 0 ? ` ${cancelled} ${cancelled === 1 ? 'run was' : 'runs were'} cancelled.` : ''}`
    })
  }

  const duplicate = (w: GtmWorkflow) => change(w, async () => {
    const r = await workflowsService.create(duplicateInput(w))
    return `Duplicated as a draft: “${r.data.workflow.name}”. Turn it on when you are ready.`
  })

  const install = async (recipe: WorkflowRecipe) => {
    setAdding(recipe.key)
    setNotice(null)
    try {
      const r = await workflowsService.installRecipe(recipe.key)
      say('success', r.data.created ? `Added “${recipe.title}” as a draft. Try it, then turn it on when you are ready.` : `“${recipe.title}” was already added.`)
      setGalleryOpen(false)
      await Promise.all([load(), loadRecipes()])
    } catch (e) {
      say('error', workflowErrorMessage(e, 'It could not be added. Check your connection and try again.', data?.catalog))
    } finally {
      setAdding(null)
    }
  }

  const startBuilder = (workflow: GtmWorkflow | null) => setBuilder({ workflow, key: Date.now() })
  const finished = (message: string) => { setBuilder(null); say('success', message); void load() }

  const loading = !data && !error
  const empty = data !== null && data.items.length === 0
  const hasMenu = canWrite

  return (
    <div className="space-y-4">
      <StatusStrip health={health} loading={healthLoading} />

      {notice && (
        <p role={notice.tone === 'error' ? 'alert' : 'status'} className={cn('break-words rounded-lg border px-3 py-2 text-sm', NOTE_TONE[notice.tone])}>{notice.text}</p>
      )}

      {error && <ErrorState title="The automations could not be loaded" description={error} retry={() => void load()} />}

      {loading && (
        <div role="status" aria-label="Loading automations" className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      )}

      {data && empty && (
        <section aria-labelledby="automations-empty" className="space-y-4 rounded-lg border border-dashed border-border p-4 sm:p-6">
          <div className="max-w-xl space-y-1">
            <h2 id="automations-empty" className="text-pretty text-lg font-semibold text-foreground">
              {canWrite ? 'Start with a ready-made automation' : 'No automations yet'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {canWrite
                ? 'Add one as a draft, try it on a real record, then turn it on when you are happy with it. Or build your own from scratch.'
                : 'An administrator can add the first one. Until then there is nothing to show here.'}
            </p>
          </div>
          <RecipeGallery recipes={recipes} adding={adding} canAdd={canWrite} onAdd={(r) => void install(r)} onRetry={() => void loadRecipes()} />
          {canWrite && <Button variant="outline" onClick={() => startBuilder(null)}><Plus className="size-4" aria-hidden="true" />Start from scratch</Button>}
        </section>
      )}

      {data && !empty && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 basis-full sm:max-w-sm sm:basis-0">
              <ListSearch value={query.q} onSearch={setSearch} placeholder="Search automations…" label="Search automations" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Show
              <NativeSelect name="show" value={query.filters.show} onChange={(e) => setFilter('show', e.target.value)} className="w-auto">
                {SHOW_FILTERS.map((s) => <option key={s} value={s}>{SHOW_FILTER_LABEL[s]}</option>)}
              </NativeSelect>
            </label>
            <span className="grow" />
            {hasMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button><Plus className="size-4" aria-hidden="true" />New automation<ChevronDown className="size-4" aria-hidden="true" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => startBuilder(null)}>Start from scratch</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setGalleryOpen(true)}>Choose a ready-made automation</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title="No automation matches"
              description="Try fewer words, or show all automations."
              action={<Button variant="outline" onClick={() => setQuery({ q: '', filters: { show: 'all' } })}>Clear the search</Button>}
            />
          ) : (
            <ul aria-label="Automations" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {visible.map((w) => (
                <AutomationRow
                  key={w.id}
                  workflow={w}
                  catalog={data.catalog}
                  canWrite={canWrite}
                  pending={pending.has(w.id)}
                  now={now}
                  deferRendering={visible.length > LONG_LIST}
                  onToggle={(x) => void toggle(x)}
                  onEdit={(x) => startBuilder(x)}
                  onTryIt={setTryFor}
                  onDuplicate={(x) => void duplicate(x)}
                  onArchive={(x) => void archive(x)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {builder && data && (
        <BuilderDrawer
          key={builder.key}
          catalog={data.catalog}
          workflow={builder.workflow}
          onClose={() => setBuilder(null)}
          onSaved={finished}
          onTurnedOn={finished}
        />
      )}

      {galleryOpen && (
        <RecordDrawer
          open
          onClose={() => setGalleryOpen(false)}
          title="Ready-made automations"
          description="Each one is added as a draft. Nothing happens until you turn it on."
          width="xl"
        >
          <RecipeGallery recipes={recipes} adding={adding} canAdd={canWrite} onAdd={(r) => void install(r)} onRetry={() => void loadRecipes()} />
        </RecordDrawer>
      )}

      {tryFor && data && (
        <RecordDrawer
          open
          onClose={() => setTryFor(null)}
          title={`Try “${tryFor.name}”`}
          description="Pick a real record and see what this automation would do for it."
          width="lg"
        >
          <TryItPanel key={tryFor.id} workflow={tryFor} catalog={data.catalog} />
        </RecordDrawer>
      )}

      {confirmDialog}
    </div>
  )
}
