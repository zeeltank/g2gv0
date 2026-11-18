'use client'

/**
 * Simulation Learning - the gallery's data and the actions a manager takes on it.
 *
 * ONE LIST, FILTERED HERE. The server returns every simulation the caller may see (the organisation's own plus the platform ones it has
 * switched on) together with the filter chips it derived from them, so searching, the category chip and the progress filter are views over
 * that one list and cannot disagree with the counts on the chips. Nothing about which simulations or categories exist is in this file.
 *
 * ACTIONS RELOAD QUIETLY. After a publish, remove or add the list is fetched again without the skeleton, so the grid does not flash; a
 * response that arrives after a newer request was made is dropped rather than applied.
 *
 * `can` is the caller's rights as the server computed them (the rights matrix on the `Simulation Learning` menu row, or the administrator /
 * HR role). Buttons here are shown from it; the server still checks every call, so a stale `can` can only ever cost a refused request.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { DEFAULT_LIMITS, runUploads, type SimulationLimits, type StepStatus, type UploadStep } from '@/lib/simulation-package-plan'
import { ApiError } from '@/services/core'
import {
  simulationService,
  type CreateSimulationInput,
  type SimulationCard,
  type SimulationCategory,
  type SimulationProgress,
  type SimulationRights,
  type SimulationStatus,
  type UpdateSimulationInput,
} from '@/services/lms/simulations'

export type SimulationProgressFilter = 'all' | 'todo' | 'doing' | 'done'

export interface SimulationFilters {
  search: string
  /** A category chip's `key`, or 'all'. */
  category: string
  progress: SimulationProgressFilter
}

const DEFAULT_FILTERS: SimulationFilters = { search: '', category: 'all', progress: 'all' }
const NO_RIGHTS: SimulationRights = { view: false, add: false, edit: false, delete: false }

/**
 * The category a card is counted under. The server sends the key it counted the chip with, and that is what the filter must use: two
 * implementations of "trim and lower-case" (PHP's and JavaScript's) disagree on a few characters, and a chip that counts 1 must also show 1.
 * The fallback (a blank one is "General") is for a server that does not send it yet.
 */
export function categoryKeyOf(card: Pick<SimulationCard, 'category'> & { category_key?: string }): string {
  if (card.category_key) return card.category_key
  const label = (card.category ?? '').trim()
  return (label === '' ? 'General' : label).toLowerCase()
}

export function progressBucketOf(card: Pick<SimulationCard, 'progress'>): Exclude<SimulationProgressFilter, 'all'> {
  if (!card.progress) return 'todo'
  return card.progress.status === 'completed' ? 'done' : 'doing'
}

function matchesSearch(card: SimulationCard, term: string): boolean {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = [card.title, card.subtitle, card.summary, card.category, card.audience, ...card.tags]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase()
  return words.every((word) => haystack.includes(word))
}

/** What went wrong, as one sentence for a person, plus the specification problems when the server listed them. */
export function describeSimulationError(err: unknown, fallback: string): { message: string; problems: string[] } {
  if (err instanceof ApiError) {
    const problems = err.errors?.spec ?? []
    return { message: err.fullMessage || fallback, problems: Array.isArray(problems) ? problems : [] }
  }
  return { message: err instanceof Error && err.message ? err.message : fallback, problems: [] }
}

export type SimulationActionResult = { ok: true } | { ok: false; message: string; problems: string[] }

