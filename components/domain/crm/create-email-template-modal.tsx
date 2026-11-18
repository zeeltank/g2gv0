'use client'

/**
 * Create/Edit dialog for the Email Templates admin library - same shape as
 * CreatePriceBookModal (a null `template` prop means "Create", a real one
 * means "Edit", same seeded-form-state pattern).
 */

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmEmailTemplate, CrmEmailTemplatePayload } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  template: CrmEmailTemplate | null
}

const EMPTY: CrmEmailTemplatePayload = {
  name: '', folder: '', subject: '', body: '', assignedTo: '',
}

export function CreateEmailTemplateModal({ isOpen, onClose, onSaved, template }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<CrmEmailTemplate | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmEmailTemplatePayload>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== template) {
    setSeededFrom(template)
    setForm(template
      ? {
          name: template.name, folder: template.folder ?? '', subject: template.subject,
          body: template.body, assignedTo: template.assignedTo ?? '',
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmEmailTemplatePayload>(key: K, value: CrmEmailTemplatePayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.name?.trim() || !form.subject?.trim() || !form.body?.trim()) {
      setError('Name, Subject, and Body are all required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = template
        ? await crmService.updateEmailTemplate(context, template.id, form)
        : await crmService.createEmailTemplate(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that email template.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{template ? 'Edit Email Template' : 'New Email Template'}</DialogTitle>
          <DialogDescription>
            {template ? 'Update this reusable email.' : 'A reusable subject + body, selectable when composing a CRM email.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="et-name">Name *</Label>
            <Input id="et-name" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="et-folder">Folder</Label>
            <Input id="et-folder" value={form.folder ?? ''} onChange={(e) => set('folder', e.target.value)} placeholder="e.g. Sales" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="et-subject">Subject *</Label>
            <Input id="et-subject" value={form.subject ?? ''} onChange={(e) => set('subject', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="et-body">Body *</Label>
            <Textarea id="et-body" rows={8} value={form.body ?? ''} onChange={(e) => set('body', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Assigned To</Label>
            <SearchableSelect
              value={form.assignedTo ?? ''}
              onChange={(v) => set('assignedTo', v)}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Choose an employee…"
            />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.name?.trim() || !form.subject?.trim() || !form.body?.trim()}>
            {submitting ? 'Saving…' : template ? 'Save Changes' : 'Create Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
