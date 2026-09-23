import { cn } from '@/lib/utils'

/*
 * `size` and `tone` exist so a caller that needs the mark bigger, or on a dark
 * ground, does not have to reach into this component's DOM to get it — the
 * sign-in screen used to resize this with six arbitrary-variant selectors
 * (`[&>div:first-child]:size-14 …`) that broke silently the moment this file's
 * markup changed shape. `tone="inverted"` exists for exactly one caller: a
 * dark-navy surface where the default `bg-primary` tile and `text-foreground`
 * name would both lose most of their contrast.
 */

type BrandMarkSize = 'sm' | 'md' | 'lg'
type BrandMarkTone = 'default' | 'inverted'

const TILE: Record<BrandMarkSize, string> = {
  sm: 'size-9 rounded-md',
  md: 'size-11 rounded-lg',
  lg: 'size-14 rounded-xl',
}

const TILE_TEXT: Record<BrandMarkSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

const NAME_TEXT: Record<BrandMarkSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
}

const SUB_TEXT: Record<BrandMarkSize, string> = {
  sm: 'text-xs',
  md: 'text-xs',
  lg: 'text-sm',
}

export function GtgBrandMark({
  collapsed = false,
  size = 'sm',
  tone = 'default',
  className,
}: {
  collapsed?: boolean
  size?: BrandMarkSize
  tone?: BrandMarkTone
  className?: string
}) {
  const inverted = tone === 'inverted'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center shadow-sm',
          TILE[size],
          inverted
            ? 'bg-white/95 text-brand-navy ring-1 ring-white/15'
            : 'bg-primary text-primary-foreground',
        )}
        aria-hidden="true"
      >
        <span className={cn('font-mono font-bold tracking-tight', TILE_TEXT[size])}>G2G</span>
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span
            className={cn(
              'truncate font-bold',
              NAME_TEXT[size],
              inverted ? 'text-white' : 'text-foreground',
            )}
          >
            GapstoGrowth
          </span>
          <span
            className={cn(
              'truncate font-medium',
              SUB_TEXT[size],
              inverted ? 'text-white/60' : 'text-muted-foreground',
            )}
          >
            HRMS Platform
          </span>
        </div>
      )}
    </div>
  )
}
