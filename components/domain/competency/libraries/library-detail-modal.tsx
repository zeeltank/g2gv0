'use client'

/**
 * The library detail popup — what opens when a tile is clicked, on every tab.
 *
 * Shape of the previous app's popup, kept because it works: an identity header
 * (name, category, the actions that apply to this row), a grid of navigation
 * cards, and a panel showing whichever card is selected.
 *
 * Two deliberate departures:
 *
 * 1. The card set is derived from the row's own type. Skills have proficiency
 *    levels and applications; a knowledge item does not, and showing it an
 *    empty "Proficiency Level" card teaches people the screen is broken.
 *
 * 2. The KASA cards actually load. In the old app the popup declared state for
 *    jobroleData / proficiencyLevel / abilityLevel and never fetched any of
 *    it, so those panels were permanently empty. They are answered here by the
 *    usage endpoint, which walks s_skill_knowledge_ability back to the skills
 *    that reference the item.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BookOpen,
  Briefcase,
  ChevronDown,
  Info,
  Layers,
  Pencil,
  Sparkles,
  Target,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { useLaravelContext } from '@/hooks/use-agentic'
import { skillDetailService } from '@/services/competency/skill-detail'
import type {
  ClassificationItem,
  KasaUsage,
  ProficiencyGroup,
  SkillDetailResponse,
} from '@/services/competency/skill-detail'
import type { LibraryRow } from '@/services/competency/libraries'
import type { LibraryTabConfig } from './library-config'
import { CourseBuilderPanel } from './course-builder-panel'

interface LibraryDetailModalProps {
  config: LibraryTabConfig
  row: LibraryRow
  /** Which card to land on — set by the tile actions. */
  initialSection?: string
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

interface CardDef {
  id: string
  label: string
  icon: typeof Info
  /** Shown on the card so it is not just a title. */
  hint: string
}

/** The KASA tabs share one shape, so they share one card set. */
const KASA_IDS = ['knowledge', 'ability', 'attitude', 'behaviour'] as const

function cardsFor(config: LibraryTabConfig): CardDef[] {
  const noun = config.singular

  if (config.id === 'skill') {
    return [
      { id: 'details', label: `${noun} Details`, icon: Info, hint: 'Every recorded field' },
      { id: 'jobroles', label: `${noun} Job Role`, icon: Briefcase, hint: 'Roles that need it' },
      { id: 'levels', label: `${noun} Proficiency Level`, icon: Layers, hint: 'Levels it is rated on' },
      { id: 'knowledge', label: `${noun} Knowledge`, icon: BookOpen, hint: 'What to know, by level' },
      { id: 'ability', label: `${noun} Ability`, icon: Wrench, hint: 'What to do, by level' },
      { id: 'application', label: `${noun} Application`, icon: Target, hint: 'Where it is applied' },
      { id: 'attitude', label: `${noun} Attitude`, icon: Sparkles, hint: 'Mindsets it calls for' },
      { id: 'behaviour', label: `${noun} Behaviour`, icon: Activity, hint: 'Observable behaviours' },
    ]
  }

  if ((KASA_IDS as readonly string[]).includes(config.id)) {
    return [
      { id: 'details', label: `${noun} Details`, icon: Info, hint: 'Every recorded field' },
      { id: 'skills', label: `${noun} Skills`, icon: Zap, hint: 'Skills that reference it' },
      { id: 'jobroles', label: `${noun} Job Role`, icon: Briefcase, hint: 'Roles that inherit it' },
      { id: 'levels', label: `${noun} Level`, icon: Layers, hint: 'Levels it appears at' },
    ]
  }

  return [{ id: 'details', label: `${noun} Details`, icon: Info, hint: 'Every recorded field' }]
}

