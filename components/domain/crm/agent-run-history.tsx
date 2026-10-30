'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { crmService } from '@/services/crm'
import type { AgentRun, CrmPagination } from '@/types/crm'

const AGENT_TYPES = [
  { value: '', label: 'All' },
  { value: 'prospecting', label: 'Prospecting' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'deal_coach', label: 'Deal Coach' },
  { value: 'workflow', label: 'Workflow' },
]

function statusBadge(status: AgentRun['status']) {
  const map: Record<string, string> = {
    running:            'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    completed:          'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    failed:             'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    cancelled:          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    awaiting_approval:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  }
  return map[status] ?? map.cancelled
}

function duration(run: AgentRun) {
  if (!run.startedAt || !run.completedAt) return '—'
  const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function AgentRunHistory() {
  const context = getLaravelContext()
  const [agentType, setAgentType] = useState('')
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [pagination, setPagination] = useState<CrmPagination | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await crmService.getAgentRuns(context, { agentType: agentType || undefined, page })
      if (res.status === 1) {
        setRuns(res.data.items)
        setPagination(res.data.pagination)
      }
    } finally {
      setLoading(false)
    }
  }, [context, agentType, page])

  useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-1 flex-wrap">
        {AGENT_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => { setAgentType(t.value); setPage(1) }}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              agentType === t.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}

      {!loading && runs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">No agent runs found.</div>
      )}

      {!loading && runs.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Agent</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Trigger</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Duration</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Tokens</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Date</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map(run => (
                <>
                  <tr
                    key={run.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => setExpanded(expanded === run.id ? null : run.id)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{run.agentName}</div>
                      <div className="text-xs text-muted-foreground capitalize">{run.agentType.replace('_', ' ')}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">{run.triggerType}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', statusBadge(run.status))}>
                        {run.status === 'running' && <Loader2 className="size-3 animate-spin mr-1" />}
                        {run.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">{duration(run)}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                      {run.tokensUsed ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(run.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      {expanded === run.id
                        ? <ChevronDown className="size-4 text-muted-foreground" />
                        : <ChevronRight className="size-4 text-muted-foreground" />}
                    </td>
                  </tr>
                  {expanded === run.id && (
                    <tr key={`${run.id}-exp`} className="bg-muted/20">
                      <td colSpan={7} className="px-4 py-3">
                        <pre className="text-xs font-mono overflow-x-auto max-h-48 bg-muted rounded p-3 whitespace-pre-wrap">
                          {JSON.stringify(run.outputData, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.last_page > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {pagination.current_page} of {pagination.last_page} ({pagination.total} runs)</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 text-xs">Prev</Button>
            <Button size="sm" variant="outline" disabled={page >= pagination.last_page} onClick={() => setPage(p => p + 1)} className="h-7 text-xs">Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
