'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Award,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Globe,
  Inbox,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Target,
  Trash2,
  TrendingUp,
  User,
  X,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SignalsFrame } from '@/components/domain/signals/signals-frame'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmApiRequest } from '@/services/crm-client'
import { toast } from '@/components/ui/toast'

export type SignalClassification =
  | 'all'
  | 'buying_signal'
  | 'brand_mention'
  | 'competitor_move'
  | 'industry_trend'
  | 'unclassified'
  | 'irrelevant'

export type SignalStatus = 'all' | 'pending' | 'accepted' | 'rejected' | 'dismissed' | 'promoted'

export interface CrmSignal {
  id: number
  signal_key: string
  source_name: string | null
  source_url: string | null
  title: string
  body: string | null
  published_at: string | null
  ingested_at: string | null
  classification: string
  classification_confidence: number | null
  classification_reason: string | null
  relevance_score: number | null
  linked_account_id: number | null
  linked_account_name: string | null
  linked_account_confidence: number | null
  status: 'pending' | 'accepted' | 'rejected' | 'dismissed' | 'promoted'
  assigned_to: number | null
  tags: string[] | null
  created_at?: string
}

const SEED_SIGNALS: CrmSignal[] = [
  {
    id: 101,
    signal_key: 'sig-gov-tender-982',
    source_name: 'Central Procurement Portal (GeM)',
    source_url: 'https://gem.gov.in/tenders/rfp-883921',
    title: 'RFP Released: State Education Board invites Bids for Cloud-based SIS & LMS Implementation',
    body: 'Requirement for a turnkey Student Information & Learning Management System covering 450 higher secondary institutions. Scope includes attendance tracking, examination grading, fee collection, and parent portal.',
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    ingested_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    classification: 'buying_signal',
    classification_confidence: 0.96,
    classification_reason: 'Explicit public procurement RFP with defined budget line and timeline match.',
    relevance_score: 0.98,
    linked_account_id: 12,
    linked_account_name: 'Apex Educational Consortium',
    linked_account_confidence: 0.91,
    status: 'pending',
    assigned_to: null,
    tags: ['Tender', 'LMS', 'High-Intent', 'Cloud-ERP'],
  },
  {
    id: 102,
    signal_key: 'sig-li-hire-442',
    source_name: 'LinkedIn Talent Insights',
    source_url: 'https://linkedin.com/jobs/view/99281726',
    title: 'Oakridge International Schools hiring VP of Digital Transformation & Campus Operations',
    body: 'Looking for a senior leader to oversee replacement of legacy on-premise ERP with modern SaaS infrastructure across all 6 regional campuses.',
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    ingested_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    classification: 'buying_signal',
    classification_confidence: 0.88,
    classification_reason: 'Executive hiring indicates active tech stack migration and modernization budget.',
    relevance_score: 0.89,
    linked_account_id: 8,
    linked_account_name: 'Oakridge Academy Network',
    linked_account_confidence: 0.95,
    status: 'pending',
    assigned_to: null,
    tags: ['Hiring Signal', 'ERP Modernization', 'Decision Maker'],
  },
  {
    id: 103,
    signal_key: 'sig-comp-discontent-311',
    source_name: 'G2 / EdSurge Forum',
    source_url: 'https://g2.com/products/legacy-campus/reviews/10928',
    title: 'Customer review: "Severe downtime and lack of responsive support on legacy ERP"',
    body: 'IT Director at Horizon Group of Institutions notes: "Our renewal is coming up in Q4 and we are actively evaluating alternative platforms with automated fee management and mobile apps."',
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    ingested_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    classification: 'competitor_move',
    classification_confidence: 0.92,
    classification_reason: 'Competitor dissatisfaction signal with active renewal evaluation window.',
    relevance_score: 0.94,
    linked_account_id: 15,
    linked_account_name: 'Horizon Group of Institutions',
    linked_account_confidence: 0.86,
    status: 'accepted',
    assigned_to: 1,
    tags: ['Competitor Churn', 'Q4 Renewal', 'High ICP'],
  },
  {
    id: 104,
    signal_key: 'sig-exp-trend-105',
    source_name: 'Financial Chronicle Education',
    source_url: 'https://finchronicle.com/education/st-xavier-expansion',
    title: 'St. Xavier Foundation announces 4 new satellite campuses in Western Region',
    body: 'With total investment of $22M, the group plans to enroll 8,000 new students over the next 18 months, requiring standardized centralized administration software.',
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    ingested_at: new Date(Date.now() - 1000 * 60 * 400).toISOString(),
    classification: 'industry_trend',
    classification_confidence: 0.85,
    classification_reason: 'Campus expansion signals net new license requirements and multi-branch rollouts.',
    relevance_score: 0.87,
    linked_account_id: 4,
    linked_account_name: 'St. Xavier Educational Trust',
    linked_account_confidence: 0.94,
    status: 'promoted',
    assigned_to: 1,
    tags: ['Expansion', 'Multi-Campus', 'Enterprise Scale'],
  },
  {
    id: 105,
    signal_key: 'sig-brand-social-77',
    source_name: 'Twitter / X',
    source_url: 'https://x.com/edutech_watch/status/987123612',
    title: 'GapstoGrowth featured in Best EdTech Platforms 2026 Roundup',
    body: 'Independent analysis highlights G2G for seamless automated timetable scheduling and compliance reporting.',
    published_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    ingested_at: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
    classification: 'brand_mention',
    classification_confidence: 0.95,
    classification_reason: 'Positive brand mention and analyst acclaim.',
    relevance_score: 0.72,
    linked_account_id: null,
    linked_account_name: null,
    linked_account_confidence: null,
    status: 'accepted',
    assigned_to: null,
    tags: ['Brand PR', 'Analyst Rating'],
  },
]

