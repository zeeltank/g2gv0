import { ApiError } from '@/services/core'
import { errMsg } from './gtm-shared'

export const TEXTAREA = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
export const label = (s: string) => s.replace(/_/g, ' ')

/** errMsg plus the per-field validation messages Laravel sends in `errors` (422). */
export function detailedErr(e: unknown, fallback = 'Something went wrong'): string {
  const base = errMsg(e, fallback)
  if (e instanceof ApiError && e.errors) {
    const lines = Object.values(e.errors).flat().filter(Boolean)
    if (lines.length) return `${base}: ${lines.join(' ')}`
  }
  return base
}

export function isForbidden(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403
}

export function money(by: Record<string, number> | null | undefined): string {
  const entries = Object.entries(by ?? {})
  if (entries.length === 0) return '—'
  return entries.map(([cur, v]) => `${cur} ${v.toLocaleString()}`).join(' · ')
}

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? 'n/a' : `${v}%`)
export const dateOnly = (v?: string | null) => (v ? v.slice(0, 10) : '')
