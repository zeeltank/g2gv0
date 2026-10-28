'use client'

import { AlertTriangle, CheckCircle2, Clock, FileJson, Layers, Library, Loader2, PackagePlus, Plus, Upload } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useRuntimeCheck } from '@/hooks/use-runtime-check'
import { describeSimulationError, type UseSimulationsReturn } from '@/hooks/use-simulations'
import { cn } from '@/lib/utils'
import { simulationService, type SimulationCard, type SimulationCategory, type SimulationSpecPreview } from '@/services/lms/simulations'

import { CreateTab } from './create-simulation-tab'
import { SimulationCover } from './simulation-cover'
import { categoryLabelOf, difficultyOf, minutesLabel, missionsLabel, readSpec } from './simulation-format'
import { CategoryIcon, DifficultyBars, MetaItem } from './simulation-bits'

/** The server refuses anything bigger; say so before uploading a megabyte to be told the same thing. */
const MAX_SPEC_BYTES = 1_000_000

type Tab = 'library' | 'create' | 'import'

const TABS = [
  { value: 'library', label: 'G2G library', Icon: Library },
  { value: 'create', label: 'Create a simulation', Icon: PackagePlus },
  { value: 'import', label: 'Import a specification', Icon: FileJson },
] as const satisfies readonly { value: Tab; label: string; Icon: unknown }[]

type Check =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'checking'; spec: SimulationSpecPreview }
  | { kind: 'valid'; spec: SimulationSpecPreview }
  | { kind: 'problems'; spec: SimulationSpecPreview; issues: string[] }
  | { kind: 'unavailable'; spec: SimulationSpecPreview }

/**
 * The specification inside whatever was pasted. A stored record wraps it as `{ spec: {...} }` (that is how this very API returns one), so that
 * is accepted too - an administrator copying one simulation's response into another organisation should not have to unwrap it by hand.
 */
function specOf(parsed: unknown): SimulationSpecPreview | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  if (!('schema' in record) && record.spec && typeof record.spec === 'object' && !Array.isArray(record.spec)) {
    return record.spec as SimulationSpecPreview
  }
  return record as SimulationSpecPreview
}

function splitTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/**
 * Adds a simulation to the organisation: switch on one the platform offers, create one from a downloaded-and-edited package (models and
 * images included), or import a specification of its own.
 */
