'use client'

import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { PanelLeftClose } from 'lucide-react'
import { resolveBreadcrumb, type ActiveNav } from '@/hooks/use-navigation'
import { useAuth } from '@/components/auth/gtg-auth'
import { GtgSidebar } from '@/components/shell/gtg-sidebar'
import { GtgHeader } from '@/components/shell/gtg-header'
import FloatingToolbar from '@/components/shell/gtg-floating-toolbar'
import { GtgBreadcrumb } from '@/components/shell/gtg-breadcrumb'
import { AgentPanel } from '@/components/shell/agent/agent-drawer'
import { getContentRoute, COMING_SOON_CONTENT } from '@/hooks/use-content-map'
import type { ReactNode } from 'react'

const DEFAULT_ACTIVE: ActiveNav = {
  moduleId: 'm1',
  menuId: 'org-setup',
  submenuId: 'org-profile',
}

function getRoutePath(active: ActiveNav): string {
  return `/module/${active.moduleId}/${active.menuId}/${active.submenuId}`
}

function parseRoutePath(pathname: string): ActiveNav | null {
  const match = pathname.match(/^\/module\/([^/]+)\/([^/]+)\/([^/]+)/)
  if (match) {
    return {
      moduleId: match[1],
      menuId: match[2],
      submenuId: match[3],
    }
  }
  return null
}

function ComingSoonScreen({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-lg bg-accent text-accent-foreground" aria-hidden="true">
        <PanelLeftClose className="size-7 opacity-50" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

function ContentSkeleton() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16">
      <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
    </div>
  )
}

function ContentRenderer({ active }: { active: ActiveNav }) {
  const route = getContentRoute(active)
  
  if (route) {
    const LazyComponent = lazy(route.component)
    return (
      <Suspense fallback={<ContentSkeleton />}>
        <LazyComponent />
      </Suspense>
    )
  }
  
  const comingSoon = COMING_SOON_CONTENT[active.submenuId || active.menuId || '']
  if (comingSoon) {
    return <ComingSoonScreen title={comingSoon.title} description={comingSoon.description} />
  }
  
  return (
    <ComingSoonScreen
      title="Application Shell Ready"
      description="This is the GapstoGrowth master application layout. Select a module in the sidebar to get started."
    />
  )
}

interface GtgAppShellProps {
  children?: ReactNode
  initialActive?: ActiveNav
  agentOpen?: boolean
  onAgentOpenChange?: (open: boolean) => void
}

export function GtgAppShell({
  children,
  initialActive,
  agentOpen,
  onAgentOpenChange,
}: GtgAppShellProps = {}) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [active, setActive] = useState<ActiveNav>(() => {
    if (initialActive) return initialActive
    if (!children && pathname) {
      const parsed = parseRoutePath(pathname)
      if (parsed) return parsed
    }
    return DEFAULT_ACTIVE
  })

  useEffect(() => {
    if (children) return
    const parsed = parseRoutePath(pathname)
    if (parsed) {
      setActive((prev) => {
        if (prev.moduleId === parsed.moduleId && prev.menuId === parsed.menuId && prev.submenuId === parsed.submenuId) {
          return prev
        }
        return parsed
      })
    }
  }, [pathname, children])

  const handleNavSelect = (next: ActiveNav) => {
    router.push(getRoutePath(next))
  }

  const [internalAgentOpen, setInternalAgentOpen] = useState(false)
  const agentOpenState = agentOpen ?? internalAgentOpen
  const setAgentOpen = useCallback((next: boolean) => {
    setInternalAgentOpen(next)
    onAgentOpenChange?.(next)
  }, [onAgentOpenChange])

  const breadcrumbItems = resolveBreadcrumb(active)

  return (
    <div role="application" aria-label="GapstoGrowth HRMS" className="flex h-screen w-full bg-background overflow-hidden">
      <GtgSidebar active={active} onSelect={handleNavSelect} role={user?.role || 'employee'} />
      <div className="flex h-screen w-full flex-col pl-[72px]">
        <GtgHeader agentOpen={agentOpenState} onAgentOpenChange={setAgentOpen} />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
            <GtgBreadcrumb items={breadcrumbItems} />
            <main className="g2g-page-scroll g2g-scrollbar flex-1 bg-background overflow-auto">
              <div className="w-full min-h-full p-6">
                {children ?? <ContentRenderer active={active} />}
              </div>
            </main>
          </div>
          <aside aria-label="AI Agent Panel" className="flex-shrink-0 border-l border-border bg-background overflow-hidden transition-[width] duration-300"
            style={{ width: agentOpenState ? 'var(--agent-panel-width)' : '0px', transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}>
            <div className="h-full">
              <AgentPanel onClose={() => setAgentOpen(false)} />
            </div>
          </aside>
        </div>
        <FloatingToolbar isAgentOpen={agentOpenState} />
      </div>
    </div>
  )
}
