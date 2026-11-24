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

// React Strict Mode replays mount effects in development. Share that initial
// snapshot request across the replay, while removing it as soon as it settles
// so an explicit refresh always reaches the API.
const inFlightSnapshots = new WeakMap<IntelligenceApi, Promise<Snapshot>>()

export async function loadSnapshot(service: IntelligenceApi): Promise<Snapshot> {
  const pending = inFlightSnapshots.get(service)
  if (pending) return pending

  const request = fetchSnapshot(service)
  inFlightSnapshots.set(service, request)
  try {
    return await request
  } finally {
    if (inFlightSnapshots.get(service) === request) inFlightSnapshots.delete(service)
  }
}

async function fetchSnapshot(service: IntelligenceApi): Promise<Snapshot> {
  const [detectorsResponse, firstResponse] = await Promise.all([service.detectors(), service.insights({ per_page: PAGE_SIZE, page: 1 })])
  const first: InsightsData = firstResponse.data
  const byKey = new Map<string, Insight>()
  const add = (items: readonly Insight[]) => {
    for (const item of items) if (!byKey.has(item.key)) byKey.set(item.key, item)
  }
  add(first.insights)

  const totalPages = Math.max(1, first.pagination?.total_pages ?? 1)
  const lastPage = Math.min(totalPages, MAX_PAGES)
  // The page numbers are known from page one. Fetch the remaining bounded
  // pages together, then add them in page order to preserve server ordering.
  const remaining = await Promise.all(
    Array.from({ length: lastPage - 1 }, (_, index) => service.insights({ per_page: PAGE_SIZE, page: index + 2 })),
  )
  for (const next of remaining) add(next.data.insights)

  return {
    insights: [...byKey.values()],
    detectors: detectorsResponse.data.detectors,
    meta: first.meta,
    truncated: totalPages > MAX_PAGES,
    total: first.pagination?.total ?? null,
  }
}
