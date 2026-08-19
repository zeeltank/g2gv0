'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  competencyLibrariesService,
  type GenericDetail,
  type LibraryListParams,
  type LibraryMeta,
  type LibraryPagination,
  type LibraryPayload,
  type LibraryRow,
  type LibraryTabId,
  type ResponsibilityLevel,
  type SkillTaxonomy,
  type TaxonomyPayload,
  type TaxonomyTree,
} from '@/services/competency'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Rebuilt per call so it always reads the live session, not stale React state. */
function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

export interface MutationResult {
  ok: boolean
  message: string
}

/* ------------------------------------------------------------------ *
 * Shared dropdown options + tab counts
 * ------------------------------------------------------------------ */

const EMPTY_META: LibraryMeta = {
  departments: [],
  sub_departments: [],
  micro_categories: [],
  industries: [],
  jobroles_by_department: {},
  related_skills: [],
  job_titles: [],
  learning_resources: [],
  proficiency_levels: [],
  invisible_types: [],
  task_types: [],
  counts: {} as LibraryMeta['counts'],
}

/**
 * Library metadata, cached for the tab this session.
 *
 * The payload is dropdown options and tab counts — the same for every screen
 * that asks and slow to rebuild, because the database is remote. Without this,
 * navigating away from Libraries & Taxonomy and back pays the round trip again
 * for a payload that has not changed.
 *
 * Module scope, not React state: the point is to survive the component
 * unmounting. Writes clear it through `invalidateLibraryMeta` so a created or
 * deleted row shows up in the counts immediately.
 */
const META_TTL_MS = 60_000

let metaCache: { key: string; at: number; value: LibraryMeta } | null = null

/** Dropped after any library write, so counts never show a stale number. */
export function invalidateLibraryMeta() {
  metaCache = null
}

