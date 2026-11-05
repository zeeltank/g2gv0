'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Database, FileText, Layers, Loader2, Search, ShieldCheck, Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiErrorText } from '@/lib/api-messages'
import type { LaravelContext } from '@/lib/laravel-context'
import type { ProductInfo } from '@/services/portfolio/types'
import { productIcpService, type ProductDependencies } from '@/services/signals/product-icp'

export interface MainProductDeleteDialogProps {
  context: LaravelContext
  open: boolean
  product: ProductInfo | null
  onClose: () => void
  onDeleted: (key: string) => void
}

export function MainProductDeleteDialog({
  context,
  open,
  product,
  onClose,
  onDeleted,
}: MainProductDeleteDialogProps) {
  const [loadingDeps, setLoadingDeps] = useState(false)
  const [deps, setDeps] = useState<ProductDependencies['data'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (!open || !product) {
      setDeps(null)
      setError(null)
      setDeleting(false)
      setConfirmed(false)
      return
    }

    let live = true
    setLoadingDeps(true)
    setError(null)
    setConfirmed(false)

    productIcpService
      .getProductDependencies(context, product.key)
      .then((res) => {
        if (live) {
          setDeps(res.data)
        }
      })
      .catch((err) => {
        if (live) {
          setError(apiErrorText(err, 'Failed to inspect product dependencies.'))
        }
      })
      .finally(() => {
        if (live) setLoadingDeps(false)
      })

    return () => {
      live = false
    }
  }, [open, product, context])

  const handleDelete = async () => {
    if (!product || deleting) return
    setDeleting(true)
    setError(null)

    try {
      await productIcpService.deleteProduct(context, product.key)
      onDeleted(product.key)
      onClose()
    } catch (err) {
      setError(apiErrorText(err, 'Could not delete product.'))
    } finally {
      setDeleting(false)
    }
  }

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !deleting) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            <DialogTitle>Delete Product: {product.label}</DialogTitle>
          </div>
          <DialogDescription>
            Review the impact and dependent records before confirming deletion of this product.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Dependency Statistics */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-xs font-semibold text-foreground">Associated Records &amp; Dependencies</span>
              {loadingDeps && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 rounded-lg bg-background p-2 border border-border/40">
                <Layers className="size-4 text-primary shrink-0" />
                <div>
                  <p className="text-muted-foreground text-[10px]">Offers</p>
                  <p className="font-semibold text-foreground">
                    {loadingDeps ? '…' : (deps?.sub_products_count ?? product.offers?.length ?? 0)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-background p-2 border border-border/40">
                <FileText className="size-4 text-primary shrink-0" />
                <div>
                  <p className="text-muted-foreground text-[10px]">ICP Profiles</p>
                  <p className="font-semibold text-foreground">
                    {loadingDeps ? '…' : (deps?.icp_profiles_count ?? (product.icp ? 1 : 0))}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-background p-2 border border-border/40">
                <Target className="size-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-[10px]">Signals &amp; Opportunities</p>
                  <p className="font-semibold text-foreground">
                    {loadingDeps ? '…' : (deps?.opportunities_count ?? product.opportunities_count ?? 0)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-background p-2 border border-border/40">
                <Search className="size-4 text-amber-600 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-[10px]">Research Runs</p>
                  <p className="font-semibold text-foreground">
                    {loadingDeps ? '…' : (deps?.research_runs_count ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Safety Notice */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
            <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Historical Data Preservation</p>
              <p className="text-muted-foreground leading-relaxed">
                All existing generated signals, company opportunities, target accounts, and research history are{' '}
                <strong className="text-foreground">safely preserved</strong> without data loss. Deleting removes the product from active dropdowns and archives associated offers.
              </p>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              id="confirm-delete-checkbox"
              checked={confirmed}
              disabled={deleting}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="size-4 rounded border-input text-destructive focus:ring-destructive"
            />
            <span>
              I understand and confirm deletion of <strong className="font-bold text-destructive">{product.label}</strong>.
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
            <Button type="button" variant="outline" size="sm" disabled={deleting} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!confirmed || deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Trash2 className="mr-1.5 size-3.5" />}
              Delete Product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

