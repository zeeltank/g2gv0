'use client'

import { TabularView } from './tabular-view'
import { SummaryView } from './summary-view'
import { PivotView } from './pivot-view'
import { ChartView } from './chart-view'
import type {
  ChartResult,
  PivotResult,
  ReportDefinition,
  ReportResult,
  ReportType,
  SummaryResult,
  TabularResult,
} from '@/services/reports'

/** Switches on report_type — the one place a result shape is matched to the view that knows how to render it. */
export function ReportViewer({
  reportType,
  result,
  definition,
  onPageChange,
}: {
  reportType: ReportType
  result: ReportResult
  definition: ReportDefinition
  onPageChange?: (page: number) => void
}) {
  switch (reportType) {
    case 'tabular':
      return <TabularView result={result as TabularResult} columns={definition.columns ?? []} onPageChange={onPageChange} />
    case 'summary':
      return <SummaryView result={result as SummaryResult} />
    case 'pivot':
      return <PivotView result={result as PivotResult} />
    case 'chart':
      return <ChartView type={definition.chart?.type ?? 'VerticalBar'} result={result as ChartResult} />
    default:
      return null
  }
}