export function useLibraryMeta() {
  const resolveContext = useLaravelContext()

  // Reading the cache here would mean calling Date.now() during render, which
  // is impure. The effect below resolves a hit in a microtask with no network
  // call, so the saving is the same and the render stays pure.
  const [meta, setMeta] = useState<LibraryMeta>(EMPTY_META)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      const key = resolveContext().subInstituteId
      const fresh =
        metaCache && metaCache.key === key && Date.now() - metaCache.at < META_TTL_MS ? metaCache.value : null

      // A hit still refreshes nothing: the server caches this too, and the
      // counts are invalidated explicitly on write.
      if (fresh) {
        if (!cancelled) {
          setMeta(fresh)
          setError(null)
          setLoading(false)
        }
        return
      }

      setLoading(true)
      try {
        const response = await competencyLibrariesService.meta(resolveContext())
        const value = { ...EMPTY_META, ...response.data }
        metaCache = { key, at: Date.now(), value }

        if (!cancelled) {
          setMeta(value)
          setError(null)
        }
      } catch (metaError) {
        if (!cancelled) setError(toMessage(metaError, 'Failed to load library options.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [resolveContext, nonce])

  return {
    meta,
    loading,
    error,
    refresh: () => {
      invalidateLibraryMeta()
      setNonce((n) => n + 1)
    },
  }
}

/* ------------------------------------------------------------------ *
 * One tab's list + CRUD
 * ------------------------------------------------------------------ */

export interface UseLibraryListState<T> {
  loading: boolean
  error: string | null
  items: T[]
  pagination: LibraryPagination | null
  saving: boolean
  actionMessage: string | null
  actionError: string | null
  retry: () => void
  create: (payload: LibraryPayload) => Promise<MutationResult>
  update: (id: number, payload: LibraryPayload) => Promise<MutationResult>
  remove: (id: number) => Promise<MutationResult>
  clearMessages: () => void
}

/**
 * Drives one library tab. `enabled` is false for every tab that is not on
 * screen, so switching tabs does not fire eight parallel list requests.
 */
export function useLibraryList<T extends LibraryRow = LibraryRow>(
  tab: LibraryTabId,
  params: LibraryListParams,
  enabled = true,
): UseLibraryListState<T> {
  const resolveContext = useLaravelContext()

  // A disabled hook never fetches, so it must not claim to be loading either.
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<T[]>([])
  const [pagination, setPagination] = useState<LibraryPagination | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Serialised so the effect only refires when a value actually changes.
  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      const response = await competencyLibrariesService.list<T>(
        resolveContext(),
        tab,
        JSON.parse(paramsKey) as LibraryListParams,
      )
      setItems(response.data ?? [])
      setPagination(response.pagination ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load this library.'))
      setItems([])
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [enabled, paramsKey, resolveContext, tab])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)

      try {
        const response = await action()
        // A write changes the tab counts, so the cached metadata is stale.
        // Dropped here rather than at each call site: this is the single
        // point every create, update and delete passes through.
        invalidateLibraryMeta()
        setActionMessage(response.message)
        await load()
        return { ok: true, message: response.message }
      } catch (mutationError) {
        const message = toMessage(mutationError, fallback)
        setActionError(message)
        return { ok: false, message }
      } finally {
        setSaving(false)
      }
    },
    [load],
  )

  // RETURNS THE NEW ROW'S ID, which this used to discard. The job role tab maps
  // competencies onto the role it just created, and role_map keys on jobrole_id
  // - so the form cannot write the mapping without knowing what was created.
  // runMutation's shape is shared with update/delete, so the id rides alongside
  // its result rather than widening it for every caller.
  const create = useCallback(
    async (payload: LibraryPayload) => {
      let createdId: number | null = null
      const result = await runMutation(async () => {
        const response = await competencyLibrariesService.create(resolveContext(), tab, payload)
        createdId = response?.data?.id ?? null
        return { message: response.message }
      }, 'Failed to create the entry.')
      return { ...result, createdId }
    },
    [runMutation, resolveContext, tab],
  )

  const update = useCallback(
    (id: number, payload: LibraryPayload) =>
      runMutation(
        () => competencyLibrariesService.update(resolveContext(), tab, id, payload),
        'Failed to update the entry.',
      ),
    [runMutation, resolveContext, tab],
  )

  const remove = useCallback(
    (id: number) =>
      runMutation(
        () => competencyLibrariesService.remove(resolveContext(), tab, id),
        'Failed to delete the entry.',
      ),
    [runMutation, resolveContext, tab],
  )

  return {
    loading,
    error,
    items,
    pagination,
    saving,
    actionMessage,
    actionError,
    retry: load,
    create,
    update,
    remove,
    clearMessages: () => {
      setActionMessage(null)
      setActionError(null)
    },
  }
}

/* ------------------------------------------------------------------ *
 * Detail panel
 * ------------------------------------------------------------------ */

