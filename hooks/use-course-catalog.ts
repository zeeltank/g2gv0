'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  lmsCatalogService,
  type CatalogBulkAction,
  type CatalogCourse,
  type CatalogFilterOptions,
  type CatalogKpis,
  type CatalogListMeta,
  type CatalogSortBy,
  type CatalogSortDir,
  type CourseCreatePayload,
  type CourseUpdatePayload,
} from '@/services/lms'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** The Laravel context is rebuilt per call - it reads live storage, not React state. */
function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

const EMPTY_META: CatalogListMeta = { page: 1, per_page: 10, total: 0, last_page: 1 }

export interface CatalogFilterState {
  search: string
  category: string
  subjectType: string
  jobrole: string
  /** '' = any, '1' = active, '0' = inactive. */
  status: string
}

const EMPTY_FILTERS: CatalogFilterState = {
  search: '',
  category: '',
  subjectType: '',
  jobrole: '',
  status: '',
}

export interface CourseCatalogState {
  courses: CatalogCourse[]
  meta: CatalogListMeta
  kpis: CatalogKpis | null
  filterOptions: CatalogFilterOptions | null

  loading: boolean
  error: string | null
  retry: () => void

  filters: CatalogFilterState
  setFilter: <K extends keyof CatalogFilterState>(key: K, value: CatalogFilterState[K]) => void
  clearFilters: () => void
  hasActiveFilters: boolean

  sortBy: CatalogSortBy
  sortDir: CatalogSortDir
  toggleSort: (column: CatalogSortBy) => void

  page: number
  setPage: (page: number) => void
  perPage: number

  /** Mutations - each refreshes the list and KPIs on success. */
  saving: boolean
  actionMessage: string | null
  actionError: string | null
  dismissAction: () => void
  createCourse: (payload: CourseCreatePayload) => Promise<{ ok: boolean; message: string; courseId: number | null }>
  updateCourse: (
    id: number,
    payload: CourseUpdatePayload,
  ) => Promise<{ ok: boolean; message: string }>
  deleteCourse: (course: CatalogCourse) => Promise<{ ok: boolean; message: string }>
  bulkAction: (
    action: CatalogBulkAction,
    ids: number[],
  ) => Promise<{ ok: boolean; message: string }>
}

