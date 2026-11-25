/**
 * The Product Atlas: every module and sub-module of the K12 product, one record each, written from source (docs/client-presentation/content/atlas)
 * and built into generated/atlas.json by scripts/client-presentation/build-atlas.mjs. This file turns that data into the plan of new slides.
 * Pure TypeScript, no React, so navigation and tests can use it.
 *
 * The atlas is organised BY PRODUCT, so a client who cares about one module can open it directly and never sit through the others:
 *   a product hub (one button per product), then for each product in turn: its opener (what it is, the problem it removes, the technology,
 *   the benefit), its sub-modules five at a time (one press of Next each), a "how it works" slide (workflow, technology, AI) and its screens.
 * Every slide carries a product rail (jump to any product) and the product slides run on into the next product, so Next also works.
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

export interface Atlas {
  captured: string
  products: AtlasProduct[]
}

export const ATLAS = atlasJson as unknown as Atlas

export type AtlasKind = 'hub' | 'opener' | 'subs' | 'glance' | 'gallery'

export interface AtlasSlide {
  key: string
  n: number
  kind: AtlasKind
  theme: 'ink' | 'paper'
  title: string
  kicker: string
  /** "2/5" for a part of a product, otherwise empty. */
  ghost: string
  /** The product the slide belongs to (absent on the hub). */
  family?: string
  /** Sub-module ids shown by a spotlight or a gallery slide. */
  subs?: string[]
  /** Presses of Next after the entrance. */
  beats: number
}

/** Even chunks of at most `max` items. */
export function chunk<T>(items: T[], max = 5): T[][] {
  if (!items.length) return []
  const parts = Math.ceil(items.length / max)
  const size = Math.ceil(items.length / parts)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export const GALLERY_PER_SLIDE = 9

export function buildAtlasPlan(a: Atlas = ATLAS): AtlasSlide[] {
  const filled = a.products.filter((p) => p.subs.length)
  if (!filled.length) return []
  const plan: Omit<AtlasSlide, 'key' | 'n'>[] = [{ kind: 'hub', theme: 'ink', title: 'Choose a product', kicker: 'Products', ghost: '', beats: 0 }]
  for (const p of filled) {
    plan.push({ kind: 'opener', theme: 'ink', title: p.product, kicker: p.k12_module, ghost: '', family: p.key, beats: 0 })
    const groups = chunk(p.subs, 5)
    groups.forEach((g, i) => plan.push({ kind: 'subs', theme: 'ink', title: p.product, kicker: p.k12_module, ghost: `${i + 1}/${groups.length}`, family: p.key, subs: g.map((s) => s.id), beats: g.length - 1 }))
    plan.push({ kind: 'glance', theme: 'paper', title: p.product, kicker: p.k12_module, ghost: '', family: p.key, beats: 0 })
    const gal = chunk(p.subs.filter((s) => s.shots.length), GALLERY_PER_SLIDE)
    gal.forEach((g, i) => plan.push({ kind: 'gallery', theme: 'paper', title: p.product, kicker: p.k12_module, ghost: gal.length > 1 ? `${i + 1}/${gal.length}` : '', family: p.key, subs: g.map((s) => s.id), beats: 0 }))
  }
  return plan.map((s, i) => ({ ...s, key: `a${i + 1}`, n: 200 + i + 1 }))
}

export const ATLAS_PLAN: AtlasSlide[] = buildAtlasPlan()
export const ATLAS_KEYS: string[] = ATLAS_PLAN.map((s) => s.key)
export const atlasByN = (n: number): AtlasSlide | undefined => ATLAS_PLAN.find((s) => s.n === n)

export const productOf = (key: string): AtlasProduct | undefined => ATLAS.products.find((p) => p.key === key)
export const HUB_KEY: string = ATLAS_PLAN[0]?.key ?? ''
/** The scene key that opens a product. */
export const openerKeyOf = (family: string): string => ATLAS_PLAN.find((s) => s.kind === 'opener' && s.family === family)?.key ?? HUB_KEY
/** The products that have slides, in order, with the key of their opener and a short name for the rail. */
export const PRODUCT_NAV: { key: string; product: string; short: string; opener: string }[] = ATLAS.products
  .filter((p) => p.subs.length)
  .map((p) => ({ key: p.key, product: p.product, short: p.product.replace(/^Scholar /, ''), opener: openerKeyOf(p.key) }))

/** Deck slides for the atlas scenes, so presenter notes and slide numbers work the same way as for the story slides. */
export function atlasSlides(plan: AtlasSlide[] = ATLAS_PLAN, a: Atlas = ATLAS): Slide[] {
  return plan.map((s) => {
    const p = s.family ? a.products.find((x) => x.key === s.family) : undefined
    const names = s.subs?.map((id) => p?.subs.find((x) => x.id === id)?.name).filter(Boolean).join(', ') ?? ''
    const say =
      s.kind === 'hub' ? 'Which product would you like to see first? Click one, or press 1 to 5. Next shows them in order.'
      : s.kind === 'opener' ? `${s.title}, ${s.kicker}: what it is, the problem it removes, the technology behind it and what could become easier.`
      : s.kind === 'subs' ? `${s.title}, ${s.kicker}: ${names}. One press of Next opens each sub-module: what it is, the problem it removes, its features, the technology behind it and what could become easier.`
      : s.kind === 'glance' ? `${s.title}: how the work flows through the product, what it runs on, and where AI and intelligence help.`
      : `${s.title}: screens from the working product, edited for this presentation. Personal details are removed.`
    return { n: s.n, id: `atlas-${s.key}`, section: 'Product Atlas', lines: [{ role: 'headline', text: s.title, kind: 'concept' }], say, ask: '', transition: '', limits: [], slots: [] }
  })
}
