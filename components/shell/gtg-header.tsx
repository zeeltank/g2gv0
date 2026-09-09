'use client'

import { type RefObject } from 'react'
import { LayoutGrid, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GtgNavSearch } from '@/components/shell/gtg-nav-search'
import { NotificationsMenu } from '@/components/shell/notifications-menu'
import { GtgUserMenu } from '@/components/shell/gtg-user-menu'
import { AgentButton } from '@/components/shell/agent/agent-button'

export function GtgHeader({
  agentOpen,
  onAgentOpenChange,
  onSendAgentMessage,
  onMenuClick,
  toolbarOpen,
  onToolbarToggle,
  toolbarButtonRef,
}: {
  agentOpen?: boolean
  onAgentOpenChange?: (open: boolean) => void
  onSendAgentMessage?: (message: string) => void | Promise<void>
  onMenuClick?: () => void
  toolbarOpen?: boolean
  onToolbarToggle?: () => void
  toolbarButtonRef?: RefObject<HTMLButtonElement | null>
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
        <AgentButton
          agentOpen={agentOpen}
          onAgentOpenChange={onAgentOpenChange}
          onSendMessage={onSendAgentMessage}
        />
        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
        <GtgUserMenu />
         <button
          ref={toolbarButtonRef}
          type="button"
          onClick={onToolbarToggle}
          aria-label="Toggle toolbar"
          aria-haspopup="dialog"
          aria-expanded={toolbarOpen}
          className={cn(
            'relative flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-ring',
            toolbarOpen && 'bg-secondary text-secondary-foreground',
          )}
        >
          <LayoutGrid  className="size-5" aria-hidden="true" />
        </button>

      </div>
    </header>
  )
}
