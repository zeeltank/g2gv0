'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  competencyApprovalService,
  type ApprovalCounts,
  type ApprovalRequest,
  type ApprovalStatus,
  type ApprovalSubjectType,
  type ApprovalTrailEntry,
} from '@/services/competency'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

export interface ApprovalMutationResult {
  ok: boolean
  message: string
}

const EMPTY_COUNTS: ApprovalCounts = { pending: 0, approved: 0, rejected: 0 }

export interface UseApprovalQueueState {
  items: ApprovalRequest[]
  counts: ApprovalCounts
  loading: boolean
  error: string | null
  saving: boolean
  actionMessage: string | null
  actionError: string | null
  retry: () => void
  decide: (id: number, decision: 'approve' | 'reject', note?: string) => Promise<ApprovalMutationResult>
  bulkApprove: (ids?: number[]) => Promise<ApprovalMutationResult>
  clearMessages: () => void
}

/**
 * The approval inbox. `status` and `subjectType` narrow it; both are part of the
 * request so the counts always describe the whole queue, not the filtered slice.
 */
export function useApprovalQueue(
  status: ApprovalStatus,
  subjectType?: ApprovalSubjectType,
  enabled = true,
): UseApprovalQueueState {
  const resolveContext = useLaravelContext()

  const [items, setItems] = useState<ApprovalRequest[]>([])
  const [counts, setCounts] = useState<ApprovalCounts>(EMPTY_COUNTS)
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
      const response = await competencyApprovalService.list(resolveContext(), {
        status,
        ...(subjectType ? { subject_type: subjectType } : {}),
      })
      setItems(response.data ?? [])
      setCounts(response.counts ?? EMPTY_COUNTS)
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the approval queue.'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [enabled, resolveContext, status, subjectType])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  const runMutation = useCallback(
    async (action: () => Promise<{ message: string }>, fallback: string): Promise<ApprovalMutationResult> => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)
      try {
        const response = await action()
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

  return {
    items,
    counts,
    loading,
    error,
    saving,
    actionMessage,
    actionError,
    retry: load,
    decide: (id, decision, note) =>
      runMutation(
        () => competencyApprovalService.decide(resolveContext(), id, decision, note),
        decision === 'approve' ? 'Failed to approve.' : 'Failed to reject.',
      ),
    bulkApprove: (ids) =>
      runMutation(
        () => competencyApprovalService.bulkApprove(resolveContext(), ids),
        'Failed to approve the selected requests.',
      ),
    clearMessages: () => {
      setActionMessage(null)
      setActionError(null)
    },
  }
}

/**
 * Submit-for-approval, for the screens that own the subject (Competency
 * Library, Framework & Role Mapping). Separate from the queue hook so a screen
 * can submit without loading the inbox.
 */
export function useSubmitForApproval() {
  const resolveContext = useLaravelContext()
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(
    async (
      subjectType: 'competency' | 'framework',
      subjectId: number,
      note?: string,
    ): Promise<ApprovalMutationResult> => {
      setSubmitting(true)
      try {
        const response = await competencyApprovalService.submit(resolveContext(), {
          subject_type: subjectType,
          subject_id: subjectId,
          ...(note ? { note } : {}),
        })
        return { ok: true, message: response.message }
      } catch (error) {
        return { ok: false, message: toMessage(error, 'Failed to submit for approval.') }
      } finally {
        setSubmitting(false)
      }
    },
    [resolveContext],
  )

  return { submit, submitting }
}

/** One subject's approval trail, for its detail panel. */
export function useApprovalTrail(
  subjectType: 'competency' | 'framework',
  subjectId: number | null,
) {
  const resolveContext = useLaravelContext()
  const [trail, setTrail] = useState<ApprovalTrailEntry[]>([])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(async () => {
      if (subjectId == null) {
        setTrail([])
        return
      }
      try {
        const response = await competencyApprovalService.trail(resolveContext(), subjectType, subjectId)
        if (!cancelled) setTrail(response.data ?? [])
      } catch {
        // The trail is supporting context - a failure must not blank the panel.
        if (!cancelled) setTrail([])
      }
    })
    return () => {
      cancelled = true
    }
  }, [resolveContext, subjectId, subjectType])

  return trail
}
