'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmPriceBook, CrmPriceBookPayload } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  priceBook: CrmPriceBook | null
}

const EMPTY: CrmPriceBookPayload = {
  name: '', currency: '', isActive: true, description: '', assignedTo: '',
}

export function CreatePriceBookModal({ isOpen, onClose, onSaved, priceBook }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)

  const [seededFrom, setSeededFrom] = useState<CrmPriceBook | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmPriceBookPayload>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== priceBook) {
    setSeededFrom(priceBook)
    setForm(priceBook
      ? {
          name: priceBook.name, currency: priceBook.currency ?? '', isActive: priceBook.isActive,
          description: priceBook.description ?? '', assignedTo: priceBook.assignedTo ?? '',
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmPriceBookPayload>(key: K, value: CrmPriceBookPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.name?.trim() || !form.assignedTo) {
      setError('Name and Assigned To are required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = priceBook
        ? await crmService.updatePriceBook(context, priceBook.id, form)
        : await crmService.createPriceBook(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that price book.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>{priceBook ? 'Edit Price Book' : 'New Price Book'}</DialogTitle>
          <DialogDescription>
            {priceBook ? 'Update this price book.' : 'A named price list, e.g. "Wholesale" or "Retail" - set per-product prices after creating it.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="pb-name">Name *</Label>
            <Input id="pb-name" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pb-currency">Currency</Label>
            <Input id="pb-currency" value={form.currency ?? ''} onChange={(e) => set('currency', e.target.value)} placeholder="USD" />
          </div>

          <div className="space-y-1.5">
            <Label>Assigned To *</Label>
            <SearchableSelect
              value={form.assignedTo ?? ''}
              onChange={(v) => set('assignedTo', v)}
              options={employees.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Choose an employee…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pb-description">Description</Label>
            <Textarea id="pb-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="pb-active" className="cursor-pointer">Active</Label>
            <Switch id="pb-active" checked={form.isActive ?? true} onChange={(e) => set('isActive', e.target.checked)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.name?.trim()}>
            {submitting ? 'Saving…' : priceBook ? 'Save Changes' : 'Create Price Book'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
