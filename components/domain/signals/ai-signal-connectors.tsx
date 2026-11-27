'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BrainCircuit, Bot, ChevronDown, Copy, Gem, KeyRound, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiErrorText } from '@/lib/api-messages'
import {
  aiSignalsService,
  type AiDeliverySummary,
  type AiProviderKey,
  type AiSignalSlot,
  type AiSignalsApi,
  type AiSignalsOverview,
  type AiSlotState,
} from '@/services/signals/ai-signals'

const ICONS: Record<AiProviderKey, typeof Sparkles> = { claude: Sparkles, gpt: Bot, deepseek: BrainCircuit, gemini: Gem }

const STATE_TONE: Record<AiSlotState, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  waiting: 'border-border bg-muted text-muted-foreground',
  pending: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  syncing: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  off: 'border-border bg-muted text-muted-foreground',
  no_secret: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  not_configured: 'border-border bg-muted text-muted-foreground',
}

const DELIVERY_TONE: Record<AiDeliverySummary['status'], string> = {
  imported: 'text-emerald-700 dark:text-emerald-300', partial: 'text-amber-700 dark:text-amber-300', failed: 'text-destructive',
  received: 'text-blue-700 dark:text-blue-300', importing: 'text-blue-700 dark:text-blue-300',
}

const POLL_MS = 3000
/** An action that the server has not answered in this long is stopped ON SCREEN (the request may still finish), so a hung request can never lock the buttons for good. */
const REQUEST_TIMEOUT_MS = 45000
const MAX_POLLS = 60

