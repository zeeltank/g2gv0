'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity, AlertCircle, BookOpen, Building2, ChevronDown, ChevronRight,
  ExternalLink, Globe, Link2, Loader2, Mail, Phone, Radio, Shield,
  ShieldCheck, Target, Users, Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LaravelContext } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { Account360, EntityRelationship, KnowledgeSource } from '@/types/crm'

interface Props {
  organizationId: string
  context: LaravelContext
}

function Section({ title, icon: Icon, count, children, defaultOpen = true }: {
  title: string
  icon: typeof Users
  count?: number
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          {title}
          {count !== undefined && (
            <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
          )}
        </span>
        {open
          ? <ChevronDown className="size-4 text-muted-foreground" />
          : <ChevronRight className="size-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border px-4 pb-4 pt-3">{children}</div>}
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{message}</p>
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  buying_signal: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  brand_mention: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  competitor_move: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  industry_trend: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  irrelevant: 'bg-muted text-muted-foreground',
  unclassified: 'bg-muted text-muted-foreground',
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>
  const pct = Math.round(value * 100)
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <span
          className={cn('block h-full rounded-full', pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400')}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </span>
  )
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 rounded-lg bg-muted" />
      ))}
    </div>
  )
}

const SOURCE_TYPE_ICONS: Record<string, typeof BookOpen> = {
  web_scrape: Globe,
  linkedin: Link2,
  news: Radio,
  document: BookOpen,
  manual: Target,
  api: Zap,
}

export function Account360({ organizationId, context }: Props) {
  const [data, setData] = useState<Account360 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await crmService.getAccount360(context, organizationId)
      setData(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Account 360.')
    } finally {
      setLoading(false)
    }
  }, [context, organizationId])

  useEffect(() => { void load() }, [load])

  if (loading) return <Skeleton />

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        {error}
        <Button variant="ghost" size="sm" onClick={() => void load()} className="ml-auto">Retry</Button>
      </div>
    )
  }

  if (!data) return null

  const org = data.organization
  const openOpportunities = data.opportunities.filter((o) => !['Closed Won', 'Closed Lost'].includes(o.salesStage ?? ''))

  return (
    <div className="space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Contacts', value: data.contacts.length, icon: Users },
          { label: 'Opportunities', value: data.opportunities.length, icon: Target },
          { label: 'Signals', value: data.signals.length, icon: Activity },
          { label: 'Campaigns', value: data.campaigns.length, icon: Radio },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <Icon className="size-5 text-muted-foreground" />
            <div>
              <p className="text-lg font-semibold text-foreground leading-none">{value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Signals */}
      <Section title="Recent Signals" icon={Activity} count={data.signals.length} defaultOpen={data.signals.length > 0}>
        {data.signals.length === 0
          ? <Empty message="No signals linked to this account." />
          : (
            <ul className="divide-y divide-border">
              {data.signals.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.sourceName ?? '—'} · {s.publishedAt ? new Date(s.publishedAt).toLocaleDateString() : '—'}</p>
                  </div>
                  <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-xs font-medium', CLASSIFICATION_COLORS[s.classification] ?? CLASSIFICATION_COLORS.unclassified)}>
                    {s.classification.replace(/_/g, ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
      </Section>

      {/* Contacts */}
      <Section title="Contacts" icon={Users} count={data.contacts.length}>
        {data.contacts.length === 0
          ? <Empty message="No contacts linked to this organization." />
          : (
            <ul className="divide-y divide-border">
              {data.contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{c.firstName} {c.lastName}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.title ?? ''}{c.title && c.email ? ' · ' : ''}{c.email ?? ''}</p>
                  </div>
                  {c.consentStatus && (
                    <span className={cn('shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
                      c.consentStatus === 'opted_in' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      c.consentStatus === 'opted_out' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-muted text-muted-foreground'
                    )}>
                      <ShieldCheck className="size-3" />
                      {c.consentStatus.replace(/_/g, ' ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
      </Section>

      {/* Open Opportunities */}
      <Section title="Open Opportunities" icon={Target} count={openOpportunities.length}>
        {openOpportunities.length === 0
          ? <Empty message="No open opportunities for this account." />
          : (
            <ul className="divide-y divide-border">
              {openOpportunities.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{o.opportunityName}</p>
                    <p className="text-xs text-muted-foreground">Close: {o.closeDate ?? '—'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {o.amount != null && (
                      <span className="text-sm font-semibold text-foreground">{o.currency ?? ''} {Number(o.amount).toLocaleString()}</span>
                    )}
                    <Badge variant="outline" className="text-xs">{o.salesStage ?? 'Unknown'}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </Section>

      {/* Recent Campaigns */}
      <Section title="Recent Campaigns" icon={Radio} count={data.campaigns.length} defaultOpen={false}>
        {data.campaigns.length === 0
          ? <Empty message="This account hasn't been targeted in any campaign." />
          : (
            <ul className="divide-y divide-border">
              {data.campaigns.map((c) => (
                <li key={c.campaignId} className="flex items-center justify-between gap-3 py-2.5">
                  <p className="min-w-0 truncate text-sm text-foreground">{c.campaignName}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{c.responseStatus}</Badge>
                    {c.sentAt && <span className="text-xs text-muted-foreground">{new Date(c.sentAt).toLocaleDateString()}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
      </Section>

      {/* Knowledge Sources */}
      <Section title="Knowledge Sources" icon={BookOpen} count={data.knowledgeSources.length} defaultOpen={false}>
        {data.knowledgeSources.length === 0
          ? <Empty message="No knowledge sources recorded for this account." />
          : (
            <ul className="divide-y divide-border">
              {data.knowledgeSources.map((k) => {
                const SourceIcon = SOURCE_TYPE_ICONS[k.sourceType] ?? BookOpen
                return (
                  <li key={k.id} className="flex items-start gap-3 py-2.5">
                    <SourceIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{k.title ?? k.sourceType}</p>
                        {k.verified && (
                          <span className="flex items-center gap-0.5 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <ShieldCheck className="size-3" /> Verified
                          </span>
                        )}
                      </div>
                      {k.url && (
                        <a href={k.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-xs text-primary hover:underline">
                          <ExternalLink className="size-3" />
                          {k.url.length > 60 ? `${k.url.slice(0, 60)}…` : k.url}
                        </a>
                      )}
                      <div className="mt-1 flex items-center gap-3">
                        <ConfidenceBar value={k.confidence} />
                        {k.collectedAt && <span className="text-xs text-muted-foreground">{new Date(k.collectedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
      </Section>

      {/* Entity Relationships */}
      <Section title="Relationships" icon={Link2} count={data.relationships.length} defaultOpen={false}>
        {data.relationships.length === 0
          ? <Empty message="No explicit relationships recorded." />
          : (
            <ul className="divide-y divide-border">
              {data.relationships.map((r: EntityRelationship) => {
                const isFrom = r.fromType === 'organization'
                const connType = isFrom ? r.toType : r.fromType
                const connId = isFrom ? r.toId : r.fromId
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{r.relationshipType.replace(/_/g, ' ')}</span>
                        {' '}→{' '}
                        <span className="text-muted-foreground">{connType} #{connId}</span>
                      </p>
                      {r.source && <p className="text-xs text-muted-foreground">Source: {r.source}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ConfidenceBar value={r.confidence} />
                      {r.verified && <ShieldCheck className="size-4 text-green-500" title="Verified" />}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
      </Section>
    </div>
  )
}
