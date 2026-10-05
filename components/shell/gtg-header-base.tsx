'use client'

import { type RefObject } from 'react'
import { ChevronDown, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GtgNavSearch } from '@/components/shell/gtg-nav-search'
import { NotificationsMenu } from '@/components/shell/notifications-menu'
import { GtgUserMenu } from '@/components/shell/gtg-user-menu'

export function GtgHeaderBase({
  onMenuClick,
  subheaderOpen,
  onSubheaderToggle,
  subheaderButtonRef,
}: {
  onMenuClick?: () => void
  subheaderOpen?: boolean
  onSubheaderToggle?: () => void
  subheaderButtonRef?: RefObject<HTMLButtonElement | null>
} = {}) {
  return (
    <header
      className="flex h-12 shrink-0 items-center gap-4 border-b border-border bg-card px-4 shadow-sm md:px-6"
      role="banner"
    >
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      {/* Was a dead <input type="search"> with no handler of any kind. */}
      <GtgNavSearch />

      <div className="ml-auto flex items-center gap-2">
        {onSubheaderToggle && (
          <button
            ref={subheaderButtonRef}
            type="button"
            onClick={onSubheaderToggle}
            aria-label="Toggle platform services"
            aria-haspopup="true"
            aria-expanded={subheaderOpen}
            aria-controls="platform-services-subheader"
            className={cn(
              'flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring',
              subheaderOpen && 'bg-secondary text-secondary-foreground',
            )}
          >
            <ChevronDown
              className={cn('size-5 transition-transform duration-200', subheaderOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
        )}
        <NotificationsMenu />
        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <GtgUserMenu />
      </div>
    </header>
  )
}
