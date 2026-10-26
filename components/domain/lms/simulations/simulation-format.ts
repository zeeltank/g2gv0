import type { SimulationCard } from '@/services/lms/simulations'

/**
 * How a category looks. The categories themselves are DATA (whatever the organisation's simulations say), so this only sorts a category's name
 * into a broad kind by the words in it; `CategoryIcon` (simulation-bits.tsx) draws a glyph for the kind. A category nobody anticipated is
 * 'general' and still gets its pill, just with the neutral icon.
 */
export type CategoryKind = 'security' | 'data' | 'infrastructure' | 'engineering' | 'commercial' | 'finance' | 'health' | 'people' | 'science' | 'general'

const CATEGORY_KINDS: [RegExp, CategoryKind][] = [
  [/secur|cyber|complian|risk|privacy|safety/i, 'security'],
  [/data|machine|learning|\bml\b|\bai\b|analytic|statistic/i, 'data'],
  [/network|infra|cloud|devops|operation|system|server|platform/i, 'infrastructure'],
  [/engineer|software|code|program|develop|architect/i, 'engineering'],
  [/sales|market|customer|crm|commerc|retail/i, 'commercial'],
  [/financ|account|bank|audit|tax/i, 'finance'],
  [/health|medic|clinic|care/i, 'health'],
  [/people|\bhr\b|human|leader|manag|communicat|soft skill/i, 'people'],
  [/science|physic|chem|biolog|\blab\b|math/i, 'science'],
]

export function categoryKindOf(category: string | null | undefined): CategoryKind {
  const name = (category ?? '').trim()
  if (name === '') return 'general'
  return CATEGORY_KINDS.find(([pattern]) => pattern.test(name))?.[1] ?? 'general'
}

export function categoryLabelOf(card: Pick<SimulationCard, 'category'>): string {
  const label = (card.category ?? '').trim()
  return label === '' ? 'General' : label
}

const DIFFICULTY: Record<string, { label: string; level: 1 | 2 | 3 }> = {
  intro: { label: 'Introductory', level: 1 },
  intermediate: { label: 'Intermediate', level: 2 },
  advanced: { label: 'Advanced', level: 3 },
}

/**
 * A difficulty the specification names, as a label and a 1-3 level. Anything unrecognised is shown as written, at the middle level; anything that
 * is not text at all (a specification is data somebody typed, so `2` or `null` can arrive) is no difficulty.
 */
export function difficultyOf(value: unknown): { label: string; level: 1 | 2 | 3 } | null {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (key === '') return null
  return DIFFICULTY[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1), level: 2 }
}

export function minutesLabel(minutes: unknown): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 1) return null
  const whole = Math.round(minutes)
  return whole >= 60 ? `${Math.floor(whole / 60)} h${whole % 60 ? ` ${whole % 60} min` : ''}` : `${whole} min`
}

/* ------------------------------------------------------------------ reading a specification safely */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const asText = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null)
const asTexts = (value: unknown): string[] => (Array.isArray(value) ? value.map(asText).filter((text): text is string => text !== null) : [])

export interface SpecMission {
  id: string | null
  kind: string | null
  title: string | null
  brief: string | null
}

/** What the screens show about a specification, every field already checked for the type it is used as. */
export interface SpecFacts {
  id: string | null
  title: string | null
  subtitle: string | null
  summary: string | null
  intro: string | null
  minutes: number | null
  difficulty: string | null
  category: string | null
  tags: string[]
  authors: string[]
  /** How many competencies it builds (the ids themselves are not shown). */
  competencies: number
  missions: SpecMission[]
}

/**
 * The facts of a specification the screens display, read defensively. A specification is stored as the author wrote it and the server checks
 * its shape, but a screen that trusted the type of every field would crash for everybody who opens a card (or the add dialog, with text that is
 * still being typed) the moment one of them is a number, a list, or missing. Every read of a specification goes through here.
 */
export function readSpec(spec: unknown): SpecFacts {
  const root = isRecord(spec) ? spec : {}
  const meta = isRecord(root.meta) ? root.meta : {}
  const lesson = isRecord(root.lesson) ? root.lesson : {}
  return {
    id: asText(root.id),
    title: asText(root.title),
    subtitle: asText(root.subtitle),
    summary: asText(root.summary),
    intro: asText(lesson.intro),
    minutes: typeof meta.minutes === 'number' && Number.isFinite(meta.minutes) ? meta.minutes : null,
    difficulty: asText(meta.difficulty),
    category: asText(meta.category),
    tags: asTexts(meta.tags),
    authors: asTexts(meta.authors),
    competencies: Array.isArray(meta.competencies) ? meta.competencies.filter((id) => typeof id === 'number').length : 0,
    missions: Array.isArray(lesson.missions)
      ? lesson.missions.filter(isRecord).map((mission) => ({ id: asText(mission.id), kind: asText(mission.kind), title: asText(mission.title), brief: asText(mission.brief) }))
      : [],
  }
}

export function missionsLabel(count: number): string | null {
  return count > 0 ? `${count} ${count === 1 ? 'mission' : 'missions'}` : null
}

/** "01", "02" ... the number a card carries in the gallery. */
export function cardNumber(index: number): string {
  return String(index + 1).padStart(2, '0')
}

/** The label of the button that starts a simulation, from where the learner stands in it. */
export function startLabel(card: Pick<SimulationCard, 'progress' | 'status'>): string {
  if (card.progress?.status === 'completed') return 'Play again'
  if (card.progress) return `Continue · ${card.progress.percent}%`
  return card.status === 'published' ? 'Start simulation' : 'Preview simulation'
}
