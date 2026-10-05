'use client'

/**
 * The pieces the Event Bus and Scheduler consoles share.
 *
 * Local to `app/platform-services/` on purpose. `components/shared/console-ui.tsx` holds
 * the vocabulary every admin console uses — the status chip, the section card — because
 * those appear on the AI screens too. These are narrower: a KPI tile that can be
 * unavailable, and the load/error states for a panel that reads a live endpoint. Pushing
 * them into `shared/` would be promoting two screens' habits into a product-wide API
 * before anything else has asked for them.
 */

import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { KpiTile } from '@/lib/platform/event-bus'

/**
 * One headline number.
 *
 * ── `available: false` IS THE WHOLE POINT OF THIS COMPONENT ─────────────────
 *
 * A tile that cannot be computed renders an em dash and its reason, never a zero. On an
 * operations screen "0 failed" and "we have no way to know" look identical if you draw
 * them the same way, and only one of them means you can stop worrying.
 *
 * `tone` is advisory and never carries meaning alone: every tile shows its label and
 * value as text, so it reads the same to somebody who cannot separate amber from red.
 */
const TONE: Record<KpiTile['tone'], string> = {
  gray: 'text-foreground',
  green: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-destructive',
}

export function KpiRow({ tiles }: { tiles: KpiTile[] }) {
  if (tiles.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.key} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>

          {tile.available ? (
            <p className={cn('mt-1 text-2xl font-semibold tabular-nums', TONE[tile.tone])}>
              {tile.value}
            </p>
          ) : (
            <p className="mt-1 text-2xl font-semibold text-muted-foreground/40" aria-label="Not available">
              &mdash;
            </p>
          )}

          {tile.available ? (
            tile.source && (
              <p className="mt-1.5 font-mono text-[10px] leading-4 text-muted-foreground/70">
                {tile.source}
              </p>
            )
          ) : (
            <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
              {tile.hint ?? 'This number cannot be computed yet.'}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

/** First load, nothing to show yet. */
export function PanelLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  )
}

/**
 * A failure with nothing to fall back on.
 *
 * Always offers the retry. A monitoring screen that fails and gives you no way to ask
 * again sends you to the browser's reload button, which throws away every other panel
 * on the page that loaded correctly.
 */
export function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm text-foreground">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * A failure WITH data already on screen.
 *
 * A strip above the table rather than a replacement for it: throwing away a list that
 * loaded because a refresh failed is worse than showing the list with a note that it may
 * be stale. The list without the note is worse still — that is the case this exists for.
 */
export function StaleNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message} Showing the last result.</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded border border-amber-500/30 px-2 py-0.5 font-medium transition-colors hover:bg-amber-500/10"
      >
        Retry
      </button>
    </div>
  )
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
    >
      <RefreshCw className={cn('size-3', busy && 'animate-spin')} aria-hidden="true" />
      Refresh
    </button>
  )
}

/** A table's empty row, so an empty list still reads as a table rather than a gap. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  )
}

/** Simple prev/next paging over a `PlatformPage`. */
export function Pager({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number
  perPage: number
  total: number
  onPage: (next: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / perPage))

  if (total === 0) return null

  return (
    <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {total.toLocaleString('en-IN')} row{total === 1 ? '' : 's'} — page {page} of {pages}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded border border-border px-2 py-1 transition-colors hover:bg-muted disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="rounded border border-border px-2 py-1 transition-colors hover:bg-muted disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
