'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmFaq, CrmFaqPayload, CrmPicklistValue } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  faq: CrmFaq | null
  categories: CrmPicklistValue[]
  statuses: CrmPicklistValue[]
}

const EMPTY: CrmFaqPayload = {
  question: '', answer: '', category: '', status: 'Draft', productId: '', assignedTo: '',
}

export function CreateFaqModal({ isOpen, onClose, onSaved, faq, categories, statuses }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)

  const [products, setProducts] = useState<Array<{ id: string; label: string }>>([])
  const [seededFrom, setSeededFrom] = useState<CrmFaq | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmFaqPayload>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !isLaravelContextReady(context)) return
    Promise.all([
      crmService.getProducts(context, 'product', { perPage: 100, sortBy: 'name', sortDir: 'asc' }),
      crmService.getProducts(context, 'service', { perPage: 100, sortBy: 'name', sortDir: 'asc' }),
    ])
      .then(([products, services]) => setProducts([...products.data.items, ...services.data.items].map((p) => ({ id: p.id, label: p.name }))))
      .catch(() => { /* the form still works with an empty picker */ })
  }, [isOpen, context])

  if (isOpen && seededFrom !== faq) {
    setSeededFrom(faq)
    setForm(faq
      ? {
          question: faq.question, answer: faq.answer ?? '', category: faq.category ?? '',
          status: faq.status ?? 'Draft', productId: faq.productId ?? '', assignedTo: faq.assignedTo ?? '',
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmFaqPayload>(key: K, value: CrmFaqPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.question?.trim() || !form.answer?.trim()) {
      setError('Question and Answer are required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = faq
        ? await crmService.updateFaq(context, faq.id, form)
        : await crmService.createFaq(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that FAQ.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{faq ? 'Edit FAQ' : 'New FAQ'}</DialogTitle>
          <DialogDescription>
            {faq ? 'Update this question and answer.' : 'Add a question and its answer - optionally scoped to one product or service.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="faq-question">Question *</Label>
            <Textarea id="faq-question" rows={2} value={form.question ?? ''} onChange={(e) => set('question', e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-answer">Answer *</Label>
            <Textarea id="faq-answer" rows={5} value={form.answer ?? ''} onChange={(e) => set('answer', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <SearchableSelect
                value={form.category ?? ''}
                onChange={(v) => set('category', v)}
                options={categories.map((c) => ({ value: c.value, label: c.label }))}
                placeholder="Choose a category…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <SearchableSelect
                value={form.status ?? 'Draft'}
                onChange={(v) => set('status', v)}
                options={statuses.map((s) => ({ value: s.value, label: s.label }))}
                placeholder="Choose a status…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Product / Service</Label>
            <SearchableSelect
              value={form.productId ?? ''}
              onChange={(v) => set('productId', v)}
              options={products.map((p) => ({ value: p.id, label: p.label }))}
              placeholder="Optional - leave blank for a general question…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Assigned To</Label>
            <SearchableSelect
              value={form.assignedTo ?? ''}
              onChange={(v) => set('assignedTo', v)}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Optional…"
            />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.question?.trim() || !form.answer?.trim()}>
            {submitting ? 'Saving…' : faq ? 'Save Changes' : 'Create FAQ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
