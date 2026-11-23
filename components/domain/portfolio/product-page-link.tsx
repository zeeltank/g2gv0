'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LINK_TEXT } from '@/lib/product-master/tones'
import { productPickerService } from '@/services/product-master/picker-service'

/** The page of a Sub-product or Product, by its Product Master id. */
export const productPageHref = (masterId: number | string) => `/portfolio/products/${encodeURIComponent(String(masterId))}`

/**
 * A link from a ticket or an asset to the Sub-product it is about. These records hold the CATALOGUE id, the page is addressed by the MASTER id, so the link asks
 * `GET /api/product-master/by-crm/{id}` when it is pressed (it answers for a Sub-product that is paused or in the Recycle Bin too) and goes to
 * `/portfolio/products/{masterId}`. It never builds an address from a menu row: the old Products row may not be in the person's sidebar any more, and
 * `resolveAccessLink` would then answer `/dashboard`. When the id cannot be resolved (another organisation's, deleted for good, no session) it opens the
 * Product Portfolio list instead of a dead page.
 */
export function ProductPageLink({ crmProductId, children }: { crmProductId: string | number; children: ReactNode }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const open = async () => {
    setBusy(true)
    try {
      const found = await productPickerService.byCrm(crmProductId)
      router.push(productPageHref(found.data.id))
    } catch {
      router.push('/portfolio')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className={LINK_TEXT} onClick={() => void open()} disabled={busy} data-product-page-link={String(crmProductId)}>
      {children}
    </button>
  )
}
