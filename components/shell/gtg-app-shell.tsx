'use client'

import { Component, useState, useEffect, useCallback, useRef, Suspense, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { PanelLeftClose } from 'lucide-react'
import { resolveBreadcrumb, HOME_NAV, type ActiveNav } from '@/hooks/use-navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { GtgSidebar } from '@/components/shell/gtg-sidebar'
import { GtgHeader } from '@/components/shell/gtg-header'
import FloatingToolbar from '@/components/shell/gtg-floating-toolbar'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { AgentPanel } from '@/components/shell/agent/agent-drawer'
import type { Message as AgentMessage } from '@/components/shell/agent/agent-chat'
import { loadContentRoute, COMING_SOON_CONTENT, type ContentRoute } from '@/hooks/use-content-map'
import { consumeSidebarFirstOpenExpansion } from '@/lib/sidebar-first-open'
import { getLaravelContext } from '@/lib/laravel-context'

const DEFAULT_ACTIVE: ActiveNav = HOME_NAV

function getRoutePath(active: ActiveNav): string {
  if (active.moduleId === 'm0') {
    return '/dashboard'
  }
  return `/module/${active.moduleId}/${active.menuId}/${active.submenuId}`
}

function parseRoutePath(pathname: string): ActiveNav | null {
  if (pathname === '/dashboard') {
    return HOME_NAV
  }
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
    <div className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="h-8 w-40 rounded-md bg-muted/70" />
      <div className="grid gap-3">
        <div className="h-24 rounded-lg bg-muted/40" />
        <div className="h-24 rounded-lg bg-muted/40" />
        <div className="h-24 rounded-lg bg-muted/40" />
      </div>
    </div>
  )
}

class ContentErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
          <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            {this.state.error.message || 'This content failed to load.'}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

