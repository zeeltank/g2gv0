'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, EyeOff, Loader2, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  reportsService,
  type ExportFormat,
  type ReportCatalogue,
  type ReportColumn,
  type ReportDef,
  type ReportFilters,
  type ReportResult,
} from '@/services/gtm/reports'
import { ApiError } from '@/services/core'
import { GtmPageHeader, StatTile, errMsg, fmtDate, useGtmReady } from './gtm-shared'

const SELECT = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm'
const PER_PAGE = 50
const pretty = (s: string) => s.replace(/_/g, ' ')

/** PHP sends an empty map as [] and a filled one as {} - normalise both. */
function asRecord<T>(v: Record<string, T> | T[] | undefined | null): Record<string, T> {
  return v && !Array.isArray(v) ? v : {}
}

function columnList(cols: Record<string, ReportColumn> | ReportColumn[] | undefined): [string, ReportColumn][] {
  return Object.entries(asRecord(cols))
}

function money(amount: number, currency?: string | null): string {
  try {
    return currency
      ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
      : amount.toLocaleString()
  } catch {
    return `${currency ?? ''} ${amount.toLocaleString()}`.trim()
  }
}

function cell(value: unknown, col: ReportColumn, row: Record<string, unknown>): string {
  if (value === null || value === undefined || value === '') return '—'
  if (col.type === 'money' && typeof value === 'number') return money(value, typeof row.currency === 'string' ? row.currency : null)
  if (col.type === 'date' && typeof value === 'string') return fmtDate(value, value.includes(':') || value.includes('T'))
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function exportError(e: unknown): string {
  if (e instanceof ApiError && e.status === 403) return 'Only Administrators can export reports.'
  return errMsg(e, 'Export failed')
}

export function ReportsView() {
  const ready = useGtmReady()
  const [cat, setCat] = useState<ReportCatalogue | null>(null)
  const [catError, setCatError] = useState<string | null>(null)
  const [key, setKey] = useState<string | null>(null)

  const loadCatalogue = useCallback(async () => {
    setCatError(null)
    try {
      const res = await reportsService.catalogue()
      setCat(res.data)
      setKey((prev) => prev ?? res.data.reports[0]?.key ?? null)
    } catch (e) {
      setCatError(errMsg(e, 'Unable to load the report list'))
    }
  }, [])

  useEffect(() => { if (ready) queueMicrotask(() => void loadCatalogue()) }, [ready, loadCatalogue])

  const def = cat?.reports.find((r) => r.key === key) ?? null
  const hasAdminOnly = cat?.reports.some((r) => r.admin_only) ?? false

  return (
    <div className="p-6">
      <GtmPageHeader title="Reports" description="Tenant-scoped views over your real GTM records. Money is always shown per currency and never added across currencies." />

      {catError ? <ErrorState title="Could not load reports" description={catError} retry={loadCatalogue} /> : !cat ? (
        <Skeleton className="h-64" />
      ) : cat.reports.length === 0 ? (
        <EmptyState title="No reports available" description="The server returned no reports for your role." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <nav className="space-y-1" aria-label="Reports">
            {cat.reports.map((r) => (
              <button
                key={r.key}
                onClick={() => setKey(r.key)}
                className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${r.key === key ? 'border-primary bg-primary/5 font-medium text-primary' : 'border-transparent text-foreground hover:bg-muted/50'}`}
              >
                <span>{r.title}</span>
                <span className="flex items-center gap-1">
                  {r.pii && <EyeOff className="size-3.5 text-muted-foreground" aria-label="Contains personal data" />}
                  {r.admin_only && <Lock className="size-3.5 text-muted-foreground" aria-label="Administrators only" />}
                </span>
              </button>
            ))}
            {!hasAdminOnly && (
              <p className="px-3 pt-2 text-xs text-muted-foreground">Some reports, such as the audit trail, are visible to Administrators only and are not listed for your role.</p>
            )}
            {!cat.can_export && (
              <p className="px-3 text-xs text-muted-foreground">Exporting is limited to Administrators.</p>
            )}
          </nav>

          {def && <ReportPanel key={def.key} def={def} canExport={cat.can_export} maxRows={cat.max_rows} />}
        </div>
      )}
    </div>
  )
}

function ReportPanel({ def, canExport, maxRows }: { def: ReportDef; canExport: boolean; maxRows: number }) {
  const enums = asRecord<string[]>(def.enums as Record<string, string[]>)
  const filterDefs = Object.entries(def.filters ?? {})
  const [draft, setDraft] = useState<ReportFilters>({})
  const [applied, setApplied] = useState<ReportFilters>({})
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ReportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reportsService.run(def.key, applied, page, PER_PAGE)
      setData(res.data)
      setError(null)
    } catch (e) {
      setData(null)
      setError(errMsg(e, 'Unable to run this report'))
    } finally {
      setLoading(false)
    }
  }, [def.key, applied, page])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const apply = () => { setPage(1); setApplied({ ...draft }) }
  const reset = () => { setDraft({}); setPage(1); setApplied({}) }

  const doExport = async () => {
    setExporting(true)
    setExportErr(null)
    try {
      const blob = await reportsService.exportBlob(def.key, applied, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gtm-${def.key}-${new Date().toISOString().slice(0, 10)}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setExportErr(exportError(e))
    } finally {
      setExporting(false)
    }
  }

  const cols = useMemo(() => columnList(data?.report.columns ?? def.columns), [data, def.columns])
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1
  const byCurrency = data?.summary.value_by_currency ? Object.entries(data.summary.value_by_currency) : []
  const masked = data?.report.masked ?? false

  return (
    <section className="min-w-0 space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{def.title}</h2>
          {def.pii && <Badge variant="outline">Contains personal data</Badge>}
          {def.admin_only && <Badge variant="outline">Administrators only</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{def.description}</p>
      </div>

      {masked && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-3 text-sm">
          <EyeOff className="mr-2 inline size-4 text-amber-600" />
          Email addresses and phone numbers are masked for your role. Administrators see them in full.
        </div>
      )}

      {filterDefs.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filterDefs.map(([name, type]) => (
              <label key={name} className="space-y-1 text-xs font-medium text-muted-foreground">
                {pretty(name)}
                {type === 'enum' ? (
                  <select className={SELECT} value={draft[name] ?? ''} onChange={(e) => setDraft({ ...draft, [name]: e.target.value })}>
                    <option value="">Any</option>
                    {(enums[name] ?? []).map((v) => <option key={v} value={v}>{pretty(v)}</option>)}
                  </select>
                ) : type === 'date' ? (
                  <Input type="date" value={draft[name] ?? ''} onChange={(e) => setDraft({ ...draft, [name]: e.target.value })} />
                ) : (
                  <Input
                    inputMode={type === 'int' ? 'numeric' : undefined}
                    placeholder={type === 'currency' ? 'e.g. USD' : type === 'int' ? 'Whole number' : ''}
                    value={draft[name] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [name]: type === 'currency' ? e.target.value.toUpperCase() : e.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={apply} disabled={loading}>Apply filters</Button>
            <Button size="sm" variant="outline" onClick={reset} disabled={loading}>Reset</Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canExport ? (
          <>
            <select className={`${SELECT} w-28`} value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} aria-label="Export format">
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <Button size="sm" variant="outline" onClick={doExport} disabled={exporting}>
              {exporting ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Download className="mr-1 size-3.5" />}Export (applied filters)
            </Button>
            <span className="text-xs text-muted-foreground">Every export is recorded in the audit trail. Up to {maxRows.toLocaleString()} rows.</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Exporting is limited to Administrators.</span>
        )}
      </div>
      {exportErr && <p role="alert" className="text-sm text-destructive">{exportErr}</p>}

      {error ? <ErrorState title="Could not run this report" description={error} retry={load} /> : !data ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Rows" value={data.summary.rows.toLocaleString()} hint="matching the filters" />
            {byCurrency.map(([cur, v]) => <StatTile key={cur} label={`Total value (${cur})`} value={money(v, cur)} hint="this currency only" />)}
            {typeof data.summary.total_tokens === 'number' && <StatTile label="Tokens used" value={data.summary.total_tokens.toLocaleString()} />}
            {typeof data.summary.failed === 'number' && <StatTile label="Failed runs" value={data.summary.failed.toLocaleString()} tone={data.summary.failed > 0 ? 'warn' : undefined} />}
          </div>
          {data.summary.basis && <p className="text-xs text-muted-foreground">{data.summary.basis}</p>}
          {data.truncated && (
            <p className="rounded-md border border-amber-300 bg-amber-50/50 p-2 text-xs">Results were capped at {maxRows.toLocaleString()} rows. Narrow the filters to see everything.</p>
          )}

          {data.rows.length === 0 ? (
            <EmptyState title="No rows" description="Nothing matches these filters." />
          ) : (
            <div className={`overflow-x-auto rounded-lg border border-border ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>{cols.map(([k, c]) => <th key={k} className="whitespace-nowrap p-3">{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      {cols.map(([k, c]) => (
                        <td key={k} className={`p-3 ${c.type === 'number' || c.type === 'money' ? 'whitespace-nowrap text-right tabular-nums' : 'max-w-xs'}`}>{cell(row[k], c, row)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.total > data.per_page && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {data.page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
