'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ChevronDown,
  ExternalLink,
  Info,
  AlertTriangle,
  Search,
  Globe,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { LaravelContext } from '@/lib/laravel-context'
import {
  opportunitiesService,
  type ResearchRun,
  type ResearchSourceInfo,
  type RunSourcesResponse,
} from '@/services/signals/opportunities'
import type { GenerateNotice } from '@/components/domain/signals/use-generate-signals'

const NOTICE_TONES = {
  info: 'bg-muted/70 border border-border/40 text-foreground',
  success: 'bg-emerald-500/10 border border-emerald-500/20 text-foreground',
  warning: 'bg-amber-500/10 border border-amber-500/20 text-foreground',
  error: 'bg-destructive/10 border border-destructive/20 text-foreground',
} as const

// Standard factual descriptions for known zero-reason codes
const REASON_EXPLANATIONS: Record<string, string> = {
  no_candidate_proposed:
    'Pages were fetched and analyzed, but the content did not show an active institutional buying trigger, new tender, expansion project, or immediate software requirement.',
  results_too_old:
    'Discovered announcements, articles, or postings had verified publication dates older than the active recency freshness window.',
  pages_unreadable:
    'Page content could not be retrieved in full due to login gates, anti-bot controls (robots.txt), or remote connection errors. Stored as snippet only.',
  source_off_topic:
    'Discovered web pages were not related to target educational institutions, school systems, or the configured geographic region.',
  source_prompt_injection:
    'Pages contained suspicious adversarial AI instructions or unverified web text and were withheld from the analysis prompt.',
  rejected_by_gate:
    'Signal candidates drafted by AI failed evidence verification checks (missing verbatim quote or unverified entity attribution).',
  duplicate_of_existing:
    'Signals discovered in this run matched opportunities already present in your active pipeline and remained unchanged.',
  no_search_results:
    'Search provider returned 0 results for the planned discovery queries in this geography.',
  all_searches_failed:
    'Search provider queries failed to reach endpoint (quota or API network timeout).',
}

