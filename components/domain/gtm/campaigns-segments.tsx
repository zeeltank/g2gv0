'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  segmentService, type DirectoryUser, type Segment, type SegmentCriteria, type SegmentFilters, type SegmentKind, type SegmentPreview,
} from '@/services/gtm/campaigns'
import { MeasuredTag } from './gtm-shared'
import { detailedErr, label } from './campaigns-shared'

function describe(c: SegmentCriteria): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(c)) parts.push(`${label(k)}: ${Array.isArray(v) ? v.map(label).join(', ') : String(v)}`)
  return parts.join(' · ') || '—'
}

export function SegmentsPanel({ segments, filters, users, onChanged }: {
  segments: Segment[] | null; filters: SegmentFilters | null; users: DirectoryUser[]; onChanged: () => void
}) {
  const [editing, setEditing] = useState<Segment | 'new' | null>(null)
  const [previewing, setPreviewing] = useState<Segment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const remove = async (s: Segment) => {
    if (!window.confirm(`Remove segment "${s.name}"? Campaigns that used it keep their targets.`)) return
    try {
      await segmentService.remove(s.id)
      onChanged()
    } catch (e) {
      setError(detailedErr(e))
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">A segment is a saved filter, re-evaluated live on every read, so it never goes stale.</p>
        <Button size="sm" disabled={!filters} onClick={() => setEditing('new')}><Plus className="mr-1 size-4" />New segment</Button>
      </div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {!segments ? <Skeleton className="h-32" /> : segments.length === 0 ? (
        <EmptyState title="No segments yet" description="Create a segment to target a group of accounts or contacts in a campaign." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">Kind</th><th className="p-3">Filters</th><th className="p-3">Matches now</th><th className="p-3" /></tr></thead>
            <tbody>
              {segments.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="p-3"><div className="font-medium">{s.name}</div>{s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}</td>
                  <td className="p-3"><Badge variant="outline">{s.kind}</Badge></td>
                  <td className="max-w-md p-3 text-xs text-muted-foreground">{describe(s.criteria)}</td>
                  <td className="p-3">{s.match_count}</td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setPreviewing(s)}>Preview</Button>{' '}
                    <Button size="sm" variant="outline" onClick={() => setEditing(s)}>Edit</Button>{' '}
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(s)}>Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && filters && (
        <SegmentDialog key={editing === 'new' ? 'new' : editing.id} segment={editing === 'new' ? null : editing} filters={filters} users={users}
          onClose={() => setEditing(null)} onSaved={(s) => { onChanged(); setEditing(null); setPreviewing(s) }} />
      )}
      {previewing && <PreviewDialog segment={previewing} onClose={() => setPreviewing(null)} />}
    </div>
  )
}

function Toggle({ options, value, onChange }: { options: string[]; value: string[] | undefined; onChange: (v: string[] | undefined) => void }) {
  const cur = value ?? []
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {options.map((o) => (
        <label key={o} className="flex items-center gap-1.5 text-sm">
          <Checkbox checked={cur.includes(o)} onCheckedChange={(on) => { const n = on ? [...cur, o] : cur.filter((x) => x !== o); onChange(n.length ? n : undefined) }} />
          {label(o)}
        </label>
      ))}
    </div>
  )
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return <div className="space-y-1"><div className="text-xs font-medium text-muted-foreground">{title}</div>{children}</div>
}

