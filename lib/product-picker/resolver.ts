import { productPickerService, type DescribedProduct } from '../../services/product-master/picker-service'
import { valueKey } from './model'

/**
 * A value that a document already holds is read by NAME, so it is never drawn blank even when the picker no longer offers it (paused, in the Recycle Bin, a
 * Sub-product that was never sold). One read per catalogue id is shared by every picker on the screen (a quote with twenty lines of three products asks three
 * times, not twenty), kept for a minute, and a failed read is forgotten at once so a Retry asks again. `remember` stores what a pick already told us.
 */
const KEEP_MS = 60_000

interface Entry { at: number; promise: Promise<DescribedProduct> }
const byCrm = new Map<string, Entry>()
const byMaster = new Map<string, Entry>()

function fresh(entry: Entry | undefined): entry is Entry {
  return entry !== undefined && Date.now() - entry.at < KEEP_MS
}

function read(cache: Map<string, Entry>, key: string, fetcher: () => Promise<DescribedProduct>): Promise<DescribedProduct> {
  const held = cache.get(key)
  if (fresh(held)) return held.promise
  const promise = fetcher()
  cache.set(key, { at: Date.now(), promise })
  promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key) })
  return promise
}

/** The name of the Sub-product behind a catalogue id (two calls the first time, none after). */
export function describeCrmProduct(crmProductId: string | number): Promise<DescribedProduct> {
  const key = valueKey(crmProductId)
  return read(byCrm, key, () => productPickerService.describe(key))
}

/** The name of a Product Master record (a lead's or a campaign's Product). */
export function describeMasterProduct(masterId: string | number): Promise<DescribedProduct> {
  const key = valueKey(masterId)
  return read(byMaster, key, () => productPickerService.describeMaster(key))
}

/** What a pick already told us, so the box shows the name at once on the next render. */
export function rememberCrmProduct(crmProductId: string | number, described: DescribedProduct): void {
  byCrm.set(valueKey(crmProductId), { at: Date.now(), promise: Promise.resolve(described) })
}

/** The name already known for a catalogue id, or null. Never makes a request. */
export function knownCrmProduct(crmProductId: string | number): Promise<DescribedProduct> | null {
  const held = byCrm.get(valueKey(crmProductId))
  return fresh(held) ? held.promise : null
}

/** For tests, and for a screen that has just changed a name. */
export function forgetResolved(): void {
  byCrm.clear()
  byMaster.clear()
}
