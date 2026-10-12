'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmAsset, CrmAssetPayload, CrmPicklistValue } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { useOrganizationOptions } from './organization-options'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  asset: CrmAsset | null
}

const EMPTY: CrmAssetPayload = {
  assetName: '', productId: null, organizationId: null, serialNumber: '', tagNumber: '',
  dateSold: '', dateInService: '', status: '', shippingMethod: '', shippingTrackingNumber: '',
  invoiceId: null, description: '', assignedTo: '',
}

/** Products & Services share one physical table (`crm_products`) - an Asset's `product_id` can point at either, so both item types are fetched and offered together, same as `AddPriceBookItemDialog` already does on the Price Book detail page. */
function useProductOptions(enabled: boolean) {
  const context = useMemo(() => getLaravelContext(), [])
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    Promise.all([
      crmService.getProducts(context, 'product', { perPage: 200, sortBy: 'name', sortDir: 'asc' }),
      crmService.getProducts(context, 'service', { perPage: 200, sortBy: 'name', sortDir: 'asc' }),
    ])
      .then(([products, services]) => {
        if (active) setOptions([...products.data.items, ...services.data.items].map((p) => ({ id: p.id, label: p.name })))
      })
      .catch(() => { /* the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return options
}

function useInvoiceOptions(enabled: boolean) {
  const context = useMemo(() => getLaravelContext(), [])
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    if (!enabled || !isLaravelContextReady(context)) return
    let active = true

    crmService.getInvoices(context, { perPage: 200, sortBy: 'created_at', sortDir: 'desc' })
      .then((response) => { if (active) setOptions(response.data.items.map((i) => ({ id: i.id, label: i.invoiceNo ? `${i.invoiceNo} · ${i.subject}` : i.subject }))) })
      .catch(() => { /* the form still works with an empty picker */ })

    return () => { active = false }
  }, [context, enabled])

  return options
}

export function CreateAssetModal({ isOpen, onClose, onSaved, asset }: Props) {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, isOpen)
  const organizations = useOrganizationOptions(context, isOpen)
  const products = useProductOptions(isOpen)
  const invoices = useInvoiceOptions(isOpen)
  const [statusOptions, setStatusOptions] = useState<CrmPicklistValue[]>([])

  useEffect(() => {
    if (!isOpen || !isLaravelContextReady(context)) return
    crmService.getPicklistValues(context, 'assets')
      .then((response) => setStatusOptions(response.data.assets?.status ?? []))
      .catch(() => { /* the form still works with an empty status picker */ })
  }, [isOpen, context])

  const [seededFrom, setSeededFrom] = useState<CrmAsset | null | 'unset'>('unset')
  const [form, setForm] = useState<CrmAssetPayload>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (isOpen && seededFrom !== asset) {
    setSeededFrom(asset)
    setForm(asset
      ? {
          assetName: asset.assetName, productId: asset.productId, organizationId: asset.organizationId,
          serialNumber: asset.serialNumber ?? '', tagNumber: asset.tagNumber ?? '',
          dateSold: asset.dateSold ?? '', dateInService: asset.dateInService ?? '', status: asset.status ?? '',
          shippingMethod: asset.shippingMethod ?? '', shippingTrackingNumber: asset.shippingTrackingNumber ?? '',
          invoiceId: asset.invoiceId, description: asset.description ?? '', assignedTo: asset.assignedTo ?? '',
        }
      : EMPTY)
    setError('')
  } else if (!isOpen && seededFrom !== 'unset') {
    setSeededFrom('unset')
  }

  const set = <K extends keyof CrmAssetPayload>(key: K, value: CrmAssetPayload[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async () => {
    if (!form.assetName?.trim() || !form.productId || !form.assignedTo) {
      setError('Asset Name, Product, and Assigned To are required.')
      return
    }
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = asset
        ? await crmService.updateAsset(context, asset.id, form)
        : await crmService.createAsset(context, form)
      onSaved(response.message)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that asset.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{asset ? 'Edit Asset' : 'New Asset'}</DialogTitle>
          <DialogDescription>
            {asset ? 'Update this asset.' : 'A serialized unit of a Product, owned by an Organization.'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          <div className="space-y-1.5">
            <Label htmlFor="asset-name">Asset Name *</Label>
            <Input id="asset-name" value={form.assetName ?? ''} onChange={(e) => set('assetName', e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <SearchableSelect
                value={form.productId ?? ''}
                onChange={(v) => set('productId', v || null)}
                options={products.map((p) => ({ value: p.id, label: p.label }))}
                placeholder="Choose a product or service…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <SearchableSelect
                value={form.organizationId ?? ''}
                onChange={(v) => set('organizationId', v || null)}
                options={organizations.map((o) => ({ value: o.id, label: o.name }))}
                placeholder="No organization"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="asset-serial">Serial Number</Label>
              <Input id="asset-serial" value={form.serialNumber ?? ''} onChange={(e) => set('serialNumber', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-tag">Tag Number</Label>
              <Input id="asset-tag" value={form.tagNumber ?? ''} onChange={(e) => set('tagNumber', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <SearchableSelect
                value={form.status ?? ''}
                onChange={(v) => set('status', v)}
                options={statusOptions.map((s) => ({ value: s.value, label: s.label }))}
                placeholder="Choose a status…"
              />
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
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="asset-date-sold">Date Sold</Label>
              <Input id="asset-date-sold" type="date" value={form.dateSold ?? ''} onChange={(e) => set('dateSold', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asset-date-in-service">Date In Service</Label>
              <Input id="asset-date-in-service" type="date" value={form.dateInService ?? ''} onChange={(e) => set('dateInService', e.target.value)} />
            </div>
          </div>

          <section className="space-y-2 rounded-lg border border-border p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shipping &amp; Invoice</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input value={form.shippingMethod ?? ''} onChange={(e) => set('shippingMethod', e.target.value)} placeholder="Shipping Method" />
              <Input value={form.shippingTrackingNumber ?? ''} onChange={(e) => set('shippingTrackingNumber', e.target.value)} placeholder="Shipping Tracking Number" />
            </div>
            <div className="space-y-1.5">
              <Label>Invoice</Label>
              <SearchableSelect
                value={form.invoiceId ?? ''}
                onChange={(v) => set('invoiceId', v || null)}
                options={invoices.map((i) => ({ value: i.id, label: i.label }))}
                placeholder="No invoice"
              />
            </div>
          </section>

          <div className="space-y-1.5">
            <Label htmlFor="asset-description">Description</Label>
            <Textarea id="asset-description" rows={3} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </div>

          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.assetName?.trim()}>
            {submitting ? 'Saving…' : asset ? 'Save Changes' : 'Create Asset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