export function AddSimulationDialog({
  open,
  onOpenChange,
  categories,
  simulations,
  create,
  update,
  enable,
  setStatus,
  onAdded,
  onPreview,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: SimulationCategory[]
  /** What the organisation already has, so the Create tab can tell a new id from one in use. */
  simulations: SimulationCard[]
  create: UseSimulationsReturn['create']
  update: UseSimulationsReturn['update']
  enable: UseSimulationsReturn['enable']
  setStatus: UseSimulationsReturn['setStatus']
  onAdded: (message: string) => void
  /** Opens the player on a simulation just saved from the Create tab; the parent closes this dialog. */
  onPreview: (card: SimulationCard) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        {/* the body mounts only while open, so closing the dialog throws away what was typed and any check in flight */}
        <AddBody
          categories={categories}
          simulations={simulations}
          create={create}
          update={update}
          enable={enable}
          setStatus={setStatus}
          onAdded={onAdded}
          onPreview={onPreview}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function AddBody({
  categories,
  simulations,
  create,
  update,
  enable,
  setStatus,
  onAdded,
  onPreview,
  onDone,
}: {
  categories: SimulationCategory[]
  simulations: SimulationCard[]
  create: UseSimulationsReturn['create']
  update: UseSimulationsReturn['update']
  enable: UseSimulationsReturn['enable']
  setStatus: UseSimulationsReturn['setStatus']
  onAdded: (message: string) => void
  onPreview: (card: SimulationCard) => void
  onDone: () => void
}) {
  const [tab, setTab] = useState<Tab>('library')
  const tabsId = useId()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Arrow keys, Home and End move between the tabs (the focused one is the only tab stop), as a tab list is expected to.
  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const index = TABS.findIndex((item) => item.value === tab)
    const next =
      event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    setTab(TABS[next].value)
    tabRefs.current[TABS[next].value]?.focus()
  }

  return (
    <>
      <DialogHeader className="mb-0 space-y-1.5 border-b border-border px-6 pb-4 pt-6">
        <DialogTitle>Add a simulation</DialogTitle>
        <DialogDescription>
          Choose one from the G2G library, create one from a package you edit yourself, or import a specification. It is added to your organisation only.
        </DialogDescription>
        <div
          className="mt-3 flex w-fit max-w-full items-center overflow-x-auto rounded-lg border border-border bg-muted/30 p-0.5 text-xs font-medium"
          role="tablist"
          aria-label="Where to add from"
          onKeyDown={onTabKeyDown}
        >
          {TABS.map(({ value, label, Icon }) => (
            <button
              key={value}
              ref={(node) => {
                tabRefs.current[value] = node
              }}
              id={`${tabsId}-tab-${value}`}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls={`${tabsId}-panel`}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                tab === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </DialogHeader>

      <div id={`${tabsId}-panel`} className="min-h-0 flex-1 overflow-y-auto px-6 py-5" role="tabpanel" aria-labelledby={`${tabsId}-tab-${tab}`}>
        {tab === 'library' ? (
          <LibraryTab enable={enable} onAdded={onAdded} onImport={() => setTab('import')} />
        ) : tab === 'create' ? (
          <CreateTab existing={simulations} create={create} update={update} setStatus={setStatus} onAdded={onAdded} onDone={onDone} onPreview={onPreview} />
        ) : (
          <ImportTab categories={categories} create={create} onAdded={onAdded} onDone={onDone} />
        )}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ the G2G library */

function LibraryTab({
  enable,
  onAdded,
  onImport,
}: {
  enable: UseSimulationsReturn['enable']
  onAdded: (message: string) => void
  onImport: () => void
}) {
  const [items, setItems] = useState<SimulationCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<number | null>(null)

  const load = useCallback(() => {
    setError(null)
    setItems(null)
    simulationService
      .catalogue()
      .then((response) => setItems(response.data.simulations))
      .catch((err) => setError(describeSimulationError(err, 'Could not load the G2G library.').message))
  }, [])

  useEffect(() => {
    queueMicrotask(load)
  }, [load])

  const add = async (card: SimulationCard) => {
    setAdding(card.id)
    const result = await enable(card.id)
    setAdding(null)
    if (result.ok) {
      setItems((current) => (current ? current.filter((item) => item.id !== card.id) : current))
      onAdded(`Added “${card.title}” to your simulations.`)
    } else {
      setError(result.message)
    }
  }

  if (error && !items) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
        <p className="flex items-center gap-2 text-foreground">
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" /> {error}
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          Try again
        </Button>
      </div>
    )
  }

  if (!items) {
    return (
      <div className="space-y-3" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-border p-3">
            <Skeleton className="h-20 w-32 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-12 text-center">
        <Library className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Everything in the G2G library is already in your organisation.</p>
        <p className="max-w-sm text-xs text-muted-foreground">New simulations appear here as G2G publishes them. You can also import a specification of your own.</p>
        <Button variant="outline" size="sm" onClick={onImport}>
          Import a specification
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {items.map((card) => {
          const difficulty = difficultyOf(card.difficulty)
          const minutes = minutesLabel(card.minutes)
          const missions = missionsLabel(card.missions)
          const busy = adding === card.id
          return (
            <li key={card.id}>
              <button
                type="button"
                disabled={adding !== null}
                onClick={() => void add(card)}
                className="group flex w-full items-stretch gap-4 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-70"
              >
                <span className="h-20 w-32 shrink-0 overflow-hidden rounded-lg">
                  <SimulationCover simulation={card} imageClassName="transition-transform duration-500 group-hover:scale-105" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CategoryIcon category={card.category} className="size-3.5 text-primary" /> {categoryLabelOf(card)}
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">{card.title}</span>
                  {(card.summary ?? card.subtitle) && <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{card.summary ?? card.subtitle}</span>}
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {minutes && <MetaItem icon={Clock}>{minutes}</MetaItem>}
                    {difficulty && (
                      <MetaItem>
                        <DifficultyBars level={difficulty.level} /> {difficulty.label}
                      </MetaItem>
                    )}
                    {missions && <MetaItem icon={Layers}>{missions}</MetaItem>}
                  </span>
                </span>
                <span className="flex shrink-0 items-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                    {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
                    {busy ? 'Adding…' : 'Add'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------- import a specification */

function ImportTab({
  categories,
  create,
  onAdded,
  onDone,
}: {
  categories: SimulationCategory[]
  create: UseSimulationsReturn['create']
  onAdded: (message: string) => void
  onDone: () => void
}) {
  const fileId = useId()
  const listId = useId()
  const fileInput = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [check, setCheck] = useState<Check>({ kind: 'empty' })
  const [dragging, setDragging] = useState(false)
  const [fileNote, setFileNote] = useState<string | null>(null)

  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [cover, setCover] = useState('')
  const [publish, setPublish] = useState(true)

  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<{ message: string; problems: string[] } | null>(null)

  // A newer edit abandons the older check, and closing the dialog abandons whatever is running (shared with the Create tab).
  const { run: runCheck, abandon: abandonCheck } = useRuntimeCheck()
  const filledFor = useRef<string | null>(null)

  // Parse what was entered, then ask the runtime itself whether it would play. The runtime's validator is the authority: it is the code that will
  // run the simulation, so it is the one that vets it. This answers the person typing (or choosing a file), so it is called from their handlers,
  // not from an effect.
  const startCheck = useCallback(
    (value: string) => {
      abandonCheck()
      setFailure(null)
      const source = value.trim()
      if (source === '') {
        setCheck({ kind: 'empty' })
        return
      }
      if (source.length > MAX_SPEC_BYTES * 1.2) {
        setCheck({ kind: 'invalid', message: 'That is larger than 1 MB, which is more than a simulation specification needs.' })
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(source)
      } catch (err) {
        setCheck({ kind: 'invalid', message: `That is not valid JSON: ${err instanceof Error ? err.message : 'it could not be read'}.` })
        return
      }
      const spec = specOf(parsed)
      if (!spec) {
        setCheck({ kind: 'invalid', message: 'A specification is a JSON object ({ ... }).' })
        return
      }

      setCheck({ kind: 'checking', spec })
      runCheck(spec, (verdict) => {
        if (verdict.unavailable) setCheck({ kind: 'unavailable', spec })
        else if (verdict.ok) setCheck({ kind: 'valid', spec })
        else setCheck({ kind: 'problems', spec, issues: verdict.issues })
        // Fill the card fields from the specification the first time it is usable, so the administrator only changes what they mean to.
        if (verdict.ok || verdict.unavailable) {
          const facts = readSpec(spec)
          const key = `${facts.id ?? ''}|${facts.title ?? ''}`
          if (filledFor.current !== key) {
            filledFor.current = key
            setCategory(facts.category ?? '')
            setTags(facts.tags.join(', '))
          }
        }
      })
    },
    [abandonCheck, runCheck],
  )

  const readFile = async (file: File | undefined | null) => {
    if (!file) return
    if (file.size > MAX_SPEC_BYTES) {
      setFileNote(`“${file.name}” is ${(file.size / 1_000_000).toFixed(1)} MB; a specification can be at most 1 MB.`)
      return
    }
    try {
      const content = await file.text()
      setText(content)
      startCheck(content)
      setFileNote(`Loaded “${file.name}”.`)
    } catch {
      setFileNote(`“${file.name}” could not be read.`)
    }
  }


  const submittable = check.kind === 'valid' || check.kind === 'unavailable'

  const submit = async () => {
    if (!submittable) return
    setSaving(true)
    setFailure(null)
    const result = await create({
      spec: check.spec,
      status: publish ? 'published' : 'draft',
      ...(category.trim() ? { category: category.trim() } : {}),
      ...(splitTags(tags).length ? { tags: splitTags(tags) } : {}),
      ...(cover.trim() ? { cover_url: cover.trim() } : {}),
    })
    setSaving(false)
    if (result.ok) {
      onAdded(`Added “${result.card.title}”${publish ? '' : ' as a draft'}.`)
      onDone()
    } else {
      setFailure({ message: result.message, problems: result.problems })
    }
  }

  // What is pasted is still being typed and may be any JSON at all, so the summary is read through readSpec, never field by field.
  const spec = check.kind === 'valid' || check.kind === 'unavailable' || check.kind === 'problems' || check.kind === 'checking' ? check.spec : null
  const facts = spec ? readSpec(spec) : null
  const summaryMinutes = minutesLabel(facts?.minutes)
  const summaryMissions = missionsLabel(facts?.missions.length ?? 0)
  const summaryDifficulty = difficultyOf(facts?.difficulty)

  return (
    <div className="space-y-5">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void readFile(event.dataTransfer.files?.[0])
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-foreground">
          Drop a <span className="font-medium">.json</span> specification here, or
        </p>
        <input
          ref={fileInput}
          id={fileId}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(event) => {
            void readFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          Choose a file
        </Button>
        {fileNote && <p className="text-xs text-muted-foreground" role="status">{fileNote}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${fileId}-paste`}>…or paste it</Label>
        <Textarea
          id={`${fileId}-paste`}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            startCheck(event.target.value)
          }}
          spellCheck={false}
          placeholder='{ "schema": "g2g.sim/1", "id": "...", "title": "...", ... }'
          className="min-h-[140px] font-mono text-xs"
          aria-describedby={`${fileId}-verdict`}
        />
      </div>

      <div id={`${fileId}-verdict`} aria-live="polite">
        {check.kind === 'invalid' && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /> {check.message}
          </p>
        )}
        {check.kind === 'checking' && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking it with the simulation player…
          </p>
        )}
        {check.kind === 'problems' && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm" role="alert">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" /> This specification cannot be played yet.
            </p>
            {check.issues.length > 0 && (
              <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-6 text-xs text-foreground">
                {check.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {check.kind === 'unavailable' && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            The simulation player did not answer, so the full check could not run. You can still add it; the server checks the basics, and the player explains any problem when it is opened.
          </p>
        )}
        {check.kind === 'valid' && (
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> The simulation is valid.
          </p>
        )}
      </div>

      {facts && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-sm font-semibold text-foreground">{facts.title ?? 'Untitled simulation'}</p>
          {(facts.subtitle ?? facts.summary) && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{facts.subtitle ?? facts.summary}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {summaryMinutes && <MetaItem icon={Clock}>{summaryMinutes}</MetaItem>}
            {summaryMissions && <MetaItem icon={Layers}>{summaryMissions}</MetaItem>}
            {summaryDifficulty && (
              <MetaItem>
                <DifficultyBars level={summaryDifficulty.level} /> {summaryDifficulty.label}
              </MetaItem>
            )}
          </div>
        </div>
      )}

      {submittable && (
        <div className="space-y-4 border-t border-border pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${fileId}-category`}>Category</Label>
              <Input id={`${fileId}-category`} list={listId} value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} placeholder="e.g. Engineering" />
              <datalist id={listId}>
                {categories.map((c) => (
                  <option key={c.key} value={c.label} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">Becomes a filter chip in the gallery.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${fileId}-tags`}>Tags</Label>
              <Input id={`${fileId}-tags`} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="caching, queues, capacity" />
              <p className="text-xs text-muted-foreground">Comma separated, up to 8.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${fileId}-cover`}>Cover image (optional)</Label>
            <Input id={`${fileId}-cover`} value={cover} onChange={(event) => setCover(event.target.value)} placeholder="https://… (leave empty for a generated cover)" />
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-foreground">Publish to learners now</span>
              <span className="block text-xs text-muted-foreground">Off keeps it as a draft that only people who manage simulations can see.</span>
            </span>
            <Switch checked={publish} onChange={(event) => setPublish(event.target.checked)} aria-label="Publish to learners now" />
          </label>
        </div>
      )}

      {failure && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm" role="alert">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden="true" /> {failure.message}
          </p>
          {failure.problems.length > 0 && (
            <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-6 text-xs text-foreground">
              {failure.problems.map((problem, i) => (
                <li key={i}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={!submittable || saving} className="gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          {saving ? 'Adding…' : 'Add simulation'}
        </Button>
      </div>
    </div>
  )
}