export function useLibraryDetail<T = GenericDetail>(tab: LibraryTabId, id: number | null) {
  const resolveContext = useLaravelContext()

  const [detail, setDetail] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      if (id == null) {
        setDetail(null)
        setError(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const response = await competencyLibrariesService.get<T>(resolveContext(), tab, id)
        if (!cancelled) setDetail(response.data)
      } catch (detailError) {
        if (!cancelled) {
          setError(toMessage(detailError, 'Failed to load the details.'))
          setDetail(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [id, resolveContext, tab])

  return { detail, loading, error }
}

/* ------------------------------------------------------------------ *
 * Taxonomy editor
 * ------------------------------------------------------------------ */

export interface UseTaxonomyState {
  tree: TaxonomyTree | null
  loading: boolean
  error: string | null
  saving: boolean
  actionMessage: string | null
  actionError: string | null
  /** Category names, for the list filters and the create form. */
  categories: string[]
  /** Sub-categories under one category, or [] when the tab has no second level. */
  subCategoriesOf: (category: string) => string[]
  retry: () => void
  addNode: (payload: TaxonomyPayload) => Promise<MutationResult>
  renameNode: (payload: TaxonomyPayload) => Promise<MutationResult>
  deleteNode: (category: string, subCategory?: string) => Promise<MutationResult>
  clearMessages: () => void
}

export function useTaxonomy(tab: LibraryTabId, enabled = true): UseTaxonomyState {
  const resolveContext = useLaravelContext()

  const [tree, setTree] = useState<TaxonomyTree | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)
    try {
      const response = await competencyLibrariesService.taxonomy(resolveContext(), tab)
      setTree(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the taxonomy.'))
      setTree(null)
    } finally {
      setLoading(false)
    }
  }, [enabled, resolveContext, tab])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<MutationResult> => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)
      try {
        const response = await action()
        // A write changes the tab counts, so the cached metadata is stale.
        // Dropped here rather than at each call site: this is the single
        // point every create, update and delete passes through.
        invalidateLibraryMeta()
        setActionMessage(response.message)
        await load()
        return { ok: true, message: response.message }
      } catch (mutationError) {
        const message = toMessage(mutationError, fallback)
        setActionError(message)
        return { ok: false, message }
      } finally {
        setSaving(false)
      }
    },
    [load],
  )

  const categories = useMemo(
    () => (tree?.categories ?? []).map((node) => node.category),
    [tree],
  )

  const subCategoriesOf = useCallback(
    (category: string) =>
      (tree?.categories ?? [])
        .find((node) => node.category === category)
        ?.sub_categories.map((sub) => sub.name) ?? [],
    [tree],
  )

  return {
    tree,
    loading,
    error,
    saving,
    actionMessage,
    actionError,
    categories,
    subCategoriesOf,
    retry: load,
    addNode: (payload) =>
      runMutation(
        () => competencyLibrariesService.createTaxonomy(resolveContext(), tab, payload),
        'Failed to add the category.',
      ),
    renameNode: (payload) =>
      runMutation(
        () => competencyLibrariesService.renameTaxonomy(resolveContext(), tab, payload),
        'Failed to rename the category.',
      ),
    deleteNode: (category, subCategory) =>
      runMutation(
        () => competencyLibrariesService.deleteTaxonomy(resolveContext(), tab, category, subCategory),
        'Failed to remove the category.',
      ),
    clearMessages: () => {
      setActionMessage(null)
      setActionError(null)
    },
  }
}

/* ------------------------------------------------------------------ *
 * Critical work functions (Job Role Task drill-down)
 * ------------------------------------------------------------------ */

/**
 * Distinct work functions, narrowed to one job role when the caller has picked
 * one. Refetches on that change so the second dropdown always matches the first.
 */
export function useWorkFunctions(jobrole: string | null, enabled = true) {
  const resolveContext = useLaravelContext()
  const [values, setValues] = useState<string[]>([])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    queueMicrotask(async () => {
      try {
        const response = await competencyLibrariesService.workFunctions(
          resolveContext(),
          jobrole ?? undefined,
        )
        if (!cancelled) setValues(response.data ?? [])
      } catch {
        // A missing filter list must not break the table it sits above.
        if (!cancelled) setValues([])
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled, jobrole, resolveContext])

  return values
}

/* ------------------------------------------------------------------ *
 * Levels of responsibility
 * ------------------------------------------------------------------ */

/** Reference data shared by every tenant, so it loads once per mount. */
export function useLevelsOfResponsibility(enabled = true) {
  const resolveContext = useLaravelContext()

  const [levels, setLevels] = useState<ResponsibilityLevel[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    queueMicrotask(async () => {
      setLoading(true)
      try {
        const response = await competencyLibrariesService.levelsOfResponsibility(resolveContext())
        if (!cancelled) {
          setLevels(response.data ?? [])
          setError(null)
        }
      } catch (loadError) {
        if (!cancelled) setError(toMessage(loadError, 'Failed to load the responsibility levels.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled, resolveContext])

  return { levels, loading, error }
}

/* ------------------------------------------------------------------ *
 * Skill taxonomy tree
 * ------------------------------------------------------------------ */

export function useSkillTaxonomy(params: { search?: string; category?: string; department?: string }) {
  const resolveContext = useLaravelContext()

  const [taxonomy, setTaxonomy] = useState<SkillTaxonomy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const paramsKey = JSON.stringify(params)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await competencyLibrariesService.skillTaxonomyTree(
        resolveContext(),
        JSON.parse(paramsKey),
      )
      setTaxonomy(response.data)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the skill taxonomy.'))
      setTaxonomy(null)
    } finally {
      setLoading(false)
    }
  }, [paramsKey, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  return { taxonomy, loading, error, retry: load }
}