function ComingSoonFallback({ active }: { active: ActiveNav }) {
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

function ContentRenderer({ active }: { active: ActiveNav }) {
  const [route, setRoute] = useState<ContentRoute | undefined | null>(undefined)

  useEffect(() => {
    let cancelled = false
    loadContentRoute(active)
      .then((resolved) => {
        if (!cancelled) setRoute(resolved ?? null)
      })
      .catch(() => {
        if (!cancelled) setRoute(null)
      })
    return () => {
      cancelled = true
    }
  }, [active])

  if (route === undefined) {
    return <ContentSkeleton />
  }

  const ContentComponent = route?.component

  return (
    <ContentErrorBoundary>
      <Suspense fallback={<ContentSkeleton />}>
        {ContentComponent ? <ContentComponent /> : <ComingSoonFallback active={active} />}
      </Suspense>
    </ContentErrorBoundary>
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

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync navigation state with URL */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleNavSelect = (next: ActiveNav) => {
    router.push(getRoutePath(next))
  }

  const [internalAgentOpen, setInternalAgentOpen] = useState(false)
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const agentMessagesRef = useRef<AgentMessage[]>([])
  /**
   * Stable per-mount id so the server can keep follow-up context ("show me
   * their names") for this chat panel without persisting it anywhere.
   */
  const agentSessionIdRef = useRef<string>(`agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const agentOpenState = agentOpen ?? internalAgentOpen
  const setAgentOpen = useCallback((next: boolean) => {
    setInternalAgentOpen(next)
    onAgentOpenChange?.(next)
  }, [onAgentOpenChange])

  useEffect(() => {
    agentMessagesRef.current = agentMessages
  }, [agentMessages])

  const handleAgentSendMessage = useCallback(async (message: string) => {
    const trimmed = message.trim()
    if (!trimmed) return

    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    const nextMessages = [...agentMessagesRef.current, userMessage]
    setAgentOpen(true)
    setAgentError(null)
    setAgentMessages(nextMessages)
    setAgentLoading(true)

    try {
      const currentUser = user as (typeof user & { subInstituteId?: string }) | null
      /**
       * The Laravel session (token, sub_institute_id, syear) is what lets the
       * conversational layer read live module data through the same token
       * authenticated endpoints the screens use. Without it the assistant still
       * answers general questions and says system data is unavailable.
       */
      const laravelContext = getLaravelContext(user)
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responseMode: 'json',
          messages: nextMessages.map((item) => ({
            id: item.id,
            role: item.role,
            content: item.content,
          })),
          context: {
            userId: laravelContext.userId || currentUser?.id,
            subInstituteId: laravelContext.subInstituteId || currentUser?.subInstituteId,
            role: currentUser?.role,
            profileName: currentUser?.profileName,
            employeeNo: currentUser?.employeeNo,
            orgId: laravelContext.organizationId || currentUser?.orgId,
            token: laravelContext.token,
            syear: laravelContext.syear,
            sessionId: agentSessionIdRef.current,
          },
        }),
      })

      const payload = (await response.json()) as {
        error?: string
        message?: {
          id?: string
          role?: 'assistant'
          content?: string
        }
        response?: {
          message?: string
          status?: string
          conversationType?: string
          activeTools?: string[]
        }
      }

      if (!response.ok) {
        throw new Error(payload.error || 'The AI agent request failed.')
      }

      setAgentMessages((current) => [
        ...current,
        {
          id: payload.message?.id || `assistant-${Date.now()}`,
          role: 'assistant',
          content:
            payload.response?.message?.trim() ||
            payload.message?.content?.trim() ||
            'No visible response was returned.',
          status: payload.response?.status,
          conversationType: payload.response?.conversationType,
          tools: payload.response?.activeTools,
        },
      ])
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'The AI agent request failed.'

      setAgentError(errorMessage)
      setAgentMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: errorMessage,
          variant: 'error',
        },
      ])
    } finally {
      setAgentLoading(false)
    }
  }, [setAgentOpen, user])

  const breadcrumbItems = resolveBreadcrumb(active)

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const toolbarButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (consumeSidebarFirstOpenExpansion()) {
      queueMicrotask(() => {
        setSidebarCollapsed(false)
      })
    }
  }, [])

  return (
    <div role="application" aria-label="GapstoGrowth HRMS" className="flex h-screen w-full bg-background overflow-hidden">
      <GtgSidebar
        active={active}
        onSelect={handleNavSelect}
        role={user?.role || 'employee'}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div
        className={cn(
          'flex h-screen w-full flex-col pl-0 transition-[padding-left] duration-200',
          sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]',
        )}
      >
        <GtgHeader
          agentOpen={agentOpenState}
          onAgentOpenChange={setAgentOpen}
          onSendAgentMessage={handleAgentSendMessage}
          onMenuClick={() => setMobileNavOpen(true)}
          toolbarOpen={toolbarOpen}
          onToolbarToggle={() => setToolbarOpen((open) => !open)}
          toolbarButtonRef={toolbarButtonRef}
        />
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
              <main className="g2g-page-scroll g2g-scrollbar flex-1 bg-background overflow-auto">
                <div className="w-full min-h-full p-6">
                  {children ?? (
                    <>
                      <GtgBreadcrumbFromContext />
                      <ContentRenderer active={active} />
                    </>
                  )}
                </div>
              </main>
            </div>
            <aside aria-label="AI Agent Panel" className="flex-shrink-0 border-l border-border bg-background overflow-hidden transition-[width] duration-300"
              style={{ width: agentOpenState ? 'var(--agent-panel-width)' : '0px', transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}>
              <div className="h-full">
                {agentOpenState && (
                  <AgentPanel
                    messages={agentMessages}
                    isLoading={agentLoading}
                    error={agentError}
                    onClose={() => setAgentOpen(false)}
                    onSendMessage={handleAgentSendMessage}
                  />
                )}
              </div>
            </aside>
          </div>
        </BreadcrumbItemsProvider>
        <FloatingToolbar
          isAgentOpen={agentOpenState}
          open={toolbarOpen}
          onOpenChange={setToolbarOpen}
          triggerRef={toolbarButtonRef}
        />
      </div>
    </div>
  )
}
