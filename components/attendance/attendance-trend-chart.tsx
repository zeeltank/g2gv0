'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface AttendanceTrendData {
  label: string
  present: number
  late: number
  earlyGoing: number
  absent: number
}

interface AttendanceTrendChartProps {
  data: AttendanceTrendData[]
  className?: string
}

export function AttendanceTrendChart({ data, className }: AttendanceTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Attendance Trend</CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    )
  }

  const width = 700
  const height = 280
  const margin = { top: 20, right: 20, bottom: 40, left: 40 }
  const chartWidth = width - margin.left - margin.right
  const chartHeight = height - margin.top - margin.bottom

  const allValues = data.flatMap((d) => [d.present, d.late, d.earlyGoing, d.absent])
  const maxValue = Math.max(...allValues, 1)
  const minValue = 0
  const gridStep = Math.max(1, Math.ceil(maxValue / 5))
  const gridValues = Array.from({ length: Math.ceil(maxValue / gridStep) + 1 }, (_, i) => Math.min(i * gridStep, maxValue))

  const points = data.map((d, i) => {
    const x = data.length === 1
      ? margin.left + chartWidth / 2
      : margin.left + (i / (data.length - 1)) * chartWidth
    return {
      x,
      present: margin.top + chartHeight - ((d.present - minValue) / (maxValue - minValue)) * chartHeight,
      late: margin.top + chartHeight - ((d.late - minValue) / (maxValue - minValue)) * chartHeight,
      earlyGoing: margin.top + chartHeight - ((d.earlyGoing - minValue) / (maxValue - minValue)) * chartHeight,
      absent: margin.top + chartHeight - ((d.absent - minValue) / (maxValue - minValue)) * chartHeight,
    }
  })

  const buildPath = (key: 'present' | 'late' | 'earlyGoing' | 'absent') =>
    points.map((p, i) => (i === 0 ? `M ${p.x} ${p[key]}` : `L ${p.x} ${p[key]}`)).join(' ')

  const strokeColors = {
    present: '#3b82f6',
    late: '#f59e0b',
    earlyGoing: '#8b5cf6',
    absent: '#ef4444',
  }

  const legendItems = [
    { label: 'Present', color: strokeColors.present, key: 'present' as const },
    { label: 'Late', color: strokeColors.late, key: 'late' as const },
    { label: 'Early Going', color: strokeColors.earlyGoing, key: 'earlyGoing' as const },
    { label: 'Absent', color: strokeColors.absent, key: 'absent' as const },
  ]

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Attendance Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            <defs>
              {legendItems.map((item) => (
                <linearGradient key={item.key} id={`gradient-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={item.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={item.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>

            <g>
              {gridValues.map((val) => {
                const y = margin.top + chartHeight - (val / maxValue) * chartHeight
                return (
                  <g key={val}>
                    <line
                      x1={margin.left}
                      x2={width - margin.right}
                      y1={y}
                      y2={y}
                      stroke="#e5e7eb"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={margin.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-muted-foreground text-[10px]"
                    >
                      {val}
                    </text>
                  </g>
                )
              })}
            </g>

            {data.map((d, i) => {
              const x = data.length === 1
                ? margin.left + chartWidth / 2
                : margin.left + (i / (data.length - 1)) * chartWidth
              return (
                <text
                  key={d.label}
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {d.label}
                </text>
              )
            })}

            {legendItems.map((item) => {
              const pathD = buildPath(item.key)
              const areaD = `${pathD} L ${points[points.length - 1].x} ${margin.top + chartHeight} L ${points[0].x} ${margin.top + chartHeight} Z`
              return (
                <g key={item.key}>
                  <path d={areaD} fill={`url(#gradient-${item.key})`} />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((p, pi) => (
                    <circle
                      key={pi}
                      cx={p.x}
                      cy={p[item.key]}
                      r="3"
                      fill={item.color}
                      stroke="white"
                      strokeWidth="1.5"
                    />
                  ))}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          {legendItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