export function useSimulations() {
  const { user } = useAuth()
  const resolveContext = useCallback(() => getLaravelContext(user), [user])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<SimulationCard[]>([])
  const [categories, setCategories] = useState<SimulationCategory[]>([])
  const [can, setCan] = useState<SimulationRights>(NO_RIGHTS)
  const [filters, setFilters] = useState<SimulationFilters>({ ...DEFAULT_FILTERS })
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Only the newest request may write to state.
  const requestId = useRef(0)

  const load = useCallback(
    async (quiet = false) => {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) {
        setLoading(false)
        setError('Your session has expired. Sign in again to load the simulations.')
        return
      }

      const mine = ++requestId.current
      if (!quiet) {
        setLoading(true)
        setError(null)
      }

      try {
        const response = await simulationService.list()
        if (mine !== requestId.current) return
        setRows(response?.data?.simulations ?? [])
        setCategories(response?.data?.categories ?? [])
        setCan(response?.data?.can ?? NO_RIGHTS)
        setError(null)
      } catch (err) {
        if (mine !== requestId.current) return
        const { message } = describeSimulationError(err, 'Failed to load the simulations')
        // A quiet reload that fails keeps what is on screen; only a first load shows the error state.
        if (!quiet) setError(message)
        else setActionError(message)
        console.error('[useSimulations] load failed:', err)
      } finally {
        if (mine === requestId.current) setLoading(false)
      }
    },
    [resolveContext],
  )

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  // A chip can vanish (its last simulation was removed): a category that no longer exists counts as "All", rather than leave an empty grid
  // under a chip that is gone. Worked out here, not stored, so there is nothing to keep in step.
  const category =
    filters.category !== 'all' && categories.length > 0 && !categories.some((c) => c.key === filters.category) ? 'all' : filters.category

  const setFilter = useCallback(<K extends keyof SimulationFilters>(key: K, value: SimulationFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => setFilters({ ...DEFAULT_FILTERS }), [])

  /** Search and category narrow the list; the progress counts are taken over THAT list so the segmented control never overpromises. */
  const searched = useMemo(
    () =>
      rows.filter(
        (card) => matchesSearch(card, filters.search) && (category === 'all' || categoryKeyOf(card) === category),
      ),
    [rows, filters.search, category],
  )

  const visible = useMemo(
    () => (filters.progress === 'all' ? searched : searched.filter((card) => progressBucketOf(card) === filters.progress)),
    [searched, filters.progress],
  )

  const progressCounts = useMemo(() => {
    const counts = { all: searched.length, todo: 0, doing: 0, done: 0 }
    for (const card of searched) counts[progressBucketOf(card)] += 1
    return counts
  }, [searched])

  /** Runs one mutation, keeps the screen in step with the server and turns a failure into a message instead of a throw. */
  const act = useCallback(
    async (fallback: string, run: () => Promise<unknown>): Promise<SimulationActionResult> => {
      const context = resolveContext()
      if (!isLaravelContextReady(context)) return { ok: false, message: 'Your session has expired.', problems: [] }
      setActing(true)
      setActionError(null)
      try {
        await run()
        await load(true)
        return { ok: true }
      } catch (err) {
        const failure = describeSimulationError(err, fallback)
        setActionError(failure.message)
        return { ok: false, ...failure }
      } finally {
        setActing(false)
      }
    },
    [resolveContext, load],
  )

  const setStatus = useCallback(
    (id: number, status: SimulationStatus) =>
      act('Could not change the status.', () => simulationService.update(id, { status })),
    [act],
  )

  const remove = useCallback(
    (id: number) => act('Could not remove this simulation.', () => simulationService.remove(id)),
    [act],
  )

  const restore = useCallback(
    (id: number) => act('Could not restore this simulation.', () => simulationService.restore(id)),
    [act],
  )

  const enable = useCallback(
    (id: number) => act('Could not add this simulation.', () => simulationService.enable(id)),
    [act],
  )

  const disable = useCallback(
    (id: number) => act('Could not switch this simulation off.', () => simulationService.disable(id)),
    [act],
  )

  const create = useCallback(
    async (
      input: CreateSimulationInput,
    ): Promise<{ ok: true; card: SimulationCard } | { ok: false; message: string; problems: string[] }> => {
      let card: SimulationCard | undefined
      const result = await act('Could not add this simulation.', async () => {
        card = (await simulationService.create(input))?.data
      })
      return result.ok && card ? { ok: true, card } : result.ok ? { ok: false, message: 'The server did not return the new simulation.', problems: [] } : result
    },
    [act],
  )

  /** Saves a new version of a simulation (edit right); the same outcome shape as `create`. */
  const update = useCallback(
    async (
      id: number,
      input: UpdateSimulationInput,
    ): Promise<{ ok: true; card: SimulationCard } | { ok: false; message: string; problems: string[] }> => {
      let card: SimulationCard | undefined
      const result = await act('Could not save this simulation.', async () => {
        card = (await simulationService.update(id, input))?.data
      })
      return result.ok && card ? { ok: true, card } : result.ok ? { ok: false, message: 'The server did not return the simulation.', problems: [] } : result
    },
    [act],
  )

  /**
   * Keeps a card's progress current without a round trip when the player reports (or closes). Mirrors the server's own rules - progress only
   * moves forward and a completed simulation stays completed - so the card never shows something the next reload would take back.
   */
  const applyProgress = useCallback((id: number, report: Pick<SimulationProgress, 'status' | 'percent' | 'step'>) => {
    setRows((current) =>
      current.map((card) => {
        if (card.id !== id) return card
        const held = card.progress
        const completed = held?.status === 'completed' || report.status === 'completed'
        return {
          ...card,
          progress: {
            status: completed ? 'completed' : 'in_progress',
            percent: completed ? 100 : Math.max(held?.percent ?? 0, report.percent),
            step: Math.max(held?.step ?? 0, report.step),
            completed_at: held?.completed_at ?? (completed ? new Date().toISOString() : null),
            snapshot: held?.snapshot,
          },
        }
      }),
    )
  }, [])

  const clearActionError = useCallback(() => setActionError(null), [])
  const reload = useCallback(() => load(true), [load])
  const retry = useCallback(() => void load(), [load])

  return {
    loading,
    error,
    simulations: rows,
    visible,
    categories,
    can,
    filters: { ...filters, category },
    setFilter,
    resetFilters,
    progressCounts,
    total: rows.length,
    setStatus,
    remove,
    restore,
    enable,
    disable,
    create,
    update,
    applyProgress,
    acting,
    actionError,
    clearActionError,
    reload,
    retry,
  }
}

