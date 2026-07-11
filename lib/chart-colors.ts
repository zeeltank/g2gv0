/**
 * Chart color utilities using design tokens
 * All colors are defined as HSL values that map to CSS custom properties
 */

// Chart status colors (using design token names)
export const chartStatusColors = {
  // Status colors
  primary: { light: 'hsl(23 100% 50%)', dark: 'hsl(23 100% 57%)' },      // --primary
  success: { light: 'hsl(143 65% 30%)', dark: 'hsl(143 55% 42%)' },    // --success
  warning: { light: 'hsl(28 100% 38%)', dark: 'hsl(28 100% 58%)' },     // --warning
  danger: { light: 'hsl(0 72% 42%)', dark: 'hsl(0 72% 55%)' },          // --destructive
  secondary: { light: 'hsl(232 56% 34%)', dark: 'hsl(210 40% 98%)' },   // --secondary
  muted: { light: 'hsl(215 16% 47%)', dark: 'hsl(215 20% 70%)' },       // --muted-foreground
  brand: { light: 'hsl(232 56% 34%)', dark: 'hsl(232 56% 34%)' },       // --brand
  accent: { light: 'hsl(26 100% 96%)', dark: 'hsl(24 45% 20%)' },        // --accent
} as const

// Pre-defined color palettes for different chart types
export const leaveChartColors = {
  requests: '#2563eb',    // Blue - use --primary equivalent
  approved: '#16a34a',    // Green - use --success equivalent  
  rejected: '#dc2626',    // Red - use --destructive equivalent
} as const

export const attendanceChartColors = {
  present: '#3b82f6',     // Blue - primary
  late: '#f59e0b',        // Amber - warning
  earlyGoing: '#8b5cf6',  // Purple - secondary
  absent: '#ef4444',      // Red - destructive
  onTime: '#22c55e',      // Green - success
  overtime: '#6366f1',    // Indigo - brand
} as const

export const taskChartColors = {
  completed: '#10b981',   // Emerald - success
  inProgress: '#3b82f6',  // Blue - primary
  overdue: '#f43f5e',    // Rose - danger
  pending: '#8b5cf6',    // Purple - secondary
  blocked: '#f59e0b',    // Amber - warning
} as const

// Helper to get CSS variable value for chart colors
export function getChartColor(token: string): string {
  // Recharts needs hex values, but we can use hsl values directly
  // This function can be expanded to handle theme-aware colors
  const colorMap: Record<string, string> = {
    'primary': '#f97316',      // HSL(23 100% 50%)
    'success': '#22c55e',      // HSL(143 65% 30%)
    'warning': '#f59e0b',      // HSL(28 100% 38%)
    'danger': '#ef4444',       // HSL(0 72% 42%)
    'secondary': '#2e3a8c',    // HSL(232 56% 34%)
    'brand': '#2e3a8c',        // HSL(232 56% 34%)
    'accent': '#fff7ed',       // HSL(26 100% 96%)
  }
  return colorMap[token] || '#6b7280' // Fallback to gray
}
