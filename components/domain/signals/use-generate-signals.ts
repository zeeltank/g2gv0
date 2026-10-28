'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { opportunitiesService, type ResearchRun, type ResearchStatusResponse } from '@/services/signals/opportunities'
import type { ProductInfo } from '@/services/portfolio/types'
import { runGuardedGenerate, type GenerateSub } from '@/lib/signals-generate'
import type { RegionSelection } from '@/lib/region-scope'
import { describeFinishedRun, type RunNotice } from '@/lib/signal-run-notice'

const POLL_MS = 2500
// A run always reaches an end state on the backend (finished, failed, or closed by the reaper within ~15 minutes), so the poll runs until it sees one.
// This cap (40 minutes) is only a backstop against a lost connection, never the normal way a poll ends.
const POLL_MAX = 960
const POLL_FAILURES_MAX = 12   // consecutive failed polls (about 30 s) before the screen says it lost contact

export type GenerateNotice = RunNotice

const errText = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback)

export { describeFinishedRun }

/** The sub-product chosen on the screen, with whether its own ICP is ready (read from what the server says about the product's offers). */
function subOf(products: ProductInfo[] | null, productKey: string | null, offerId: string | null): GenerateSub | null {
  if (!offerId) return null
  const o = products?.find((p) => p.key === productKey)?.offers.find((x) => x.offer_id === offerId)
  if (!o) return { offer_id: offerId, name: offerId, ready: false, missing: ['that sub-product was not found'] }

  return { offer_id: o.offer_id, name: o.name, ready: o.icp_ready !== false, missing: o.icp_missing ?? [] }
}

/**
 * Generate Signals for one product. Starts nothing unless the selected product is valid and ready (see generateSignals), allows one run at a
 * time, follows the run to its end, then bumps `refreshKey` so the lists re-read what the backend stored.
 */
export function useGenerateSignals(context: LaravelContext, productKey: string | null, products: ProductInfo[] | null, offerId: string | null = null) {
  const [status, setStatus] = useState<ResearchStatusResponse['data'] | null>(null)
  const [running, setRunning] = useState(false)
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(null)
  const [notice, setNotice] = useState<GenerateNotice | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)   // runs this screen saw finish: the screen then jumps to the new day
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const followRef = useRef<(runId: number, attempt?: number, failures?: number) => void>(() => {})
  const generation = useRef(0)   // changes with the product: results of an old product's poll are dropped

  const loadStatus = useCallback(async () => {
    if (!productKey) return null
    const mine = ++generation.current
    try {
      const res = await opportunitiesService.getStatus(context, productKey)
      if (mine === generation.current) setStatus(res.data)
      return res.data
    } catch {
      return null
    }
  }, [context, productKey])

  const finish = useCallback((run: ResearchRun | null, fallback?: string) => {
    inFlight.current = false
    setRunning(false)
    if (run) setActiveRun(run)
    // A run that did not complete is explained, with Retry, by the progress bar; a second message would repeat it.
    setNotice(run ? (run.status === 'failed' || run.status === 'skipped' ? null : describeFinishedRun(run)) : { tone: 'warning', text: fallback ?? 'The run is still going in the background. Check back shortly.' })
    setRefreshKey((k) => k + 1)
    setCompletedCount((n) => n + 1)
    void loadStatus()
  }, [loadStatus])

  const follow = useCallback((runId: number, attempt = 0, failures = 0) => {
    const mine = generation.current
    timer.current = setTimeout(async () => {
      if (mine !== generation.current) return
      let failed = failures
      try {
        const run = (await opportunitiesService.getRun(context, runId)).data
        if (mine !== generation.current) return
        failed = 0
        setActiveRun(run)
        if (run && ['success', 'partial', 'failed', 'skipped'].includes(run.status)) {
          finish(run)
          return
        }
      } catch {
        if (mine !== generation.current) return
        failed += 1
      }
      if (failed >= POLL_FAILURES_MAX) {
        finish(null, 'Lost contact with the server while following the run. Reload the page to see where it got to.')
        return
      }
      if (attempt >= POLL_MAX) {
        finish(null)
        return
      }
      followRef.current(runId, attempt + 1, failed)
    }, POLL_MS)
  }, [context, finish])
  useEffect(() => { followRef.current = follow }, [follow])

  // A new product: forget the previous one's run state and read this product's own.
  useEffect(() => {
    generation.current += 1
    if (timer.current) clearTimeout(timer.current)
    inFlight.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(null); setRunning(false); setActiveRun(null); setNotice(null)
    if (!productKey) return
    void (async () => {
      const s = await loadStatus()
      // A run that is going (started here before a refresh, or elsewhere) is followed to its end. It blocks a second one.
      const latest = s?.latest_run
      if (s?.busy_elsewhere) {
        // The one running run belongs to another product: say so, never show it as this product's progress.
        setNotice({ tone: 'info', text: 'A run for another product is in progress. Wait for it to finish before generating.' })
      } else if (s?.running && latest?.id) {
        inFlight.current = true
        setRunning(true)
        setActiveRun(latest)
        follow(latest.id)
      }
    })()
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [productKey, offerId, loadStatus, follow])

  const generate = useCallback(async (regions?: RegionSelection[]) => {
    await runGuardedGenerate(inFlight, {
      context, choice: productKey, running, regions,
      sub: subOf(products, productKey, offerId),
      products: products?.map((p) => ({ key: p.key, label: p.label, ready: p.ready, missing: p.missing, next_step: p.next_step })) ?? null,
      service: opportunitiesService,
    }, {
      busy: () => setNotice({ tone: 'info', text: 'Generate Signals is already starting. Please wait a moment.' }),
      begin: () => { setNotice({ tone: 'info', text: 'Checking the product and starting the run…' }); setRunning(true) },   // an immediate, visible response
      refused: (outcome) => {
        setRunning(false)
        setNotice({ tone: outcome.reason === 'running' ? 'info' : 'warning', text: outcome.message, missing: outcome.missing, nextStep: outcome.nextStep })
        // "Already running" is only true if a run really is going: follow it if so, so the lock and button are never left stuck without one.
        void loadStatus().then((s) => {
          if (outcome.reason === 'running' && s?.running && s.latest_run?.id) {
            inFlight.current = true
            setRunning(true)
            setActiveRun(s.latest_run)
            follow(s.latest_run.id)
          }
        })
      },
      started: (outcome) => {
        setActiveRun((outcome.run as ResearchRun | null) ?? null)
        setNotice({ tone: 'info', text: outcome.message })
        if (outcome.runId) {
          follow(outcome.runId)
        } else {
          inFlight.current = false
          setRunning(false)
          void loadStatus()
        }
      },
      failed: (e) => {
        setRunning(false)
        setNotice({ tone: 'error', text: errText(e, 'Could not start the run.') })
      },
    })
  }, [context, productKey, offerId, products, running, follow, loadStatus])

  return { status, running, activeRun, notice, refreshKey, completedCount, generate, reloadStatus: loadStatus, refresh: () => { setRefreshKey((k) => k + 1); void loadStatus() }, clearNotice: () => setNotice(null) }
}
