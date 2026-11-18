'use client'

/**
 * Email Templates admin library - detail/read view. Same shape as
 * PriceBookDetailPage, minus its own Product Prices sub-list (a template has
 * nothing of its own to manage beyond the header fields CreateEmailTemplateModal
 * already edits).
 */

import { useState } from 'react'
import { ArrowLeft, FolderOpen, Mail, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReadField, SectionCard } from '@/components/shared/business/shared'
import type { CrmEmailTemplate } from '@/types/crm'
import { CreateEmailTemplateModal } from './create-email-template-modal'

interface Props {
  template: CrmEmailTemplate
  onSaved: () => void
  onBack: () => void
}

export function EmailTemplateDetailPage({ template, onSaved, onBack }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [notice, setNotice] = useState('')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to Email Templates" title="Back to Email Templates">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Button>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary">
            <Mail className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{template.name}</h1>
            <p className="text-sm text-muted-foreground">{template.folder || 'No folder'}</p>
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 size-4" aria-hidden="true" />
          Edit
        </Button>
      </div>

      {notice && <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success">{notice}</div>}

      <SectionCard title="Template Details">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <ReadField label="Folder" value={template.folder && <span className="inline-flex items-center gap-1.5"><FolderOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />{template.folder}</span>} />
          <ReadField label="Subject" value={template.subject} />
        </dl>
      </SectionCard>

      <SectionCard title="Body">
        <p className="whitespace-pre-wrap text-sm text-foreground">{template.body}</p>
      </SectionCard>

      <CreateEmailTemplateModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(message) => { setNotice(message); setEditOpen(false); onSaved() }}
        template={template}
      />
    </div>
  )
}
