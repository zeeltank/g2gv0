import { AlertTriangle, CheckCircle2, CircleDashed, CircleSlash } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { subProductIcpState } from '@/lib/product-selection'
import type { ProductInfo } from '@/services/portfolio/types'

/** How many of a product's sub-products have an ICP. A product has no ICP of its own: each sub-product's is set on that sub-product. */
export function SubProductIcpBadge({ product }: { product: Pick<ProductInfo, 'offers'> }) {
  const s = subProductIcpState(product.offers)
  if (s.key === 'all') return <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> {s.configured} of {s.total} sub-products have an ICP</Badge>
  if (s.key === 'partial') return <Badge variant="warning" className="gap-1"><AlertTriangle className="size-3" /> {s.configured} of {s.total} sub-products have an ICP</Badge>
  if (s.key === 'none') return <Badge variant="warning" className="gap-1"><CircleDashed className="size-3" /> ICP not configured</Badge>

  return <Badge variant="muted" className="gap-1"><CircleSlash className="size-3" /> {s.label}</Badge>
}
