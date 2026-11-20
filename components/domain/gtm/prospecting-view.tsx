'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, Pencil, Plus, Search, Sparkles, Target, Trash2, Upload, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { useProducts } from '@/components/domain/signals/product-selector'
import type { ProductInfo } from '@/services/portfolio/types'
import {
  ACCOUNT_STAGES, ACTIVITY_TYPES, CONTACT_ROLES, CONTACT_STATUSES, gtmService, isMasked,
  type AccountDetail, type ContactPatch, type GtmAccount, type GtmCandidate, type GtmContact, type GtmDirectory,
} from '@/services/gtm/gtm'
import type { CrossLinkedCrmOrganization } from '@/components/domain/crm/crm-cross-links-tab'
import { EstimateTag, GtmPageHeader, errMsg, fmtDate, useGtmReady } from './gtm-shared'
import { ImportContactsDialog } from './import-contacts-dialog'
import {
  ProspectScopeBar, accountRegionLabel, customerTypeLabel, productLabel, regionKey, scopeIsComplete, scopeSentence, useStoredScope,
  type ProspectScopeValue,
} from './prospecting-scope'

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

type Tab = 'accounts' | 'research'

/**
 * Prospecting. Accounts are the working list; "From research" is every company the tenant's
 * own signal research found that has not been promoted yet, with its strongest live signal
 * and the source it came from. Nothing on this page is generated or seeded.
 */
export function ProspectingView() {
  const ready = useGtmReady()
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const { products } = useProducts(context)
  const [scope, setScope] = useStoredScope(`g2g_prospect_scope_${context.organizationId || context.subInstituteId || 'default'}`)
  const complete = scopeIsComplete(scope)
  const scopeText = scopeSentence(products, scope)
  const needScope = 'Choose a product, a customer type and a region first.'
  const [tab, setTab] = useState<Tab>('accounts')
  const [openId, setOpenId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const bump = () => setRefresh((n) => n + 1)

  return (
    <div className="p-6">
      <GtmPageHeader
        title="Prospecting"
        description="Your working list of target accounts for each product and customer type, the people at them, and the buying signals your research found."
        actions={<><Button variant="outline" disabled={!complete} title={complete ? undefined : needScope} onClick={() => setImporting(true)}><Upload className="mr-1 size-4" />Import contacts</Button><Button disabled={!complete} title={complete ? undefined : needScope} onClick={() => setAdding(true)}><Plus className="mr-1 size-4" />Add account</Button></>}
      />
      <ProspectScopeBar products={products} scope={scope} context={context} onChange={(next) => { setScope(next); setOpenId(null) }} />
      <div className="mb-4 flex gap-1 border-b border-border">
        {([['accounts', 'Target accounts'], ['research', 'From research']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
          >{label}</button>
        ))}
      </div>

      {ready && tab === 'accounts' && <AccountsTab key={`${scope.product}|${scope.customerModel}|${regionKey(scope.region)}`} refresh={refresh} onOpen={setOpenId} scope={scope} products={products} />}
      {ready && tab === 'research' && <ResearchTab refresh={refresh} scope={scope} onPromoted={(id) => { bump(); setOpenId(id) }} />}

      <ImportContactsDialog open={importing} onClose={() => setImporting(false)} onDone={bump} scope={scope} scopeText={scopeText} />
      <AddAccountDialog open={adding} scope={scope} scopeText={scopeText} onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); bump(); setOpenId(id) }} />
      <AccountDialog key={openId ?? "none"} id={openId} onClose={() => setOpenId(null)} onChanged={bump} />
    </div>
  )
}

