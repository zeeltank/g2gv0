/**
 * Loads everything the Intelligence screens need, once: the detectors this person may see and ALL open insights (every page, up to a cap).
 * The screens then derive every view from this one snapshot, so moving between the home, a domain, an area and a finding needs no further request.
 */
import type { InsightsData, IntelligenceApi, Insight } from '../../services/intelligence/types'
import type { Snapshot } from './derive'

export const PAGE_SIZE = 50
/**
 * A ceiling on requests: the API allows 30 requests a minute per address, and the first page and the detectors already cost two. 4 pages of 50 is 200
 * findings; when the server has more, the screen says how many it did not load.
 */
export const MAX_PAGES = 4

export async function loadSnapshot(service: IntelligenceApi): Promise<Snapshot> {
  const [detectorsResponse, firstResponse] = await Promise.all([service.detectors(), service.insights({ per_page: PAGE_SIZE, page: 1 })])
  const first: InsightsData = firstResponse.data
  const byKey = new Map<string, Insight>()
  const add = (items: readonly Insight[]) => {
    for (const item of items) if (!byKey.has(item.key)) byKey.set(item.key, item)
  }
  add(first.insights)

  const totalPages = Math.max(1, first.pagination?.total_pages ?? 1)
  const lastPage = Math.min(totalPages, MAX_PAGES)
  // One page at a time: the API is rate limited, and the order of the answer stays the server's.
  for (let page = 2; page <= lastPage; page++) {
    const next = await service.insights({ per_page: PAGE_SIZE, page })
    add(next.data.insights)
  }

  return {
    insights: [...byKey.values()],
    detectors: detectorsResponse.data.detectors,
    meta: first.meta,
    truncated: totalPages > MAX_PAGES,
    total: first.pagination?.total ?? null,
  }
}
