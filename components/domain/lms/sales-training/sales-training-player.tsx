'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CircleCheck, List, RotateCcw, TriangleAlert, X } from 'lucide-react'

import {
  continueTarget,
  parseSalesDeck,
  type DecisionInteraction,
  type OutcomeInteraction,
  type SalesDeck,
  type SalesProductKey,
  type SalesSlide,
} from '@/lib/sales-training/deck'
import { markSalesDone } from '@/lib/sales-training/progress'

/**
 * The sales-training scenario player, drawn like the interactive lessons already in My Learning: a navy lesson header
 * with step pills and a percent-complete figure, a "slides seen" bar with an Outline button, a lavender stage, and a
 * 16:9 slide (navy cover with a Start lesson button, white fact slides, scene slides with a decision pop-up).
 *
 * Branching: a decision asks its question in a pop-up; each answer opens its own consequence slide; an outcome slide's
 * buttons choose what happens next. Previous walks back along the path the learner actually took.
 *
 * Nothing is sent to a server. The slides seen are kept in this browser (localStorage), per product. Inside a lesson
 * (embedded) it also reports progress to the lesson page by postMessage.
 */

const STORAGE = (key: string) => `sales-training:${key}`
const EXIT_HREF = '/module/lms/learning/my-learning'
const NAVY = '#1c2468'
const FINAL = ['won', 'wonConc', 'stalled']

function readSeen(key: string): number[] {
  try {
    const raw = window.localStorage.getItem(STORAGE(key))
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : []
  } catch {
    return []
  }
}
function writeSeen(key: string, seen: number[]) {
  try {
    window.localStorage.setItem(STORAGE(key), JSON.stringify(seen))
  } catch {
    /* private window or blocked storage: the player still works */
  }
}

type Phase = 'facts' | 'scenario' | 'outcome'
const PHASES: ReadonlyArray<{ key: Phase; label: string }> = [
  { key: 'facts', label: 'Product facts' },
  { key: 'scenario', label: 'Scenario' },
  { key: 'outcome', label: 'Outcome' },
]
function phaseOf(slide: SalesSlide): Phase {
  const i = slide.interaction
  if (i?.kind === 'outcome' && ['won', 'wonConc', 'stalled', 'lost'].includes(i.choice.id)) return 'outcome'
  if (i) return 'scenario'
  if (slide.slide_type === 'hook' || slide.slide_type === 'menu') return 'facts'
  return (slide.section ?? '').includes('Verified product facts') ? 'facts' : 'scenario'
}

type Load = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; deck: SalesDeck }