export type UseSimulationsReturn = ReturnType<typeof useSimulations>

/**
 * The organisation's limits for models, images and storage, and how much it has used (GET /lms/simulations/limits). They only inform the
 * Create screen: until they arrive, or if they cannot be loaded, the contract's own figures stand in (`limits.fromServer` says which), and
 * the server enforces every limit regardless.
 */
export function useSimulationLimits() {
  const [limits, setLimits] = useState<SimulationLimits>(DEFAULT_LIMITS)
  const [loading, setLoading] = useState(true)
  const requestId = useRef(0)

  const load = useCallback(() => {
    const mine = ++requestId.current
    setLoading(true)
    simulationService
      .limits()
      .then((loaded) => {
        if (mine === requestId.current) setLimits(loaded)
      })
      .catch((err) => console.warn('[useSimulationLimits] the limits could not be loaded:', err))
      .finally(() => {
        if (mine === requestId.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    queueMicrotask(load)
    return () => {
      requestId.current += 1
    }
  }, [load])

  return { limits, loading, reload: load }
}

/** The media type sent with a model or image part of an upload (the server decides what a file is from its bytes, never from this). */
function mimeFor(step: Pick<UploadStep, 'kind' | 'filename'>): string {
  if (step.kind === 'model') return 'model/gltf-binary'
  const extension = step.filename.split('.').pop()?.toLowerCase()
  return extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg'
}

/**
 * Uploads a plan's files one at a time (see runUploads), keeping each file's status for the screen. Running it again sends only the files
 * that did not go through. Closing the screen stops the batch after the file in flight.
 */
export function useAssetUploads() {
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({})
  const [running, setRunning] = useState(false)
  const held = useRef<Record<string, StepStatus>>({})
  const stopped = useRef(false)

  useEffect(() => {
    stopped.current = false
    return () => {
      stopped.current = true
    }
  }, [])

  const run = useCallback(async (steps: UploadStep[]) => {
    setRunning(true)
    const outcome = await runUploads({
      steps,
      previous: held.current,
      isCancelled: () => stopped.current,
      onStatus: (id, status) => {
        held.current = { ...held.current, [id]: status }
        if (!stopped.current) setStatuses(held.current)
      },
      upload: (step) => {
        const file = new File([step.bytes as BlobPart], step.filename, { type: mimeFor(step) })
        return simulationService.uploadAsset(file, step.meta)
      },
    })
    if (!stopped.current) setRunning(false)
    return outcome
  }, [])

  const reset = useCallback(() => {
    held.current = {}
    setStatuses({})
  }, [])

  return { statuses, running, run, reset }
}
