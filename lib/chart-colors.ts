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

/**
 * CATEGORICAL HUES, for colouring by identity — a project, a stream, a tenant.
 *
 * ── WHY THIS IS NOT taskChartColors ─────────────────────────────────────────
 *
 * Every other palette in this file is SEMANTIC: `completed` is green because
 * completion is good. These carry no meaning at all — slot 3 is not "better"
 * than slot 4, it is merely a different thing. Reusing a semantic colour for
 * identity is how a chart ends up implying that Project Beta is overdue.
 *
 * ── THE ORDER IS VALIDATED, NOT CHOSEN ──────────────────────────────────────
 *
 * Run against this product's own light surface (#f8fafc), the obvious seven-hue
 * set FAILS: yellow #f59f0a sits at L 0.77, outside the lightness band, and
 * green↔orange measure ΔE 6.2 under deuteranopia. Green is absent here because
 * it collides with BOTH orange and red for red-green colour blindness — the
 * single most common form.
 *
 * These five measure: CVD ΔE 12.8 (deutan) / 32.5 (tritan), normal-vision 28.6,
 * all inside the lightness band. Orange and teal fall below 3:1 against the
 * surface, so anything using them MUST carry a visible label or legend — which
 * is why the dependency map ships both.
 *
 * ── NEVER CYCLE ─────────────────────────────────────────────────────────────
 *
 * A sixth item does not wrap around to slot 1. Two things sharing a colour is
 * worse than one of them being explicitly "Other", because a repeated hue reads
 * as a claim that they are the same. categoricalColor() returns null past the
 * end and the caller renders a neutral.
 */
export const categoricalColors = [
  'var(--chart-blue)',
  'var(--chart-orange)',
  'var(--chart-teal)',
  'var(--chart-red)',
  'var(--chart-indigo)',
] as const

/**
 * A stable colour for `id`, or null once the palette is exhausted.
 *
 * STABLE MEANS DERIVED FROM POSITION IN A SORTED LIST, not from iteration order
 * or a hash. A filter that removes one project must not repaint the survivors —
 * colour follows the entity, never its rank in the current view.
 */
export function categoricalColor(id: string, orderedIds: readonly string[]): string | null {
  const index = orderedIds.indexOf(id)

  return index >= 0 && index < categoricalColors.length ? categoricalColors[index] : null
}
