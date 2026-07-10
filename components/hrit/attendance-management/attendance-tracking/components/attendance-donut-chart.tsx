'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface AttendanceDistributionData {
  present: number
  late: number
  earlyGoing: number
  absent: number
}

interface AttendanceDonutChartProps {
  data: AttendanceDistributionData
  className?: string
}

export function AttendanceDonutChart({ data, className }: AttendanceDonutChartProps) {
  const total = data.present + data.late + data.earlyGoing + data.absent

  if (total === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Attendance Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    )
  }

  const segments = [
    { key: 'present', label: 'Present', value: data.present, color: '#3b82f6' },
    { key: 'late', label: 'Late', value: data.late, color: '#f59e0b' },
    { key: 'earlyGoing', label: 'Early Going', value: data.earlyGoing, color: '#8b5cf6' },
    { key: 'absent', label: 'Absent', value: data.absent, color: '#ef4444' },
  ]

  const size = 200
  const center = size / 2
  const radius = 80
  const innerRadius = 50
  const circumference = 2 * Math.PI * radius

  let currentAngle = -Math.PI / 2

  const paths = segments.map((seg) => {
    const percentage = seg.value / total
    const angle = percentage * 2 * Math.PI
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const x1 = center + radius * Math.cos(startAngle)
    const y1 = center + radius * Math.sin(startAngle)
    const x2 = center + radius * Math.cos(endAngle)
    const y2 = center + radius * Math.sin(endAngle)

    const ix1 = center + innerRadius * Math.cos(endAngle)
    const iy1 = center + innerRadius * Math.sin(endAngle)
    const ix2 = center + innerRadius * Math.cos(startAngle)
    const iy2 = center + innerRadius * Math.sin(startAngle)

    const largeArcFlag = angle > Math.PI ? 1 : 0

    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ')

    return { ...seg, pathData, percentage }
  })

  const getBadgeTone = (key: string) => {
    switch (key) {
      case 'present': return 'success'
      case 'late': return 'warning'
      case 'earlyGoing': return 'default'
      case 'absent': return 'destructive'
      default: return 'secondary'
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Attendance Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {paths.map((seg) => (
                <path
                  key={seg.key}
                  d={seg.pathData}
                  fill={seg.color}
                  stroke="white"
                  strokeWidth="2"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{total}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {paths.map((seg) => (
              <div key={seg.key} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ backgroundColor: seg.color }} />
                  <span className="text-sm text-foreground">{seg.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{seg.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(seg.percentage * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
