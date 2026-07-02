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
import type { LeaveTrendData } from '@/types/Leavedashboard'

interface LeaveTrendChartProps {
  data: LeaveTrendData[]
}

export function LeaveTrendChart({ data }: LeaveTrendChartProps) {
  const chartData = useMemo(() => data, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Trend</CardTitle>
        <CardDescription>Monthly leave requests across the calendar year</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis tickLine={false} axisLine={false} tickMargin={10} />
              <Tooltip
                cursor={{ stroke: 'var(--primary)', strokeDasharray: '3 3' }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="requests" name="Requests" stroke="#2563eb" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="approved" name="Approved" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="rejected" name="Rejected" stroke="#dc2626" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
