import { cn } from '@/lib/utils'

const styles: Record<string, string> = {
  low: 'border-success/30 bg-success/10 text-success',
  medium: 'border-warning/40 bg-warning/10 text-warning',
  high: 'border-destructive/35 bg-destructive/10 text-destructive',
  critical: 'border-purple-800/40 bg-purple-950/15 text-purple-800 dark:text-purple-300',
  urgent: 'border-purple-800/40 bg-purple-950/15 text-purple-800 dark:text-purple-300',
}

export function PriorityBadge({ priority, className }: { priority?: string | null; className?: string }) {
  if (!priority) return <span className="text-muted-foreground">—</span>
  const key = priority.trim().toLowerCase()
  return <span className={cn(
    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize leading-none',
    styles[key] ?? 'border-border bg-muted text-muted-foreground',
    className,
  )}>{priority}</span>
}
