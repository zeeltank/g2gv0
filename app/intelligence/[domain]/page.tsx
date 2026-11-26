'use client'

import { useParams } from 'next/navigation'
import { DomainPage } from '@/components/domain/intelligence'
import { decodeSegment } from '@/lib/intelligence-center/domains'

/** One domain (`/intelligence/[domain]`). An unknown domain shows a clear not-found state with a link home. */
export default function IntelligenceDomainRoute() {
  const params = useParams<{ domain: string }>()
  return <DomainPage domainId={decodeSegment(String(params?.domain ?? ''))} />
}
