'use client'

import { useMemo } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeaveTypeDistribution } from '@/types/Leavedashboard'

interface LeaveTypeChartProps {
  data: LeaveTypeDistribution[]
}

export function LeaveTypeChart({ data }: LeaveTypeChartProps) {
  const chartData = useMemo(() => data, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Type Distribution</CardTitle>
        <CardDescription>Share of requests by leave category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={92}
                innerRadius={52}
                paddingAngle={3}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                }}
              />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
