'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LaravelContext } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import { opportunitiesService, type ResearchRun, type ResearchStatusResponse } from '@/services/signals/opportunities'
import type { ProductInfo } from '@/services/portfolio/types'
import { generateSignals } from '@/lib/signals-generate'

const POLL_MS = 2500
const POLL_MAX = 120

export type GenerateNotice = { tone: 'error' | 'info' | 'warning' | 'success'; text: string; missing?: string[]; nextStep?: string | null }

const errText = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback)

/** What a finished run honestly says, from the run row the backend holds (never from invented results). */
export function describeFinishedRun(run: ResearchRun): GenerateNotice {
  if (run.status === 'failed' || run.status === 'skipped') {
    return { tone: 'error', text: run.error_message ?? run.stage_message ?? 'The run did not complete.' }
  }
  if (run.status === 'partial') {
    return {
      tone: 'warning',
      text: `Finished with limits: ${run.stage_message ?? 'some searches or sources could not be read.'} ${run.opportunities_qualified} qualified (${run.opportunities_new} new).`,
    }
  }
  if (run.opportunities_qualified === 0) {
    return { tone: 'info', text: `Finished: checked ${run.sources_found} sources, but no opportunity had enough evidence to qualify.` }
  }

  return { tone: 'success', text: `Finished: ${run.opportunities_qualified} qualified (${run.opportunities_new} new) from ${run.sources_found} sources.` }
}

/**
 * Generate Signals for one product. Starts nothing unless the selected product is valid and ready (see generateSignals), allows one run at a
 * time, follows the run to its end, then bumps `refreshKey` so the lists re-read what the backend stored.
 */
export function useGenerateSignals(context: LaravelContext, productKey: string | null, products: ProductInfo[] | null) {
  const [status, setStatus] = useState<ResearchStatusResponse['data'] | null>(null)
  const [running, setRunning] = useState(false)
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(null)
  const [notice, setNotice] = useState<GenerateNotice | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)   // runs this screen saw finish: the screen then jumps to the new day
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const followRef = useRef<(runId: number, attempt?: number) => void>(() => {})
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
    setNotice(run ? describeFinishedRun(run) : { tone: 'warning', text: fallback ?? 'The run is still going in the background. Check back shortly.' })
    setRefreshKey((k) => k + 1)
    setCompletedCount((n) => n + 1)
    void loadStatus()
  }, [loadStatus])

  const follow = useCallback((runId: number, attempt = 0) => {
    const mine = generation.current
    timer.current = setTimeout(async () => {
      if (mine !== generation.current) return
      try {
        const run = (await opportunitiesService.getRun(context, runId)).data
        if (mine !== generation.current) return
        setActiveRun(run)
        if (run && ['success', 'partial', 'failed', 'skipped'].includes(run.status)) {
          finish(run)
          return
        }
      } catch {
        /* a failed poll is retried until the limit */
      }
      if (attempt >= POLL_MAX) {
        finish(null)
        return
      }
      followRef.current(runId, attempt + 1)
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
      if (s?.running && latest?.id && latest.product_key && latest.product_key !== productKey) {
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
  }, [productKey, loadStatus, follow])

  const generate = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setNotice(null)
    try {
      const outcome = await generateSignals({
        context, choice: productKey, running,
        products: products?.map((p) => ({ key: p.key, label: p.label, ready: p.ready, missing: p.missing, next_step: p.next_step })) ?? null,
        service: opportunitiesService,
      })
      if (!outcome.started) {
        inFlight.current = outcome.reason === 'running'
        setNotice({ tone: outcome.reason === 'running' ? 'info' : 'warning', text: outcome.message, missing: outcome.missing, nextStep: outcome.nextStep })
        void loadStatus()
        return
      }
      setRunning(true)
      setActiveRun((outcome.run as ResearchRun | null) ?? null)
      setNotice({ tone: 'info', text: outcome.message })
      if (outcome.runId) {
        follow(outcome.runId)
      } else {
        inFlight.current = false
        setRunning(false)
        void loadStatus()
      }
    } catch (e) {
      inFlight.current = false
      setRunning(false)
      setNotice({ tone: 'error', text: errText(e, 'Could not start the run.') })
    }
  }, [context, productKey, products, running, follow, loadStatus])

  return { status, running, activeRun, notice, refreshKey, completedCount, generate, reloadStatus: loadStatus, refresh: () => { setRefreshKey((k) => k + 1); void loadStatus() }, clearNotice: () => setNotice(null) }
}
