'use client'

/**
 * THE LAST NAVBAR BUTTON'S PANEL — PLATFORM SERVICES AND AI & INTELLIGENCE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS (replacing `gtg-floating-toolbar.tsx`)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This button used to open `RightFloatingToolbar`, a page-builder style panel
 * (Search / Text / Image / Layout / Chart / Table / Card / Design) whose
 * `OptionCard` buttons carried no `onClick` at all — fully decorative, dead UI.
 *
 * Meanwhile `gtg-user-menu.tsx` (the profile dropdown) carried the real
 * "Platform Services" and "AI & Intelligence" sections, 24 items that made the
 * account menu a 27-row scrolling list mixing "things about you" with
 * "platform admin consoles." That content moves here: same button, same
 * open/close/positioning mechanics, real content.
 *
 * Both sections come from `packages/`, which is also what builds their consoles
 * and every detail page. Adding or renaming an entry is a registry edit; this
 * file does not change. Neither section is gated by a hardcoded role check —
 * every entry is filtered individually by `usePlatformServicesAccess()`, the
 * same tblgroupwise_rights_g2g rows the API actually enforces via
 * `platformright` (routes/platform.php and routes/ai.php alike) — what appears
 * here is exactly what will not 403. A section with nothing visible does not
 * render at all, rather than showing a heading over an empty list.
 */

