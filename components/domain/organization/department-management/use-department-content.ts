'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DepartmentContentRecord } from '@/services/organization'

/**
 * Shared loading + shape-mapping for the SOPs, Policies and Rules tabs.
 *
 * All three shipped as `useState(MOCK_*)` - a literal array in the bundle, the
 * same four or five records for every department in every tenant, and every
 * create/edit/delete discarded the moment the tab lost focus. They now read
 * from `/api/department-sops|-policies|-rules`.
 *
 * The tabs keep their own view-model (`name`, `lastUpdated`, `updatedBy`)
 * rather than adopting the API's column names (`title`, `updated_at`,
 * `updated_by`). That is deliberate: the card, form and detail components in
 * each tab are several hundred lines built around the view-model, and renaming
 * fields through all of them would be a large, risky diff for no user-visible
 * gain. The translation happens here, at the boundary, in one place.
 */

/** What the tab components consume. */
export type ContentItem = {
  id: string
  name: string
  code: string
  status: string
  lastUpdated: string
  updatedBy: string
  description?: string
  category?: string
  version?: string
  /** SOP only. */
  fileName?: string | null
  fileSize?: number | null
  hasFile?: boolean
}

type ApiRecord = DepartmentContentRecord & {
  created_by_name?: string | null
  updated_by_name?: string | null
  rule_definition?: string | null
  file_name?: string | null
  file_size?: number | null
  file_path?: string | null
}

/** '09 Jun 2025', or '-' for a missing or unparseable timestamp. */
export function formatContentDate(value?: string | null): string {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function mapContentRecord(record: ApiRecord): ContentItem {
  return {
    id: String(record.id),
    name: record.title ?? '',
    code: record.code ?? '',
    status: record.status ?? 'Draft',
    lastUpdated: formatContentDate(record.updated_at ?? record.created_at),
    // Was hardcoded to the string 'You' on every record the UI created.
    updatedBy: record.updated_by_name || record.created_by_name || '-',
    description: record.description ?? '',
    category: record.category ?? undefined,
    version: record.version ?? undefined,
    fileName: record.file_name ?? null,
    fileSize: record.file_size ?? null,
    hasFile: Boolean(record.file_path),
  }
}

/**
 * Load one department's records, and expose a reload for after any write.
 *
 * Reloading rather than patching local state is intentional: the server owns
 * `updated_at` and `updated_by`, so a locally-patched row would show a stale
 * "last updated" until the next refresh - which is the class of small lie this
 * whole exercise is removing.
 */
export function useDepartmentContent(
  departmentId: string,
  loader: (departmentId: string) => Promise<{ data?: ApiRecord[] } | undefined>,
) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await loader(departmentId)
      setItems((response?.data ?? []).map(mapContentRecord))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load records.')
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [departmentId, loader])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, isLoading, error, reload, setError }
}
