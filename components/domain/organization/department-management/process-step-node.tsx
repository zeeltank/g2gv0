'use client'

import { Handle, Position } from '@xyflow/react'
import {
  Bell,
  CheckSquare,
  Clock,
  FileText,
  Flag,
  GitBranch,
  Play,
  Scale,
  Shield,
  Square,
  Stamp,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared between the editable canvas builder and the library's read-only
 * mini-preview, so a step looks identical whether you are dragging it or
 * glancing at a card thumbnail.
 *
 * `data` IS the step record (plus a couple of UI-only flags) rather than a
 * pre-computed display shape - the builder edits a node by patching this
 * object directly, and the node re-renders from the same source it will be
 * saved from. There is no second "view model" to keep in sync with it.
 */

const STEP_ICONS: Record<string, typeof Play> = {
  start: Play,
  end: Flag,
  task: CheckSquare,
  approval: Stamp,
  decision: GitBranch,
  milestone: Flag,
  wait_delay: Clock,
  notification: Bell,
  sop_reference: FileText,
  policy_reference: Shield,
  rule_reference: Scale,
  sub_process: Workflow,
}

const FALLBACK_COLOR = '#64748b'

export function stepColor(stepType: string, stepTypes: Record<string, { label: string; color: string }>) {
  return stepTypes[stepType]?.color ?? FALLBACK_COLOR
}

export function stepLabel(stepType: string, stepTypes: Record<string, { label: string; color: string }>) {
  return stepTypes[stepType]?.label ?? stepType
}

export interface ProcessStepNodeData extends Record<string, unknown> {
  node_key: string
  step_type: string
  title: string
  description?: string | null
  assignee_type?: string | null
  assignee_value?: string | null
  sla_value?: number | null
  sla_unit?: string | null
  linked_sop_id?: number | null
  linked_policy_id?: number | null
  linked_rule_id?: number | null
  is_required?: boolean
  stepTypes: Record<string, { label: string; color: string }>
  interactive: boolean
  isCurrent?: boolean
  isComplete?: boolean
}

export function ProcessStepNode({ data }: { data: ProcessStepNodeData }) {
  // A direct map lookup, not a call through stepIcon() - the lint rule
  // guarding against components created during render (react-hooks/
  // static-components) can prove this assignment stable because it sees the
  // object literal directly; it cannot see through a function call to the
  // same literal. module-card.tsx's MODULE_LOOKS lookup takes the same shape
  // for the same reason.
  const Icon = STEP_ICONS[data.step_type] ?? Square
  const color = stepColor(data.step_type, data.stepTypes)
  const assigneeLabel = data.assignee_type
    ? `${data.assignee_type.replace('_', ' ')}${data.assignee_value ? ': ' + data.assignee_value : ''}`
    : null
  const slaLabel = data.sla_value ? `${data.sla_value} ${data.sla_unit ?? ''}`.trim() : null
  const linked = Boolean(data.linked_sop_id || data.linked_policy_id || data.linked_rule_id)

  return (
    <div
      className={cn(
        'relative flex min-w-[168px] max-w-[220px] flex-col gap-1 rounded-lg border-2 bg-card px-3 py-2 shadow-sm transition-shadow',
        data.interactive && 'cursor-pointer hover:shadow-md',
        data.isCurrent && 'ring-2 ring-primary/70 animate-pulse',
        data.isComplete && 'opacity-60',
      )}
      style={{ borderColor: color }}
    >
      {data.step_type !== 'start' && (
        <Handle type="target" position={Position.Top} className="!size-2 !border-0" style={{ background: color }} />
      )}

      <div className="flex items-center gap-1.5">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}>
          <Icon className="size-3" />
        </span>
        <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{data.title}</p>
      </div>

      {(assigneeLabel || slaLabel || linked) && (
        <div className="flex flex-wrap items-center gap-1 pl-[26px]">
          {assigneeLabel && (
            <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
              {assigneeLabel}
            </span>
          )}
          {slaLabel && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{slaLabel}</span>}
          {linked && (
            <span className="rounded bg-teal-500/15 px-1.5 py-0.5 text-[10px] text-teal-700 dark:text-teal-400">Linked</span>
          )}
        </div>
      )}

      {data.step_type !== 'end' && (
        <Handle type="source" position={Position.Bottom} className="!size-2 !border-0" style={{ background: color }} />
      )}
    </div>
  )
}