export function LibraryDetailModal({
  config,
  row,
  initialSection,
  onEdit,
  onDelete,
  onClose,
}: LibraryDetailModalProps) {
  const resolveContext = useLaravelContext()

  const cards = useMemo(() => cardsFor(config), [config])
  const isSkill = config.id === 'skill'
  const isKasa = (KASA_IDS as readonly string[]).includes(config.id)

  const [active, setActive] = useState(
    initialSection && cards.some((card) => card.id === initialSection) ? initialSection : 'details',
  )
  const [skill, setSkill] = useState<SkillDetailResponse | null>(null)
  const [usage, setUsage] = useState<KasaUsage | null>(null)
  const [loading, setLoading] = useState(isSkill || isKasa)
  const [error, setError] = useState<string | null>(null)

  const rowId = Number(row.id)
  const title = String(row[config.titleKey] ?? '').trim() || config.singular

  const load = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return
    if (!isSkill && !isKasa) return

    setLoading(true)
    setError(null)

    try {
      if (isSkill) {
        setSkill(await skillDetailService.get(context, rowId))
      } else {
        const response = await skillDetailService.kasaUsage(context, config.id, rowId)
        setUsage(response.data)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the details.')
    } finally {
      setLoading(false)
    }
  }, [resolveContext, rowId, config.id, isSkill, isKasa])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // The row from the list already carries the columns; the detail fetch only
  // adds relations. So Details renders immediately, without waiting.
  const record = (skill?.editData ?? usage?.item ?? row) as LibraryRow

  const category = String(record[config.categoryKey ?? 'category'] ?? '').trim()
  const subCategory = String(record[config.subCategoryKey ?? 'sub_category'] ?? '').trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Identity header */}
        <div className="relative shrink-0 overflow-hidden border-b border-border bg-gradient-to-r from-primary/12 via-primary/5 to-transparent p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
                <config.icon className="h-6 w-6" />
              </span>

              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  {config.singular} Name
                </p>
                <h2 className="mt-0.5 break-words text-xl font-bold leading-tight text-foreground">{title}</h2>

                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
                  {category && (
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Category:</span> {category}
                    </span>
                  )}
                  {subCategory && (
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Sub Category:</span> {subCategory}
                    </span>
                  )}
                  {typeof record.department === 'string' && record.department && (
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Department:</span> {record.department}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 gap-2 rounded-lg font-semibold">
                    Actions <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={onEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit {config.singular}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {config.singular}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={() => setActive('course')}
                className={cn(
                  'h-9 gap-2 rounded-lg font-bold',
                  active === 'course' && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                )}
              >
                <Sparkles className="h-4 w-4" /> Build Course
              </Button>

              <Button variant="outline" onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-lg p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation cards */}
        <div className="g2g-scrollbar flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 border-b border-border p-5 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => {
              const selected = active === card.id

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setActive(card.id)}
                  aria-pressed={selected}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200',
                    selected
                      ? 'border-primary bg-primary/10 shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.6)]'
                      : 'border-border bg-card/60 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40',
                  )}
                >
                  <span className="flex flex-col gap-1.5">
                    <card.icon className={cn('h-5 w-5', selected ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('text-sm font-bold leading-tight', selected ? 'text-primary' : 'text-foreground')}>
                      {card.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{card.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Selected panel */}
          <div className="p-5">
            {error && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-semibold text-destructive">{error}</p>
                <Button variant="outline" onClick={load} className="h-8 rounded-lg text-xs font-semibold">
                  Retry
                </Button>
              </div>
            )}

            {active === 'course' ? (
              <CourseBuilderPanel data={skill} title={title} record={record} />
            ) : active === 'details' ? (
              <DetailsPanel config={config} record={record} />
            ) : loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
              </div>
            ) : isSkill ? (
              <SkillPanels active={active} data={skill} />
            ) : (
              <KasaPanels active={active} usage={usage} noun={config.singular} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Details — every recorded field
 * ------------------------------------------------------------------ */

/** Columns that carry no meaning for a reader. */
const HIDDEN_KEYS = new Set([
  'id',
  'sub_institute_id',
  'created_by',
  'updated_by',
  'deleted_by',
  'deleted_at',
  'syear',
  'department_id',
])

function DetailsPanel({ config, record }: { config: LibraryTabConfig; record: LibraryRow }) {
  // Configured fields first and in order, then anything else the row carries,
  // so a column added server-side still shows up instead of vanishing.
  const configured = config.fields
    .map((field) => ({ key: field.key, label: field.label }))
    .filter(({ key }) => hasValue(record[key]))

  const seen = new Set(configured.map((field) => field.key))

  const extra = Object.keys(record)
    .filter((key) => !seen.has(key) && !HIDDEN_KEYS.has(key) && hasValue(record[key]))
    .map((key) => ({ key, label: humanise(key) }))

  const all = [...configured, ...extra]

  if (all.length === 0) {
    return <Empty message="Nothing has been recorded for this entry yet." />
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {all.map(({ key, label }) => (
        <div key={key} className="rounded-xl border border-border bg-card/40 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="mt-1.5 text-sm leading-relaxed text-foreground">
            <FieldValue value={record[key]} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** JSON-encoded list columns are common here, so they render as lists. */
function FieldValue({ value }: { value: unknown }) {
  const list = asList(value)

  if (list) {
    return (
      <ul className="space-y-0.5">
        {list.map((entry, index) => (
          <li key={index} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span>{entry}</span>
          </li>
        ))}
      </ul>
    )
  }

  const text = String(value)

  if (/^https?:\/\//i.test(text)) {
    return (
      <a
        href={text}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline-offset-2 hover:underline"
      >
        {text}
      </a>
    )
  }

  return <span className="whitespace-pre-wrap">{text}</span>
}

/* ------------------------------------------------------------------ *
 * Skill panels
 * ------------------------------------------------------------------ */

function SkillPanels({ active, data }: { active: string; data: SkillDetailResponse | null }) {
  if (active === 'jobroles') {
    return <JobRoleList roles={data?.userJobroleData ?? []} />
  }

  if (active === 'levels') {
    const levels = data?.userproficiency_levelData ?? []

    if (levels.length === 0) return <Empty message="No proficiency levels have been defined." />

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {levels.map((level) => (
          <div key={level.id} className="rounded-xl border border-border p-4">
            <p className="text-sm font-bold text-foreground">
              {level.proficiency_level ? `Level ${level.proficiency_level}` : 'Unlevelled'}
            </p>
            <dl className="mt-2 space-y-1.5 text-xs">
              <Row label="Description" value={level.description ?? level.proficiency_description} />
              <Row label="Type" value={level.proficiency_type} />
              <Row label="Type description" value={level.type_description} />
              <Row label="Item" value={level.classification_item} />
            </dl>
          </div>
        ))}
      </div>
    )
  }

  if (active === 'attitude' || active === 'behaviour') {
    const items = active === 'attitude' ? data?.userAttitudeData : data?.userBehaviourData
    return <ItemList items={items ?? []} />
  }

  const groups =
    active === 'knowledge'
      ? data?.userViewKnowledge
      : active === 'ability'
        ? data?.userViewAbility
        : data?.userViewApplication

  return <LevelledItems groups={groups ?? []} label={active} />
}

/** Items tabbed by proficiency level — a competency only means something at a level. */
function LevelledItems({ groups, label }: { groups: ProficiencyGroup[]; label: string }) {
  const levels = groups.map((group) => String(group.proficiency_level)).filter(Boolean)
  const [picked, setPicked] = useState<string | null>(null)
  const current = picked && levels.includes(picked) ? picked : (levels[0] ?? null)

  if (levels.length === 0) return <Empty message={`No ${label} items recorded.`} />

  const items = groups.find((group) => String(group.proficiency_level) === current)?.items ?? []
  const descriptor = items.find((item) => item.proficiency_description)?.proficiency_description

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setPicked(level)}
            aria-pressed={current === level}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-bold transition-colors',
              current === level
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-accent',
            )}
          >
            Level {level}
          </button>
        ))}
      </div>

      {descriptor && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">What this level means</p>
          <p className="mt-1 text-sm font-medium text-foreground">{descriptor}</p>
        </div>
      )}

      <ItemList items={items} />
    </div>
  )
}

