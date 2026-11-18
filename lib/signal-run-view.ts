import { resolveSelection } from '@/lib/product-selection'

/**
 * Small, pure rules behind the Company Opportunities screen's run and list behaviour. They hold no React state, so each can be tested on its own.
 */

/**
 * "Only the newest request counts". Take a number before a request starts and check it when the answer arrives: an answer for anything but the
 * latest request (a slower earlier page, another day, another product) is dropped instead of overwriting what the person is looking at.
 */
export function createLatestOnly() {
  let latest = 0

  return {
    /** Call when a request starts. */
    next: () => ++latest,
    /** Call when its answer arrives: true only if no newer request has started since. */
    isLatest: (ticket: number) => ticket === latest,
    /** A change that makes every request in flight obsolete (the product or day changed). */
    invalidate: () => { latest += 1 },
  }
}

const ENDED_BADLY = ['failed', 'skipped']

/**
 * Whether the run progress panel (which explains a failed run and offers Retry) is on screen: while a run is going, and also after a run THIS
 * screen followed ended without completing, so a failure is never silent. A run that finished well, or an older run, is not shown here.
 */
export function showsRunProgress(running: boolean, activeRun: { status: string } | null | undefined): boolean {
  return running || (activeRun != null && ENDED_BADLY.includes(activeRun.status))
}

/** The places a request is limited to, as text that is the same for the same places whatever the array identity or order. */
export function regionSignature(regions: { country: string; state?: string | null; city?: string | null }[] | null | undefined): string {
  return JSON.stringify([...(regions ?? [])].map((r) => [r.country, r.state ?? null, r.city ?? null]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
}

/**
 * A remembered product (or sub-product) choice, checked again against the products as they are NOW. Still valid: kept. Gone (the product or its
 * sub-product was removed or deactivated): replaced by what the screen would start on, never left pointing at something that no longer exists.
 */
export function revalidateChoice(
  choice: string | null,
  products: { key: string; ready: boolean; offers?: { offer_id: string }[] }[],
  opts: { allowAll: boolean; allowSub: boolean },
): string | null {
  if (choice === null) return null
  const next = resolveSelection(choice, products, opts.allowAll, opts.allowSub)

  return next === choice ? choice : next
}

/**
 * A list refresh that failed. With nothing on screen yet the error replaces the list; with a list already shown the list stays and the error is
 * shown beside it, so a transient failure does not wipe what the person was reading.
 */
export function listErrorMode(error: string | null, hasData: boolean): 'none' | 'replace' | 'beside' {
  if (!error) return 'none'

  return hasData ? 'beside' : 'replace'
}