export function ExpandableRunNotice({
  notice,
  run,
  context,
  className,
}: {
  notice: GenerateNotice
  run?: ResearchRun | null
  context: LaravelContext
  className?: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sourcesData, setSourcesData] = useState<RunSourcesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'read' | 'snippet' | 'qualified'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const tone = notice.tone === 'success' ? 'info' : notice.tone
  const runId = run?.id ?? notice.runId ?? notice.run?.id ?? null
  const effectiveRun = run ?? notice.run ?? sourcesData?.run ?? null

  const loadSources = async () => {
    if (!runId) return
    setLoading(true)
    setError(null)
    try {
      const res = await opportunitiesService.getRunSources(context, runId)
      setSourcesData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load source details.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    const nextState = !isExpanded
    setIsExpanded(nextState)
    if (nextState && !sourcesData && !loading && runId) {
      void loadSources()
    }
  }

  // Refetch if the run ID changes while expanded
  useEffect(() => {
    if (isExpanded && runId && (!sourcesData || sourcesData.run?.id !== runId)) {
      void loadSources()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, isExpanded])

  // Extract metrics from sourcesData or fallback to run record
  const metrics = useMemo(() => {
    if (sourcesData?.metrics) return sourcesData.metrics
    const stats = effectiveRun?.stage_stats
    return {
      sources_found: effectiveRun?.sources_found ?? 0,
      queries_run: effectiveRun?.queries_run ?? 0,
      queries_failed: effectiveRun?.queries_failed ?? 0,
      queries_attempted: stats?.queries?.attempted ?? effectiveRun?.queries_run ?? 0,
      queries_succeeded: stats?.queries?.succeeded ?? Math.max(0, (effectiveRun?.queries_run ?? 0) - (effectiveRun?.queries_failed ?? 0)),
      queries_with_results: stats?.queries?.with_results ?? null,
      queries_empty: stats?.queries?.empty ?? null,
      results_returned: stats?.results?.returned ?? effectiveRun?.sources_found ?? 0,
      pages_read_in_full: stats?.pages?.fetched ?? 0,
      registry_searched: stats?.registry?.searched ?? null,
      registry_selected: stats?.registry?.selected ?? null,
      opportunities_qualified: effectiveRun?.opportunities_qualified ?? 0,
      opportunities_rejected: effectiveRun?.opportunities_rejected ?? 0,
      opportunities_new: effectiveRun?.opportunities_new ?? 0,
    }
  }, [sourcesData, effectiveRun])

  // Extract zero reasons from sourcesData or fallback to run stage_stats
  const zeroReasons = useMemo(() => {
    if (sourcesData?.zero_reasons && sourcesData.zero_reasons.length > 0) {
      return sourcesData.zero_reasons
    }
    return effectiveRun?.stage_stats?.zero_reasons ?? []
  }, [sourcesData, effectiveRun])

  const sourcesList = useMemo(() => {
    return sourcesData?.data ?? []
  }, [sourcesData])

  // Filter sources based on active tab and search query
  const filteredSources = useMemo(() => {
    return sourcesList.filter((src) => {
      if (sourceFilter === 'read' && !src.page_fetched) return false
      if (sourceFilter === 'snippet' && src.page_fetched) return false
      if (sourceFilter === 'qualified' && !src.cited) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = src.title?.toLowerCase().includes(q)
        const domainMatch = src.domain?.toLowerCase().includes(q)
        const urlMatch = src.url?.toLowerCase().includes(q)
        const typeMatch = src.source_type?.toLowerCase().includes(q)
        const snippetMatch = src.snippet?.toLowerCase().includes(q)
        if (!titleMatch && !domainMatch && !urlMatch && !typeMatch && !snippetMatch) return false
      }
      return true
    })
  }, [sourcesList, sourceFilter, searchQuery])

  const readCount = useMemo(() => sourcesList.filter((s) => s.page_fetched).length, [sourcesList])
  const snippetCount = useMemo(() => sourcesList.filter((s) => !s.page_fetched).length, [sourcesList])
  const qualifiedCount = useMemo(() => sourcesList.filter((s) => s.cited).length, [sourcesList])

  return (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-4 py-3 text-sm leading-relaxed transition-all duration-200',
        NOTICE_TONES[tone],
        className
      )}
    >
      {/* 1. Collapsed Banner Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {tone === 'info' ? (
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <AlertTriangle
              className={cn(
                'mt-0.5 size-4 shrink-0',
                tone === 'error' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'
              )}
            />
          )}

          <div className="min-w-0 flex-1 break-words">
            <span>{notice.text}</span>
            {notice.missing && notice.missing.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {notice.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            {notice.nextStep && <span className="mt-1 block font-medium">{notice.nextStep}</span>}
          </div>
        </div>

        {/* Expand / Collapse Chevron Button */}
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse source exploration' : 'Expand source exploration'}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
            'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary'
          )}
          title={isExpanded ? 'Collapse source details' : 'Explore all searched websites and reasons'}
        >
          <span className="hidden sm:inline">{isExpanded ? 'Hide Sources' : 'Explore Sources'}</span>
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-180 text-foreground'
            )}
          />
        </button>
      </div>

      {/* 2. Expanded Area */}
      {isExpanded && (
        <div className="mt-3.5 space-y-4 border-t border-border/40 pt-3.5">
          {/* Research Summary Metrics */}
          <div className="rounded-lg bg-background/60 p-3 shadow-xs">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Research Run Metrics
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              <div className="rounded border border-border/50 bg-background/80 p-2">
                <span className="block text-[11px] text-muted-foreground">Sources Found</span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {metrics.sources_found}
                </span>
              </div>

              <div className="rounded border border-border/50 bg-background/80 p-2">
                <span className="block text-[11px] text-muted-foreground">Searches Run</span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {metrics.queries_attempted}
                </span>
                {metrics.queries_with_results !== null && metrics.queries_empty !== null && (
                  <span className="block text-[10px] text-muted-foreground">
                    {metrics.queries_with_results} with results, {metrics.queries_empty} empty
                  </span>
                )}
              </div>

              <div className="rounded border border-border/50 bg-background/80 p-2">
                <span className="block text-[11px] text-muted-foreground">Results Returned</span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {metrics.results_returned}
                </span>
              </div>

              <div className="rounded border border-border/50 bg-background/80 p-2">
                <span className="block text-[11px] text-muted-foreground">Pages Read in Full</span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {metrics.pages_read_in_full}
                </span>
                <span className="block text-[10px] text-muted-foreground">inspected in depth</span>
              </div>

              {metrics.registry_searched !== null && (
                <div className="rounded border border-border/50 bg-background/80 p-2">
                  <span className="block text-[11px] text-muted-foreground">Registry Sources</span>
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    {metrics.registry_searched}
                    {metrics.registry_selected !== null ? ` / ${metrics.registry_selected}` : ''}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">direct registries</span>
                </div>
              )}

              <div className="rounded border border-border/50 bg-background/80 p-2">
                <span className="block text-[11px] text-muted-foreground">Qualified</span>
                <span className="text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {metrics.opportunities_qualified}
                </span>
                {metrics.opportunities_new > 0 && (
                  <span className="block text-[10px] text-muted-foreground">
                    {metrics.opportunities_new} new signals
                  </span>
                )}
              </div>

              <div className="rounded border border-border/50 bg-background/80 p-2">
                <span className="block text-[11px] text-muted-foreground">Rejected / Non-qualifying</span>
                <span className="text-base font-semibold tabular-nums text-muted-foreground">
                  {metrics.opportunities_rejected}
                </span>
                <span className="block text-[10px] text-muted-foreground">insufficient proof</span>
              </div>
            </div>
          </div>

          {/* 3. Why No Opportunity Was Generated Section */}
          {zeroReasons.length > 0 && (
            <div className="rounded-lg bg-background/60 p-3 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Why No Opportunity Was Generated
                </h4>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The research engine evaluated all discovered content against the product&apos;s Ideal Customer Profile (ICP). Here is why candidate signals were rejected or excluded:
              </p>

              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {zeroReasons.map((zr) => {
                  const explanation =
                    REASON_EXPLANATIONS[zr.code] ??
                    'Content did not meet the required qualification criteria for this run.'
                  return (
                    <div
                      key={zr.code}
                      className="rounded-md border border-border/50 bg-background/80 p-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-foreground">{zr.label}</span>
                        <Badge variant="secondary" className="shrink-0 tabular-nums">
                          {zr.count} {zr.count === 1 ? 'source' : 'sources'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] leading-normal text-muted-foreground">
                        {explanation}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. Explored Sources Section */}
          <div className="rounded-lg bg-background/60 p-3 shadow-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Explored Websites & Sources ({sourcesList.length})
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Every source queried, retrieved, or inspected in this run. Click any URL to view the original source in a new tab.
                </p>
              </div>

              {/* Filter Tabs */}
              {sourcesList.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={sourceFilter === 'all' ? 'default' : 'outline'}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setSourceFilter('all')}
                  >
                    All ({sourcesList.length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sourceFilter === 'read' ? 'default' : 'outline'}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setSourceFilter('read')}
                  >
                    Read in Full ({readCount})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sourceFilter === 'snippet' ? 'default' : 'outline'}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setSourceFilter('snippet')}
                  >
                    Snippets Only ({snippetCount})
                  </Button>
                  {qualifiedCount > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant={sourceFilter === 'qualified' ? 'default' : 'outline'}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setSourceFilter('qualified')}
                    >
                      Qualified ({qualifiedCount})
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Search Input when multiple sources exist */}
            {sourcesList.length > 4 && (
              <div className="relative mt-2.5">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter sources by name, domain, URL, or finding…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-background/90 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            {/* Loading & Error States */}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>Loading source exploration details…</span>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <span>{error}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => void loadSources()}
                >
                  <RefreshCw className="mr-1 size-3" /> Retry
                </Button>
              </div>
            )}

            {/* Empty Sources Fallback */}
            {!loading && !error && sourcesList.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No individual web sources were recorded for this run.
              </div>
            )}

            {/* Filtered Out Empty State */}
            {!loading && !error && sourcesList.length > 0 && filteredSources.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No sources match your current search or tab filter.
              </div>
            )}

            {/* Sources Table / Cards */}
            {!loading && !error && filteredSources.length > 0 && (
              <div className="mt-3 max-h-[460px] overflow-y-auto rounded-md border border-border/50 bg-background">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-border bg-muted/90 text-muted-foreground backdrop-blur-xs">
                    <tr>
                      <th className="py-2 pl-3 pr-2 font-medium">Source & Domain</th>
                      <th className="px-2 py-2 font-medium">Type</th>
                      <th className="px-2 py-2 font-medium">Exploration Status</th>
                      <th className="px-2 py-2 font-medium">Content Finding</th>
                      <th className="py-2 pl-2 pr-3 font-medium">Qualification & Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredSources.map((source, index) => {
                      const isQualified = source.cited === true
                      const isReadInFull = source.page_fetched === true

                      return (
                        <tr
                          key={source.id ?? `${source.url}-${index}`}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          {/* 1. Source Name, Domain & Link */}
                          <td className="max-w-[220px] py-2.5 pl-3 pr-2 align-top">
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex items-center gap-1 font-medium text-foreground hover:text-primary hover:underline"
                              title={source.url}
                            >
                              <span className="line-clamp-1">{source.title || source.source_name || source.domain || 'Source'}</span>
                              <ExternalLink className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
                            </a>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Globe className="size-3 shrink-0 text-muted-foreground/70" />
                              <span className="truncate">{source.domain ?? 'Web'}</span>
                              {source.published_at && (
                                <span className="shrink-0 text-muted-foreground/60">
                                  · {source.published_at}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Source Type */}
                          <td className="px-2 py-2.5 align-top whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Building2 className="size-3 text-muted-foreground/60" />
                              {source.source_type || 'Web Publication'}
                            </span>
                          </td>

                          {/* 3. Exploration Status */}
                          <td className="px-2 py-2.5 align-top whitespace-nowrap">
                            {isQualified ? (
                              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[10px]">
                                <Sparkles className="size-2.5" /> Qualified
                              </Badge>
                            ) : isReadInFull ? (
                              <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 gap-1 text-[10px]">
                                <FileText className="size-2.5" /> Read in full
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 text-[10px] text-muted-foreground">
                                <Search className="size-2.5" /> Search snippet
                              </Badge>
                            )}
                            <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                              {isReadInFull ? '1 page read' : 'Excerpt only'}
                            </div>
                          </td>

                          {/* 4. Content Finding */}
                          <td className="max-w-[280px] px-2 py-2.5 align-top">
                            <p className="line-clamp-2 text-[11px] text-muted-foreground italic">
                              &ldquo;{source.content_finding || source.snippet || 'No snippet available'}&rdquo;
                            </p>
                          </td>

                          {/* 5. Qualification Result & Reason */}
                          <td className="max-w-[240px] py-2.5 pl-2 pr-3 align-top">
                            <div className="flex items-center gap-1.5">
                              {isQualified ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="size-3" /> Qualified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                  <XCircle className="size-3 text-muted-foreground/70" /> Not qualified
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                              {isQualified
                                ? 'Signal verified and added to pipeline.'
                                : source.rejection_reason ||
                                  (isReadInFull
                                    ? 'Content read; no verifiable buying intent or procurement trigger found.'
                                    : 'Discovered in search; full page not inspected within fetch budget.')}
                            </p>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

