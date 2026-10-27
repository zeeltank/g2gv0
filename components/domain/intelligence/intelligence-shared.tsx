'use client'

import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import type { InsightClass, InsightSeverity } from '@/types/intelligence'

/** Severity wording is plain business language, not a database label. */
export const SEVERITY: Record<
  InsightSeverity,
  { label: string; variant: 'destructive' | 'warning' | 'navy' | 'muted'; bar: string }
> = {
  high: { label: 'High priority', variant: 'destructive', bar: 'bg-destructive' },
  medium: { label: 'Medium priority', variant: 'warning', bar: 'bg-warning' },
  low: { label: 'Low priority', variant: 'navy', bar: 'bg-primary' },
  info: { label: 'For information', variant: 'muted', bar: 'bg-muted-foreground' },
}

/** How a finding was derived. There is no AI-written class: nothing on this screen is. */
export const CLASS_LABEL: Record<InsightClass, { label: string; hint: string }> = {
  measured: { label: 'Measured', hint: 'A direct count of your records.' },
  calculated: {
    label: 'Calculated by rule',
    hint: 'A fixed rule applied to your records, the same rule the owning screen uses.',
  },
}

/**
 * A link to an existing screen. The path comes from the server (the menu table), so a screen this organisation does
 * not have arrives as null and the control disables itself with the reason, instead of pointing at a dead page.
 */
export function ScreenLink({
  to,
  reason,
  children,
  variant = 'outline',
}: {
  to: string | null
  reason?: string | null
  children: string
  variant?: 'outline' | 'link' | 'default'
}) {
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const disabled = !to

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={disabled}
      title={disabled ? (reason ?? 'This screen is not available.') : undefined}
      onClick={to ? () => router.push(resolveAccessLink(to)) : undefined}
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Button>
  )
}

export function SeverityBadge({ severity }: { severity: InsightSeverity }) {
  return <Badge variant={SEVERITY[severity].variant}>{SEVERITY[severity].label}</Badge>
}
