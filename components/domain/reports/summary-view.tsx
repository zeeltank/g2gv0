'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SummaryResult } from '@/services/reports'

/**
 * One row per group — label, count (always present, see
 * ReportQueryExecutionService::runSummary), plus one column per requested
 * aggregate. This is vtiger's own "summary" report type rendered as a
 * grouped table. A group is clickable when the engine's drill-down
 * endpoint can resolve it (single group-by field — see ReportViewer's own
 * docblock for why a multi-field group doesn't support this yet).
 */
export function SummaryView({ result, onGroupClick }: { result: SummaryResult; onGroupClick?: (label: string) => void }) {
  if (result.groups.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No groups for the current filters.</p>
  }

  const aggregateKeys = Object.keys(result.groups[0]).filter((k) => k !== 'label' && k !== 'count')

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead className="text-right">Count</TableHead>
            {aggregateKeys.map((key) => (
              <TableHead key={key} className="text-right">{formatAggregateLabel(key)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.groups.map((group) => (
            <TableRow
              key={group.label}
              className={onGroupClick ? 'cursor-pointer' : undefined}
              onClick={onGroupClick ? () => onGroupClick(group.label) : undefined}
            >
              <TableCell className="font-medium text-foreground">{group.label}</TableCell>
              <TableCell className="text-right">{group.count}</TableCell>
              {aggregateKeys.map((key) => (
                <TableCell key={key} className="text-right">{String(group[key] ?? '—')}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** "agg_task_management.tasks.estimated_hours_sum" -> "Estimated Hours (sum)" — best-effort, falls back to the raw key. */
function formatAggregateLabel(key: string): string {
  const match = key.match(/^agg_.+\.([a-z_]+)_(sum|avg|min|max)$/)

  if (!match) {
    return key
  }

  const [, field, aggregate] = match
  const label = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return `${label} (${aggregate})`
}
