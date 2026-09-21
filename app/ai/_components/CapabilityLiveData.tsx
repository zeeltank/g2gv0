'use client'

/**
 * What a capability actually holds for the organisation the user is signed in to.
 *
 * This is the half of the console that is not a description. The registry says what a
 * capability is for; this says whether it is configured here, how much of it there
 * is, and what it has done lately — read from the same G2G tables the product writes.
 *
 * THREE STATES, NOT TWO
 *
 * `unavailable` means this deployment has not migrated the capability's tables, and
 * the panel names them. `empty` means the tables exist and hold nothing for this
 * organisation yet. `live` means there are rows. Collapsing the first two into one
 * blank panel is what sends someone hunting for data that was never going to be
 * there, so each says something different.
 *
 * The organisation is never passed in. It is resolved on the server from the caller's
 * token, so this component cannot be pointed at another organisation by a prop.
 */

import { useCallback, useEffect, useState } from 'react'
import { Database, Loader2, RefreshCw, ServerCrash } from 'lucide-react'

import { fetchCapability, type CapabilityDetail } from '@/lib/intelligence/ai-capabilities'

interface LoadState {
  detail: CapabilityDetail | null
  error: string | null
  loading: boolean
}

export function CapabilityLiveData({ slug, name }: { slug: string; name: string }) {
  const [{ detail, error, loading }, setState] = useState<LoadState>({
    detail: null,
    error: null,
    loading: true,
  })
  // Bumping this re-runs the effect. The alternative — a load() the effect calls —
  // sets state synchronously inside the effect body, which React flags as a cascading
  // render. Only the promise callbacks below touch state.
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetchCapability(slug)
      .then((data) => {
        if (!cancelled) setState({ detail: data, error: null, loading: false })
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setState({
          detail: null,
          error: cause instanceof Error ? cause.message : 'The request failed.',
          loading: false,
        })
      })

    return () => {
      cancelled = true
    }
  }, [slug, reloadToken])

  // An event handler, so setting state here is not the effect problem above.
  const refresh = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }))
    setReloadToken((token) => token + 1)
  }, [])

  return (
    <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">In this organisation</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Live records for the organisation you are signed in to.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <div className="px-5 py-4">
        {loading && !detail && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading {name}…
          </p>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5">
            <ServerCrash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-card-foreground">Could not load this capability</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {detail && !error && <Body detail={detail} name={name} />}
      </div>
    </section>
  )
}

function Body({ detail, name }: { detail: CapabilityDetail; name: string }) {
  if (detail.state === 'unavailable') {
    const missing = detail.missing_tables ?? []

    return (
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5">
        <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-card-foreground">Not installed on this deployment</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {name} needs {missing.length === 1 ? 'a table' : 'tables'} that this database does not have
            yet: <span className="font-mono text-xs">{missing.join(', ')}</span>. Run the migration that
            creates {missing.length === 1 ? 'it' : 'them'} and this panel fills in.
          </p>
        </div>
      </div>
    )
  }

  const hasRows = detail.table !== null && detail.table.rows.length > 0

  return (
    <div className="flex flex-col gap-4">
      {detail.metrics.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {detail.metrics.map((metric) => (
            <div key={metric.key} className="rounded-lg border border-border bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {metric.value.toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </div>
      )}

      {!hasRows ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5 text-sm leading-6 text-muted-foreground">
          Nothing recorded for this organisation yet. The tables exist, so records will appear here as
          soon as {name} is used.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {detail.table!.columns.map((column) => (
                  <th
                    key={column.key}
                    className="whitespace-nowrap border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {detail.table!.rows.map((row, index) => (
                <tr key={index} className="transition-colors hover:bg-muted/40">
                  {detail.table!.columns.map((column) => (
                    <td
                      key={column.key}
                      className="max-w-[22rem] truncate px-3 py-2 text-muted-foreground"
                      title={row[column.key] ?? ''}
                    >
                      {row[column.key] ?? <span className="text-muted-foreground/50">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
