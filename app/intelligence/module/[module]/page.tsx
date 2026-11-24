'use client'

import { useParams } from 'next/navigation'
import { ModuleIntelligencePage } from '@/components/domain/intelligence'
import { decodeSegment } from '@/lib/intelligence-center/domains'

/** Intelligence for one parent module, separate from the organisation-wide overview. */
export default function ModuleIntelligenceRoute() {
  const params = useParams<{ module: string }>()
  return <ModuleIntelligencePage moduleKey={decodeSegment(String(params?.module ?? ''))} />
}
