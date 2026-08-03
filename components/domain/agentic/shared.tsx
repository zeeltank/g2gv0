'use client'

import type { ReactNode } from 'react'
import {
  Bot,
  BrainCircuit,
  Database,
  FileText,
  Mail,
  Search,
  Workflow as WorkflowIcon,
  type LucideIcon,
} from 'lucide-react'

import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ *
 * Status vocabulary
 * ------------------------------------------------------------------ */

/**
 * StatusBadge keys its colour off a known word list, and the module's own
 * vocabulary (deployed / paused / running) is not on it. Mapping here keeps a
 * deployed agent green and a paused one amber rather than defaulting to grey.
 */
const AGENT_TONE: Record<string, 'active' | 'pending' | 'inactive' | 'error' | 'processing' | 'default'> = {
  deployed: 'active',
  draft: 'default',
  paused: 'pending',
  archived: 'inactive',
}

const RUN_TONE: Record<string, 'active' | 'pending' | 'inactive' | 'error' | 'processing' | 'default'> = {
  success: 'active',
  completed: 'active',
  running: 'processing',
  pending: 'pending',
  error: 'error',
  failed: 'error',
  cancelled: 'inactive',
  idle: 'default',
  processing: 'processing',
}

export function AgentStatusBadge({ status, size }: { status: string; size?: 'sm' | 'default' | 'lg' }) {
  return <StatusBadge variant={AGENT_TONE[status] ?? 'default'} label={status} size={size} />
}

export function RunStatusBadge({ status, size }: { status: string; size?: 'sm' | 'default' | 'lg' }) {
  return <StatusBadge variant={RUN_TONE[status] ?? 'default'} label={status} size={size} />
}

/* ------------------------------------------------------------------ *
 * Tool identity
 * ------------------------------------------------------------------ */

/** Icons for the tool ids that live on an agent record. */
export const TOOL_ICONS: Record<string, LucideIcon> = {
  knowledge_base: BrainCircuit,
  web_search: Search,
  email: Mail,
  sql_query: Database,
  data_viz: WorkflowIcon,
  file_operations: FileText,
  n8n: WorkflowIcon,
}

export const TOOL_LABELS: Record<string, string> = {
  knowledge_base: 'Knowledge Base',
  web_search: 'Web Search',
  email: 'Email',
  sql_query: 'SQL Query',
  data_viz: 'Data Visualization',
  file_operations: 'File Operations',
  n8n: 'n8n',
}

/** The agent-record tool id that each invocable tool endpoint maps to. */
export const TOOL_ENDPOINT_FOR: Record<string, string> = {
  knowledge_base: 'knowledge',
  email: 'email',
  web_search: 'web_search',
  sql_query: 'sql_exec',
  data_viz: 'visualization',
  file_operations: 'file',
}

export function ToolChip({ tool, className }: { tool: string; className?: string }) {
  const Icon = TOOL_ICONS[tool] ?? Bot
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground',
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {TOOL_LABELS[tool] ?? tool}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export function dash(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const text = String(value).trim()
  return text === '' ? '—' : text
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Sub-second durations read better in ms; anything longer in seconds. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function formatCost(cost: number | null | undefined): string {
  if (cost === null || cost === undefined) return '—'
  // Fractions of a cent are normal here, so a fixed 2dp would show $0.00.
  return cost < 0.01 && cost > 0 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString()
}

/** Success rate is null until something has run — that is not the same as 0%. */
export function formatRate(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? '—' : `${rate}%`
}

/* ------------------------------------------------------------------ *
 * Sparkline
 * ------------------------------------------------------------------ */

/**
 * A dependency-free sparkline.
 *
 * Recharts is already in the bundle for the big charts, but a 40px trend line
 * does not need a ResponsiveContainer per KPI tile — four of them on one screen
 * measured and re-rendered on every resize.
 */
export function Sparkline({
  values,
  className,
  stroke = 'currentColor',
  filled = true,
}: {
  values: number[]
  className?: string
  stroke?: string
  filled?: boolean
}) {
  if (values.length < 2) {
    return <div className={cn('h-10', className)} aria-hidden />
  }

  const width = 100
  const height = 32
  const max = Math.max(...values)
  const min = Math.min(...values)
  // A flat series would divide by zero; render it as a centred straight line.
  const span = max - min || 1

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - ((value - min) / span) * (height - 4) - 2
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('h-10 w-full', className)}
      aria-hidden
    >
      {filled && (
        <polygon
          points={`0,${height} ${points.join(' ')} ${width},${height}`}
          fill={stroke}
          opacity={0.12}
        />
      )}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * KPI tile
 * ------------------------------------------------------------------ */

export function KpiTile({
  label,
  value,
  hint,
  icon,
  spark,
  sparkColor,
  onClick,
  loading,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: ReactNode
  spark?: number[]
  sparkColor?: string
  onClick?: () => void
  loading?: boolean
}) {
  const Element = onClick ? 'button' : 'div'

  return (
    <Element
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-primary/10 bg-card/60 p-4 text-left shadow-sm backdrop-blur-xl',
        onClick && 'transition-colors hover:border-primary/40 hover:bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{loading ? '…' : value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      {spark && spark.length > 1 ? (
        <div className="-mx-1 mt-2" style={{ color: sparkColor ?? 'hsl(var(--primary))' }}>
          <Sparkline values={spark} />
        </div>
      ) : null}
    </Element>
  )
}
