'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { apiErrorText } from '@/lib/api-messages'
import type { LaravelContext } from '@/lib/laravel-context'
import { serverProblems, suggestKey, validateNewProduct, type NewProductErrors } from '@/lib/product-key'
import { ApiError } from '@/services/core'
import { productIcpService } from '@/services/signals/product-icp'

/**
 * Creates a NEW top-level product, with its own identity and its own ICP. This is not "Add Product" (which adds an offer inside an existing
 * product group): nothing here touches an offer, a group or another product's ICP. After it is created the person lands on the product's own
 * ICP tab to define who buys it. The organisation comes from the sign-in; the server checks the key and name again.
 */
export function NewProductDialog({ context, open, onClose, onCreated }: { context: LaravelContext; open: boolean; onClose: () => void; onCreated: (key: string) => void }) {
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  // Once the person edits the key themselves it stops following the name.
  const [keyTouched, setKeyTouched] = useState(false)
  const [errors, setErrors] = useState<NewProductErrors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel(''); setKey(''); setKeyTouched(false); setErrors({}); setMessage(''); setBusy(false)
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const found = validateNewProduct(key, label)
    setErrors(found)
    if (found.key || found.label) return
    setBusy(true)
    setMessage('')
    try {
      const res = await productIcpService.createProduct(context, { key, label: label.trim() })
      onCreated(res.data.product.key)
    } catch (err) {
      const { fields, general } = serverProblems(err instanceof ApiError ? err.errors : undefined)
      setErrors(fields)
      setMessage(general[0] ?? (fields.key || fields.label ? 'Fix the highlighted fields.' : apiErrorText(err, 'Could not create the product.')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
          <DialogDescription>
            A separate product with its own ideal customer profile. To add an offer to an existing product, use Add Product instead.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void submit(e)} className="space-y-4" aria-busy={busy}>
          <div className="space-y-1">
            <label htmlFor="np-label" className="text-xs font-medium text-foreground">Product name <span className="text-destructive">*</span></label>
            <Input
              id="np-label"
              value={label}
              maxLength={50}
              disabled={busy}
              onChange={(e) => { setLabel(e.target.value); if (!keyTouched) setKey(suggestKey(e.target.value)) }}
              placeholder="For example: Payroll Cloud"
            />
            {errors.label && <p role="alert" className="text-xs text-destructive">{errors.label}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="np-key" className="text-xs font-medium text-foreground">Key <span className="text-destructive">*</span></label>
            <Input id="np-key" value={key} maxLength={20} disabled={busy} onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toLowerCase()) }} />
            {errors.key
              ? <p role="alert" className="text-xs text-destructive">{errors.key}</p>
              : <p className="text-xs text-muted-foreground">Used in addresses and to label this product&apos;s signals. It cannot be changed later.</p>}
          </div>
          {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
          <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Create product</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
