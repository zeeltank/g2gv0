'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorText } from '@/lib/api-messages'
import type { LaravelContext } from '@/lib/laravel-context'
import { serverProblems } from '@/lib/product-key'
import { ApiError } from '@/services/core'
import type { ProductInfo } from '@/services/portfolio/types'
import { productIcpService } from '@/services/signals/product-icp'

/**
 * Edit a Product's own details: its name, category, description and status (slice 15). The key never changes (signals and Sub-products point at it). This is what the old
 * Portfolio's "Edit Product" dialog did; the unified screens had no way to do it, so it is a plain dialog on the Product page, offered to an administrator for a Product this
 * organisation created itself (a built-in Product is shared and read only). It saves through `PUT /api/signals/icp/products/{key}`, which the server limits to administrators.
 */
export function ProductEditDialog({ context, open, product, onClose, onSaved }: {
  context: LaravelContext
  open: boolean
  product: ProductInfo
  onClose: () => void
  onSaved: (saved: ProductInfo) => void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [labelError, setLabelError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel(product.label ?? '')
    setDescription(product.description ?? '')
    setCategory(product.category ?? '')
    setStatus(product.status === 'inactive' ? 'inactive' : 'active')
    setLabelError('')
    setGeneralError('')
    setBusy(false)
  }, [open, product])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const name = label.trim()
    if (name.length < 2) { setLabelError('Give the product a name (at least 2 characters).'); return }
    if (name.length > 60) { setLabelError('At most 60 characters.'); return }
    setLabelError('')
    setGeneralError('')
    setBusy(true)
    try {
      const res = await productIcpService.updateProduct(context, product.key, {
        label: name,
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        status,
      })
      onSaved(res.data.product)
      onClose()
    } catch (cause) {
      const { fields, general } = serverProblems(cause instanceof ApiError ? cause.errors : undefined)
      if (fields.label) setLabelError(fields.label)
      setGeneralError(general[0] ?? (fields.label ? 'Fix the highlighted field.' : apiErrorText(cause, 'Could not update the product.')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit product: {product.label}</DialogTitle>
          <DialogDescription>Change the name, category, status and description. The key ({product.key}) stays, so signals and sub-products keep pointing at this product.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4 pt-1" aria-busy={busy}>
          <div className="space-y-1">
            <label htmlFor="edit-prod-label" className="text-xs font-semibold text-foreground">Product name <span className="text-destructive">*</span></label>
            <Input id="edit-prod-label" value={label} maxLength={60} disabled={busy} onChange={(e) => setLabel(e.target.value)} autoFocus />
            {labelError && <p role="alert" className="text-xs text-destructive">{labelError}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-prod-category" className="text-xs font-semibold text-foreground">Category <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input id="edit-prod-category" value={category} maxLength={60} disabled={busy} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-prod-status" className="text-xs font-semibold text-foreground">Status</label>
            <select
              id="edit-prod-status"
              value={status}
              disabled={busy}
              onChange={(e) => setStatus(e.target.value === 'inactive' ? 'inactive' : 'active')}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive (left out of signal research)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-prod-desc" className="text-xs font-semibold text-foreground">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Textarea id="edit-prod-desc" rows={3} value={description} maxLength={500} disabled={busy} onChange={(e) => setDescription(e.target.value)} className="text-xs" />
          </div>
          {generalError && <p role="alert" className="rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">{generalError}</p>}
          <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
