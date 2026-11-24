'use client'

import { useParams } from 'next/navigation'
import { AreaPage } from '@/components/domain/intelligence'
import { decodeSegment } from '@/lib/intelligence-center/domains'

/** One area of a domain (`/intelligence/[domain]/[area]`). */
export default function IntelligenceAreaRoute() {
  const params = useParams<{ domain: string; area: string }>()
  return <AreaPage domainId={decodeSegment(String(params?.domain ?? ''))} areaId={decodeSegment(String(params?.area ?? ''))} />
}
