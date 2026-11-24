'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Field, NativeSelect, useConfirm } from '@/components/shared/scaffolds'
import { SectionCard } from '@/components/shared/business/shared'
import type { LaravelContext } from '@/lib/laravel-context'
import { FIELD_ERROR_TEXT } from '@/lib/org-accounts/tones'
import { formatMoney } from '@/lib/portfolio/page-model'
import { PICKER_RULES } from '@/lib/product-picker/consumer-rules'
import { isSelectable, rowKey, rowTag } from '@/lib/product-picker/model'
import { crmService } from '@/services/crm'
import { productRecordService } from '@/services/product-master/record-service'
import type { PmPickerRow, PmSell } from '@/services/product-master/record-types'
import type { CrmProductBundleItem } from '@/types/crm'

/**
 * The Bundle tab: the priced parts a Sub-product is built from, with a quantity each. Products only, one level deep, as the old Products page had it. The
 * parts are the Sub-products that are sold, active and in the CRM (the picker's own rule). It reads and writes through the three bundle calls keyed by the
 * Sell entry's id; a person who may not edit sees the parts and no buttons.
 */
export function BundleTab({ sell, context, canEdit }: { sell: PmSell; context: LaravelContext; canEdit: boolean }) {
  const productId = String(sell.crmProductId)
  const [items, setItems] = useState<CrmProductBundleItem[] | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const { confirm, confirmDialog } = useConfirm()

  const load = useCallback(async () => {
    try {
      setItems((await crmService.getBundleItems(context, productId)).data)
      setError('')
    } catch (cause) {
      setItems([])
      setError(cause instanceof Error ? cause.message : 'The parts could not be loaded.')
    }
  }, [context, productId])
  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  const total = (items ?? []).reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0)

  const remove = async (item: CrmProductBundleItem) => {
    if (!(await confirm({ title: `Remove ${item.name}?`, description: 'It stops being a part of this bundle. Nothing else changes.', confirmLabel: 'Remove' }))) return
    try {
      await crmService.removeBundleItem(context, productId, item.id)
      void load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That part could not be removed.')
    }
  }

  return (
    <>
      <SectionCard
        title="Bundle"
        description="Build this as a kit of other sub-products. The bundle keeps its own price, set separately."
        actions={canEdit ? <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1.5 size-3.5" aria-hidden="true" />Add a part</Button> : undefined}
      >
        {error && <p role="alert" className={`mb-3 text-sm ${FIELD_ERROR_TEXT}`}>{error}</p>}
        {items === null
          ? <p role="status" className="text-sm text-muted-foreground">Loading…</p>
          : items.length === 0
            ? <EmptyState title="Not a bundle yet" description="Add the sub-products it is built from, each with a quantity." />
            : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Part</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Unit price</TableHead>{canEdit && <TableHead><span className="sr-only">Remove</span></TableHead>}</TableRow></TableHeader>
                    <TableBody>
                      {items.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">{i.name}</TableCell>
                          <TableCell className="text-right">{i.quantity}</TableCell>
                          <TableCell className="text-right">{formatMoney(i.unitPrice, sell.currency) ?? '—'}</TableCell>
                          {canEdit && <TableCell className="text-right"><Button size="icon" variant="ghost" aria-label={`Remove ${i.name}`} onClick={() => void remove(i)}><Trash2 className="size-4" aria-hidden="true" /></Button></TableCell>}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-foreground">Parts total: <span className="font-semibold">{formatMoney(total, sell.currency)}</span></p>
              </div>
            )}
      </SectionCard>
      <AddPartDialog open={adding} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); void load() }} context={context} productId={productId} />
      {confirmDialog}
    </>
  )
}

function AddPartDialog({ open, onClose, onAdded, context, productId }: { open: boolean; onClose: () => void; onAdded: () => void; context: LaravelContext; productId: string }) {
  const [text, setText] = useState('')
  const [options, setOptions] = useState<PmPickerRow[]>([])
  const [componentId, setComponentId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Search as the person types: the picker lists every active product, the ones that are not sold tagged and not choosable, and never the bundle itself.
  useEffect(() => {
    if (!open) return
    let live = true
    const timer = setTimeout(() => {
      productRecordService.pickerParts(text, 20, PICKER_RULES.bundle.scope)
        .then((r) => { if (live) setOptions(r.data.filter((o) => String(o.crmProductId) !== productId)) })
        .catch(() => { if (live) setOptions([]) })
    }, 200)
    return () => { live = false; clearTimeout(timer) }
  }, [open, text, productId])

  const submit = async () => {
    if (componentId === '') return
    setBusy(true)
    setError('')
    try {
      await crmService.addBundleItem(context, productId, componentId, Number(quantity) || 1)
      setComponentId('')
      setQuantity('1')
      setText('')
      onAdded()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That part could not be added.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a part</DialogTitle>
          <DialogDescription>Choose a sold sub-product and how many of it the bundle holds. A sub-product that is not sold in CRM is listed, and cannot be chosen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Find a sub-product">{(c) => <Input {...c} value={text} onChange={(e) => setText(e.target.value)} placeholder="Name or SKU" autoComplete="off" />}</Field>
          <Field label="Part" required>
            {(c) => (
              <NativeSelect {...c} value={componentId} onChange={(e) => setComponentId(e.target.value)}>
                <option value="">Choose a sub-product…</option>
                {options.map((o) => {
                  const tag = rowTag(o)
                  return <option key={rowKey(o)} value={o.crmProductId ?? ''} disabled={!isSelectable(o, PICKER_RULES.bundle.notSoldSelectable)}>{o.productName ? `${o.productName} › ${o.name}` : o.name}{o.sku ? ` (${o.sku})` : ''}{tag ? ` - ${tag}` : ''}</option>
                })}
              </NativeSelect>
            )}
          </Field>
          <Field label="Quantity">{(c) => <Input {...c} type="number" min={0.01} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />}</Field>
        </div>
        {error && <p role="alert" className={`rounded-lg border border-destructive p-3 text-sm ${FIELD_ERROR_TEXT}`}>{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={busy || componentId === ''}>{busy ? 'Adding…' : 'Add'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