export function SalesTrainingPlayer({ productKey, initialSlide, embedded = false }: { productKey: SalesProductKey; initialSlide?: number; embedded?: boolean }) {
  const [load, setLoad] = useState<Load>({ phase: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/sales-training/${productKey}/deck.json`, { cache: 'no-store', signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('This sales-training deck could not be loaded.')
        return res.json()
      })
      .then((json) => setLoad({ phase: 'ready', deck: parseSalesDeck(json) }))
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name === 'AbortError') return
        setLoad({ phase: 'error', message: error instanceof Error ? error.message : 'This sales-training deck could not be loaded.' })
      })
    return () => controller.abort()
  }, [productKey])

  const shell = 'fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#eef0fb] p-6 text-center text-slate-700'
  if (load.phase === 'loading') return <div className={shell}><p className="text-sm">Loading the scenario...</p></div>
  if (load.phase === 'error') {
    return (
      <div className={shell}>
        <TriangleAlert className="size-8 text-amber-500" aria-hidden />
        <p className="max-w-md text-sm">{load.message}</p>
        <Link href={EXIT_HREF} className="rounded-md bg-[#1c2468] px-4 py-2 text-sm font-semibold text-white">Back to My Learning</Link>
      </div>
    )
  }
  return <Deck deck={load.deck} productKey={productKey} initialSlide={initialSlide} embedded={embedded} />
}

function Deck({ deck, productKey, initialSlide, embedded }: { deck: SalesDeck; productKey: SalesProductKey; initialSlide?: number; embedded: boolean }) {
  const bySlide = useMemo(() => new Map(deck.slides.map((s) => [s.n, s])), [deck])
  const firstN = deck.slides[0].n
  const [current, setCurrent] = useState(() => (initialSlide !== undefined && bySlide.has(initialSlide) ? initialSlide : firstN))
  const [trail, setTrail] = useState<number[]>([])
  const [seen, setSeen] = useState<number[]>([])
  const [outline, setOutline] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => setSeen(readSeen(productKey)), [productKey])
  useEffect(() => {
    setSeen((prev) => {
      if (prev.includes(current)) return prev
      const next = [...prev, current]
      writeSeen(productKey, next)
      return next
    })
    scroller.current?.scrollTo({ top: 0 })
  }, [current, productKey])

  const slide = bySlide.get(current) as SalesSlide
  const percent = Math.round((seen.length / deck.slides.length) * 100)

  // Inside a lesson, tell the lesson page how far the learner is. Reaching a won, won-with-concessions or stalled
  // ending completes the lesson; a lost deal does not.
  useEffect(() => {
    if (!embedded || typeof window === 'undefined' || window.parent === window) return
    const i = bySlide.get(current)?.interaction
    const done = i?.kind === 'outcome' && FINAL.includes(i.choice.id)
    window.parent.postMessage({ src: 'g2g-sales-training', key: productKey, type: done ? 'completed' : 'progress', slide: current, percent }, window.location.origin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, embedded])

  // Reaching a won, won-with-concessions or stalled ending is what completes the scenario, in a frame or on its own page.
  useEffect(() => {
    const i = bySlide.get(current)?.interaction
    if (i?.kind === 'outcome' && FINAL.includes(i.choice.id)) markSalesDone(productKey)
  }, [current, bySlide, productKey])

  const goto = useCallback((n: number) => { setTrail((t) => [...t, current]); setCurrent(n); setOutline(false) }, [current])
  const back = useCallback(() => {
    setTrail((t) => {
      if (t.length === 0) { if (current > firstN) setCurrent(current - 1); return t }
      setCurrent(t[t.length - 1])
      return t.slice(0, -1)
    })
  }, [current, firstN])
  const forward = continueTarget(deck, slide)
  const goForward = useCallback(() => { if (forward !== null) goto(forward) }, [forward, goto])
  const restart = () => { setTrail([]); setCurrent(firstN) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowLeft') back()
      if (e.key === 'ArrowRight') goForward()
      if (e.key === 'Escape') setOutline(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back, goForward])

  const accent = slide.accent ?? deck.accent
  const phase = phaseOf(slide)
  const interaction = slide.interaction
  const isCover = slide.slide_type === 'hook'
  // Each decision exists once per customer-confidence lane and has a recovery slide, so the real number comes from the section label ("Decision 3 of 8").
  const decisions = Math.max(0, ...deck.slides.map((x) => Number(/Decision \d+ of (\d+)/.exec(x.section ?? '')?.[1] ?? 0)))

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#eef0fb] text-slate-900">
      {/* Lesson header: title, step pills, progress */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-white" style={{ background: NAVY }}>
        <div className="min-w-0">
          <p className="truncate text-base font-bold leading-tight">{deck.title}</p>
          <p className="text-xs text-white/70">Branching scenario - {decisions} decisions</p>
        </div>
        <nav aria-label="Lesson steps" className="hidden flex-1 items-center gap-2 md:flex">
          {PHASES.map((p, i) => {
            const active = p.key === phase
            return (
              <span key={p.key} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ${active ? 'bg-white text-slate-900' : 'bg-white/10 text-white/90'}`}>
                <span className={`flex size-5 items-center justify-center rounded-full text-[11px] ${active ? 'text-white' : 'bg-white/20'}`} style={active ? { background: accent } : undefined}>{i + 1}</span>
                {p.label}
              </span>
            )
          })}
        </nav>
        <p className="ml-auto text-sm text-white/80">{percent}% complete</p>
        {embedded ? null : <Link href={EXIT_HREF} className="inline-flex items-center gap-1.5 rounded-md border border-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"><X className="size-3.5" aria-hidden />Exit</Link>}
      </header>
      {deck.nav && deck.nav.length > 0 ? (
        <nav aria-label="Sections" className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-2 text-white" style={{ background: '#14305a' }}>
          {deck.nav.map((b) => {
            const active = slide.group === b.label
            return (
              <button key={b.label} type="button" onClick={() => goto(b.goto)} aria-current={active ? 'page' : undefined}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${active ? 'border-teal-500 bg-teal-500 text-white' : 'border-white/25 bg-transparent text-white hover:bg-white/10'}`}>
                {b.label}
              </button>
            )
          })}
        </nav>
      ) : null}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <p className="truncate text-sm font-medium text-slate-700">{deck.title}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{seen.length} of {deck.slides.length} slides seen</span>
          <button type="button" onClick={restart} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw className="size-3.5" aria-hidden />Start over</button>
          <button type="button" onClick={() => setOutline(true)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><List className="size-3.5" aria-hidden />Outline</button>
        </div>
      </div>
      <div className="h-1.5 shrink-0 bg-indigo-100"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} /></div>

      {/* Stage: a 16:9 slide on the lavender background */}
      <div ref={scroller} className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 sm:p-5">
        <div className="relative aspect-video w-full max-w-[1180px] overflow-hidden rounded-sm bg-white shadow-xl ring-1 ring-slate-200 [container-type:inline-size]" style={{ maxHeight: '100%' }}>
          <div className="absolute inset-0 overflow-y-auto" style={{ fontSize: 'clamp(11px, 1.55cqw, 21px)' }}>
            {isCover ? (
              <CoverScreen key={slide.n} slide={slide} deck={deck} accent={accent} onStart={goForward} onGoto={goto} />
            ) : interaction?.kind === 'decision' ? (
              <DecisionScreen key={slide.n} slide={slide} interaction={interaction} onChoose={goto} accent={accent} />
            ) : interaction?.kind === 'outcome' ? (
              <OutcomeScreen key={slide.n} slide={slide} interaction={interaction} onGoto={goto} />
            ) : (
              <InfoScreen key={slide.n} slide={slide} accent={accent} onGoto={goto} />
            )}
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5">
        <button type="button" onClick={back} disabled={trail.length === 0 && current === firstN} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40">
          <ArrowLeft className="size-4" aria-hidden />Previous
        </button>
        <p className="hidden text-xs text-slate-500 md:block">
          {forward === null ? (interaction?.kind === 'decision' ? 'Choose an answer to go on.' : 'Use the buttons on the slide to choose what happens next.') : 'Continue when you are ready.'}
        </p>
        <button type="button" onClick={goForward} disabled={forward === null} className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-bold text-white disabled:opacity-40" style={{ background: NAVY }}>
          Continue<ArrowRight className="size-4" aria-hidden />
        </button>
      </footer>

      {outline ? <OutlineDrawer deck={deck} current={current} seen={seen} onJump={goto} onClose={() => setOutline(false)} accent={accent} /> : null}
    </div>
  )
}

/* ---------- Outline ---------- */

function OutlineDrawer({ deck, current, seen, onJump, onClose, accent }: { deck: SalesDeck; current: number; seen: number[]; onJump: (n: number) => void; onClose: () => void; accent: string }) {
  const groups = useMemo(() => {
    const out: Array<{ title: string; slides: SalesSlide[] }> = []
    for (const s of deck.slides) {
      // Consequence and recovery slides sit under the decision they belong to, so the outline reads as the story.
      const i = s.interaction
      const parts = (s.section ?? '').split(' - ')
      const title = i ? (i.kind === 'outcome' && FINAL.includes(i.choice.id) ? `${parts[0]} - Endings` : parts.slice(0, 2).join(' - ')) : `${parts[0]} - Facts`
      const last = out[out.length - 1]
      if (last && last.title === title) last.slides.push(s)
      else out.push({ title, slides: [s] })
    }
    return out
  }, [deck])
  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-label="Outline" className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-bold">Outline</h2>
          <button type="button" onClick={onClose} aria-label="Close outline" className="p-1 text-slate-500 hover:bg-slate-100"><X className="size-4" aria-hidden /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {groups.map((g, gi) => (
            <details key={gi} open={g.slides.some((s) => s.n === current)} className="mb-1 rounded-md border border-slate-200">
              <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-800">{g.title} <span className="font-normal text-slate-400">({g.slides.length})</span></summary>
              <ul className="border-t border-slate-100 py-1">
                {g.slides.map((s) => (
                  <li key={s.n}>
                    <button type="button" onClick={() => onJump(s.n)} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${s.n === current ? 'font-bold' : ''}`} style={s.n === current ? { color: accent } : undefined}>
                      <span className={`size-2 shrink-0 rounded-full ${seen.includes(s.n) ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden />
                      <span className="w-7 shrink-0 text-xs text-slate-400">{s.n}</span>
                      <span className="truncate">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </aside>
    </div>
  )
}

/* ---------- Slides ---------- */

function Backdrop({ slide }: { slide: SalesSlide }) {
  return slide.image ? (
    // eslint-disable-next-line @next/next/no-img-element -- local illustration served from /public
    <img src={slide.image.url} alt={slide.image.alt} className="absolute inset-0 h-full w-full object-cover" />
  ) : null
}

function CoverScreen({ slide, deck, accent, onStart, onGoto }: { slide: SalesSlide; deck: SalesDeck; accent: string; onStart: () => void; onGoto: (n: number) => void }) {
  return (
    <section aria-label="Cover" className="relative flex h-full flex-col justify-center overflow-hidden px-[6%] text-white" style={{ background: `linear-gradient(135deg, #0f1745 0%, ${NAVY} 55%, #28357f 100%)` }}>
      <div aria-hidden className="absolute -right-[6%] -top-[12%] size-[46%] rounded-full border border-white/15 bg-white/5" />
      <div aria-hidden className="absolute -right-[14%] top-[18%] size-[34%] rounded-full border border-white/10 bg-white/5" />
      <div aria-hidden className="absolute -bottom-[16%] left-[8%] size-[40%] rounded-full border border-white/10 bg-white/5" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-[0.45em]" style={{ background: accent }} />
      <p className="relative text-[0.8em] font-semibold uppercase tracking-[0.12em] text-white/80">Sales training - Interactive scenario</p>
      <h1 className="relative mt-[0.5em] max-w-[16em] text-[3.1em] font-extrabold leading-[1.05]">{(slide.product ?? deck.product).name}</h1>
      <p className="relative mt-[0.8em] max-w-[28em] text-[1.15em] leading-snug text-white/85">{(slide.product ?? deck.product).tagline}</p>
      <p className="relative mt-[0.6em] max-w-[34em] text-[0.8em] leading-snug text-white/60">{slide.content.body}</p>
      <div className="relative mt-[1.6em]">
        <button type="button" onClick={onStart} className="inline-flex items-center gap-[0.6em] rounded-full bg-white px-[1.4em] py-[0.65em] text-[0.95em] font-bold text-slate-900 hover:bg-indigo-50">
          Start lesson<ArrowRight className="size-[1.1em]" aria-hidden />
        </button>
      </div>
      {(slide.links ?? []).length > 0 ? (
        <div className="relative mt-[1.2em] flex max-w-[44em] flex-wrap gap-[0.6em]" aria-label="Where to start">
          {(slide.links ?? []).map((l) => (
            <button key={l.label} type="button" onClick={() => (l.href ? window.open(l.href, '_blank', 'noopener,noreferrer') : l.goto !== undefined && onGoto(l.goto))} className="rounded-full border border-white/40 bg-white/10 px-[1.1em] py-[0.5em] text-[0.82em] font-semibold text-white hover:bg-white/20">
              {l.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

type GoLink = { goto?: number; href?: string }
function LinkBtn({ l, onGo, className, style, children }: { l: GoLink; onGo: (l: GoLink) => void; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  if (l.href) return <a href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => onGo(l)} className={className} style={style}>{children}</a>
  return <button type="button" onClick={() => onGo(l)} className={className} style={style}>{children}</button>
}

function InfoScreen({ slide, accent, onGoto }: { slide: SalesSlide; accent: string; onGoto: (n: number) => void }) {
  const all = slide.links ?? []
  // Links that carry a group become small buttons at the top (a dropdown when the group has several items); the rest stay at the bottom.
  const grouped = all.filter((l) => l.group)
  const plainAll = all.filter((l) => !l.group)
  const cardLinkOf = (b: string) => plainAll.find((l) => b.startsWith(l.label + ': '))
  const consumed = new Set(slide.content.bullets.map(cardLinkOf).filter(Boolean))
  const links = plainAll.filter((l) => !consumed.has(l))
  const groupNames = [...new Set(grouped.map((l) => l.group as string))]
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const open = (l: GoLink) => { setOpenGroup(null); if (!l.href && l.goto !== undefined) onGoto(l.goto) }
  const shortLabel = (l: { label: string; group?: string }) => l.label.replace(/^(Feature|Used by|Show live demo|Also show): /, '')
  const tiles = links.length > 4
  const cols = links.length > 6 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  const verified = (slide.section ?? '').includes('Verified product facts')
  // Talk-track slides: the key points become tabs, one at a time, so the slide fits without scrolling.
  const tabOf = (label: string): string | null =>
    /^Problem/.test(label) ? 'The problem' : /^Why the customer/.test(label) ? 'Why needed' : /^How G2G/.test(label) ? 'How G2G helps' : /^How ScholarClone/.test(label) ? 'How ScholarClone helps' : / needs$/.test(label) ? 'What each role needs' : /^Business value/.test(label) ? 'Business value' : /^Ask$/.test(label) ? 'ask' : /^Status$/.test(label) ? 'status' : null
  const parsed = slide.content.bullets.map((b) => { const m = /^([^:]{2,40}): ([\s\S]*)$/.exec(b); return { b, label: m ? m[1] : '', text: m ? m[2] : b } })
  const tabNames = groupNames.length > 0 ? [...new Set(parsed.map((p) => tabOf(p.label)).filter((x): x is string => !!x && x !== 'ask' && x !== 'status'))] : []
  const tabbable = tabNames.length > 1
  const [tab, setTab] = useState(tabNames[0] ?? '')
  const askLine = parsed.find((p) => tabOf(p.label) === 'ask')
  const statusLine = parsed.find((p) => tabOf(p.label) === 'status')
  return (
    <section aria-label={slide.title} className="relative flex min-h-full flex-col gap-[0.9em] px-[3.5%] py-[3%]" style={slide.image ? { paddingRight: '35%' } : undefined}>
      {slide.image ? (
        <figure className="absolute right-[3%] top-[3%] w-[28%] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- local illustration served from /public */}
          <img src={slide.image.url} alt={slide.image.alt} className="aspect-[4/3] w-full object-cover" />
          <figcaption className="px-[0.7em] py-[0.5em] text-[0.62em] leading-tight text-slate-500">
            <span className="font-bold uppercase tracking-wide text-slate-700">{slide.image.tag ?? 'Illustration'}</span>
            {slide.image.credit ? <span className="block">Image: {slide.image.credit}</span> : null}
          </figcaption>
        </figure>
      ) : null}
      <div className="flex items-center gap-[0.7em]">
        <span className="h-[1.4em] w-[0.3em] rounded-sm" style={{ background: accent }} aria-hidden />
        <p className={`text-[0.72em] font-bold uppercase tracking-[0.12em] ${verified ? 'text-emerald-700' : 'text-amber-700'}`}>{slide.section}</p>
      </div>
      <h1 className="text-[2em] font-extrabold leading-tight text-slate-900">{slide.title}</h1>
      {groupNames.length > 0 ? (
        <div className="relative z-20 flex flex-wrap items-center gap-[0.6em]" aria-label="Quick links">
          {openGroup ? <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpenGroup(null)} /> : null}
          {groupNames.map((g) => {
            const items = grouped.filter((l) => l.group === g)
            if (items.length === 1) {
              const only = items[0]
              return (
                <LinkBtn key={g} l={only} onGo={open} className="relative z-20 inline-block rounded-full px-[1.1em] py-[0.5em] text-[0.85em] font-bold text-white shadow-sm" style={{ background: accent }}>
                  {g}{only.href ? ' ↗' : ''}
                </LinkBtn>
              )
            }
            const isOpen = openGroup === g
            return (
              <div key={g} className="relative z-20">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpenGroup(isOpen ? null : g)}
                  className="inline-flex items-center gap-[0.5em] rounded-full border-2 bg-white px-[1.1em] py-[0.45em] text-[0.85em] font-bold text-slate-900 hover:bg-slate-50" style={{ borderColor: accent }}>
                  {g} <span className="rounded-full px-[0.55em] text-[0.8em] text-white" style={{ background: accent }}>{items.length}</span> <span aria-hidden>{isOpen ? '▴' : '▾'}</span>
                </button>
                {isOpen ? (
                  <ul className="absolute left-0 top-[calc(100%+0.4em)] z-30 w-[22em] max-w-[80vw] overflow-hidden rounded-lg border border-slate-200 bg-white py-[0.3em] shadow-xl">
                    {items.map((l) => (
                      <li key={l.label}>
                        <LinkBtn l={l} onGo={open} className="flex w-full items-center justify-between gap-[0.8em] px-[1em] py-[0.6em] text-left text-[0.85em] font-semibold text-slate-900 hover:bg-slate-100">
                          <span>{shortLabel(l)}</span>
                          <span aria-hidden className="text-slate-400">{l.href ? '↗' : '→'}</span>
                        </LinkBtn>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
      {slide.content.body ? <p className="max-w-[48em] text-[0.95em] leading-snug text-slate-600">{slide.content.body}</p> : null}
      {tabbable ? (
        <div className="flex flex-col gap-[0.7em]">
          <div role="tablist" aria-label="Talk track" className="flex flex-wrap gap-[0.5em]">
            {tabNames.map((n) => (
              <button key={n} type="button" role="tab" aria-selected={tab === n} onClick={() => setTab(n)}
                className={`rounded-md px-[1em] py-[0.45em] text-[0.82em] font-bold ${tab === n ? 'text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                style={tab === n ? { background: accent } : undefined}>{n}</button>
            ))}
          </div>
          <ul role="tabpanel" className="grid gap-[0.6em] sm:grid-cols-2" aria-label={tab}>
            {parsed.filter((p) => tabOf(p.label) === tab).map((p, i) => (
              <li key={i} className="rounded-md border border-slate-200 bg-slate-50 p-[0.9em] text-[1em] leading-snug text-slate-800">
                {/needs$/.test(p.label) ? <span className="mb-[0.2em] block text-[0.72em] font-bold uppercase tracking-wide" style={{ color: accent }}>{p.label.replace(/ needs$/, '')}</span> : null}
                {p.text}
              </li>
            ))}
          </ul>
          {askLine ? <p className="rounded-md border border-indigo-200 bg-indigo-50 px-[1em] py-[0.6em] text-[0.9em] text-indigo-900"><span className="mr-[0.6em] rounded bg-indigo-900 px-[0.6em] py-[0.15em] text-[0.8em] font-bold text-white">ASK</span><i>{askLine.text}</i></p> : null}
          {statusLine ? <p className="text-[0.75em] text-slate-500">Status: {statusLine.text}</p> : null}
        </div>
      ) : slide.content.bullets.length > 0 ? (
        <ul className={`grid gap-[0.6em] ${slide.content.bullets.length > 4 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`} aria-label="Key points">
          {slide.content.bullets.map((b, i) => {
            const warn = /^NOT documented|^Limit:/.test(b)
            const cl = cardLinkOf(b)
            if (cl) {
              const [name, ...rest] = b.split(': ')
              return (
                <li key={i}>
                  <LinkBtn l={cl} onGo={open} className="block h-full w-full rounded-md border-2 bg-white p-[0.8em] text-left text-[0.88em] leading-snug text-slate-800 shadow-sm transition hover:bg-slate-50 hover:shadow-md" style={{ borderColor: accent }}>
                    <span className="mb-[0.25em] flex items-center justify-between font-bold" style={{ color: accent }}><span>{name}</span><span aria-hidden>→</span></span>
                    {rest.join(': ')}
                  </LinkBtn>
                </li>
              )
            }
            return (
              <li key={i} className={`rounded-md border p-[0.8em] text-[0.88em] leading-snug ${warn ? 'border-red-200 bg-red-50 text-red-900' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
                <span className="mb-[0.3em] flex size-[1.6em] items-center justify-center rounded text-[0.8em] font-bold text-white" style={{ background: warn ? '#c93b3b' : accent }}>{i + 1}</span>
                {b}
              </li>
            )
          })}
        </ul>
      ) : null}
      {links.length > 0 ? (
        <div className={tiles ? `grid gap-[0.5em] ${cols}` : 'mt-[0.3em] flex flex-wrap gap-[0.6em]'} aria-label="Go to">
          {links.map((l) => (
            <LinkBtn key={l.label} l={l} onGo={open}
              className={`text-left font-semibold leading-snug ${tiles ? 'rounded-md border-2 px-[0.9em] py-[0.55em] text-[0.82em] hover:bg-slate-50' : 'rounded-md px-[1.2em] py-[0.6em] text-[0.88em]'} ${l.primary ? 'text-white' : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'}`}
              style={l.primary ? { background: NAVY } : tiles ? { borderColor: accent, color: '#0f172a' } : undefined}>
              {l.label}
            </LinkBtn>
          ))}
        </div>
      ) : null}
      {slide.content.key_idea ? <p className="rounded-md border border-indigo-200 bg-indigo-50 px-[1em] py-[0.7em] text-[0.9em] font-semibold text-indigo-900">{slide.content.key_idea}</p> : null}
    </section>
  )
}

function DecisionScreen({ slide, interaction, onChoose, accent }: { slide: SalesSlide; interaction: DecisionInteraction; onChoose: (n: number) => void; accent: string }) {
  const [open, setOpen] = useState(true)
  const [chosen, setChosen] = useState<string | null>(null)
  const chosenRef = useRef<string | null>(null)

  const choose = useCallback((o: { id: string; goto: number }) => {
    if (chosenRef.current) return
    chosenRef.current = o.id
    setChosen(o.id)
    window.setTimeout(() => onChoose(o.goto), 350)
  }, [onChoose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const o = e.key.length === 1 ? interaction.options[e.key.toLowerCase().charCodeAt(0) - 97] : undefined
      if (o && !e.metaKey && !e.ctrlKey && !e.altKey) choose(o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, interaction.options, choose])

  return (
    <section aria-label="Decision" className="relative h-full min-h-full overflow-hidden bg-slate-900 text-white">
      <Backdrop slide={slide} />
      <div className="absolute inset-0 bg-slate-950/50" />
      <div className="absolute inset-x-0 top-0 z-10 bg-slate-950/70 px-[3%] py-[1.2%]">
        <p className="text-[0.7em] font-semibold uppercase tracking-[0.14em] text-sky-200">{slide.section}</p>
        <h2 className="text-[1.5em] font-bold leading-tight">{slide.title}</h2>
      </div>
      {!open ? (
        <div className="absolute inset-x-0 bottom-[6%] z-20 flex justify-center">
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-[0.5em] bg-white px-[1.4em] py-[0.6em] text-[0.95em] font-bold text-slate-900 hover:bg-sky-50">
            Answer the question<ArrowRight className="size-[1.1em]" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-[2.5%] pt-[8%]">
          <div aria-hidden className="absolute inset-0 bg-slate-950/55" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label="Decision" className="relative z-10 max-h-full w-full max-w-[38em] overflow-y-auto border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <header className="flex items-center justify-between gap-[1em] border-b border-slate-200 px-[1.4em] py-[0.6em]">
              <p className="text-[0.68em] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>{interaction.kicker}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Put the question away" className="p-[0.3em] text-slate-500 hover:bg-slate-100"><X className="size-[1.1em]" aria-hidden /></button>
            </header>
            <div className="px-[1.4em] pb-[1.1em] pt-[1em]">
              <h3 className="text-[1.15em] font-bold leading-snug">{interaction.question}</h3>
              <ul className="mt-[0.9em] space-y-[0.5em]" aria-label="Answers">
                {interaction.options.map((o, i) => {
                  const picked = chosen === o.id
                  return (
                    <li key={o.id}>
                      <button type="button" onClick={() => choose(o)} disabled={chosen !== null && !picked}
                        className={`flex w-full items-center gap-[0.8em] border px-[0.9em] py-[0.65em] text-left transition-colors disabled:opacity-50 ${picked ? 'bg-slate-100' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
                        style={picked ? { borderColor: accent } : undefined}>
                        <span className="flex size-[1.9em] shrink-0 items-center justify-center text-[0.85em] font-bold text-white" style={{ background: picked ? accent : '#0f172a' }}>{String.fromCharCode(65 + i)}</span>
                        <span className="min-w-0 flex-1 text-[0.92em] font-semibold leading-snug">{o.text}</span>
                        {picked ? <CircleCheck className="size-[1.2em] shrink-0" style={{ color: accent }} aria-hidden /> : <ArrowRight className="size-[1em] shrink-0 text-slate-400" aria-hidden />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <footer className="border-t border-slate-200 bg-slate-50 px-[1.4em] py-[0.5em] text-[0.72em] text-slate-500">Choose an answer, or press A, B or C. Each answer has its own consequence.</footer>
          </div>
        </div>
      )}
    </section>
  )
}

function OutcomeScreen({ slide, interaction, onGoto }: { slide: SalesSlide; interaction: OutcomeInteraction; onGoto: (n: number) => void }) {
  const sound = interaction.tone === 'sound'
  const tone = sound ? '#1e9e5a' : '#d98a00'
  const ended = ['lost', ...FINAL].includes(interaction.choice.id)
  return (
    <section aria-label="Outcome" className="relative h-full min-h-full overflow-hidden bg-slate-900 text-white">
      <Backdrop slide={slide} />
      <div className="absolute inset-0 bg-slate-950/65" />
      <div className="relative z-10 flex min-h-full flex-col justify-center gap-[0.5em] px-[6%] py-[3%]">
        <p className="text-[0.7em] font-semibold uppercase tracking-[0.14em] text-sky-200">{slide.section}</p>
        <h2 className="text-[1.9em] font-bold leading-tight">{slide.title}</h2>
        <div className="max-w-[44em] border bg-white p-[1.2em] text-slate-900 shadow-2xl" style={{ borderColor: tone }}>
          <p className="flex items-center gap-[0.5em] text-[0.85em] font-bold" style={{ color: tone }}>
            {sound ? <CircleCheck className="size-[1.3em]" aria-hidden /> : <TriangleAlert className="size-[1.3em]" aria-hidden />}
            {ended ? 'Result' : sound ? 'A sound choice' : 'Not the best choice'}
          </p>
          <p className="mt-[0.6em] text-[0.68em] font-semibold uppercase tracking-wide text-slate-500">{ended ? 'Outcome' : 'You chose'}</p>
          <p className="text-[0.9em] font-semibold leading-snug">{interaction.choice.text}</p>
          <p className="mt-[0.8em] text-[0.68em] font-semibold uppercase tracking-wide text-slate-500">What happens</p>
          <p className="text-[0.95em] leading-snug">{interaction.what}</p>
          <p className="mt-[0.8em] text-[0.68em] font-semibold uppercase tracking-wide text-slate-500">Why / coaching</p>
          <p className="text-[0.9em] leading-snug text-slate-700">{interaction.why}</p>
          <div className="mt-[1.1em] flex flex-wrap gap-[0.7em]">
            {interaction.actions.map((a) => (
              <button key={a.label} type="button" onClick={() => onGoto(a.goto)}
                className={`px-[1.2em] py-[0.55em] text-[0.88em] font-bold ${a.primary ? 'text-white' : 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50'}`}
                style={a.primary ? { background: NAVY } : undefined}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