import { useEffect, useRef, useState, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { AI_CAPABILITIES } from '@shared/ai-intelligence-core'
import { PLATFORM_MENU_SECTION } from '@shared/platform-services-core'
import { platformServiceIcon } from '@/lib/platform/icons'
import { usePlatformDestination } from '@/hooks/use-platform-destination'
import { useCapabilityDestination } from '@/hooks/use-capability-destination'
import { usePlatformServicesAccess } from '@/hooks/use-platform-services-access'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import {
  AG_AGENT_DASHBOARD_ACCESS_LINK,
  AG_AGENT_LIBRARY_ACCESS_LINK,
  AG_CREATE_AGENT_ACCESS_LINK,
  AG_RUN_LOG_ACCESS_LINK,
  AG_ANALYTICS_ACCESS_LINK,
  AG_MULTI_AGENT_ACCESS_LINK,
  AG_REFLECTION_ACCESS_LINK,
} from '@/lib/gtg-navigation'
import type { PlatformService } from '@shared/platform-services-core'
import type { AiCapability } from '@shared/ai-intelligence-core'

/**
 * The seven Agentic AI screens, listed directly rather than as entries in the
 * shared `AI_CAPABILITIES` registry — that registry is a cross-product
 * capability catalog (purpose/whyCentral/solutions-consumption fields per
 * row, shared with LMS K-12 and Enterprise Brain), and these are literal
 * G2G module screens, not independent product capabilities. The single
 * `ai.agents` ("Agent Management") registry entry stays as-is — it still
 * backs `/ai/agents`'s description page and the roadmap — but is excluded
 * from the flat AI capability list below and replaced here by this labeled
 * sub-column of its real screens, the same shape "Setup and configuration"
 * already uses under Platform services.
 *
 * No role check gates these: each is resolved per-screen against the
 * signed-in profile's own rights on its (pre-existing) tblmenumaster_g2g
 * row, exactly like RBAC/Onboarding/Mobile App Rights already are below. An
 * employee who was never granted view rights on these rows won't see them
 * here either — nothing new was seeded for this, so visibility is exactly
 * whatever it already was when these screens lived in the sidebar.
 */
const AGENTIC_SCREENS = [
  { id: 'agentic.dashboard', label: 'Agent Dashboard', accessLink: AG_AGENT_DASHBOARD_ACCESS_LINK },
  { id: 'agentic.library', label: 'Agentic Library', accessLink: AG_AGENT_LIBRARY_ACCESS_LINK },
  { id: 'agentic.create', label: 'Create Agent', accessLink: AG_CREATE_AGENT_ACCESS_LINK },
  { id: 'agentic.runlog', label: 'Run Log', accessLink: AG_RUN_LOG_ACCESS_LINK },
  { id: 'agentic.analytics', label: 'Analytics', accessLink: AG_ANALYTICS_ACCESS_LINK },
  { id: 'agentic.multiagent', label: 'Multi-Agent', accessLink: AG_MULTI_AGENT_ACCESS_LINK },
  { id: 'agentic.reflection', label: 'Reflection', accessLink: AG_REFLECTION_ACCESS_LINK },
] as const

interface MenuItem {
  id: string
  label: string
  icon: LucideIcon | undefined
  href: string
  /** `WIP` / `Soon`. Absent for anything live — a badge on everything says nothing. */
  badge?: string
}

interface MenuColumn {
  label?: string
  items: MenuItem[]
}

interface MenuSection {
  id: string
  label: string
  href: string
  span: 1 | 2
  columns: MenuColumn[]
}

function useMenuSections(): MenuSection[] {
  const resolveService = usePlatformDestination()
  const resolveCapability = useCapabilityDestination()
  const access = usePlatformServicesAccess()
  const { resolveAccessLink } = useSidebarNavigation()

  const isServiceVisible = (service: PlatformService): boolean => {
    switch (service.slug) {
      case 'rbac':
      case 'mobile-app-rights':
      case 'onboarding':
        // Ride real, never-hidden menu rows (Role & Permissions / Talent
        // Onboarding) — already correctly rights-gated, no change needed.
        return resolveService(service).isRealScreen
      case 'workflow':
      case 'scheduler':
      case 'integration':
      case 'add-process':
      case 'fields-configuration':
        return access.anyModule
      case 'document-library':
        return access.documentLibrary
      case 'event-bus':
        return access.eventBus
      case 'audit':
        return access.audit
      case 'platform-administration':
        return access.platformAdministration
      case 'whats-coming':
        return access.whatsComing
      default:
        return false
    }
  }

  // ai.agents has no case here — it's filtered out of the input list before
  // this runs (see the aiColumns block below) and resolved separately via
  // AGENTIC_SCREENS instead.
  const isCapabilityVisible = (capability: AiCapability): boolean => {
    switch (capability.id) {
      case 'ai.providers': return access.ai.providers
      case 'ai.models': return access.ai.models
      case 'ai.prompts': return access.ai.prompts
      case 'ai.policies': return access.ai.policies
      case 'ai.conversational': return access.ai.conversational
      case 'ai.knowledge-rag': return access.ai.knowledge_rag
      case 'ai.recommendations': return access.ai.recommendations
      case 'ai.knowledge-graph': return access.ai.knowledge_graph
      case 'ai.evaluation': return access.ai.evaluation
      case 'ai.usage-cost': return access.ai.usage_cost
      case 'ai.audit': return access.ai.audit
      default: return false
    }
  }

  const platformColumns = PLATFORM_MENU_SECTION.columns
    .map((column) => ({
      label: column.label,
      items: column.items
        .filter(isServiceVisible)
        .map((service) => ({
          id: service.id,
          label: service.name,
          icon: platformServiceIcon(service.slug),
          /*
           * Resolved here so the caller reaches the real screen in one click.
           * A service whose screen lives in the module tree resolves against THIS
           * user's own menu, and one they have no rights to falls back to the
           * service's page — which explains it — rather than to a 404.
           */
          href: resolveService(service).href,
          badge:
            service.status === 'live'
              ? undefined
              : service.status === 'in-progress'
                ? 'WIP'
                : 'Soon',
        })),
    }))
    // A column every one of whose items is filtered out would render a bare
    // label over nothing.
    .filter((column) => column.items.length > 0)

  const aiColumns = [
    {
      // ai.agents is excluded here — it's replaced by the labeled "Agent
      // Management" column below, listing its real screens instead of the
      // one generic description page.
      items: AI_CAPABILITIES.filter((c) => c.id !== 'ai.agents')
        .filter(isCapabilityVisible)
        .map((capability) => ({
          id: capability.id,
          label: capability.name,
          icon: undefined,
          href: resolveCapability(capability).href,
          badge:
            capability.status === 'live'
              ? undefined
              : capability.status === 'in-progress'
                ? 'WIP'
                : 'Soon',
        })),
    },
    {
      label: 'Agent Management',
      items: AGENTIC_SCREENS.filter((screen) => {
        const resolved = resolveAccessLink(screen.accessLink)
        return resolved !== '/dashboard'
      }).map((screen) => ({
        id: screen.id,
        label: screen.label,
        icon: undefined,
        href: resolveAccessLink(screen.accessLink),
        badge: undefined,
      })),
    },
  ].filter((column) => column.items.length > 0)

  const sections: MenuSection[] = []

  if (platformColumns.length > 0) {
    sections.push({
      id: PLATFORM_MENU_SECTION.id,
      label: PLATFORM_MENU_SECTION.label,
      href: PLATFORM_MENU_SECTION.href,
      span: PLATFORM_MENU_SECTION.span,
      columns: platformColumns,
    })
  }

  if (aiColumns.length > 0) {
    sections.push({
      id: 'ai-intelligence',
      label: 'AI and insights',
      href: '/ai',
      span: aiColumns.length > 1 ? 2 : 1,
      columns: aiColumns,
    })
  }

  return sections
}

/**
 * One section of the panel: a heading that is itself a destination, then its columns.
 *
 * The rule sits above the whole section rather than above each column, so a two-column
 * section reads as one heading over two lists instead of as two headings that happen to
 * be adjacent.
 */
function MenuSectionBlock({
  section,
  onNavigate,
}: {
  section: MenuSection
  onNavigate: (href: string) => void
}) {
  const headingId = `platform-launcher-section-${section.id}`

  return (
    <nav
      aria-labelledby={headingId}
      className={section.span === 2 ? 'min-w-0 sm:col-span-2' : 'min-w-0'}
    >
      <div className="px-1 pb-2">
        <button
          type="button"
          id={headingId}
          onClick={() => onNavigate(section.href)}
          className="max-w-full truncate rounded-md text-left text-sm font-bold text-popover-foreground transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {section.label}
        </button>
      </div>

      <div
        className={`grid gap-x-3 gap-y-4 border-t border-border pt-2 ${
          section.span === 2 ? 'sm:grid-cols-2' : ''
        }`}
      >
        {section.columns.map((column, index) => (
          <div key={column.label ?? index} className="min-w-0">
            {column.label && (
              <p className="px-1 pb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {column.label}
              </p>
            )}

            <ul className="space-y-1">
              {column.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.href)}
                    title={item.label}
                    className="flex h-10 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-left text-sm font-semibold text-muted-foreground shadow-xs transition-all outline-none hover:border-muted-foreground/30 hover:bg-muted/60 hover:text-foreground hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* A label with no glyph falls back to its own initial, which is
                        what the sidebar does for an unresolvable icon — a missing
                        glyph never costs the row its shape. */}
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                      aria-hidden="true"
                    >
                      {item.icon ? (
                        <item.icon className="size-[15px]" />
                      ) : (
                        item.label.charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="shrink-0 text-[10px] tracking-wider text-muted-foreground/70 uppercase">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

export default function PlatformServicesLauncher({
  isAgentOpen,
  open,
  onOpenChange,
  triggerRef,
}: {
  isAgentOpen: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef?: RefObject<HTMLButtonElement | null>
}) {
  const router = useRouter()
  const sections = useMenuSections()
  const containerRef = useRef<HTMLDivElement>(null)
  const [topOffset, setTopOffset] = useState(56)

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  useEffect(() => {
    if (isAgentOpen) {
      onOpenChange(false)
    }
  }, [isAgentOpen, onOpenChange])

  useEffect(() => {
    if (!open) {
      return
    }

    const updatePosition = () => {
      const trigger = triggerRef?.current
      if (!trigger) {
        setTopOffset(56)
        return
      }

      const rect = trigger.getBoundingClientRect()
      setTopOffset(rect.bottom + 8)
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, triggerRef])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (containerRef.current?.contains(target)) {
        return
      }

      if (triggerRef?.current?.contains(target)) {
        return
      }

      onOpenChange(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onOpenChange, open, triggerRef])

  if (isAgentOpen || !open) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className="fixed right-0 z-50 flex items-start pr-4"
      style={{ top: topOffset }}
    >
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Platform services and AI and insights"
        className="pointer-events-auto flex max-h-[85vh] w-[min(calc(100vw-1.5rem),18rem)] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl sm:w-auto"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {sections.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-3 gap-y-5 sm:grid-cols-[repeat(3,220px)]">
              {sections.map((section) => (
                <MenuSectionBlock key={section.id} section={section} onNavigate={go} />
              ))}
            </div>
          ) : (
            <p className="p-2 text-sm text-muted-foreground">No platform services available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
