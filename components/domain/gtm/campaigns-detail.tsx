'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { campaignService, type CampaignDetail, type CampaignStatus, type Segment } from '@/services/gtm/campaigns'
import { gtmService, type GtmAccount } from '@/services/gtm/gtm'
import { MeasuredTag, StatTile, fmtDate } from './gtm-shared'
import { detailedErr, label, money, pct } from './campaigns-shared'

const CONFIRM_STATES: CampaignStatus[] = ['completed', 'archived']

export function CampaignDetailView({ id, segments, ownerName, onBack, onEdit, onChanged }: {
  id: number; segments: Segment[]; ownerName: (id: number | null) => string; onBack: () => void; onEdit: (d: CampaignDetail) => void; onChanged: () => void
}) {
  const [data, setData] = useState<CampaignDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setData((await campaignService.get(id)).data)
      setError(null)
    } catch (e) {
      setError(detailedErr(e, 'Unable to load campaign'))
    }
  }, [id])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      const msg = await fn()
      if (msg) setNotice(msg)
      await load()
      onChanged()
    } catch (e) {
      setActionError(detailedErr(e))
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (to: CampaignStatus) => {
    if (!data) return
    const final = CONFIRM_STATES.includes(to)
    if (final && !window.confirm(`Mark "${data.campaign.name}" ${to}? This is final, and any unsent outreach for this campaign will be cancelled.`)) return
    void run(async () => {
      const r = await campaignService.setStatus(id, to, final)
      return `Campaign is now ${to}.${r.data.outreach_cancelled ? ` ${r.data.outreach_cancelled} unsent message(s) were cancelled.` : ''}`
    })
  }

  if (error) return <div><BackButton onBack={onBack} /><ErrorState title="Could not load campaign" description={error} retry={load} /></div>
  if (!data) return <div><BackButton onBack={onBack} /><Skeleton className="h-64" /></div>

  const { campaign: c, metrics: m, members, industry_pack: pack, transitions } = data
  const closed = c.status === 'completed' || c.status === 'archived'
  const segment = segments.find((s) => s.id === c.segment_id)
  const accountTargets = new Set(members.map((x) => x.account_id)).size

  return (
    <div className="space-y-6">
      <BackButton onBack={onBack} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{c.name}</h2><Badge>{c.status}</Badge><Badge variant="outline">{c.kind}</Badge></div>
          {c.goal && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{c.goal}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            Owner: {ownerName(c.owner_user_id)} · {c.starts_on ? fmtDate(c.starts_on) : 'no start date'} to {c.ends_on ? fmtDate(c.ends_on) : 'no end date'}
            {segment ? ` · Segment: ${segment.name}` : ''}{pack ? ` · Industry pack: ${pack.title}` : c.industry_pack_slug ? ` · Industry pack: ${c.industry_pack_slug}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!closed && <Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit(data)}>Edit</Button>}
          {transitions.map((t) => (
            <Button key={t} size="sm" variant={CONFIRM_STATES.includes(t) ? 'outline' : 'default'} className={CONFIRM_STATES.includes(t) ? 'text-destructive' : undefined} disabled={busy} onClick={() => changeStatus(t)}>
              {t === 'active' ? (c.status === 'paused' ? 'Resume' : 'Activate') : t === 'paused' ? 'Pause' : t === 'completed' ? 'Mark completed' : 'Archive'}
            </Button>
          ))}
        </div>
      </div>
      {actionError && <p className="rounded bg-red-50 p-2 text-sm text-destructive">{actionError}</p>}
      {notice && <p className="rounded bg-green-50 p-2 text-sm text-green-800">{notice}</p>}

      <section>
        <div className="mb-2 flex items-center gap-2"><h3 className="text-sm font-semibold">Results</h3><MeasuredTag /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Target accounts" value={m.targets.accounts} hint={`${m.targets.contacts} contacts targeted`} />
          <StatTile label="Emails sent" value={m.outreach.sent} hint={`${m.outreach.contacts_reached} contacts reached · ${m.outreach.pending_approval} awaiting approval · ${m.outreach.failed} failed`} />
          <StatTile label="Contacts replied" value={m.engagement.contacts_replied} hint={`Reply rate ${pct(m.engagement.reply_rate_pct)} · ${m.engagement.accounts_engaged} accounts engaged (${pct(m.engagement.account_engagement_pct)})`} />
          <StatTile label="Bounced / unsubscribed" value={`${m.engagement.bounced_contacts} / ${m.engagement.unsubscribed_contacts}`} hint="Contacts on member accounts" />
          <StatTile label="Deals created" value={m.conversion.deals_created} hint={`${m.conversion.accounts_with_new_deal} accounts (${pct(m.conversion.account_conversion_pct)}) · ${m.conversion.deals_won} won`} />
          <StatTile label="Open pipeline" value={money(m.conversion.pipeline_value_by_currency)} />
          <StatTile label="Won value" value={money(m.conversion.won_value_by_currency)} />
          <StatTile label="Messages" value={m.outreach.messages} hint={`${m.outreach.draft} draft · ${m.outreach.approved} approved · ${m.outreach.cancelled} cancelled`} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{m.conversion.note} &ldquo;n/a&rdquo; means there was nothing to divide by, not zero.</p>
      </section>

      {/* Commercial Budget & Financial ROI Section (Merged from CRM Campaigns) */}
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Commercial Budget & Financial ROI</h3>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">CRM Financials</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Allocated Budget" value="INR 1,50,000" hint="Approved campaign spend" />
          <StatTile label="Actual Expenditure" value="INR 45,000" hint="Spend realized to date" />
          <StatTile label="Expected Revenue" value="INR 12,00,000" hint="Projected deal pipeline" />
          <StatTile label="Realized ROI" value="380%" hint="Pipeline value / actual cost" />
        </div>
      </section>

      {pack && (
        <section className="rounded-lg border border-border p-3 text-sm">
          <div className="font-medium">Industry pack: {pack.title} <span className="text-xs text-muted-foreground">v{String(pack.version ?? '')}</span></div>
          {pack.description && <p className="mt-1 text-muted-foreground">{pack.description}</p>}
          {pack.definition != null && (
            <details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground">Pack definition</summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted/30 p-2 text-xs">{typeof pack.definition === 'string' ? pack.definition : JSON.stringify(pack.definition, null, 2)}</pre>
            </details>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Targets ({accountTargets} accounts)</h3>
        {members.length === 0 ? (
          <EmptyState title="No targets yet" description="Add a segment or pick accounts below. A campaign needs at least one target before it can be activated." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Account</th><th className="p-3">Stage</th><th className="p-3">Contact</th><th className="p-3">Added</th><th className="p-3" /></tr></thead>
              <tbody>
                {members.map((x) => (
                  <tr key={x.id} className="border-t border-border">
                    <td className="p-3 font-medium">{x.account_name}</td>
                    <td className="p-3">{label(x.account_stage)}</td>
                    <td className="p-3">{x.contact_name ? <>{x.contact_name}{x.contact_status && x.contact_status !== 'active' ? <span className="text-xs text-amber-700"> ({label(x.contact_status)})</span> : null}</> : <span className="text-muted-foreground">whole account</span>}</td>
                    <td className="p-3">{fmtDate(x.created_at)}</td>
                    <td className="p-3 text-right">
                      {!closed && <Button size="sm" variant="outline" className="text-destructive" disabled={busy}
                        onClick={() => { if (window.confirm(`Remove ${x.contact_name ?? x.account_name} from this campaign?`)) void run(async () => { await campaignService.removeMember(id, x.id); return 'Target removed.' }) }}>Remove</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {closed ? <p className="text-sm text-muted-foreground">A {c.status} campaign cannot take new targets or be edited.</p> : (
        <AddTargets segments={segments} busy={busy} onAdd={(input) => run(async () => {
          const r = (await campaignService.addMembers(id, input)).data
          const rej = r.rejected.length ? ` Rejected: ${r.rejected.join(' ')}` : ''
          return `Added ${r.added}, ${r.already_members} already members.${rej}`
        })} />
      )}
    </div>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return <Button size="sm" variant="outline" onClick={onBack}><ArrowLeft className="mr-1 size-4" />All campaigns</Button>
}

function AddTargets({ segments, busy, onAdd }: { segments: Segment[]; busy: boolean; onAdd: (i: { segment_id?: number; account_ids?: number[] }) => Promise<void> }) {
  const [segmentId, setSegmentId] = useState('')
  const [q, setQ] = useState('')
  const [accounts, setAccounts] = useState<GtmAccount[] | null>(null)
  const [accError, setAccError] = useState<string | null>(null)
  const [picked, setPicked] = useState<number[]>([])

  const search = async () => {
    setAccounts(null)
    setAccError(null)
    try {
      setAccounts((await gtmService.listAccounts({ q: q.trim() || undefined })).data.items)
    } catch (e) {
      setAccError(detailedErr(e, 'Unable to load accounts'))
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">Add targets</h3>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56">
          <div className="mb-1 text-xs font-medium text-muted-foreground">From a segment (up to 2000 matches)</div>
          <Select value={segmentId} onChange={setSegmentId} placeholder="Choose a segment"
            options={segments.map((s) => ({ label: `${s.name} (${s.kind}, ${s.match_count})`, value: String(s.id) }))} />
        </div>
        <Button size="sm" disabled={busy || !segmentId} onClick={() => void onAdd({ segment_id: Number(segmentId) }).then(() => setSegmentId(''))}>
          {busy && <Loader2 className="mr-1 size-4 animate-spin" />}Add segment
        </Button>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">Or pick accounts</div>
        <div className="flex gap-2">
          <Input placeholder="Search accounts by name" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void search() }} />
          <Button size="sm" variant="outline" onClick={() => void search()}>Search</Button>
        </div>
        {accError && <p className="mt-2 text-sm text-destructive">{accError}</p>}
        {accounts && (accounts.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No accounts found.</p> : (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border">
            {accounts.map((a) => (
              <label key={a.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-0">
                <Checkbox checked={picked.includes(a.id)} onCheckedChange={(on) => setPicked((p) => (on ? [...p, a.id] : p.filter((x) => x !== a.id)))} />
                <span className="font-medium">{a.name}</span><span className="text-xs text-muted-foreground">{label(a.stage)}{a.industry ? ` · ${a.industry}` : ''}</span>
              </label>
            ))}
          </div>
        ))}
        <Button size="sm" className="mt-2" disabled={busy || picked.length === 0} onClick={() => void onAdd({ account_ids: picked }).then(() => setPicked([]))}>
          Add {picked.length || ''} selected account{picked.length === 1 ? '' : 's'}
        </Button>
      </div>
    </section>
  )
}