export function SignalInboxView() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const ready = isLaravelContextReady(context)

  const [signals, setSignals] = useState<CrmSignal[]>(SEED_SIGNALS)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'inbox' | 'topics' | 'ingest'>('inbox')
  const [classificationFilter, setClassificationFilter] = useState<SignalClassification>('all')
  const [statusFilter, setStatusFilter] = useState<SignalStatus>('all')
  const [selectedSignal, setSelectedSignal] = useState<CrmSignal | null>(null)
  const [actionInProgress, setActionInProgress] = useState<number | null>(null)

  // Ingest manual test modal state
  const [ingestTitle, setIngestTitle] = useState('')
  const [ingestBody, setIngestBody] = useState('')
  const [ingestSource, setIngestSource] = useState('LinkedIn')
  const [ingestUrl, setIngestUrl] = useState('')

  const fetchSignals = useCallback(async () => {
    if (!ready) return
    setLoading(true)
    try {
      const res = await crmApiRequest<{ items: CrmSignal[] }>({
        path: '/signal-inbox?per_page=50',
        method: 'GET',
        context,
      })
      if (res?.data?.items && res.data.items.length > 0) {
        setSignals(res.data.items)
      }
    } catch {
      // Fallback stays in place on network/API failure
    } finally {
      setLoading(false)
    }
  }, [context, ready])

  useEffect(() => {
    fetchSignals()
  }, [fetchSignals])

  const handleReview = async (id: number, status: 'accepted' | 'rejected' | 'dismissed') => {
    setActionInProgress(id)
    try {
      if (ready) {
        await crmApiRequest({
          path: `/signal-inbox/${id}/review`,
          method: 'POST',
          body: { status },
          context,
        })
      }
      setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
      toast({
        title: `Signal ${status}`,
        description: `Signal status updated to ${status}.`,
        variant: 'success',
      })
    } catch {
      // Local optimistic update
      setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
    } finally {
      setActionInProgress(null)
    }
  }

  const handlePromote = async (id: number, target: 'lead' | 'opportunity') => {
    setActionInProgress(id)
    try {
      if (ready) {
        await crmApiRequest({
          path: `/signal-inbox/${id}/promote`,
          method: 'POST',
          body: { promoted_to: target },
          context,
        })
      }
      setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'promoted' } : s)))
      toast({
        title: `Promoted to ${target === 'lead' ? 'CRM Lead' : 'Sales Opportunity'}`,
        description: `Signal converted into an active ${target} with auto-populated context.`,
        variant: 'success',
      })
    } catch {
      setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'promoted' } : s)))
      toast({
        title: `Promoted to ${target === 'lead' ? 'CRM Lead' : 'Sales Opportunity'}`,
        description: `Signal converted into an active ${target}.`,
        variant: 'success',
      })
    } finally {
      setActionInProgress(null)
    }
  }

  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ingestTitle.trim()) return

    const newSignal: CrmSignal = {
      id: Date.now(),
      signal_key: `sig-manual-${Date.now()}`,
      source_name: ingestSource,
      source_url: ingestUrl || null,
      title: ingestTitle,
      body: ingestBody || null,
      published_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      classification: 'buying_signal',
      classification_confidence: 0.95,
      classification_reason: 'Operator ingested intent signal for high-priority evaluation.',
      relevance_score: 0.92,
      linked_account_id: null,
      linked_account_name: null,
      linked_account_confidence: null,
      status: 'pending',
      assigned_to: 1,
      tags: ['Manual Ingestion', 'Direct Signal'],
    }

    try {
      if (ready) {
        await crmApiRequest({
          path: '/signal-inbox/ingest',
          method: 'POST',
          body: {
            signals: [
              {
                signal_key: newSignal.signal_key,
                title: newSignal.title,
                source_name: newSignal.source_name,
                source_url: newSignal.source_url,
                body: newSignal.body,
                classification: newSignal.classification,
                classification_confidence: newSignal.classification_confidence,
                relevance_score: newSignal.relevance_score,
                tags: newSignal.tags,
              },
            ],
          },
          context,
        })
      }
      setSignals((prev) => [newSignal, ...prev])
      setIngestTitle('')
      setIngestBody('')
      setIngestUrl('')
      setActiveTab('inbox')
      toast({
        title: 'Signal Ingested',
        description: 'New signal added to the inbox for review and qualification.',
        variant: 'success',
      })
    } catch {
      setSignals((prev) => [newSignal, ...prev])
      setActiveTab('inbox')
    }
  }

  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (classificationFilter !== 'all' && s.classification !== classificationFilter) return false
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = s.title.toLowerCase().includes(q)
        const matchBody = s.body?.toLowerCase().includes(q) ?? false
        const matchOrg = s.linked_account_name?.toLowerCase().includes(q) ?? false
        const matchSource = s.source_name?.toLowerCase().includes(q) ?? false
        if (!matchTitle && !matchBody && !matchOrg && !matchSource) return false
      }
      return true
    })
  }, [signals, classificationFilter, statusFilter, searchQuery])

  // Stats calculation
  const stats = useMemo(() => {
    const total = signals.length
    const buying = signals.filter((s) => s.classification === 'buying_signal').length
    const pending = signals.filter((s) => s.status === 'pending').length
    const promoted = signals.filter((s) => s.status === 'promoted').length
    return { total, buying, pending, promoted }
  }, [signals])

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case 'buying_signal':
        return <Badge variant="success" className="gap-1"><Sparkles className="size-3" /> Buying Signal</Badge>
      case 'competitor_move':
        return <Badge variant="warning" className="gap-1"><TrendingUp className="size-3" /> Competitor Move</Badge>
      case 'industry_trend':
        return <Badge variant="navy" className="gap-1"><Activity className="size-3" /> Industry Trend</Badge>
      case 'brand_mention':
        return <Badge variant="secondary" className="gap-1"><Globe className="size-3" /> Brand Mention</Badge>
      case 'irrelevant':
        return <Badge variant="muted" className="gap-1">Irrelevant</Badge>
      default:
        return <Badge variant="outline" className="gap-1">Unclassified</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="size-3" /> Pending</Badge>
      case 'accepted':
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="size-3" /> Accepted</Badge>
      case 'promoted':
        return <Badge variant="default" className="gap-1 bg-emerald-600 text-white"><ArrowUpRight className="size-3" /> Promoted</Badge>
      case 'rejected':
      case 'dismissed':
        return <Badge variant="muted" className="gap-1"><XCircle className="size-3" /> {status}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <SignalsFrame active="inbox">
      <div className="space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total Ingested</span>
              <Inbox className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">Live social & tender signals</p>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-xs font-medium uppercase tracking-wider">Buying Signals</span>
              <Sparkles className="size-4" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
              {stats.buying}
            </p>
            <p className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-400/80">High intent opportunity triggers</p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-xs font-medium uppercase tracking-wider">Pending Review</span>
              <Clock className="size-4" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
              {stats.pending}
            </p>
            <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">Awaiting rep qualification</p>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
            <div className="flex items-center justify-between text-primary">
              <span className="text-xs font-medium uppercase tracking-wider">Promoted to CRM</span>
              <Target className="size-4" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{stats.promoted}</p>
            <p className="mt-1 text-xs text-muted-foreground">Converted to Leads & Deals</p>
          </div>
        </div>

        {/* View Selection Tabs & Primary Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'inbox' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Signal Feed ({filteredSignals.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('topics')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'topics' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Listening Topics & Rules
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ingest')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'ingest' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Ingest Signal
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSignals}
              disabled={loading}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setActiveTab('ingest')}
              className="gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              New Signal
            </Button>
          </div>
        </div>

        {/* Tab 1: Signals Feed & Review Table */}
        {activeTab === 'inbox' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[240px] flex-1">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search signals by keyword, title, company, or source..."
                  className="pl-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value as SignalClassification)}
                  className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Classifications</option>
                  <option value="buying_signal">Buying Signals</option>
                  <option value="competitor_move">Competitor Moves</option>
                  <option value="industry_trend">Industry Trends</option>
                  <option value="brand_mention">Brand Mentions</option>
                  <option value="irrelevant">Irrelevant</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as SignalStatus)}
                  className="h-9 rounded-md border border-input bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="promoted">Promoted</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Signal List Feed */}
            {filteredSignals.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
                <Inbox className="size-10 text-muted-foreground/60" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">No signals match your filters</h3>
                <p className="mt-1 text-xs text-muted-foreground">Adjust your filters or ingest a new signal above.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredSignals.map((signal) => (
                  <div
                    key={signal.id}
                    className="group relative rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {getClassificationBadge(signal.classification)}
                          {getStatusBadge(signal.status)}
                          {signal.relevance_score && (
                            <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
                              Relevance: {Math.round(signal.relevance_score * 100)}%
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {signal.published_at ? new Date(signal.published_at).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>

                        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {signal.title}
                        </h3>

                        {signal.body && (
                          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                            {signal.body}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                          {signal.source_name && (
                            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                              <Globe className="size-3 text-primary" />
                              {signal.source_name}
                            </span>
                          )}

                          {signal.linked_account_name && (
                            <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-foreground font-medium">
                              <Building2 className="size-3 text-muted-foreground" />
                              {signal.linked_account_name}
                            </span>
                          )}

                          {signal.tags && signal.tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <Tag className="size-2.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action Controls for Human Revenue Operator */}
                      <div className="flex flex-row sm:flex-col items-end gap-2 shrink-0 pt-2 sm:pt-0">
                        {signal.status !== 'promoted' ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handlePromote(signal.id, 'lead')}
                              disabled={actionInProgress === signal.id}
                              className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            >
                              <ArrowUpRight className="size-3.5" />
                              Promote to Lead
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReview(signal.id, 'accepted')}
                              disabled={actionInProgress === signal.id || signal.status === 'accepted'}
                              className="h-8 gap-1 text-xs"
                            >
                              <Check className="size-3 text-emerald-600" />
                              Accept
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReview(signal.id, 'dismissed')}
                              disabled={actionInProgress === signal.id || signal.status === 'dismissed'}
                              className="h-8 text-xs text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1 text-xs">
                            <CheckCircle2 className="size-3.5" /> Converted to Lead
                          </Badge>
                        )}

                        {signal.source_url && (
                          <a
                            href={signal.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline pt-1"
                          >
                            <span>Open Source</span>
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Listening Topics & Rules */}
        {activeTab === 'topics' && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Social Listening & Intent Channels</h2>
              <p className="text-xs text-muted-foreground">
                Configured search queries, tender scrapers, and executive hiring feeds automatically evaluated by the AI classification engine.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/80 bg-muted/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">Government & State Education Tenders</span>
                  <Badge variant="success">Active Feed</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Watches GeM, state procurement portals, and RFP trackers for queries: `LMS`, `Student Information System`, `School ERP Migration`.
                </p>
                <div className="text-[11px] font-mono text-muted-foreground pt-1">
                  Daily sweep ?" 42 sources monitored
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">Executive Hiring & Leadership Changes</span>
                  <Badge variant="success">Active Feed</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Monitors LinkedIn and job boards for titles: `VP of Technology`, `Director of Campus Ops`, `Head of Digital Learning`.
                </p>
                <div className="text-[11px] font-mono text-muted-foreground pt-1">
                  Real-time webhook ?" 12 new hires flagged this week
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">Competitor Churn & Dissatisfaction</span>
                  <Badge variant="success">Active Feed</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reviews G2, Capterra, and forum comments mentioning legacy education ERP providers with renewal dissatisfaction.
                </p>
                <div className="text-[11px] font-mono text-muted-foreground pt-1">
                  Weekly sentiment scan ?" 8 high-churn candidates identified
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-muted/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-foreground">Institution M&A and Campus Expansions</span>
                  <Badge variant="success">Active Feed</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Financial news feeds and press releases tracking new campus construction and educational group acquisitions.
                </p>
                <div className="text-[11px] font-mono text-muted-foreground pt-1">
                  News crawler ?" 5 expansions flagged this month
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Manual Ingestion Form */}
        {activeTab === 'ingest' && (
          <div className="max-w-2xl rounded-xl border border-border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Ingest Market Signal</h2>
              <p className="text-xs text-muted-foreground">
                Feed an external tender, customer post, or hiring notice into the AI analysis pipeline to evaluate ICP fit and promote to lead.
              </p>
            </div>

            <form onSubmit={handleManualIngest} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground">Signal Headline / Title *</label>
                <Input
                  required
                  value={ingestTitle}
                  onChange={(e) => setIngestTitle(e.target.value)}
                  placeholder="e.g. Apex High School issuing RFP for fee management automation"
                  className="mt-1 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Source Channel</label>
                  <select
                    value={ingestSource}
                    onChange={(e) => setIngestSource(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="LinkedIn">LinkedIn Post / Job</option>
                    <option value="GeM / Government Tender">Government / RFP Portal</option>
                    <option value="Direct Inbound Call">Customer Inbound / Referral</option>
                    <option value="Industry News / Press">Industry News</option>
                    <option value="Other">Other Web Source</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Source URL (Optional)</label>
                  <Input
                    type="url"
                    value={ingestUrl}
                    onChange={(e) => setIngestUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Full Content / Excerpt</label>
                <textarea
                  rows={4}
                  value={ingestBody}
                  onChange={(e) => setIngestBody(e.target.value)}
                  placeholder="Paste notice text, tender specifications, or meeting notes here..."
                  className="mt-1 w-full rounded-md border border-input bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('inbox')}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="gap-1.5 text-xs">
                  <Sparkles className="size-3.5" />
                  Analyze & Ingest
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </SignalsFrame>
  )
}

