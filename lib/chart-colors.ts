export const chartStatusColors = {
  primary: 'var(--chart-blue)',
  success: 'var(--chart-green)',
  warning: 'var(--chart-yellow)',
  danger: 'var(--chart-red)',
  secondary: 'var(--chart-indigo)',
  muted: 'var(--muted-foreground)',
  brand: 'var(--brand-navy-light)',
  accent: 'var(--surface-muted)',
} as const

export const leaveChartColors = {
  requests: 'var(--chart-blue)',
  approved: 'var(--chart-green)',
  rejected: 'var(--chart-red)',
} as const

export const attendanceChartColors = {
  present: 'var(--chart-blue)',
  late: 'var(--chart-yellow)',
  earlyGoing: 'var(--chart-teal)',
  absent: 'var(--chart-red)',
  onTime: 'var(--chart-green)',
  overtime: 'var(--chart-indigo)',
} as const

export const taskChartColors = {
  completed: 'var(--chart-green)',
  inProgress: 'var(--chart-blue)',
  overdue: 'var(--chart-red)',
  pending: 'var(--chart-indigo)',
  blocked: 'var(--chart-yellow)',
} as const

export function getChartColor(token: string): string {
  const colorMap: Record<string, string> = {
    primary: 'var(--chart-blue)',
    success: 'var(--chart-green)',
    warning: 'var(--chart-yellow)',
    danger: 'var(--chart-red)',
    secondary: 'var(--chart-indigo)',
    brand: 'var(--brand-navy-light)',
    accent: 'var(--surface-muted)',
  }
  return colorMap[token] || 'var(--muted-foreground)'
}
