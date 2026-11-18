'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  CAMPAIGN_KINDS, CAMPAIGN_STATUSES, campaignService, directoryService, segmentService,
  type Campaign, type CampaignDetail, type DirectoryUser, type IndustryPackRef, type Segment, type SegmentFilters,
} from '@/services/gtm/campaigns'
import { GtmPageHeader, fmtDate, useGtmReady } from './gtm-shared'
import { TEXTAREA, dateOnly, detailedErr, label } from './campaigns-shared'
import { CampaignDetailView } from './campaigns-detail'
import { SegmentsPanel } from './campaigns-segments'

type Tab = 'campaigns' | 'segments'

/**
 * Campaigns and segments. Every number on this screen is counted by the server from real records;
 * a rate the server cannot compute is shown as n/a rather than as zero.
 */
export function CampaignsView() {
  const ready = useGtmReady()
  const [tab, setTab] = useState<Tab>('campaigns')
  const [status, setStatus] = useState('')
  const [items, setItems] = useState<Campaign[] | null>(null)
  const [packs, setPacks] = useState<IndustryPackRef[]>([])
  const [segments, setSegments] = useState<Segment[] | null>(null)
  const [filters, setFilters] = useState<SegmentFilters | null>(null)
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [segError, setSegError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [form, setForm] = useState<Campaign | 'new' | null>(null)

  const loadCampaigns = useCallback(async () => {
    try {
      const r = await campaignService.list(status)
      setItems(r.data.items)
      setPacks(r.data.packs)
      setError(null)
    } catch (e) {
      setError(detailedErr(e, 'Unable to load campaigns'))
    }
  }, [status])

  const loadSegments = useCallback(async () => {
    try {
      const r = await segmentService.list()
      setSegments(r.data.items)
      setFilters(r.data.filters)
      setSegError(null)
    } catch (e) {
      setSegError(detailedErr(e, 'Unable to load segments'))
    }
  }, [])

  useEffect(() => { if (ready) queueMicrotask(() => void loadCampaigns()) }, [ready, loadCampaigns])
  useEffect(() => {
    if (!ready) return
    queueMicrotask(() => void loadSegments())
    directoryService.get().then((r) => setUsers(r.data.users)).catch(() => setUsers([]))
  }, [ready, loadSegments])

  const ownerName = (id: number | null) => (id ? users.find((u) => u.id === id)?.name ?? `User #${id}` : 'Unassigned')

  return (
    <div className="p-6">
      <GtmPageHeader
        title="Campaigns"
        description="Group target accounts into marketing and account-based campaigns, aim them with saved segments, and see what they achieved - counted from real outreach, replies and deals."
        actions={tab === 'campaigns' && openId === null ? <Button size="sm" onClick={() => setForm('new')}><Plus className="mr-1 size-4" />New campaign</Button> : undefined}
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {(['campaigns', 'segments'] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setOpenId(null) }} className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize ${tab === t ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground'}`}>{t}</button>
        ))}
      </div>

      {tab === 'segments' ? (
        segError ? <ErrorState title="Could not load segments" description={segError} retry={loadSegments} /> :
          <SegmentsPanel segments={segments} filters={filters} users={users} onChanged={loadSegments} />
      ) : openId !== null ? (
        <CampaignDetailView key={openId} id={openId} segments={segments ?? []} ownerName={ownerName} onBack={() => setOpenId(null)}
          onEdit={(d: CampaignDetail) => setForm(d.campaign)} onChanged={loadCampaigns} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1">
            {['', ...CAMPAIGN_STATUSES].map((s) => (
              <button key={s || 'open'} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 text-xs ${status === s ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border text-muted-foreground'}`}>
                {s ? label(s) : 'All except archived'}
              </button>
            ))}
          </div>
          {error ? <ErrorState title="Could not load campaigns" description={error} retry={loadCampaigns} /> : !items ? <Skeleton className="h-40" /> : items.length === 0 ? (
            <EmptyState title="No campaigns" description={status ? `No ${status} campaigns.` : 'Create a campaign, then add target accounts from a segment or by search.'} />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Campaign</th><th className="p-3">Kind</th><th className="p-3">Status</th><th className="p-3">Target accounts</th><th className="p-3">Owner</th><th className="p-3">Dates</th></tr></thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => setOpenId(c.id)}>
                      <td className="p-3"><div className="font-medium">{c.name}</div>{c.goal && <div className="line-clamp-1 max-w-md text-xs text-muted-foreground">{c.goal}</div>}</td>
                      <td className="p-3"><Badge variant="outline">{c.kind}</Badge></td>
                      <td className="p-3"><Badge variant={c.status === 'active' ? 'default' : 'outline'}>{c.status}</Badge></td>
                      <td className="p-3">{c.target_accounts ?? 0}</td>
                      <td className="p-3">{ownerName(c.owner_user_id)}</td>
                      <td className="p-3 text-xs">{c.starts_on ? fmtDate(c.starts_on) : '—'} to {c.ends_on ? fmtDate(c.ends_on) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {form && (
        <CampaignFormDialog key={form === 'new' ? 'new' : form.id} campaign={form === 'new' ? null : form} packs={packs} segments={segments ?? []} users={users}
          onClose={() => setForm(null)}
          onSaved={(c) => { setForm(null); void loadCampaigns(); if (form === 'new') { setTab('campaigns'); setOpenId(c.id) } else { setOpenId(null); queueMicrotask(() => setOpenId(c.id)) } }} />
      )}
    </div>
  )
}

function CampaignFormDialog({ campaign, packs, segments, users, onClose, onSaved }: {
  campaign: Campaign | null; packs: IndustryPackRef[]; segments: Segment[]; users: DirectoryUser[]; onClose: () => void; onSaved: (c: Campaign) => void
}) {
  const [name, setName] = useState(campaign?.name ?? '')
  const [kind, setKind] = useState(campaign?.kind ?? 'abm')
  const [goal, setGoal] = useState(campaign?.goal ?? '')
  const [pack, setPack] = useState(campaign?.industry_pack_slug ?? '')
  const [segmentId, setSegmentId] = useState(campaign?.segment_id ? String(campaign.segment_id) : '')
  const [owner, setOwner] = useState(campaign?.owner_user_id ? String(campaign.owner_user_id) : '')
  const [starts, setStarts] = useState(dateOnly(campaign?.starts_on))
  const [ends, setEnds] = useState(dateOnly(campaign?.ends_on))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const body = {
        name: name.trim(), kind, goal: goal.trim() || null, industry_pack_slug: pack || null,
        segment_id: segmentId ? Number(segmentId) : null, owner_user_id: owner ? Number(owner) : null,
        starts_on: starts || null, ends_on: ends || null,
      }
      const r = campaign ? await campaignService.update(campaign.id, body) : await campaignService.create(body)
      onSaved(r.data.campaign)
    } catch (e) {
      setError(detailedErr(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? 'Edit campaign' : 'New campaign'}</DialogTitle>
          <DialogDescription>New campaigns start as drafts. Targets are added on the campaign page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><div className="mb-1 text-xs font-medium text-muted-foreground">Name</div><Input value={name} maxLength={191} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className="mb-1 text-xs font-medium text-muted-foreground">Kind</div><Select value={kind} onChange={setKind} options={CAMPAIGN_KINDS.map((k) => ({ label: k.toUpperCase() === 'ABM' ? 'ABM' : label(k), value: k }))} /></div>
            <div><div className="mb-1 text-xs font-medium text-muted-foreground">Owner</div><Select value={owner} onChange={setOwner} options={[{ label: 'Unassigned', value: '' }, ...users.map((u) => ({ label: u.name, value: String(u.id) }))]} /></div>
            <div><div className="mb-1 text-xs font-medium text-muted-foreground">Segment</div><Select value={segmentId} onChange={setSegmentId} options={[{ label: 'None', value: '' }, ...segments.map((s) => ({ label: `${s.name} (${s.kind})`, value: String(s.id) }))]} /></div>
            <div><div className="mb-1 text-xs font-medium text-muted-foreground">Industry pack</div><Select value={pack} onChange={setPack} options={[{ label: 'None', value: '' }, ...packs.map((p) => ({ label: p.title, value: p.slug }))]} /></div>
            <div><div className="mb-1 text-xs font-medium text-muted-foreground">Starts on</div><Input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
            <div><div className="mb-1 text-xs font-medium text-muted-foreground">Ends on</div><Input type="date" value={ends} min={starts || undefined} onChange={(e) => setEnds(e.target.value)} /></div>
          </div>
          <div><div className="mb-1 text-xs font-medium text-muted-foreground">Goal / objective</div><textarea className={TEXTAREA} rows={3} maxLength={2000} value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
          {segmentId && <p className="text-xs text-muted-foreground">The segment is recorded on the campaign; use &ldquo;Add segment&rdquo; on the campaign page to actually add its current matches as targets.</p>}
          {error && <p className="rounded bg-red-50 p-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={busy || !name.trim()} onClick={save}>{busy && <Loader2 className="mr-1 size-4 animate-spin" />}{campaign ? 'Save changes' : 'Create campaign'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
