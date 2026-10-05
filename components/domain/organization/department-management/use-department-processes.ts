'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService } from '@/services/organization'
import type { DepartmentProcess, DepartmentProcessTemplates } from '@/services/organization'
import { ApiError } from '@/services/core'

/**
 * Pull a flat, human-readable list of problems out of a failed request.
 *
 * Two different shapes reach here: Laravel's validator gives
 * `{field: [messages]}`; DepartmentProcessController::publish()'s structural
 * graph check (one Start, every Decision branch labeled, etc.) gives a plain
 * array of sentences. `ApiError.errors` is typed for the first shape only,
 * but the second is real at runtime, so both are handled rather than trusting
 * the type.
 */
export function extractErrorMessages(cause: unknown): string[] {
  if (!(cause instanceof ApiError) || !cause.errors) return []

  const errors: unknown = cause.errors
  if (Array.isArray(errors)) return errors.map(String)
  if (typeof errors === 'object') {
    return Object.values(errors as Record<string, unknown>).flatMap((value) =>
      Array.isArray(value) ? value.map(String) : [String(value)],
    )
  }
  return []
}

/**
 * List + CRUD for one department's processes - the Process Library view.
 *
 * Mirrors useDepartmentContent's reload-after-write shape (the server owns
 * updated_at/updated_by, so patching local state would show a stale "last
 * updated" until the next refresh), but processes have actions
 * useDepartmentContent does not model: duplicate and publish, neither of
 * which is a plain field edit.
 */
export function useDepartmentProcesses(context: LaravelContext, departmentId: string) {
  const [items, setItems] = useState<DepartmentProcess[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await organizationService.getDepartmentProcesses(context, departmentId)
      setItems(response?.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load processes.')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [context, departmentId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (data: { name: string; category?: string; description?: string; template_key?: string }) => {
      const response = await organizationService.saveDepartmentProcess(context, {
        department_id: departmentId,
        ...data,
      })
      await reload()
      return response.data
    },
    [context, departmentId, reload],
  )

  const update = useCallback(
    async (id: string, data: { name?: string; category?: string; description?: string }) => {
      const response = await organizationService.saveDepartmentProcess(context, data, id)
      await reload()
      return response.data
    },
    [context, reload],
  )

  const duplicate = useCallback(
    async (id: string) => {
      const response = await organizationService.duplicateDepartmentProcess(context, id)
      await reload()
      return response.data
    },
    [context, reload],
  )

  const remove = useCallback(
    async (id: string) => {
      await organizationService.deleteDepartmentProcess(context, id)
      await reload()
    },
    [context, reload],
  )

  return { items, isLoading, error, reload, setError, create, update, duplicate, remove }
}

/** The template picker's data - the same fixed step-type/category/template set for every tenant. */
export function useDepartmentProcessTemplates(context: LaravelContext) {
  const [templates, setTemplates] = useState<DepartmentProcessTemplates | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    organizationService
      .getDepartmentProcessTemplates(context)
      .then((response) => {
        if (!cancelled) setTemplates(response?.data ?? null)
      })
      .catch(() => {
        if (!cancelled) setTemplates(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // context.subInstituteId is stable for the life of a session; re-fetching
    // per department would just re-request the same tenant-wide fixture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { templates, isLoading }
}
