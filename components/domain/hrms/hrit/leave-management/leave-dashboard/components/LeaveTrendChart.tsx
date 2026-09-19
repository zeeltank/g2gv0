'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { leaveChartColors } from '@/lib/chart-colors'
import type { LeaveTrendPoint } from '@/services/hrms'

interface LeaveTrendChartProps {
  data: LeaveTrendPoint[]
}

/**
 * Leave volume across the year.
 *
 * F-181. /api/leave/trend was fetched on every dashboard load, stored in the
 * hook, returned from it - and the page never destructured it. A finished
 * endpoint, a finished request, a finished mapper, and no chart. The server
 * even pads all twelve months (LeaveDashboardController:87-133) specifically so
 * a chart has no gaps, which is a strong hint about what it was built for.
 *
 * A line chart rather than bars: this is one series over time, and the twelve
 * padded months make the shape of the year the point. The department breakdown
 * beside it is already a bar chart, so the two do not read as the same thing.
 */
export function LeaveTrendChart({ data }: LeaveTrendChartProps) {
  const chartData = useMemo(() => data, [data])

  // Padding means twelve points always arrive; all-zero is a real answer
  // ("nobody took leave this year"), an empty array is not.
  const hasAnyActivity = chartData.some(
    (point) => point.requests > 0 || point.approved > 0 || point.rejected > 0,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Through the Year</CardTitle>
        <CardDescription>Requests raised, approved and rejected each month</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <EmptyState
            title="No trend available"
            description="The leave trend could not be loaded for this organisation."
          />
        ) : !hasAnyActivity ? (
          <EmptyState
            title="No leave recorded this year"
            description="Once requests are raised, this chart shows how they move month by month."
          />
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} />
                <Tooltip
                  cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="requests"
                  name="Requests"
                  stroke={leaveChartColors.requests}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="approved"
                  name="Approved"
                  stroke={leaveChartColors.approved}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="rejected"
                  name="Rejected"
                  stroke={leaveChartColors.rejected}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