/** "27 Nov, 10:02" in the person's own timezone, or "Never". */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Never'
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-background px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${tone ?? 'text-foreground'}`}>{value}</p>
    </div>
  )
}

/**
 * Claude, ChatGPT / GPT, DeepSeek and Gemini as sources in Signals > Ingestion Engine > Connectors. The organisation's own scheduled tasks deliver their
 * finished signals; this screen shows what arrived and imports it (Sync, Sync All). It never runs a model. The delivery secret is held in memory only
 * until the person dismisses it, and is never written anywhere else.
 */
export function AiSignalConnectors({ service = aiSignalsService, productKey, onSyncCompleted, pollMs = POLL_MS, timeoutMs = REQUEST_TIMEOUT_MS }: {
  service?: AiSignalsApi
  productKey?: string | null
  onSyncCompleted?: () => void
  /** How often to look again while an import runs (tests use a short one). */
  pollMs?: number
  /** How long to wait for an answer before giving up on screen (tests use a short one). */
  timeoutMs?: number
}) {
  const [overview, setOverview] = useState<AiSignalsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // The actions in flight, as `action:provider`. One card's request never locks another card's buttons.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [open, setOpen] = useState<AiProviderKey | null>(null)
  const [secret, setSecret] = useState<{ provider: AiProviderKey; value: string } | null>(null)
  const [pasteFor, setPasteFor] = useState<Record<string, string>>({})
  const polls = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasSyncing = useRef(false)

  // `keepError`: refresh the cards after an action failed without wiping the reason that action just gave.
  const load = useCallback(async (keepError = false) => {
    try {
      const res = await service.list()
      setOverview(res)
      if (!keepError) setError(null)
      return res
    } catch (e) {
      setError(apiErrorText(e, 'Could not load the AI signal sources.'))
      return null
    }
  }, [service])

  // While an import runs, look again every few seconds until it ends; tell the signals list when it has.
  const watch = useCallback((res: AiSignalsOverview | null) => {
    if (timer.current) clearTimeout(timer.current)
    const syncing = Boolean(res?.data.some((s) => s.state === 'syncing'))
    if (syncing) wasSyncing.current = true
    if (syncing && polls.current < MAX_POLLS) {
      polls.current += 1
      timer.current = setTimeout(async () => watch(await load()), pollMs)
    } else if (!syncing && wasSyncing.current) {
      wasSyncing.current = false
      polls.current = 0
      onSyncCompleted?.()
    }
  }, [load, onSyncCompleted, pollMs])

  useEffect(() => {
    let live = true
    void load().then((res) => { if (live) watch(res) })
    return () => { live = false; if (timer.current) clearTimeout(timer.current) }
  }, [load, watch])

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(key))
    setError(null)
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`The server did not answer within ${Math.round(timeoutMs / 1000)} seconds, so this was stopped on screen. It may still have finished: the card shows its real state after a refresh, and "Create a new secret" gives a fresh secret if one was lost.`)), timeoutMs)
        }),
      ])
    } catch (e) {
      setError(apiErrorText(e, 'That did not work.'))
      void load(true)   // show what the server really holds, keeping this message
    } finally {
      if (timer) clearTimeout(timer)
      setBusy((b) => { const next = new Set(b); next.delete(key); return next })
    }
  }

  const isBusy = (provider: AiProviderKey) => [...busy].some((k) => k.endsWith(`:${provider}`))
  const anyBusy = busy.size > 0

  const refreshAndWatch = async () => { polls.current = 0; watch(await load()) }

  const setUp = (s: AiSignalSlot) => run(`setup:${s.provider}`, async () => {
    const res = await service.enable(s.provider, productKey)
    if (res.secret) setSecret({ provider: s.provider, value: res.secret })
    setOpen(s.provider)
    setNotice(res.secret ? `${s.label} is set up. Copy the secret now: it is shown only once.` : `${s.label} is switched on.`)
    await load()
  })

  const rotate = (s: AiSignalSlot) => run(`rotate:${s.provider}`, async () => {
    if (typeof window !== 'undefined' && !window.confirm(`Create a new secret for ${s.label}? The current one stops working immediately, so update your scheduled task.`)) return
    const res = await service.rotate(s.provider)
    if (res.secret) setSecret({ provider: s.provider, value: res.secret })
    setNotice('A new secret was created. Copy it now: it is shown only once.')
    await load()
  })

  const toggle = (s: AiSignalSlot) => run(`toggle:${s.provider}`, async () => {
    await service.toggle(s.provider, !s.enabled)
    await load()
  })

  const sync = (s: AiSignalSlot) => run(`sync:${s.provider}`, async () => {
    const res = await service.sync(s.provider)
    setNotice(res.message)
    await refreshAndWatch()
  })

  const syncAll = () => run('sync-all', async () => {
    const res = await service.syncAll()
    setNotice(res.message)
    await refreshAndWatch()
  })

  const submit = (s: AiSignalSlot) => run(`paste:${s.provider}`, async () => {
    const res = await service.submit(s.provider, pasteFor[s.provider] ?? '')
    setNotice(res.message)
    setPasteFor((p) => ({ ...p, [s.provider]: '' }))
    await refreshAndWatch()
  })

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setNotice(`${what} copied.`)
    } catch {
      setNotice(`Select and copy the ${what.toLowerCase()} by hand.`)
    }
  }

  const slots = overview?.data ?? []
  const anyOn = slots.some((s) => s.enabled && s.configured)

  return (
    <section aria-label="AI signal sources" className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm" data-testid="ai-signal-sources">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">AI signal sources</h2>
          <p className="text-xs text-muted-foreground">
            Your scheduled tasks in Claude, ChatGPT, DeepSeek and Gemini deliver their finished signals here. G2G imports them and checks them with its usual quality rules. It never runs these models again.
          </p>
        </div>
        <Button type="button" size="sm" onClick={syncAll} disabled={!anyOn || anyBusy} data-testid="sync-all-ai" className="gap-1.5">
          <RefreshCw className={`size-3.5 ${busy.has('sync-all') ? 'animate-spin' : ''}`} aria-hidden="true" />
          Sync All AI Signals
        </Button>
      </div>

      {overview && !overview.tables_migrated && (
        <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">{overview.notice}</p>
      )}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive" data-testid="ai-error">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground" data-testid="ai-notice">{notice}</p>}

      {secret && (
        <div role="alert" className="space-y-2 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-3" data-testid="ai-secret">
          <p className="text-xs font-semibold text-foreground">Delivery secret for {slots.find((s) => s.provider === secret.provider)?.label ?? secret.provider}: copy it now. It is shown only once and cannot be shown again.</p>
          <code className="block break-all rounded-md bg-background px-2 py-1.5 text-xs">{secret.value}</code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => copy(secret.value, 'Secret')}><Copy className="size-3.5" aria-hidden="true" />Copy secret</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSecret(null)}>I have saved it</Button>
          </div>
        </div>
      )}

      {!overview && !error && <p className="text-xs text-muted-foreground">Loading…</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        {slots.map((s) => {
          const Icon = ICONS[s.provider] ?? Sparkles
          const expanded = open === s.provider
          const t = s.totals
          return (
            <article key={s.provider} className="space-y-3 rounded-xl border border-border bg-background p-3" data-testid={`ai-card-${s.provider}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                  <h3 className="truncate text-sm font-semibold text-foreground">{s.label}</h3>
                </div>
                <Badge variant="outline" className={`px-2 py-0.5 text-[10px] ${STATE_TONE[s.state]}`} data-testid={`ai-state-${s.provider}`}>{s.state_label}</Badge>
              </div>

              {s.configured ? (
                <>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-[11px] sm:grid-cols-2">
                    <div className="flex gap-1.5"><dt className="text-muted-foreground">Last received</dt><dd className="font-medium text-foreground" data-testid={`ai-received-${s.provider}`}>{formatWhen(s.last_received_at)}</dd></div>
                    <div className="flex gap-1.5"><dt className="text-muted-foreground">Last sync</dt><dd className="font-medium text-foreground" data-testid={`ai-synced-${s.provider}`}>{formatWhen(s.last_sync_at)}{s.last_sync_status ? ` · ${s.last_sync_status}` : ''}</dd></div>
                  </dl>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Imported" value={t.imported + t.updated} tone="text-emerald-700 dark:text-emerald-300" />
                    <Stat label="Duplicates" value={t.duplicate} />
                    <Stat label="Failed" value={t.failed + t.failed_deliveries} tone={t.failed + t.failed_deliveries > 0 ? 'text-destructive' : undefined} />
                    <Stat label="Waiting" value={t.waiting} tone={t.waiting > 0 ? 'text-blue-700 dark:text-blue-300' : undefined} />
                  </div>
                  {s.last_sync_message && <p className="text-[11px] text-muted-foreground" data-testid={`ai-message-${s.provider}`}>{s.last_sync_message}</p>}
                  {s.worker_hint && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-200" data-testid={`ai-worker-hint-${s.provider}`}>{s.worker_hint}</p>}
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">Not set up. Set it up to get a delivery address and a secret for your scheduled task.</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {!s.configured && (
                  <Button type="button" size="sm" onClick={() => setUp(s)} disabled={isBusy(s.provider)} data-testid={`ai-setup-${s.provider}`} className="gap-1.5">
                    <KeyRound className="size-3.5" aria-hidden="true" />Set up
                  </Button>
                )}
                {s.configured && (
                  <>
                    <Button type="button" size="sm" onClick={() => sync(s)} disabled={!s.enabled || isBusy(s.provider) || s.state === 'syncing'} data-testid={`ai-sync-${s.provider}`} className="gap-1.5">
                      <RefreshCw className={`size-3.5 ${busy.has(`sync:${s.provider}`) || s.state === 'syncing' ? 'animate-spin' : ''}`} aria-hidden="true" />Sync
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setOpen(expanded ? null : s.provider)} aria-expanded={expanded} data-testid={`ai-details-${s.provider}`} className="gap-1.5">
                      Delivery details<ChevronDown className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => toggle(s)} disabled={isBusy(s.provider)} data-testid={`ai-toggle-${s.provider}`}>{s.enabled ? 'Switch off' : 'Switch on'}</Button>
                  </>
                )}
              </div>

              {expanded && s.configured && (
                <div className="space-y-3 border-t border-border/60 pt-3 text-xs" data-testid={`ai-panel-${s.provider}`}>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Where your scheduled task sends its output</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1" data-testid={`ai-url-${s.provider}`}>POST {s.delivery_url}</code>
                      <Button type="button" size="sm" variant="outline" onClick={() => copy(s.delivery_url, 'Address')} className="gap-1.5"><Copy className="size-3.5" aria-hidden="true" />Copy</Button>
                    </div>
                    <p className="text-muted-foreground">Send the header <code>Authorization: Bearer &lt;secret&gt;</code> and the signals as JSON. Secret ends <code>{s.token_hint ?? '…'}</code>. The full format and a ready-made instruction are in docs/signals-ai-delivery.md.</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => rotate(s)} disabled={isBusy(s.provider)} data-testid={`ai-rotate-${s.provider}`} className="gap-1.5"><KeyRound className="size-3.5" aria-hidden="true" />Create a new secret</Button>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={`paste-${s.provider}`} className="font-medium text-foreground">Or paste an output</label>
                    <p className="text-muted-foreground">For a task that cannot deliver by itself: paste the JSON it produced. It is checked and imported exactly like a delivery.</p>
                    <textarea
                      id={`paste-${s.provider}`}
                      rows={4}
                      value={pasteFor[s.provider] ?? ''}
                      onChange={(e) => setPasteFor((p) => ({ ...p, [s.provider]: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder='{"signals": [ ... ]}'
                      data-testid={`ai-paste-${s.provider}`}
                    />
                    <Button type="button" size="sm" onClick={() => submit(s)} disabled={isBusy(s.provider) || !(pasteFor[s.provider] ?? '').trim()} data-testid={`ai-paste-send-${s.provider}`}>Import pasted output</Button>
                  </div>

                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Recent deliveries</p>
                    {s.recent.length === 0 ? (
                      <p className="text-muted-foreground">Nothing has been delivered yet.</p>
                    ) : (
                      <ul className="space-y-1" data-testid={`ai-recent-${s.provider}`}>
                        {s.recent.map((d) => (
                          <li key={d.id} className="rounded-md border border-border/60 px-2 py-1.5" data-testid={`ai-delivery-${d.id}`}>
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className={`font-semibold capitalize ${DELIVERY_TONE[d.status]}`}>{d.status}</span>
                              <span className="text-muted-foreground">{formatWhen(d.received_at)}{d.via === 'manual' ? ' · pasted' : ''}</span>
                            </div>
                            <p className="text-muted-foreground" data-testid={`ai-delivery-counts-${d.id}`}>
                              {d.records} signal(s): {d.imported} new, {d.updated} updated, {d.duplicate} duplicate, {d.failed} rejected, {d.pending} pending
                            </p>
                            {d.message && <p className={d.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>{d.message}</p>}
                            {d.rejections.length > 0 && (
                              <ul className="mt-1 space-y-1 border-t border-border/50 pt-1" data-testid={`ai-rejections-${d.id}`}>
                                {d.rejections.map((r, i) => (
                                  <li key={`${r.index ?? i}-${r.reason_code ?? ''}`} className="text-[11px]">
                                    <p className="font-medium text-destructive">{r.label ?? `Signal ${(r.index ?? i) + 1}`}: {r.reason ?? 'Rejected by the quality checks.'}</p>
                                    {r.hint && <p className="text-muted-foreground">How to fix: {r.hint}</p>}
                                  </li>
                                ))}
                                {d.rejections_more > 0 && <li className="text-[11px] text-muted-foreground">…and {d.rejections_more} more rejected.</li>}
                              </ul>
                            )}
                            {d.look_alikes.length > 0 && (
                              <ul className="mt-1 space-y-0.5 border-t border-border/50 pt-1" data-testid={`ai-lookalikes-${d.id}`}>
                                {d.look_alikes.map((l, i) => (
                                  <li key={`${l.index ?? i}-${l.id ?? ''}`} className="text-[11px] text-amber-700 dark:text-amber-300">
                                    Possible same organisation, not merged: &ldquo;{l.label}&rdquo; looks like &ldquo;{l.name}&rdquo;{l.similarity ? ` (${l.similarity}% similar)` : ''}.
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