function AccountsTab({ refresh, onOpen, scope, products }: { refresh: number; onOpen: (id: number) => void; scope: ProspectScopeValue; products: ProductInfo[] | null }) {
  const [q, setQ] = useState('')
  const [stage, setStage] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ items: GtmAccount[]; total: number; per_page: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData((await gtmService.listAccounts({ q, stage, page, product: scope.product, customer_model: scope.customerModel, region: scope.region })).data)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load accounts'))
    } finally {
      setLoading(false)
    }
  }, [q, stage, page, scope.product, scope.customerModel, scope.region])


  useEffect(() => { queueMicrotask(() => void load()) }, [load, refresh])

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input className="w-64 pl-8" placeholder="Search name, domain, industry" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} />
        </div>
        <select className={SELECT} value={stage} onChange={(e) => { setPage(1); setStage(e.target.value) }}>
          <option value="">All stages</option>
          {ACCOUNT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && !data ? <Skeleton className="h-40" /> : error ? (
        <ErrorState title="Could not load accounts" description={error} retry={load} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title={q || stage ? 'No accounts match' : 'No accounts yet'} description={q || stage ? 'Try clearing the filters.' : scopeIsComplete(scope) ? `Nothing on the ${scopeSentence(products, scope)} list yet. Add an account, import contacts, or promote a company from the "From research" tab.` : 'Add an account, or promote a company from the "From research" tab.'} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr><th className="p-3">Account</th><th className="p-3">Stage</th><th className="p-3">Contacts</th><th className="p-3">Signals</th><th className="p-3">ICP fit</th><th className="p-3">Last activity</th></tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id} className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => onOpen(a.id)}>
                    <td className="p-3"><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{[a.industry, a.location, a.domain].filter(Boolean).join(' · ') || '—'}</div>{a.notes && <div className="mt-0.5 line-clamp-1 max-w-md text-[11px] text-muted-foreground/80" title={a.notes}>{a.notes}</div>}{!scopeIsComplete(scope) && a.product_key && <div className="mt-0.5 text-[11px] text-primary">{productLabel(products, a.product_key)} · {customerTypeLabel(a.customer_model).split(' · ')[1] ?? a.customer_model}{accountRegionLabel(a) ? ` · ${accountRegionLabel(a)}` : ''}</div>}</td>
                    <td className="p-3"><Badge variant="outline">{a.stage}</Badge></td>
                    <td className="p-3">{a.contacts_count ?? 0}</td>
                    <td className="p-3">{a.signals_count ?? 0}</td>
                    <td className="p-3">{a.icp_fit_score === null ? <span className="text-muted-foreground">Not scored</span> : <span title="AI estimate">{a.icp_fit_score} <span className="text-[10px] text-amber-600">est.</span></span>}</td>
                    <td className="p-3">{fmtDate(a.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{data.total} account(s)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page * data.per_page >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ResearchTab({ refresh, onPromoted, scope }: { refresh: number; onPromoted: (accountId: number) => void; scope: ProspectScopeValue }) {
  const [items, setItems] = useState<GtmCandidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      setItems((await gtmService.candidates({ product: scope.product, customer_model: scope.customerModel, region: scope.region })).data.items)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load researched companies'))
    }
  }, [scope.product, scope.customerModel, scope.region])
  useEffect(() => { queueMicrotask(() => void load()) }, [load, refresh])

  const promote = async (c: GtmCandidate) => {
    setBusy(c.id)
    try {
      // Filed under the list you are looking at; from an all-products view, under the product and type of its own strongest signal.
      const res = await gtmService.promoteCompany(c.id, {
        product: scope.product !== 'all' ? scope.product : (c.product_key ?? undefined),
        customer_model: scope.customerModel !== 'all' ? scope.customerModel : (c.customer_model ?? undefined),
        // The chosen region; from an all-regions view, the one place its strongest signal was found for (if there is exactly one).
        region: scope.region ?? (c.region?.country ? { country: c.region.country, state: c.region.state ?? undefined, city: c.region.city ?? undefined } : null),
      })
      onPromoted(res.data.account.id)
    } catch (e) {
      setError(errMsg(e, 'Could not add this company'))
    } finally {
      setBusy(null)
    }
  }

  if (error) return <ErrorState title="Could not load" description={error} retry={load} />
  if (!items) return <Skeleton className="h-40" />
  if (items.length === 0) {
    return <EmptyState title="Nothing waiting" description={scope.product !== 'all' || scope.customerModel !== 'all' || scope.region !== null ? 'No researched company with a signal for this product, customer type and region is waiting. New ones appear after the next signal run or connector sync.' : 'Every researched company is already an account. New companies appear here after the next signal research run.'} />
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((c) => (
        <div key={c.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{[c.industry, c.location].filter(Boolean).join(' · ') || 'No industry or location recorded'}</div>
            </div>
            <Button size="sm" disabled={busy === c.id} onClick={() => promote(c)}>
              {busy === c.id ? <Loader2 className="size-4 animate-spin" /> : 'Add as account'}
            </Button>
          </div>
          {c.top_signal ? (
            <div className="mt-3 rounded-md bg-muted/40 p-2 text-sm">
              <div className="mb-1 flex items-center gap-2"><Badge variant="outline">{c.top_signal.priority}</Badge><span className="text-xs text-muted-foreground">{c.signals_count} signal(s)</span></div>
              <p>{c.top_signal.title}</p>
              {c.top_signal.source_url && (
                <a href={c.top_signal.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Source <ExternalLink className="size-3" /></a>
              )}
            </div>
          ) : <p className="mt-3 text-xs text-muted-foreground">No live signals recorded.</p>}
        </div>
      ))}
    </div>
  )
}