export function useCourseCatalog(perPage = 10): CourseCatalogState {
  const resolveContext = useLaravelContext()

  const [courses, setCourses] = useState<CatalogCourse[]>([])
  const [meta, setMeta] = useState<CatalogListMeta>(EMPTY_META)
  const [kpis, setKpis] = useState<CatalogKpis | null>(null)
  const [filterOptions, setFilterOptions] = useState<CatalogFilterOptions | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<CatalogFilterState>(EMPTY_FILTERS)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState<CatalogSortBy>('updated_at')
  const [sortDir, setSortDir] = useState<CatalogSortDir>('desc')
  const [page, setPage] = useState(1)

  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Typing in the search box must not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => clearTimeout(timer)
  }, [filters.search])

  const load = useCallback(async () => {
    const context = resolveContext()

    if (!isLaravelContextReady(context)) {
      setLoading(false)
      setError('Your session has expired. Sign in again to load the catalog.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [listResponse, kpiResponse, filterResponse] = await Promise.all([
        lmsCatalogService.getCourses(context, {
          search: debouncedSearch,
          category: filters.category || undefined,
          subjectType: filters.subjectType || undefined,
          jobrole: filters.jobrole || undefined,
          status: filters.status === '' ? undefined : Number(filters.status),
          sortBy,
          sortDir,
          page,
          perPage,
        }),
        lmsCatalogService.getKpis(context),
        lmsCatalogService.getFilterOptions(context),
      ])

      setCourses(listResponse.data ?? [])
      setMeta(listResponse.meta ?? EMPTY_META)
      setKpis(kpiResponse.data ?? null)
      setFilterOptions(filterResponse.data ?? null)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the learning catalog.'))
      setCourses([])
      setMeta(EMPTY_META)
    } finally {
      setLoading(false)
    }
  }, [
    resolveContext,
    debouncedSearch,
    filters.category,
    filters.subjectType,
    filters.jobrole,
    filters.status,
    sortBy,
    sortDir,
    page,
    perPage,
  ])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const setFilter = useCallback(
    <K extends keyof CatalogFilterState>(key: K, value: CatalogFilterState[K]) => {
      setFilters((current) => ({ ...current, [key]: value }))
      // Any filter change invalidates the current page offset.
      setPage(1)
    },
    [],
  )

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }, [])

  const toggleSort = useCallback((column: CatalogSortBy) => {
    setSortBy((currentColumn) => {
      setSortDir((currentDir) =>
        currentColumn === column ? (currentDir === 'asc' ? 'desc' : 'asc') : 'asc',
      )
      return column
    })
    setPage(1)
  }, [])

  /** Refetch with the current filters - used after a mutation and by retry. */
  const refresh = useCallback(() => {
    void load()
  }, [load])

  /** Shared wrapper: run a mutation, surface its message, refresh on success. */
  const runMutation = useCallback(
    async (operation: () => Promise<string>, fallbackError: string) => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)

      try {
        const message = await operation()
        setActionMessage(message)
        refresh()
        return { ok: true, message }
      } catch (mutationError) {
        const message = toMessage(mutationError, fallbackError)
        setActionError(message)
        return { ok: false, message }
      } finally {
        setSaving(false)
      }
    },
    [refresh],
  )

  // RETURNS THE NEW COURSE ID, which this used to discard. The competency
  // mapping is stored against a course id, and the sheet cannot map anything
  // until it knows what was just created. The API has always returned it.
  // runMutation's shape is shared with update/delete, so the id is carried
  // alongside its result rather than by widening it for every caller.
  const createCourse = useCallback(
    async (payload: CourseCreatePayload) => {
      let courseId: number | null = null
      const result = await runMutation(async () => {
        const context = resolveContext()
        const response = await lmsCatalogService.createCourse(context, payload)
        // The controller answers with data.id; course_id is the older key. Take
        // whichever is present rather than assuming one of them.
        courseId = response?.course_id ?? response?.data?.id ?? null
        return `"${payload.display_name}" created successfully.`
      }, 'Failed to create the course.')
      return { ...result, courseId }
    },
    [runMutation, resolveContext],
  )

  const updateCourse = useCallback(
    (id: number, payload: CourseUpdatePayload) =>
      runMutation(async () => {
        const context = resolveContext()
        await lmsCatalogService.updateCourse(context, id, payload)
        return `"${payload.display_name}" updated successfully.`
      }, 'Failed to update the course.'),
    [runMutation, resolveContext],
  )

  const deleteCourse = useCallback(
    (course: CatalogCourse) =>
      runMutation(async () => {
        const context = resolveContext()
        await lmsCatalogService.deleteCourse(context, course.id)
        return `"${course.display_name ?? 'Course'}" deleted.`
      }, 'Failed to delete the course.'),
    [runMutation, resolveContext],
  )

  const bulkAction = useCallback(
    (action: CatalogBulkAction, ids: number[]) =>
      runMutation(async () => {
        const context = resolveContext()
        const response = await lmsCatalogService.bulkAction(context, action, ids)
        return response.message ?? 'Bulk action completed.'
      }, 'Failed to complete the bulk action.'),
    [runMutation, resolveContext],
  )

  const dismissAction = useCallback(() => {
    setActionMessage(null)
    setActionError(null)
  }, [])

  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.category) ||
    Boolean(filters.subjectType) ||
    Boolean(filters.jobrole) ||
    filters.status !== ''

  return {
    courses,
    meta,
    kpis,
    filterOptions,

    loading,
    error,
    retry: refresh,

    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,

    sortBy,
    sortDir,
    toggleSort,

    page,
    setPage,
    perPage,

    saving,
    actionMessage,
    actionError,
    dismissAction,
    createCourse,
    updateCourse,
    deleteCourse,
    bulkAction,
  }
}
