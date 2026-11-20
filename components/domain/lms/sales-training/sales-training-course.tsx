'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Clock, PlayCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { SALES_PRODUCTS, type SalesProductKey } from '@/lib/sales-training/deck'
import { markSalesDone, readSalesProgress, type SalesProgress } from '@/lib/sales-training/progress'
import { SalesTrainingLauncher } from './sales-training-launcher'

/**
 * Sales Training as courses in My Learning: one card per product in the course grid, and a course page that looks like
 * any other course (back arrow, title, tabs) with the scenario player in the Learn tab.
 *
 * These are not database courses: they are generated scenario decks served from /sales-training, and their progress
 * lives in this browser. That is stated on the page so nobody expects them in reports.
 */

const productOf = (key: SalesProductKey) => SALES_PRODUCTS.find((p) => p.key === key)!

/** The slide count of each deck, written next to the decks by the generator (public/sales-training/index.json). */
function useSlideTotals() {
  const [totals, setTotals] = useState<Partial<Record<SalesProductKey, number>>>({})
  useEffect(() => {
    let live = true
    fetch('/sales-training/index.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: Record<string, { slides?: number }> | null) => {
        if (!live || !json) return
        const next: Partial<Record<SalesProductKey, number>> = {}
        for (const p of SALES_PRODUCTS) if (typeof json[p.key]?.slides === 'number') next[p.key] = json[p.key].slides
        setTotals(next)
      })
      .catch(() => undefined)
    return () => { live = false }
  }, [])
  return totals
}

function useProgress(key: SalesProductKey, total: number) {
  const [progress, setProgress] = useState<SalesProgress>({ seen: 0, total, percent: 0, done: false })
  const refresh = useCallback(() => setProgress(readSalesProgress(key, total)), [key, total])
  useEffect(() => {
    refresh()
    // The player runs in a frame or another tab; storage events and focus tell this page to re-read.
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])
  return { progress, refresh }
}

/**
 * The cards, to be placed inside the My Learning course grid. `keys` picks the products; `title` is the course title
 * ("G2G Sales Training") or the card title used in the Sales row ("G2G Sales").
 */
export function SalesTrainingCards({
  onOpen,
  keys,
  title = 'course',
}: {
  onOpen: (key: SalesProductKey) => void
  keys?: ReadonlyArray<SalesProductKey>
  title?: 'course' | 'card'
}) {
  const totals = useSlideTotals()
  return (
    <>
      {SALES_PRODUCTS.filter((p) => !keys || keys.includes(p.key)).map((p) => (
        <SalesTrainingCard key={p.key} productKey={p.key} total={totals[p.key] ?? 0} onOpen={onOpen} title={title} />
      ))}
    </>
  )
}

function SalesTrainingCard({ productKey, total, onOpen, title }: { productKey: SalesProductKey; total: number; onOpen: (key: SalesProductKey) => void; title: 'course' | 'card' }) {
  const product = productOf(productKey)
  const { progress } = useProgress(productKey, total)
  const started = progress.seen > 0
  return (
    <button
      type="button"
      onClick={() => onOpen(productKey)}
      className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-bold text-white" style={{ background: product.accent }} aria-hidden>
          <PlayCircle className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{title === 'card' ? product.cardName : product.name}</h3>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{product.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-muted-foreground">{total > 0 ? `${Math.min(progress.seen, total)}/${total} slides` : 'Interactive scenario'}</span>
          <span className="text-foreground">{progress.percent}%</span>
        </div>
        <Progress value={progress.percent} className="h-1.5 bg-muted-foreground/20 [&>div]:bg-primary" />
      </div>

      <div className="flex items-center justify-between">
        <StatusBadge variant={progress.done ? 'success' : started ? 'processing' : 'default'} size="sm" className="text-[10px] font-bold uppercase tracking-wider">
          {progress.done ? 'Completed' : started ? 'In Progress' : 'Not started'}
        </StatusBadge>
        <span className="text-[11px] text-muted-foreground">About 30 min</span>
      </div>
    </button>
  )
}

const TABS = [
  { id: 'learn', label: 'Learn', icon: PlayCircle },
  { id: 'contents', label: 'Contents', icon: BookOpen },
] as const

/** The course page: the same header and tabs as the other courses, with the scenario in the Learn tab. */
export function SalesTrainingCourseView({ productKey, onBack }: { productKey: SalesProductKey; onBack: () => void }) {
  const product = productOf(productKey)
  const totals = useSlideTotals()
  const { progress, refresh } = useProgress(productKey, totals[productKey] ?? 0)
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('learn')

  const onComplete = useCallback(() => {
    markSalesDone(productKey)
    refresh()
  }, [productKey, refresh])

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 pt-2">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={onBack} aria-label="Back to my courses">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{product.name}</h1>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{product.subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Clock className="size-3.5" /> About 30 min
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-4">
        <div className="flex w-full min-w-0 items-center gap-6 overflow-x-auto border-b border-border/60">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn('relative flex items-center gap-1.5 whitespace-nowrap pb-3 text-sm font-semibold outline-none transition-colors', tab === t.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
            >
              <t.icon className="size-4" />
              {t.label}
              {tab === t.id && <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-t-full bg-primary" />}
            </button>
          ))}
        </div>

        {tab === 'learn' ? (
          <SalesTrainingLauncher productKey={productKey} title={product.name} completed={progress.done} onProgress={refresh} onComplete={onComplete} />
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5">
            <p className="text-sm text-muted-foreground">This course is one interactive lesson. Open Learn and work through its parts in order, or jump around with the buttons on each slide.</p>
            <ol className="flex flex-col gap-3 text-sm">
              <li><strong>1. Product facts</strong> - what {product.about} is, every module and what each role does in it, who it is for, and what is and is not documented.</li>
              <li><strong>2. Scenario</strong> - a fictional customer and a branching conversation. Every choice has its own consequence.</li>
              <li><strong>3. Outcome</strong> - a deal won, won with concessions or stalled, with coaching.</li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Progress for this course is kept in this browser and is not part of enrolment reports. Customers and quotes are fictional training content.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
