import { AlertTriangle, CheckCircle2, CircleDashed, FileEdit } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { icpStatus } from '@/lib/product-selection'
import type { ProductInfo } from '@/services/portfolio/types'

/** The ICP's state (ready, draft, incomplete or invalid), from the stored product. */
export function IcpStatusBadge({ product }: { product: Pick<ProductInfo, 'state' | 'draft_icp'> }) {
  const s = icpStatus(product)
  if (s.key === 'ready') return <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> {s.label}</Badge>
  if (s.key === 'invalid') return <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> {s.label}</Badge>
  if (s.key === 'draft') return <Badge variant="muted" className="gap-1"><FileEdit className="size-3" /> {s.label}</Badge>

  return <Badge variant="warning" className="gap-1"><CircleDashed className="size-3" /> {s.label}</Badge>
}