function AddAccountDialog({ open, onClose, onCreated, scope, scopeText }: { open: boolean; onClose: () => void; onCreated: (id: number) => void; scope: ProspectScopeValue; scopeText: string }) {
  const [form, setForm] = useState({ name: '', domain: '', industry: '', location: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await gtmService.createAccount({
        name: form.name.trim(), domain: form.domain.trim() || null,
        industry: form.industry.trim() || null, location: form.location.trim() || null,
        product: scope.product, customer_model: scope.customerModel, region: scope.region,
      })
      setForm({ name: '', domain: '', industry: '', location: '' })
      onCreated(res.data.account.id)
    } catch (e) {
      setError(errMsg(e, 'Could not create the account'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add account</DialogTitle><DialogDescription>{scopeText ? `Adding to the ${scopeText} list.` : 'A company you want to sell to.'}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Company name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Website or domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          <Input placeholder="Industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={saving || form.name.trim() === ''} onClick={save}>{saving ? 'Saving…' : 'Create'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AccountDialog({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const [detail, setDetail] = useState<AccountDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contact, setContact] = useState({ full_name: '', title: '', email: '', role_in_deal: '' })
  const [note, setNote] = useState({ type: 'note', subject: '' })
  const [busy, setBusy] = useState(false)
  const [directory, setDirectory] = useState<GtmDirectory | null>(null)
  const [editingAccount, setEditingAccount] = useState(false)
  // Sales & Marketing unification, Phase 7: only the CRM-organization half of
  // the cross-link - the Signals half is already shown in depth by the
  // "Buying signals" section below, duplicating it here would be noise.
  const [crmOrg, setCrmOrg] = useState<CrossLinkedCrmOrganization | null>(null)

  useEffect(() => {
    if (id === null) return
    void gtmService.directory().then((r) => setDirectory(r.data)).catch(() => setDirectory(null))
    void gtmService.getAccountCrossModuleLinks(id).then((r) => setCrmOrg(r.data.crm_organization)).catch(() => setCrmOrg(null))
  }, [id])

  const load = useCallback(async () => {
    if (id === null) return
    try {
      setDetail((await gtmService.getAccount(id)).data)
      setError(null)
    } catch (e) {
      setError(errMsg(e, 'Unable to load the account'))
    }
  }, [id])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      after?.()
      await load()
      onChanged()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const a = detail?.account

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{a?.name ?? 'Account'}</DialogTitle>
          <DialogDescription>{a ? [a.industry, a.location, a.domain, a.email, a.phone].filter(Boolean).join(' · ') || 'No details recorded' : 'Loading…'}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!detail ? (error ? null : <Skeleton className="h-40" />) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Stage</span>
              <select className={SELECT} value={detail.account.stage} disabled={busy}
                onChange={(e) => run(() => gtmService.updateAccount(detail.account.id, { stage: e.target.value as GtmAccount['stage'] }))}>
                {ACCOUNT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Badge variant="outline">source: {detail.account.source}</Badge>
              {crmOrg && (
                <button
                  type="button"
                  onClick={() => router.push(resolveAccessLink('/module/crm/marketing/organizations') + `/${crmOrg.id}`)}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
                  title="This account is also a CRM Organization"
                >
                  <Target className="size-3" aria-hidden="true" />
                  Also in CRM
                </button>
              )}
              <Button size="sm" variant="outline" className="ml-auto text-destructive" disabled={busy}
                onClick={() => { if (window.confirm(`Remove ${detail.account.name} from your accounts?`)) void run(() => gtmService.deleteAccount(detail.account.id), onClose) }}>
                <Trash2 className="mr-1 size-3.5" />Remove
              </Button>
            </div>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold">Details</h3>
                {!editingAccount && <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={() => setEditingAccount(true)}><Pencil className="mr-1 size-3.5" />Edit</Button>}
              </div>
              {editingAccount ? (
                <AccountEditForm account={detail.account} directory={directory} busy={busy} onCancel={() => setEditingAccount(false)}
                  onSave={(patch) => run(() => gtmService.updateAccount(detail.account.id, patch), () => setEditingAccount(false))} />
              ) : (
                <dl className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
                  <Detail k="Domain" v={detail.account.domain} /><Detail k="Website" v={detail.account.website} />
                  <Detail k="Industry" v={detail.account.industry} /><Detail k="Location" v={detail.account.location} />
                  <Detail k="Company size" v={detail.account.employee_range} />
                  <Detail k="Email" v={detail.account.email} /><Detail k="Phone" v={detail.account.phone} />
                  <Detail k="Owner" v={detail.account.owner_user_id === null ? null : directory?.users.find((u) => u.id === detail.account.owner_user_id)?.name ?? `User #${detail.account.owner_user_id}`} />
                  <Detail k="Product · type" v={[detail.account.product_key, detail.account.customer_model && customerTypeLabel(detail.account.customer_model)].filter(Boolean).join(' · ') || null} />
                  <Detail k="Region" v={accountRegionLabel(detail.account) || null} />
                  <div className="md:col-span-2"><Detail k="Notes" v={detail.account.notes} /></div>
                </dl>
              )}
              {!editingAccount && detail.account.import_details && Object.keys(detail.account.import_details).length > 0 && (
                <div className="mt-3 rounded-md border border-border p-3">
                  <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">From the imported file</h4>
                  <dl className="space-y-1.5 text-sm">
                    {Object.entries(detail.account.import_details).map(([heading, text]) => (
                      <div key={heading} className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">{heading}</dt><dd className="min-w-0 whitespace-pre-line break-words"><Linkified text={text} /></dd></div>
                    ))}
                  </dl>
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold">ICP fit</h3><EstimateTag />
                <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={() => run(() => gtmService.scoreIcp(detail.account.id))}>
                  {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Sparkles className="mr-1 size-3.5" />}
                  {detail.account.icp_fit_score === null && !detail.account.icp_fit_basis ? 'Score fit' : 'Re-score'}
                </Button>
              </div>
              {!detail.account.icp_fit_basis ? (
                <p className="text-sm text-muted-foreground">Not scored. Scoring compares this account with the ideal customer you defined under Signals → Company research, using only the facts recorded here and its research signals.</p>
              ) : (
                <div className="rounded-md border border-border p-3 text-sm">
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold">{detail.account.icp_fit_score ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">/ 100 · confidence {detail.account.icp_fit_basis.confidence} · {detail.account.icp_fit_basis.model} · {fmtDate(detail.account.icp_scored_at, true)}</span>
                  </div>
                  <p className="mb-2">{detail.account.icp_fit_basis.summary}</p>
                  <ul className="space-y-1">
                    {detail.account.icp_fit_basis.dimensions.map((d) => (
                      <li key={d.name} className="flex gap-2"><span className="w-20 shrink-0 font-medium capitalize">{d.name}</span><span className="w-10 shrink-0">{d.score ?? 'n/a'}</span><span className="text-muted-foreground">{d.reason}</span></li>
                    ))}
                  </ul>
                  {(detail.account.icp_fit_basis.adjustments ?? []).map((x) => <p key={x} className="mt-1 text-xs text-amber-700">{x}</p>)}
                  {detail.account.icp_fit_basis.missing.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Missing: {detail.account.icp_fit_basis.missing.join(', ')} — add them to the account to improve this score.</p>}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Buying signals ({detail.signals.length})</h3>
              {detail.signals.length === 0 ? <p className="text-sm text-muted-foreground">No signals linked to this account.</p> : (
                <ul className="space-y-2">
                  {detail.signals.map((s) => (
                    <li key={s.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="mb-1 flex items-center gap-2"><Badge variant="outline">{s.priority}</Badge>{s.signal_kind && <Badge variant="outline">{s.signal_kind}</Badge>}<span className="text-xs text-muted-foreground">{fmtDate(s.event_date)}</span></div>
                      <p className="font-medium">{s.title}</p>
                      {s.why_indicates_need && <p className="mt-1 text-muted-foreground">{s.why_indicates_need}</p>}
                      {s.sources.slice(0, 3).map((src) => (
                        <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer" className="mt-1 mr-3 inline-flex items-center gap-1 text-xs text-primary">{src.title || new URL(src.url).hostname}<ExternalLink className="size-3" /></a>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Contacts ({detail.contacts.length})</h3>
              {detail.contacts.length === 0 && <p className="mb-2 text-sm text-muted-foreground">No contacts yet. G2G does not invent people — add the ones you have found.</p>}
              <ul className="mb-3 space-y-1">
                {detail.contacts.map((c) => (
                  <ContactRow key={c.id} contact={c} busy={busy}
                    onSave={(patch) => run(() => gtmService.updateContact(c.id, patch))}
                    onDelete={() => run(() => gtmService.deleteContact(c.id))} />
                ))}
              </ul>
              <div className="grid gap-2 md:grid-cols-5">
                <Input placeholder="Full name *" value={contact.full_name} onChange={(e) => setContact({ ...contact, full_name: e.target.value })} />
                <Input placeholder="Title" value={contact.title} onChange={(e) => setContact({ ...contact, title: e.target.value })} />
                <Input placeholder="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                <select className={SELECT} value={contact.role_in_deal} onChange={(e) => setContact({ ...contact, role_in_deal: e.target.value })}>
                  <option value="">Role…</option>
                  {CONTACT_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
                <Button disabled={busy || contact.full_name.trim() === ''} onClick={() => run(
                  () => gtmService.addContact(detail.account.id, {
                    full_name: contact.full_name.trim(), title: contact.title || null, email: contact.email || null,
                    role_in_deal: (contact.role_in_deal || null) as never,
                  }),
                  () => setContact({ full_name: '', title: '', email: '', role_in_deal: '' }),
                )}><UserPlus className="mr-1 size-4" />Add</Button>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Activity</h3>
              <div className="mb-3 flex gap-2">
                <select className={SELECT} value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value })}>
                  {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <Input placeholder="What happened?" value={note.subject} onChange={(e) => setNote({ ...note, subject: e.target.value })} />
                <Button disabled={busy || note.subject.trim() === ''} onClick={() => run(
                  () => gtmService.logActivity(detail.account.id, { type: note.type, subject: note.subject.trim() }),
                  () => setNote({ ...note, subject: '' }),
                )}>Log</Button>
              </div>
              {detail.activities.length === 0 ? <p className="text-sm text-muted-foreground">Nothing logged yet.</p> : (
                <ul className="space-y-1 text-sm">
                  {detail.activities.map((x) => (
                    <li key={x.id} className="flex gap-3 border-b border-border py-1.5"><span className="w-28 shrink-0 text-xs text-muted-foreground">{fmtDate(x.occurred_at, true)}</span><Badge variant="outline">{x.type}</Badge><span>{x.subject}</span></li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Detail({ k, v }: { k: string; v: string | null | undefined }) {
  return <div className="flex gap-2"><dt className="w-28 shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 whitespace-pre-line break-words">{v ? <Linkified text={v} /> : '—'}</dd></div>
}

/** Text with its web addresses made into links (a note or an imported source list often holds several). */
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s;,)]+)/g).map((part, i) =>
        /^https?:\/\//.test(part)
          ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{part}</a>
          : <span key={i}>{part}</span>)}
    </>
  )
}

/** Only fields the person changed are sent, so an untouched value is never written back. */
function AccountEditForm({ account, directory, busy, onSave, onCancel }: {
  account: GtmAccount; directory: GtmDirectory | null; busy: boolean; onSave: (patch: Record<string, unknown>) => void; onCancel: () => void
}) {
  const [f, setF] = useState({
    name: account.name, domain: account.domain ?? '', website: account.website ?? '', industry: account.industry ?? '',
    location: account.location ?? '', employee_range: account.employee_range ?? '', email: account.email ?? '', phone: account.phone ?? '', notes: account.notes ?? '', owner: account.owner_user_id === null ? '' : String(account.owner_user_id),
  })
  const save = () => {
    const patch: Record<string, unknown> = {}
    if (f.name.trim() !== account.name) patch.name = f.name.trim()
    for (const k of ['domain', 'website', 'industry', 'location', 'employee_range', 'email', 'phone', 'notes'] as const) {
      if (f[k].trim() !== (account[k] ?? '')) patch[k] = f[k].trim() || null
    }
    if (f.owner !== (account.owner_user_id === null ? '' : String(account.owner_user_id))) patch.owner_user_id = f.owner ? Number(f.owner) : null
    if (Object.keys(patch).length === 0) { onCancel(); return }
    onSave(patch)
  }
  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-2">
        <Input placeholder="Company name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input placeholder="Domain" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} />
        <Input placeholder="Website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
        <Input placeholder="Industry" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} />
        <Input placeholder="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        <Input placeholder="Company size (e.g. 51-200)" value={f.employee_range} onChange={(e) => setF({ ...f, employee_range: e.target.value })} />
        <Input placeholder="Company email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input placeholder="Company phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2" placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <select className={SELECT} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
          <option value="">No owner</option>
          {f.owner && !directory?.users.some((u) => String(u.id) === f.owner) && <option value={f.owner}>User #{f.owner}</option>}
          {directory?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={busy || !f.name.trim()} onClick={save}>Save details</Button>
      </div>
    </div>
  )
}

function ContactRow({ contact: c, busy, onSave, onDelete }: { contact: GtmContact; busy: boolean; onSave: (patch: ContactPatch) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState({ full_name: c.full_name, title: c.title ?? '', email: c.email ?? '', phone: c.phone ?? '', role: c.role_in_deal ?? '', status: c.status })
  const emailMasked = isMasked(c.email)
  const phoneMasked = isMasked(c.phone)

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
        <span><strong>{c.full_name}</strong>{c.title ? ` — ${c.title}` : ''}{c.email ? ` · ${c.email}` : ''}{c.role_in_deal ? ` · ${c.role_in_deal.replace('_', ' ')}` : ''}
          {c.status !== 'active' && <Badge variant="outline" className="ml-2 border-amber-400 text-amber-700">{c.status.replace(/_/g, ' ')}</Badge>}</span>
        <span className="flex shrink-0 gap-2">
          <button className="text-muted-foreground hover:text-primary" aria-label={`Edit ${c.full_name}`} disabled={busy} onClick={() => { setF({ full_name: c.full_name, title: c.title ?? '', email: c.email ?? '', phone: c.phone ?? '', role: c.role_in_deal ?? '', status: c.status }); setEditing(true) }}><Pencil className="size-4" /></button>
          <button className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${c.full_name}`} disabled={busy} onClick={onDelete}><Trash2 className="size-4" /></button>
        </span>
      </li>
    )
  }

  const save = () => {
    const patch: ContactPatch = {}
    if (f.full_name.trim() !== c.full_name) patch.full_name = f.full_name.trim()
    if (f.title.trim() !== (c.title ?? '')) patch.title = f.title.trim() || null
    if (!emailMasked && f.email.trim() !== (c.email ?? '')) patch.email = f.email.trim() || null
    if (!phoneMasked && f.phone.trim() !== (c.phone ?? '')) patch.phone = f.phone.trim() || null
    if (f.role !== (c.role_in_deal ?? '')) patch.role_in_deal = (f.role || null) as ContactPatch['role_in_deal']
    if (f.status !== c.status) patch.status = f.status
    if (Object.keys(patch).length === 0) { setEditing(false); return }
    onSave(patch)
    setEditing(false)
  }

  return (
    <li className="rounded-md border border-primary/40 p-3 text-sm">
      <div className="grid gap-2 md:grid-cols-3">
        <Input placeholder="Full name *" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <Input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Input placeholder="Email" value={f.email} disabled={emailMasked} title={emailMasked ? 'Hidden for your role; it cannot be edited here' : undefined} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input placeholder="Phone" value={f.phone} disabled={phoneMasked} title={phoneMasked ? 'Hidden for your role; it cannot be edited here' : undefined} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <select className={SELECT} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="">Role…</option>
          {CONTACT_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
        </select>
        <select className={SELECT} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as GtmContact['status'] })}>
          {CONTACT_STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      {f.status !== 'active' && <p className="mt-2 text-xs text-amber-700">With this status, no email can be written or sent to this contact.</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
        <Button size="sm" disabled={busy || !f.full_name.trim()} onClick={save}>Save contact</Button>
      </div>
    </li>
  )
}