const triState = (v: boolean | undefined) => (v === undefined ? '' : v ? 'yes' : 'no')
const fromTri = (s: string): boolean | undefined => (s === '' ? undefined : s === 'yes')
const TRI = [{ label: 'Any', value: '' }, { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]

function SegmentDialog({ segment, filters, users, onClose, onSaved }: {
  segment: Segment | null; filters: SegmentFilters; users: DirectoryUser[]; onClose: () => void; onSaved: (s: Segment) => void
}) {
  const [name, setName] = useState(segment?.name ?? '')
  const [description, setDescription] = useState(segment?.description ?? '')
  const [kind, setKind] = useState<SegmentKind>(segment?.kind ?? 'account')
  const [c, setC] = useState<SegmentCriteria>(segment?.criteria ?? {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof SegmentCriteria, v: unknown) =>
    setC((p) => {
      const n: Record<string, unknown> = { ...p }
      if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) delete n[k]
      else n[k] = v
      return n as SegmentCriteria
    })
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s))

  const changeKind = (k: SegmentKind) => { setKind(k); setC({}) }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const body = { name: name.trim(), description: description.trim() || null, criteria: c }
      const r = segment ? await segmentService.update(segment.id, body) : await segmentService.create({ ...body, kind })
      onSaved(r.data.segment)
    } catch (e) {
      setError(detailedErr(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{segment ? 'Edit segment' : 'New segment'}</DialogTitle>
          <DialogDescription>Add at least one filter. After saving you see who matches right now.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field title="Name"><Input value={name} maxLength={191} onChange={(e) => setName(e.target.value)} /></Field>
          <Field title="Description"><Input value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} /></Field>
          <Field title="Segment of">
            <Select value={kind} disabled={!!segment} onChange={(v) => changeKind(v as SegmentKind)} options={[{ label: 'Accounts', value: 'account' }, { label: 'Contacts', value: 'contact' }]} />
            {segment && <p className="text-xs text-muted-foreground">The kind cannot be changed once saved.</p>}
          </Field>

          {kind === 'account' ? (
            <div className="space-y-3">
              <Field title="Stage"><Toggle options={filters.account.stages} value={c.stages} onChange={(v) => set('stages', v)} /></Field>
              <Field title="Source"><Toggle options={filters.account.sources} value={c.sources} onChange={(v) => set('sources', v)} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field title="Industry contains"><Input value={c.industry_contains ?? ''} maxLength={100} onChange={(e) => set('industry_contains', e.target.value)} /></Field>
                <Field title="Location contains"><Input value={c.location_contains ?? ''} maxLength={100} onChange={(e) => set('location_contains', e.target.value)} /></Field>
                <Field title="Min ICP fit (0-100)"><Input type="number" min={0} max={100} value={c.min_icp ?? ''} onChange={(e) => set('min_icp', num(e.target.value))} /></Field>
                <Field title="Max ICP fit (0-100)"><Input type="number" min={0} max={100} value={c.max_icp ?? ''} onChange={(e) => set('max_icp', num(e.target.value))} /></Field>
                <Field title="Has contacts"><Select value={triState(c.has_contacts)} onChange={(v) => set('has_contacts', fromTri(v))} options={TRI} /></Field>
                <Field title="Min signal priority">
                  <Select value={c.min_signal_priority ?? ''} onChange={(v) => set('min_signal_priority', v)} options={[{ label: 'Any', value: '' }, ...filters.account.priorities.map((p) => ({ label: p, value: p }))]} />
                </Field>
                <Field title="Account owner">
                  <Select value={c.owner_user_id ? String(c.owner_user_id) : ''} onChange={(v) => set('owner_user_id', v ? Number(v) : undefined)} options={[{ label: 'Anyone', value: '' }, ...users.map((u) => ({ label: u.name, value: String(u.id) }))]} />
                </Field>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Field title="Role in deal"><Toggle options={filters.contact.roles} value={c.roles} onChange={(v) => set('roles', v)} /></Field>
              <Field title="Contact status (default: active only)"><Toggle options={filters.contact.statuses} value={c.statuses} onChange={(v) => set('statuses', v)} /></Field>
              <Field title="Account stage"><Toggle options={filters.contact.account_stages} value={c.account_stages} onChange={(v) => set('account_stages', v)} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field title="Account industry contains"><Input value={c.industry_contains ?? ''} maxLength={100} onChange={(e) => set('industry_contains', e.target.value)} /></Field>
                <Field title="Has email"><Select value={triState(c.has_email)} onChange={(v) => set('has_email', fromTri(v))} options={TRI} /></Field>
              </div>
            </div>
          )}
          {error && <p className="rounded bg-red-50 p-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={busy || !name.trim()} onClick={save}>{busy && <Loader2 className="mr-1 size-4 animate-spin" />}Save and preview</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PreviewDialog({ segment, onClose }: { segment: Segment; onClose: () => void }) {
  const [data, setData] = useState<SegmentPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    segmentService.preview(segment.id).then((r) => { if (live) setData(r.data) }).catch((e) => { if (live) setError(detailedErr(e, 'Unable to load preview')) })
    return () => { live = false }
  }, [segment.id])

  const cols = data?.sample[0] ? Object.keys(data.sample[0]).filter((k) => k !== 'id') : []

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{segment.name}</DialogTitle>
          <DialogDescription>Who matches right now (first 50 shown).</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : !data ? <Skeleton className="h-32" /> : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-lg font-semibold">{data.total} match</span><MeasuredTag />
              {data.without_email !== undefined && <span className="text-muted-foreground">{data.without_email} without an email address</span>}
              {data.suppressed !== undefined && <span className="text-muted-foreground">{data.suppressed} suppressed in this sample</span>}
            </div>
            {data.sample.length === 0 ? <EmptyState title="Nobody matches" description="Loosen the filters and preview again." /> : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>{cols.map((k) => <th key={k} className="p-2">{label(k)}</th>)}</tr></thead>
                  <tbody>{data.sample.map((r, i) => <tr key={String(r.id ?? i)} className="border-t border-border">{cols.map((k) => <td key={k} className="p-2">{r[k] ?? '—'}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
