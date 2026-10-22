'use client'

import { TabularView } from './tabular-view'
import { SummaryView } from './summary-view'
import { PivotView } from './pivot-view'
import { ChartView } from './chart-view'
import type {
  ChartResult,
  FieldRef,
  PivotResult,
  ReportDefinition,
  ReportResult,
  ReportType,
  SummaryResult,
  TabularResult,
} from '@/services/reports'

type DrilldownValue = FieldRef & { value: string | null }

/** Switches on report_type — the one place a result shape is matched to the view that knows how to render it. */
export function ReportViewer({
  reportType,
  result,
  definition,
  onPageChange,
  onPerPageChange,
  busy,
  onDrilldown,
}: {
  reportType: ReportType
  result: ReportResult
  definition: ReportDefinition
  onPageChange?: (page: number) => void
  onPerPageChange?: (perPage: number) => void
  busy?: boolean
  /** Only summary/chart/pivot reports can drill down — a single-group-by-field limitation (matches every report this engine seeds today; multi-dimension summary reports have no way to recover their per-field values from one joined label string). */
  onDrilldown?: (values: DrilldownValue[], title: string) => void
}) {
  switch (reportType) {
    case 'tabular':
      return (
        <TabularView
          result={result as TabularResult}
          columns={definition.columns ?? []}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
          busy={busy}
        />
      )
    case 'summary': {
      const groupField = definition.group_by?.[0]

      return (
        <SummaryView
          result={result as SummaryResult}
          onGroupClick={
            groupField && onDrilldown
              ? (label) => onDrilldown([{ ...groupField, value: label }], label)
              : undefined
          }
        />
      )
    }
    case 'pivot': {
      const rowField = definition.pivot?.rows?.[0]
      const colField = definition.pivot?.columns?.[0]

      return (
        <PivotView
          result={result as PivotResult}
          onCellClick={
            rowField && colField && onDrilldown
              ? (rowLabel, colLabel) => onDrilldown(
                  [{ ...rowField, value: rowLabel }, { ...colField, value: colLabel }],
                  `${rowLabel} / ${colLabel}`,
                )
              : undefined
          }
        />
      )
    }
    case 'chart': {
      const groupField = definition.chart?.group_by

      return (
        <ChartView
          type={definition.chart?.type ?? 'VerticalBar'}
          result={result as ChartResult}
          onSliceClick={
            groupField && onDrilldown
              ? (label) => onDrilldown([{ ...groupField, value: label }], label)
              : undefined
          }
        />
      )
    }
    default:
      return null
  }
}
