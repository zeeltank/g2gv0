import { cn } from '@/lib/utils'

export function GtgBrandMark({
  collapsed = false,
  className,
}: {
  collapsed?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="g2g-brand-gradient flex size-9 shrink-0 items-center justify-center rounded-md text-brand-foreground shadow-sm"
        aria-hidden="true"
      >
        <span className="font-mono text-sm font-bold tracking-tight">G2G</span>
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold text-foreground">
            GapstoGrowth
          </span>
          <span className="truncate text-xs font-medium text-muted-foreground">
            HRMS Platform
          </span>
        </div>
      )}
    </div>
  )
}
