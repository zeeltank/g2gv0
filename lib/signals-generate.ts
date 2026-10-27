import type { LaravelContext } from '@/lib/laravel-context'
import type { RegionSelection } from '@/lib/region-scope'

/*
 * "Generate Signals": the rules that decide whether a research run may start, kept apart from the screen so they can be tested.
 *
 * A run is always for ONE explicit, valid, ready product. Nothing here starts research for "all products", for an unknown key, for a product
 * whose ICP the backend does not consider ready, or while a run is already going. The backend stays the authority: it is asked again
 * (fresh status) immediately before the request, and it refuses an unready product on its own as well.
 */

export interface GenerateProduct {
  key: string
  label: string
  ready: boolean
  missing: string[]
  next_step?: string | null
}

export type GenerateRefusal = 'no_product' | 'all_products' | 'unknown_product' | 'not_ready' | 'running' | 'providers'

export type GenerateOutcome =
  | { started: true; runId: number | null; message: string; run: unknown }
  | { started: false; reason: GenerateRefusal; message: string; missing: string[]; nextStep: string | null }

/** The slice of the backend status this decision reads. */
export interface GenerateStatus {
  product?: { key: string; label: string; ready: boolean; missing: string[] } | null
  requirements: { search_configured: boolean; ai_configured: boolean }
  running: boolean
}

export interface GenerateService {
  getStatus: (c: LaravelContext, product?: string) => Promise<{ data: GenerateStatus }>
  runResearch: (c: LaravelContext, params: undefined, product?: string, regions?: RegionSelection[]) => Promise<{ message: string; data?: { run_id?: number; run?: unknown } }>
}

const refuse = (reason: GenerateRefusal, message: string, missing: string[] = [], nextStep: string | null = null): GenerateOutcome =>
  ({ started: false, reason, message, missing, nextStep })

/** Local checks only (no request). Returns the product when a run may be attempted. */
export function decideGenerate(
  choice: string | null | undefined,
  products: GenerateProduct[] | null,
  running: boolean,
): { ok: true; product: GenerateProduct } | { ok: false; outcome: GenerateOutcome } {
  if (choice === 'all') return { ok: false, outcome: refuse('all_products', 'Choose one product. A run is always for a single product.') }
  if (!choice) return { ok: false, outcome: refuse('no_product', 'Choose a product first.') }
  const product = products?.find((p) => p.key === choice)
  if (!product) return { ok: false, outcome: refuse('unknown_product', 'That product is not available.') }
  if (running) return { ok: false, outcome: refuse('running', 'A run is already in progress.') }
  if (!product.ready) {
    return { ok: false, outcome: refuse('not_ready', `${product.label} is not ready: its ICP must be configured and active first.`, product.missing, product.next_step ?? null) }
  }

  return { ok: true, product }
}

/**
 * Validate, ask the backend whether the product is ready, then (only then) start the run with the exact product key.
 * Never throws for a refusal; a transport error from the service propagates so the screen can show it.
 */
export async function generateSignals(args: {
  context: LaravelContext
  choice: string | null | undefined
  products: GenerateProduct[] | null
  running: boolean
  service: GenerateService
  /** The places this request is limited to ([] or absent = All Regions). Sent with the request; saved nowhere. */
  regions?: RegionSelection[]
}): Promise<GenerateOutcome> {
  const local = decideGenerate(args.choice, args.products, args.running)
  if (!local.ok) return local.outcome
  const { product } = local

  const status = (await args.service.getStatus(args.context, product.key)).data
  if (status.running) return refuse('running', 'A run is already in progress.')
  if (!status.product || status.product.key !== product.key || !status.product.ready) {
    return refuse('not_ready', `${product.label} is not ready for discovery.`, status.product?.missing ?? product.missing, product.next_step ?? null)
  }
  if (!status.requirements.search_configured || !status.requirements.ai_configured) {
    return refuse('providers', !status.requirements.search_configured
      ? 'No web search provider is configured. An administrator must set one up first.'
      : 'No AI provider is configured for this organisation.')
  }

  const res = await args.service.runResearch(args.context, undefined, product.key, args.regions)

  return { started: true, runId: res.data?.run_id ?? null, message: res.message, run: res.data?.run ?? null }
}

export interface GenerateHandlers {
  /** The lock was already held (a click or run is in flight): tell the person instead of doing nothing. */
  busy: () => void
  /** Accepted: show an immediate response before the first request returns. */
  begin: () => void
  /** Refused with a reason (not ready, providers, already running). The lock has been released before this is called. */
  refused: (outcome: Extract<GenerateOutcome, { started: false }>) => void
  /** The backend accepted the run. The lock stays held until the caller follows the run to its end and releases it. */
  started: (outcome: Extract<GenerateOutcome, { started: true }>) => void
  /** The request failed. The lock has been released before this is called. */
  failed: (error: unknown) => void
}

/**
 * One click on Generate Signals. `guard` is a ref-like object checked and set synchronously, so a rapid second click cannot start a second
 * request (React state alone updates too late for that). The guard is released on every path that does not hand a run to the caller:
 * refusal and failure. Nothing here ever leaves it held without a run being followed.
 */
export async function runGuardedGenerate(guard: { current: boolean }, args: Parameters<typeof generateSignals>[0], on: GenerateHandlers): Promise<void> {
  if (guard.current) {
    on.busy()

    return
  }
  guard.current = true
  on.begin()
  try {
    const outcome = await generateSignals(args)
    if (!outcome.started) {
      guard.current = false
      on.refused(outcome)

      return
    }
    on.started(outcome)
  } catch (e) {
    guard.current = false
    on.failed(e)
  }
}
