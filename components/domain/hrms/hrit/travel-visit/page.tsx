'use client'

import * as React from 'react'
import { Loader2, MapPin, RefreshCw, Route as RouteIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { GtgPageHeader } from '@/components/shell/gtg-page-header'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import {
  travelVisitService,
  type TravelPoint,
  type TravelVisit,
  type TravelVisitScope,
  type TravelVisitStatus,
  type TravelVisitSummary,
} from '@/services/hrms/travel-visits'
import { RouteMap } from './route-map'

const SCOPE_LABEL: Record<TravelVisitScope, string> = { mine: 'My trips', team: 'My team', all: 'Everyone' }

function formatDateTime(value: string | null | undefined, seconds = false) {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
  })
}

function formatKm(km: number | null | undefined) {
  return `${(km ?? 0).toFixed(2)} km`
}

function duration(start: string, end: string | null) {
  const s = new Date(start.replace(' ', 'T')).getTime()
  const e = end ? new Date(end.replace(' ', 'T')).getTime() : Date.now()
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return '—'
  const minutes = Math.round((e - s) / 60000)
  const h = Math.floor(minutes / 60)
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`
}

function TripStatus({ status }: { status: TravelVisitStatus }) {
  return status === 'ongoing' ? <StatusBadge status="Pending" label="Ongoing" /> : <StatusBadge status="Completed" label="Completed" />
}

/**
 * Travel Visit - trips employees took, started and ended from the mobile app.
 * An employee sees their own; a manager their team's; HR everyone's (the server
 * decides, and says which scopes are open in reference-data).
 */
export default function TravelVisitPage() {
  const context = React.useMemo(() => getLaravelContext(), [])

  const [scopes, setScopes] = React.useState<TravelVisitScope[]>(['mine'])
  const [scope, setScope] = React.useState<TravelVisitScope>('mine')
  const [status, setStatus] = React.useState<TravelVisitStatus | ''>('')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')

  const [rows, setRows] = React.useState<TravelVisit[]>([])
  const [summary, setSummary] = React.useState<TravelVisitSummary>({ visits: 0, ongoing: 0, distance: 0 })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  const [detailId, setDetailId] = React.useState<number | null>(null)

  React.useEffect(() => {
    travelVisitService
      .referenceData(context)
      .then((r) => {
        const open = r?.data?.scopes?.length ? r.data.scopes : (['mine'] as TravelVisitScope[])
        setScopes(open)
        // Managers and HR land on the people they look after, not on their own (usually empty) list.
        setScope(open.includes('all') ? 'all' : open.includes('team') ? 'team' : 'mine')
      })
      .catch(() => setScopes(['mine']))
  }, [context])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await travelVisitService.list(context, { scope, status, from, to })
      setRows(r?.data ?? [])
      setSummary(r?.summary ?? { visits: 0, ongoing: 0, distance: 0 })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load travel visits.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [context, scope, status, from, to])

  React.useEffect(() => {
    void load()
  }, [load])

  const showEmployee = scope !== 'mine'

  const employeeColumn: Column<TravelVisit> = {
    id: 'employee_name',
    header: 'Employee',
    render: (_, row) => <span className="text-sm">{row.employee_name || `#${row.employee_id}`}</span>,
  }

  const columns: Column<TravelVisit>[] = [
    {
      id: 'visit_no',
      header: 'Visit',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{row.visit_no}</span>
          <span className="text-xs text-muted-foreground">{row.purpose || '—'}</span>
        </div>
      ),
    },
    ...(showEmployee ? [employeeColumn] : []),
    { id: 'start_at', header: 'Started', render: (_, row) => <span className="text-sm">{formatDateTime(row.start_at)}</span> },
    { id: 'end_at', header: 'Ended', render: (_, row) => <span className="text-sm">{formatDateTime(row.end_at)}</span> },
    { id: 'vehicle_type', header: 'Time', render: (_, row) => <span className="text-sm">{duration(row.start_at, row.end_at)}</span> },
    { id: 'distance', header: 'Distance', render: (_, row) => <span className="text-sm font-medium">{formatKm(row.distance)}</span> },
    { id: 'status', header: 'Status', render: (_, row) => <TripStatus status={row.status} /> },
  ]

  const tiles = [
    { label: 'Trips', value: String(summary.visits) },
    { label: 'Ongoing now', value: String(summary.ongoing) },
    { label: 'Total distance', value: formatKm(summary.distance) },
  ]

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      <GtgPageHeader
        title="Travel Visit"
        description="Trips started and ended from the mobile app. The phone records its location about once a minute, so every trip has its route."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold">{loading ? '—' : tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      <Card className="rounded-2xl border-border/50 bg-card/50 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {scopes.length > 1 && (
              <div className="w-40">
                <Select
                  value={scope}
                  onChange={(v) => setScope(v as TravelVisitScope)}
                  size="sm"
                  options={scopes.map((s) => ({ label: SCOPE_LABEL[s], value: s }))}
                />
              </div>
            )}
            <div className="w-40">
              <Select
                value={status}
                onChange={(v) => setStatus(v as TravelVisitStatus | '')}
                size="sm"
                placeholder="All statuses"
                options={[
                  { label: 'All statuses', value: '' },
                  { label: 'Ongoing', value: 'ongoing' },
                  { label: 'Completed', value: 'completed' },
                ]}
              />
            </div>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" aria-label="From date" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" aria-label="To date" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="cursor-pointer">
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={loading}
            getRowId={(row) => String(row.id)}
            onRowClick={(row) => setDetailId(row.id)}
            emptyState={
              error ? null : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <MapPin className="mx-auto mb-2 size-6 opacity-60" />
                  <p>No travel visits found. Trips are started from the mobile app.</p>
                </div>
              )
            }
            className="overflow-visible rounded-none border-0 [&_th]:bg-transparent [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:py-4"
          />
        </CardContent>
      </Card>

      <TravelVisitDetail visitId={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children || '—'}</div>
    </div>
  )
}

