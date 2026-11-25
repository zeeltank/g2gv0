'use client'

import { useCallback, useEffect, useState } from 'react'
import { SectionCard } from '@/components/shared/business/shared'
import type { LaravelContext } from '@/lib/laravel-context'
import { contactsService } from '@/services/crm/contacts'
import type { CrmAuditEntry, CrmComment, CrmEmailLinkEntry, CrmLinkedDocument } from '@/types/crm'
import { CommentThread } from '../comment-thread'
import { CrmDocumentTab } from '../crm-document-tab'
import { CrmEmailTab } from '../crm-email-tab'
import { CrmHistoryTab } from '../crm-history-tab'

/**
 * The Notes, Files, Emails and History tabs of a person: the existing tab components (comment-thread, crm-document-tab, crm-email-tab, crm-history-tab)
 * with this person's own calls. Each loads when its tab is opened (the tab panel builds its content only while it is open), so a person's panel costs one
 * request, not six.
 */

function useRows<T>(load: () => Promise<{ data: T[] }>) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await load()
      setRows(response.data ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load this.')
    } finally {
      setLoading(false)
    }
  }, [load])
  useEffect(() => { queueMicrotask(() => { void reload() }) }, [reload])
  return { rows, loading, error, reload }
}

function LoadProblem({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</p> : null
}

export function PersonNotes({ context, personId }: { context: LaravelContext; personId: string }) {
  const load = useCallback(() => contactsService.comments(context, personId), [context, personId])
  const { rows, loading, error, reload } = useRows<CrmComment>(load)
  return (
    <SectionCard title="Notes">
      <LoadProblem message={error} />
      <CommentThread
        comments={rows}
        loading={loading}
        onAdd={async (text) => {
          await contactsService.addComment(context, personId, text)
          await reload()
        }}
      />
    </SectionCard>
  )
}

export function PersonFiles({ context, personId }: { context: LaravelContext; personId: string }) {
  const load = useCallback(() => contactsService.documents(context, personId), [context, personId])
  const { rows, loading, error, reload } = useRows<CrmLinkedDocument>(load)
  return (
    <>
      <LoadProblem message={error} />
      <CrmDocumentTab
        documents={rows}
        loading={loading}
        onUpload={async (file) => {
          await contactsService.attachDocument(context, personId, file)
          await reload()
        }}
      />
    </>
  )
}

/** `version` goes up when the panel's compose dialog has sent a mail, so the list reads again. */
export function PersonEmails({ context, personId, onCompose, version }: { context: LaravelContext; personId: string; onCompose: () => void; version: number }) {
  const load = useCallback(() => { void version; return contactsService.emails(context, personId) }, [context, personId, version])
  const { rows, loading, error } = useRows<CrmEmailLinkEntry>(load)
  return (
    <>
      <LoadProblem message={error} />
      <CrmEmailTab emails={rows} loading={loading} onCompose={onCompose} />
    </>
  )
}

export function PersonHistory({ context, personId }: { context: LaravelContext; personId: string }) {
  const load = useCallback(() => contactsService.history(context, personId), [context, personId])
  const { rows, loading, error } = useRows<CrmAuditEntry>(load)
  return (
    <>
      <LoadProblem message={error} />
      <CrmHistoryTab entries={rows} loading={loading} />
    </>
  )
}
