/**
 * Sales-training progress, kept in this browser only (localStorage), per product.
 * The player writes the slides a learner has seen; reaching a won, won-with-concessions or stalled ending marks the
 * scenario done. The My Learning card and the course page read the same keys, so they always agree with the player.
 */
import type { SalesProductKey } from './deck'

export const seenStorageKey = (key: SalesProductKey | string) => `sales-training:${key}`
export const doneStorageKey = (key: SalesProductKey | string) => `sales-training:${key}:done`

export interface SalesProgress {
  seen: number
  total: number
  percent: number
  done: boolean
}

export function parseSeen(raw: string | null): number[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((n): n is number => Number.isInteger(n)) : []
  } catch {
    return []
  }
}

export function progressOf(seenCount: number, total: number, done: boolean): SalesProgress {
  const safeTotal = Math.max(0, total)
  const percent = safeTotal === 0 ? 0 : Math.min(100, Math.round((seenCount / safeTotal) * 100))
  return { seen: seenCount, total: safeTotal, percent: done ? 100 : percent, done }
}

/** Reads progress for one product. `total` is the deck's slide count (0 when it is not known yet). */
export function readSalesProgress(key: SalesProductKey, total: number): SalesProgress {
  try {
    const seen = parseSeen(window.localStorage.getItem(seenStorageKey(key))).length
    const done = window.localStorage.getItem(doneStorageKey(key)) === '1'
    return progressOf(seen, total, done)
  } catch {
    return progressOf(0, total, false)
  }
}

export function markSalesDone(key: SalesProductKey) {
  try {
    window.localStorage.setItem(doneStorageKey(key), '1')
  } catch {
    /* blocked storage: the player still works, the card just will not remember */
  }
}
