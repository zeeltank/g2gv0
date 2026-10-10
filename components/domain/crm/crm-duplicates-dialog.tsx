'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import type { CrmDuplicateGroup, CrmMergeResponse } from '@/types/crm'

interface Props {
  isOpen: boolean
  onClose: () => void
  noun: string
  getDuplicates: (context: ReturnType<typeof getLaravelContext>) => Promise<{ data: CrmDuplicateGroup[] }>
  merge: (context: ReturnType<typeof getLaravelContext>, survivorId: string, duplicateIds: string[]) => Promise<CrmMergeResponse>
  getLabel: (row: Record<string, unknown>) => string
  getSubLabel: (row: Record<string, unknown>) => string | null
  /** Called after any successful merge, so the list view behind this dialog refreshes. */
  onMerged: () => void
}

function GroupCard({
  group, noun, getLabel, getSubLabel, busy, onMerge,
}: {
  group: CrmDuplicateGroup
  noun: string
  getLabel: (row: Record<string, unknown>) => string
  getSubLabel: (row: Record<string, unknown>) => string | null
  busy: boolean
  onMerge: (survivorId: string, duplicateIds: string[]) => void
}) {
  const [survivorId, setSurvivorId] = useState(group.rows[0]?.id ?? '')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const duplicateIds = group.rows
    .map((row) => row.id)
    .filter((id) => id !== survivorId && !excluded.has(id))

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline">{group.reason}</Badge>
        <Button
          size="sm"
          disabled={busy || duplicateIds.length === 0}
          onClick={() => onMerge(survivorId, duplicateIds)}
        >
          {busy ? <Spinner className="size-4" /> : `Merge into survivor`}
        </Button>
      </div>

      <ul className="space-y-1">
        {group.rows.map((row) => {
          const id = row.id
          const isSurvivor = id === survivorId

          return (
            <li key={id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
              <input
                type="radio"
                name={`survivor-${group.key}`}
                checked={isSurvivor}
                onChange={() => setSurvivorId(id)}
                aria-label={`Keep ${getLabel(row)} as the survivor`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{getLabel(row)}</p>
                {getSubLabel(row) && <p className="truncate text-xs text-muted-foreground">{getSubLabel(row)}</p>}
              </div>
              {isSurvivor
                ? <span className="shrink-0 text-xs font-medium text-success">Survivor</span>
                : (
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!excluded.has(id)}
                      onChange={(e) => setExcluded((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.delete(id); else next.add(id)
                        return next
                      })}
                      aria-label={`Include ${getLabel(row)} in this merge`}
                    />
                    Merge this {noun}
                  </label>
                )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Shared duplicate-detection + merge dialog, reused by Leads, Contacts, and
 * Organizations (Campaigns has no equivalent - a campaign isn't a
 * "duplicate record" the way those 3 are). Each group picks its own
 * survivor (radio) and which other rows to fold in (checkbox, all checked
 * by default) - merging removes that group from view rather than closing
 * the whole dialog, so several groups can be cleared in one sitting.
 */
export function CrmDuplicatesDialog({ isOpen, onClose, noun, getDuplicates, merge, getLabel, getSubLabel, onMerged }: Props) {
  const context = useMemo(() => getLaravelContext(), [])

  const [groups, setGroups] = useState<CrmDuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mergingKey, setMergingKey] = useState('')

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const response = await getDuplicates(context)
      setGroups(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load possible duplicates.')
    } finally {
      setLoading(false)
    }
  }, [context, getDuplicates])

  useEffect(() => {
    if (isOpen) queueMicrotask(() => { void load() })
  }, [isOpen, load])

  const handleMerge = async (group: CrmDuplicateGroup, survivorId: string, duplicateIds: string[]) => {
    setMergingKey(group.key)
    setError('')
    try {
      const response = await merge(context, survivorId, duplicateIds)
      setNotice(response.message)
      setGroups((prev) => prev.filter((g) => g.key !== group.key))
      onMerged()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to merge these records.')
    } finally {
      setMergingKey('')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Possible Duplicates</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto">
          {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Looking for duplicates…
            </div>
          )}

          {!loading && groups.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-3 size-8 text-muted-foreground/50" aria-hidden="true" />
              No possible duplicates found.
            </div>
          )}

          {!loading && groups.map((group) => (
            <GroupCard
              key={group.key}
              group={group}
              noun={noun}
              getLabel={getLabel}
              getSubLabel={getSubLabel}
              busy={mergingKey === group.key}
              onMerge={(survivorId, duplicateIds) => void handleMerge(group, survivorId, duplicateIds)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