function ItemList({ items }: { items: ClassificationItem[] }) {
  if (items.length === 0) return <Empty message="Nothing recorded here." />

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-border bg-card/40 p-3.5">
          <p className="text-sm font-semibold text-foreground">{item.classification_item || 'Untitled'}</p>
          {(item.classification_category || item.classification_sub_category) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {[item.classification_category, item.classification_sub_category].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * KASA panels — the ones the old popup left empty
 * ------------------------------------------------------------------ */

function KasaPanels({ active, usage, noun }: { active: string; usage: KasaUsage | null; noun: string }) {
  if (active === 'skills') {
    const skills = usage?.skills ?? []

    if (skills.length === 0) {
      return <Empty message={`No skill references this ${noun.toLowerCase()} yet.`} />
    }

    return (
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {skills.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-border bg-card/40 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-foreground">{entry.skill_title}</p>
              {entry.proficiency_level && (
                <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                  L{entry.proficiency_level}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {[entry.skill_category, entry.skill_sub_category, entry.skill_department]
                .filter(Boolean)
                .join(' · ') || 'No category recorded'}
            </p>
          </div>
        ))}
      </div>
    )
  }

  if (active === 'jobroles') {
    return <JobRoleList roles={usage?.jobroles ?? []} />
  }

  const levels = usage?.levels ?? []

  if (levels.length === 0) return <Empty message="This entry is not tied to a proficiency level yet." />

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Appears at {levels.length === 1 ? 'one level' : `${levels.length} levels`} across{' '}
        {usage?.skill_count ?? 0} skill{(usage?.skill_count ?? 0) === 1 ? '' : 's'}.
      </p>
      <div className="flex flex-wrap gap-2">
        {levels.map((level) => (
          <span
            key={level}
            className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary"
          >
            Level {level}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Shared
 * ------------------------------------------------------------------ */

function JobRoleList({ roles }: { roles: { id: number; jobrole: string; sector?: string | null; track?: string | null; description?: string | null; jobrole_category?: string | null; proficiency_level: string | null; proficiency_description: string | null }[] }) {
  if (roles.length === 0) return <Empty message="Not mapped to any job role yet." />

  // The same role can appear once per skill, which reads as duplication.
  const unique = Array.from(new Map(roles.map((role) => [`${role.jobrole}|${role.proficiency_level}`, role])).values())

  return (
    <div className="space-y-2">
      {unique.map((role) => (
        <div key={role.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{role.jobrole}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[role.jobrole_category, role.sector, role.track].filter(Boolean).join(' · ') || 'No sector recorded'}
            </p>
            {(role.proficiency_description || role.description) && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {role.proficiency_description || role.description}
              </p>
            )}
          </div>

          {role.proficiency_level && (
            <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Level {role.proficiency_level}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function Row({ label, value }: { label: string; value: unknown }) {
  if (!hasValue(value)) return null

  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-semibold text-muted-foreground">{label}:</dt>
      <dd className="text-foreground">{String(value)}</dd>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim() !== '' && value.trim() !== 'null'
  if (Array.isArray(value)) return value.length > 0
  return true
}

/** `sop_practice_link` reads better as "Sop practice link" than as a raw key. */
function humanise(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Several columns hold a JSON array as text. Rendering that raw shows the user
 * `["a","b"]`, so it is unpacked when it parses to a list of scalars.
 */
function asList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).filter((entry) => entry.trim() !== '')
  }

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed.startsWith('[')) return null

  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) return null

    const entries = parsed
      .map((entry) => (typeof entry === 'object' && entry !== null ? JSON.stringify(entry) : String(entry)))
      .filter((entry) => entry.trim() !== '')

    return entries.length > 0 ? entries : null
  } catch {
    return null
  }
}
