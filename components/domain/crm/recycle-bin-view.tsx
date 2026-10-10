'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Briefcase, Building2, FileText, Loader2, Megaphone, Package, RotateCcw, Target, Trash2, User, UserPlus } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmRecycleBinItem, CrmRecycleBinType } from '@/types/crm'
import { employeeName, useAssignableEmployees } from './lead-employees'

const PAGE_SIZE = 20

const TYPE_META: Record<CrmRecycleBinType, { label: string; icon: typeof User; badge: BadgeProps['variant'] }> = {
  leads: { label: 'Lead', icon: UserPlus, badge: 'navy' },
  contacts: { label: 'Contact', icon: User, badge: 'secondary' },
  organizations: { label: 'Organization', icon: Building2, badge: 'success' },
  campaigns: { label: 'Campaign', icon: Megaphone, badge: 'warning' },
  opportunities: { label: 'Opportunity', icon: Target, badge: 'default' },
  quotes: { label: 'Quote', icon: FileText, badge: 'outline' },
  products: { label: 'Product', icon: Package, badge: 'muted' },
  services: { label: 'Service', icon: Briefcase, badge: 'destructive' },
}

/** "30m ago" / "2h ago" / "5d ago" - same small convention as the Talent dashboard's activity feed, not worth sharing for one more caller. */
function relativeTime(value: string): string {
  const then = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(then.getTime())) return value

  const seconds = Math.floor((Date.now() - then.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`
  return then.toLocaleDateString()
}

/**
 * One shared Recycle Bin across Leads, Contacts, Organizations, and
 * Campaigns - the backend unions all 4 tables itself (CrmRecycleBinController),
 * each row already filtered server-side to what the caller has "view" rights
 * on, so this component never has to reason about per-type permissions.
 */
export function RecycleBinView() {
  const context = useMemo(() => getLaravelContext(), [])

  const [items, setItems] = useState<CrmRecycleBinItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyKey, setBusyKey] = useState('')

  const employees = useAssignableEmployees(context, true)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setIsLoading(false); return }
    setIsLoading(true)
    setError('')
    try {
      const response = await crmService.getRecycleBin(context, { page, perPage: PAGE_SIZE })
      setItems(response.data.items)
      setTotal(response.data.pagination.total)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load the Recycle Bin.')
    } finally {
      setIsLoading(false)
    }
  }, [context, page])

  useEffect(() => {
    queueMicrotask(() => { void load() })
  }, [load])

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rowKey = (item: CrmRecycleBinItem) => `${item.type}:${item.id}`

  const handleRestore = async (item: CrmRecycleBinItem) => {
    setBusyKey(rowKey(item))
    setError('')
    try {
      const response = await crmService.restoreRecycleBinItem(context, item.type, item.id)
      setNotice(`${TYPE_META[item.type].label} "${item.name}" restored.`)
      setItems((prev) => prev.filter((row) => rowKey(row) !== rowKey(item)))
      setTotal((prev) => Math.max(0, prev - 1))
      void response
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to restore this record.')
    } finally {
      setBusyKey('')
    }
  }

  const handleForceDelete = async (item: CrmRecycleBinItem) => {
    if (!window.confirm(`Permanently delete "${item.name}"? This cannot be undone - it will not come back to the Recycle Bin.`)) return
    setBusyKey(rowKey(item))
    setError('')
    try {
      await crmService.forceDeleteRecycleBinItem(context, item.type, item.id)
      setNotice(`${TYPE_META[item.type].label} "${item.name}" permanently deleted.`)
      setItems((prev) => prev.filter((row) => rowKey(row) !== rowKey(item)))
      setTotal((prev) => Math.max(0, prev - 1))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to permanently delete this record.')
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Recycle Bin</h1>
        <p className="text-sm text-muted-foreground">
          Deleted leads, contacts, organizations, and campaigns. Restore a record, or remove it for good.
        </p>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-border">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading Recycle Bin…
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="py-14 text-center text-sm text-muted-foreground">
            <Trash2 className="mx-auto mb-3 size-8 text-muted-foreground/50" aria-hidden="true" />
            Recycle Bin is empty.
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const meta = TYPE_META[item.type]
              const Icon = meta.icon
              const busy = busyKey === rowKey(item)

              return (
                <li key={rowKey(item)} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:gap-4">
                  <Badge variant={meta.badge} className="shrink-0 gap-1">
                    <Icon className="size-3" aria-hidden="true" />
                    {meta.label}
                  </Badge>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.subLabel ? `${item.subLabel} · ` : ''}
                      Deleted {relativeTime(item.deletedAt)}
                      {item.deletedBy ? ` by ${employeeName(employees, item.deletedBy)}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {busy && <Spinner className="size-4" />}
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => void handleRestore(item)}>
                      <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                      Restore
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive" disabled={busy} onClick={() => void handleForceDelete(item)}>
                      <Trash2 className="mr-1.5 size-3.5" aria-hidden="true" />
                      Delete Permanently
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} deleted record{total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {page} of {lastPage}</span>
            <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
