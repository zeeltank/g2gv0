/**
 * The Product Atlas: every module and sub-module of the K12 product, one record each, written from source (docs/client-presentation/content/atlas)
 * and built into generated/atlas.json by scripts/client-presentation/build-atlas.mjs. This file turns that data into the plan of new slides.
 * Pure TypeScript, no React, so navigation and tests can use it.
 */
import atlasJson from './generated/atlas.json'
import type { Slide } from './deck'

export interface AtlasSub {
  id: string
  name: string
  screens: string[]
  screen_count: number
  summary: string
  problem: string
  features: string[]
  research: string | null
  technology: string[]
  benefit: string
  workflow: string[]
  data: string
  shots: string[]
}

export interface AtlasFamily {
  summary: string
  problem: string
  benefit: string
  technology: string[]
  research: string | null
  workflow: string[]
  ai: string[]
}

export interface AtlasProduct {
  key: string
  product: string
  k12_module: string
  family: AtlasFamily | null
  subs: AtlasSub[]
}

export interface AtlasTech {
  pillars: { name: string; lines: string[] }[]
  designed_from: string[]
}

export interface Atlas {
  captured: string
  products: AtlasProduct[]
  tech?: AtlasTech
}

export const ATLAS = atlasJson as unknown as Atlas

export type AtlasKind = 'big' | 'families' | 'problems' | 'subs' | 'workflows' | 'tech' | 'benefits' | 'gallery'

export interface AtlasSlide {
  key: string
  n: number
  kind: AtlasKind
  theme: 'ink' | 'paper'
  title: string
  kicker: string
  ghost: string
  family?: string
  subs?: string[]
  intro?: boolean
  /** Presses of Next after the entrance. */
  beats: number
}

const BIG: { title: string; kicker: string; ghost: string }[] = [
  { title: 'What every module is', kicker: 'Summary', ghost: '01' },
  { title: 'Which problem we solve', kicker: 'Problems', ghost: '02' },
  { title: 'Inside every module', kicker: 'Modules and sub-modules', ghost: '03' },
  { title: 'How the work flows', kicker: 'Workflows', ghost: '04' },
  { title: 'Where our AI helps', kicker: 'AI and technology', ghost: '05' },
  { title: 'What could become easier', kicker: 'Benefits', ghost: '06' },
  { title: 'See it for real', kicker: 'Screens', ghost: '07' },
]

/** Even chunks of at most `max` items. */
export function chunk<T>(items: T[], max = 5): T[][] {
  if (!items.length) return []
  const parts = Math.ceil(items.length / max)
  const size = Math.ceil(items.length / parts)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function buildAtlasPlan(a: Atlas = ATLAS): AtlasSlide[] {
  const plan: Omit<AtlasSlide, 'key' | 'n'>[] = []
  const big = (i: number, theme: 'ink' | 'paper') => plan.push({ kind: 'big', theme, beats: 0, ...BIG[i] })
  const named = (kind: AtlasKind, i: number, theme: 'ink' | 'paper', beats = 0) => plan.push({ kind, theme, beats, ...BIG[i] })
  const filled = a.products.filter((p) => p.subs.length)
  if (!filled.length) return []
  big(0, 'ink'); named('families', 0, 'paper')
  big(1, 'ink'); named('problems', 1, 'paper')
  big(2, 'ink')
  for (const p of filled) {
    const groups = chunk(p.subs, 5)
    groups.forEach((g, i) => {
      const intro = i === 0 && Boolean(p.family)
      plan.push({ kind: 'subs', theme: 'ink', title: p.product, kicker: p.k12_module, ghost: `${i + 1}/${groups.length}`, family: p.key, subs: g.map((s) => s.id), intro, beats: intro ? g.length : g.length - 1 })
    })
  }
  big(3, 'paper'); named('workflows', 3, 'ink')
  big(4, 'ink'); named('tech', 4, 'paper', 2)
  big(5, 'paper'); named('benefits', 5, 'ink')
  big(6, 'ink'); named('gallery', 6, 'paper', filled.length - 1)
  return plan.map((s, i) => ({ ...s, key: `a${i + 1}`, n: 200 + i + 1 }))
}

export const ATLAS_PLAN: AtlasSlide[] = buildAtlasPlan()
export const ATLAS_KEYS: string[] = ATLAS_PLAN.map((s) => s.key)
export const atlasByN = (n: number): AtlasSlide | undefined => ATLAS_PLAN.find((s) => s.n === n)

export const productOf = (key: string): AtlasProduct | undefined => ATLAS.products.find((p) => p.key === key)

/** Deck slides for the atlas scenes, so presenter notes and slide numbers work the same way as for the story slides. */
export function atlasSlides(plan: AtlasSlide[] = ATLAS_PLAN, a: Atlas = ATLAS): Slide[] {
  return plan.map((s) => {
    const p = s.family ? productOf(s.family) : undefined
    const names = s.subs?.map((id) => p?.subs.find((x) => x.id === id)?.name).filter(Boolean).join(', ') ?? ''
    const say =
      s.kind === 'subs' ? `${s.title}, ${s.kicker}: ${names}. One press of Next opens each sub-module: what it is, the problem it removes, its features, the technology behind it and what could become easier.`
      : s.kind === 'big' ? `${s.title}.`
      : s.kind === 'gallery' ? 'Screens from the working product, edited for this presentation. Personal details are removed.'
      : `${s.title}.`
    return { n: s.n, id: `atlas-${s.key}`, section: 'Product Atlas', lines: [{ role: 'headline', text: s.title, kind: 'concept' }], say, ask: '', transition: '', limits: [], slots: [] }
  })
}
