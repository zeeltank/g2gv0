'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorText } from '@/lib/api-messages'
import type { LaravelContext } from '@/lib/laravel-context'
import { serverProblems, suggestKey, validateNewProduct, type NewProductErrors } from '@/lib/product-key'
import { ApiError } from '@/services/core'
import type { ProductInfo } from '@/services/portfolio/types'
import { productIcpService } from '@/services/signals/product-icp'

export interface MainProductFormDialogProps {
  context: LaravelContext
  open: boolean
  mode: 'create' | 'edit'
  product?: ProductInfo | null
  onClose: () => void
  onSaved: (saved: ProductInfo, isNew: boolean) => void
}

export function MainProductFormDialog({
  context,
  open,
  mode,
  product,
  onClose,
  onSaved,
}: MainProductFormDialogProps) {
  const isEdit = mode === 'edit'
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [errors, setErrors] = useState<NewProductErrors & { description?: string; category?: string }>({})
  const [generalError, setGeneralError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    if (isEdit && product) {
      setLabel(product.label ?? '')
      setKey(product.key ?? '')
      setKeyTouched(true)
      setDescription(product.description ?? '')
      setCategory(product.category ?? '')
      setStatus((product.status as 'active' | 'inactive') || 'active')
    } else {
      setLabel('')
      setKey('')
      setKeyTouched(false)
      setDescription('')
      setCategory('')
      setStatus('active')
    }
    setErrors({})
    setGeneralError('')
    setBusy(false)
  }, [open, isEdit, product])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return

    const trimmedLabel = label.trim()
    if (isEdit) {
      if (trimmedLabel.length < 2) {
        setErrors({ label: 'Give the product a name (at least 2 characters).' })
        return
      }
      if (trimmedLabel.length > 60) {
        setErrors({ label: 'At most 60 characters.' })
        return
      }
    } else {
      const found = validateNewProduct(key, trimmedLabel)
      setErrors(found)
      if (found.key || found.label) return
    }

    setBusy(true)
    setGeneralError('')

    try {
      if (isEdit && product) {
        const res = await productIcpService.updateProduct(context, product.key, {
          label: trimmedLabel,
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          status,
        })
        onSaved(res.data.product, false)
      } else {
        const res = await productIcpService.createProduct(context, {
          key: key.trim().toLowerCase(),
          label: trimmedLabel,
          description: description.trim() || undefined,
          category: category.trim() || undefined,
          status,
        })
        onSaved(res.data.product, true)
      }
      onClose()
    } catch (err) {
      const { fields, general } = serverProblems(err instanceof ApiError ? err.errors : undefined)
      setErrors(fields)
      setGeneralError(
        general[0] ??
          (fields.key || fields.label
            ? 'Fix the highlighted fields.'
            : apiErrorText(err, isEdit ? 'Could not update the product.' : 'Could not create the product.'))
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit Product: ${product?.label ?? ''}` : 'New Product'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the product name, category, status, and descriptive details for your portfolio.'
              : 'Create a top-level product line for your organization portfolio with its own offers and signals.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void submit(e)} className="space-y-4 pt-1" aria-busy={busy}>
          {/* Product Name */}
          <div className="space-y-1">
            <label htmlFor="main-prod-label" className="text-xs font-semibold text-foreground">
              Product Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="main-prod-label"
              value={label}
              maxLength={60}
              disabled={busy}
              onChange={(e) => {
                setLabel(e.target.value)
                if (!isEdit && !keyTouched) {
                  setKey(suggestKey(e.target.value))
                }
              }}
              placeholder="e.g. Fiber Valley, ScholarClone, CloudERP"
              autoFocus
            />
            {errors.label && <p role="alert" className="text-xs text-destructive">{errors.label}</p>}
          </div>

          {/* Product Key */}
          <div className="space-y-1">
            <label htmlFor="main-prod-key" className="text-xs font-semibold text-foreground">
              Unique Key <span className="text-destructive">*</span>
            </label>
            <Input
              id="main-prod-key"
              value={key}
              maxLength={30}
              disabled={isEdit || busy}
              onChange={(e) => {
                setKeyTouched(true)
                setKey(e.target.value.toLowerCase())
              }}
              className={isEdit ? 'bg-muted/50 cursor-not-allowed font-mono text-xs' : 'font-mono text-xs'}
              placeholder="e.g. fiber_valley"
            />
            {errors.key ? (
              <p role="alert" className="text-xs text-destructive">{errors.key}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {isEdit
                  ? 'Key is immutable to maintain relational integrity with signals and sub-products.'
                  : 'Used internally to identify this product and its signals. Letters, numbers and underscores only.'}
              </p>
            )}
          </div>

          {/* Category / Type */}
          <div className="space-y-1">
            <label htmlFor="main-prod-category" className="text-xs font-semibold text-foreground">
              Category / Industry Focus <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              id="main-prod-category"
              value={category}
              maxLength={60}
              disabled={busy}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Telecom & Fiber Infrastructure, EdTech SaaS, B2B AI"
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label htmlFor="main-prod-status" className="text-xs font-semibold text-foreground">
              Status
            </label>
            <select
              id="main-prod-status"
              value={status}
              disabled={busy}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="active">Active (Available for signal research &amp; portfolio)</option>
              <option value="inactive">Inactive (Hidden from active signal generation)</option>
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label htmlFor="main-prod-desc" className="text-xs font-semibold text-foreground">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              id="main-prod-desc"
              rows={3}
              value={description}
              maxLength={500}
              disabled={busy}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of this product suite, core capabilities, and target market..."
              className="text-xs"
            />
          </div>

          {generalError && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
              {generalError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

