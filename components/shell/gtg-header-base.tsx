'use client'

import { Menu } from 'lucide-react'
import { GtgNavSearch } from '@/components/shell/gtg-nav-search'
import { NotificationsMenu } from '@/components/shell/notifications-menu'
import { GtgUserMenu } from '@/components/shell/gtg-user-menu'

export function GtgHeaderBase({
  onMenuClick,
}: {
  onMenuClick?: () => void
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
        <NotificationsMenu />
        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <GtgUserMenu />
      </div>
    </header>
  )
}
