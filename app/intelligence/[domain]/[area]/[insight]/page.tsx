'use client'

import { useParams } from 'next/navigation'
import { InsightDetailPage } from '@/components/domain/intelligence'
import { decodeSegment } from '@/lib/intelligence-center/domains'

/** One finding (`/intelligence/[domain]/[area]/[insight]`). The last segment is the finding's key, URL-encoded; it is resolved from the loaded data. */
export default function IntelligenceInsightRoute() {
  const params = useParams<{ domain: string; area: string; insight: string }>()
  return (
    <InsightDetailPage
      domainId={decodeSegment(String(params?.domain ?? ''))}
      areaId={decodeSegment(String(params?.area ?? ''))}
      insightKey={String(params?.insight ?? '')}
    />
  )
}
