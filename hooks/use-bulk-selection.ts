'use client'

import { useCallback, useState } from 'react'

/**
 * Shared checkbox-selection state for a list view's bulk-action bar.
 * Task Management hand-rolled this same ~10 lines twice (Dashboard, My
 * Tasks) before this extraction; CRM's 4 list views would have made it six.
 */
export function useBulkSelection<T extends { id: string }>(rows: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? new Set(rows.map((row) => row.id)) : new Set())
  }, [rows])

  const clear = useCallback(() => setSelectedIds(new Set()), [])

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id))

  return { selectedIds, toggle, toggleAll, clear, allSelected }
}
