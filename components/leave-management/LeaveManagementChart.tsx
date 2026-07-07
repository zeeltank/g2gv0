'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DepartmentLeaveData } from '@/types/Leavedashboard'

interface DepartmentChartProps {
  data: DepartmentLeaveData[]
}

export function DepartmentChart({ data }: DepartmentChartProps) {
  const chartData = useMemo(() => data, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Department Distribution</CardTitle>
        <CardDescription>Leave volume and outcomes by department</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="department" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis tickLine={false} axisLine={false} tickMargin={10} />
              <Tooltip
                cursor={{ fill: 'var(--muted)' }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                }}
              />
              <Legend />
              <Bar dataKey="requests" name="Requests" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="approved" name="Approved" fill="#16a34a" radius={[6, 6, 0, 0]} />
              <Bar dataKey="rejected" name="Rejected" fill="#dc2626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