/** The selfie taken at the start. Fetched with the auth header and shown from a blob URL. */
function SelfiePhoto({ visitId, available }: { visitId: number; available: boolean }) {
  const context = React.useMemo(() => getLaravelContext(), [])
  const [url, setUrl] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    let created: string | null = null
    setUrl(null)
    setFailed(false)
    if (!available) return
    travelVisitService
      .selfie(context, visitId)
      .then((blob) => {
        if (!alive) return
        created = URL.createObjectURL(blob)
        setUrl(created)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [visitId, available, context])

  return (
    <div className="shrink-0 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Start selfie</p>
      {!available ? (
        <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-border px-2 text-center text-xs text-muted-foreground">
          No selfie for this trip
        </div>
      ) : failed ? (
        <p className="text-sm text-muted-foreground">The selfie could not be loaded.</p>
      ) : url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Selfie taken at the start of the trip"
            onClick={() => setOpen(true)}
            className="h-28 w-28 cursor-zoom-in rounded-xl border border-border object-cover"
          />
          {open && (
            <div className="fixed inset-0 z-[1000] flex cursor-zoom-out items-center justify-center bg-black/80 p-6" onClick={() => setOpen(false)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Selfie" className="max-h-full max-w-full rounded-lg" />
            </div>
          )}
        </>
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-border text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      )}
    </div>
  )
}

/** Travel Route History: every recorded location fix, in time order. */
function RouteHistoryTable({ points }: { points: TravelPoint[] }) {
  const [filter, setFilter] = React.useState('')
  const rows = points
    .map((p, i) => ({ ...p, no: i + 1 }))
    .filter((p) => !filter || `${p.no} ${p.recorded_at} ${p.lat} ${p.lng}`.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Travel Route History</p>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className="h-8 w-48" aria-label="Filter route history" />
      </div>
      <div className="max-h-80 overflow-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
            <tr>
              <th className="w-16 px-3 py-2 text-center font-medium">No.</th>
              <th className="px-3 py-2 font-medium">Date Time</th>
              <th className="px-3 py-2 font-medium">Lat</th>
              <th className="px-3 py-2 font-medium">Long</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  No location points.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.no} className="border-t border-border/60">
                  <td className="px-3 py-2 text-center">{p.no}</td>
                  <td className="px-3 py-2">{formatDateTime(p.recorded_at, true)}</td>
                  <td className="px-3 py-2 tabular-nums">{p.lat}</td>
                  <td className="px-3 py-2 tabular-nums">{p.lng}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TravelVisitDetail({ visitId, onClose }: { visitId: number | null; onClose: () => void }) {
  const context = React.useMemo(() => getLaravelContext(), [])
  const [visit, setVisit] = React.useState<TravelVisit | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (visitId === null) {
      setVisit(null)
      return
    }
    let alive = true
    setLoading(true)
    setError('')
    travelVisitService
      .get(context, visitId)
      .then((r) => alive && setVisit(r?.data ?? null))
      .catch((cause) => alive && setError(cause instanceof Error ? cause.message : 'Could not load the trip.'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [visitId, context])

  return (
    <Dialog open={visitId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{visit ? visit.visit_no : 'Travel visit'}</DialogTitle>
          <DialogDescription>
            {visit ? `${visit.employee_name ?? ''} · ${visit.status === 'ongoing' ? 'Ongoing' : 'Completed'}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading…
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {visit && !loading && (
          <div className="space-y-5">
            <div className="flex flex-col gap-5 sm:flex-row">
              <SelfiePhoto visitId={visit.id} available={visit.has_selfie} />
              <div className="grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Employee">
                {visit.employee_name}
                {visit.employee_code ? ` (${visit.employee_code})` : ''}
              </Field>
              <Field label="Purpose">{visit.purpose}</Field>
              <Field label="Vehicle">{visit.vehicle_type}</Field>
              <Field label="Duration">{duration(visit.start_at, visit.end_at)}</Field>
              <Field label="Started">{formatDateTime(visit.start_at)}</Field>
              <Field label="Ended">{formatDateTime(visit.end_at)}</Field>
              <Field label="Distance">{formatKm(visit.distance)}</Field>
              <Field label="App distance">{visit.app_distance !== null ? formatKm(visit.app_distance) : '—'}</Field>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="From">{visit.from?.address || (visit.from ? `${visit.from.lat}, ${visit.from.lng}` : '')}</Field>
              <Field label="To">{visit.to?.address || (visit.to ? `${visit.to.lat}, ${visit.to.lng}` : '')}</Field>
            </div>
            {visit.remarks && <Field label="Remarks">{visit.remarks}</Field>}

            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <RouteIcon className="size-4" /> Route ({visit.points?.length ?? 0} location points)
              </p>
              <RouteMap points={visit.points ?? []} ongoing={visit.status === 'ongoing'} />
            </div>

            <RouteHistoryTable points={visit.points ?? []} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
