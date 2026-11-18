'use client'

/**
 * Renders a `chart`-type report result. Chart-type -> recharts component
 * mapping matches the real vtiger Reports module this engine is modeled on
 * (Docs/reports-engine/PLAN.md): Pie, VerticalBar, HorizontalBar, Line —
 * no funnel, no KPI-card grid anywhere here, per the explicit design
 * decision. Colours come from lib/chart-colors.ts's `categoricalColors` /
 * `categoricalColor` — an accessibility-vetted, "never cycle" palette
 * already built for exactly this (colouring an unbounded list of group
 * labels), reused rather than duplicated.
 */

import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { categoricalColor, categoricalColors } from '@/lib/chart-colors'
import type { ChartResult } from '@/services/reports'

/** Click a legend entry to show/hide that series — built into Recharts (no new dependency), confirmed via direct research as the right call: Recharts was independently validated as "the best fit for standard dashboards" over Nivo/Tremor for this stack, so the quality upgrade here is using more of what it already offers, not switching libraries. */
function useLegendToggle() {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const onLegendClick = (entry: { dataKey?: unknown }) => {
    const key = typeof entry.dataKey === 'string' || typeof entry.dataKey === 'number' ? String(entry.dataKey) : ''
    if (!key) return

    setHidden((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const legendFormatter = (value: string) => (
    <span className={hidden.has(value) ? 'text-muted-foreground line-through' : undefined}>{value}</span>
  )

  return { hidden, onLegendClick, legendFormatter }
}

export function ChartView({
  type,
  result,
  onSliceClick,
}: {
  type: 'Pie' | 'VerticalBar' | 'HorizontalBar' | 'Line'
  result: ChartResult
  /** Not wired for Line — recharts has no clean per-point click target there, and no seeded report uses it. */
  onSliceClick?: (label: string) => void
}) {
  const data = result.labels.map((label, i) => {
    const row: Record<string, string | number> = { label }
    result.series.forEach((s) => {
      row[s.name] = s.data[i] ?? 0
    })
    return row
  })

  const { hidden, onLegendClick, legendFormatter } = useLegendToggle()

  if (result.labels.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No data for the current filters.</p>
  }

  if (type === 'Pie') {
    // Vtiger itself restricts Pie to a single data field — the engine's own
    // validation already caps chart.data_fields at 3, but a pie only ever
    // reads the first.
    const field = result.series[0]?.name ?? 'value'

    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            dataKey={field}
            nameKey="label"
            outerRadius={110}
            label={(entry) => entry.name}
            onClick={onSliceClick ? (entry) => onSliceClick((entry as unknown as { label?: string }).label ?? '') : undefined}
            cursor={onSliceClick ? 'pointer' : undefined}
          >
            {data.map((entry, i) => (
              <Cell key={entry.label as string} fill={categoricalColor(entry.label as string, result.labels) ?? categoricalColors[i % categoricalColors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'Line') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Legend onClick={onLegendClick} formatter={legendFormatter} wrapperStyle={{ cursor: 'pointer' }} />
          {result.series.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={s.name} hide={hidden.has(s.name)} stroke={categoricalColors[i % categoricalColors.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // VerticalBar / HorizontalBar
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout={type === 'HorizontalBar' ? 'vertical' : 'horizontal'}>
        <CartesianGrid strokeDasharray="3 3" />
        {type === 'HorizontalBar' ? (
          <>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12 }} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          </>
        )}
        <Tooltip />
        <Legend onClick={onLegendClick} formatter={legendFormatter} wrapperStyle={{ cursor: 'pointer' }} />
        {result.series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            hide={hidden.has(s.name)}
            fill={categoricalColors[i % categoricalColors.length]}
            radius={[4, 4, 0, 0]}
            onClick={onSliceClick ? (entry) => onSliceClick((entry as { label?: string }).label ?? '') : undefined}
            cursor={onSliceClick ? 'pointer' : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
