'use client'

import { Component, useState, useEffect, useCallback, useMemo, useRef, Suspense, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { PanelLeftClose } from 'lucide-react'
import { resolveBreadcrumb, type ActiveNav } from '@/hooks/use-navigation'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { cn } from '@/lib/utils'
import { useAppPreferences } from '@/components/providers/preferences-provider'
import { rememberLastVisited } from '@/lib/last-visited'
import { GtgSidebar } from '@/components/shell/gtg-sidebar'
import { GtgHeader } from '@/components/shell/gtg-header'
import { PlatformServicesSubheader } from '@/components/shell/platform-services-subheader'
import PlatformServicesLauncher from '@/components/shell/gtg-platform-services-launcher'
import { BreadcrumbItemsProvider, GtgBreadcrumbFromContext } from '@/components/shell/gtg-breadcrumb'
import { AgentPanel } from '@/components/shell/agent/agent-drawer'
import type { Message as AgentMessage } from '@/components/shell/agent/agent-chat'
import { loadContentRoute, COMING_SOON_CONTENT, type ContentRoute } from '@/hooks/use-content-map'
import { consumeSidebarFirstOpenExpansion } from '@/lib/sidebar-first-open'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { isAiCoreEnabled, isChatLifecycleEnabled, isModuleChatEnabled } from '@/lib/ai-core/flag'
import { useActiveModule } from '@/hooks/use-active-module'
import { askAssistant } from '@/lib/intelligence/ai-conversations'
import { fetchPageContext } from '@/lib/intelligence/ai-workspace'
import { readPage } from '@/lib/page-context/dom-snapshot'
import { createG2gActionRegistry } from '@/lib/chat-actions/g2g/registry'
import type { G2gActionApp } from '@/lib/chat-actions/g2g/actions'
import { prefillFromMessage } from '@/lib/chat-actions/registry'
import * as actionFlow from '@/lib/chat-actions/flow'
import { matchNavTarget, type NavTarget } from '@/lib/chat-actions/navigation'
import { createG2gEntityProviders } from '@/lib/page-entities/g2g/registry'
import { MAX_LISTED, type G2gEntityApp } from '@/lib/page-entities/g2g/documents'
import { collectSuggestions, resolveEntity } from '@/lib/page-entities/resolve'
import type { EntityContext, EntityMatch } from '@/lib/page-entities/types'
import type { LifecyclePayload } from '@/lib/intelligence/ai-lifecycle'
import type { ActionContext, ActionInput, ChatActionDefinition, FlowState } from '@/lib/chat-actions/types'
import {
  cancelActionRequest,
  claimActionRequest,
  completeActionRequest,
  createActionRequest,
  getActionRequest,
  listActionRequests,
  resolveActionRequest,
  type ActionRequest,
} from '@/lib/intelligence/ai-action-requests'
import { ChatActionsContext, type ChatActionsApi } from '@/components/shell/agent/chat-actions-context'
import { usePageSnapshot } from '@/lib/page-context/use-page-snapshot'
import type { G2gAiCore } from '@/lib/ai-core/runtime'
import type { AppContext as AiCoreContext } from 'darshana-ai-core'
import { accountService } from '@/services/account'
import { useAuth } from '@/components/auth/gtg-auth'


/**
 * The module and tab of the AI Stack on screen, as the AI Stack host declares them on its own
 * element - or null when no AI Stack is open. The AI Stack has no menu row, so the screen is the
 * only source; the server checks both values before using them.
 */
function readAiStack(): { module: string; tab: string } | null {
  if (typeof document === 'undefined') return null
  const host = document.querySelector('[data-ai-stack-module]')
  const stackModule = host?.getAttribute('data-ai-stack-module')
  const tab = host?.getAttribute('data-ai-stack-tab')
  return stackModule && tab ? { module: stackModule, tab } : null
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

/*
 * F-192. A crashed screen used to be a dead end with a developer error string.
 *
 * It rendered `this.state.error.message` verbatim - "Cannot read properties of
 * undefined (reading 'map')" - with no retry, no reload and no link back. And
 * because nothing ever reset `state.error`, navigating to the same route again
 * within the shell kept the boundary tripped: the only escapes were a different
 * sidebar item or a browser refresh.
 *
 * Now: a sentence a person can act on, a Try again that actually clears the
 * error, and the raw message behind a disclosure for whoever needs it.
 */
class ContentErrorBoundary extends Component<
  { children: ReactNode; resetKey?: string },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  /**
   * Clear the error when the route changes, so a screen that crashed once does
   * not poison every later visit to it.
   */
  componentDidUpdate(prevProps: { resetKey?: string }) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <h2 className="text-xl font-semibold text-foreground">This screen could not be shown</h2>
          <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            Something in it failed while loading. Your data has not been changed.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              Reload the page
            </button>
          </div>
          <details className="mt-5 max-w-md text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Technical details
            </summary>
            <p className="mt-2 break-words rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              {this.state.error.message || 'No error message was provided.'}
            </p>
          </details>
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

  /*
   * F-193. This said "Application Shell Ready - This is the GapstoGrowth master
   * application layout. Select a module in the sidebar to get started."
   *
   * Build-status text, shown to somebody who has just clicked a named menu
   * item, advising them to do the thing they did. `active` carries the item's
   * own name, so the screen can at least say which one is missing.
   */
  return (
    <ComingSoonScreen
      title="This screen is not available yet"
      description="It is listed in the menu but has not been built. Nothing is wrong with your account or your permissions - choose another item in the sidebar, or ask your administrator when this one is due."
    />
  )
}

function ContentRenderer({ active }: { active: ActiveNav }) {
  const pathname = usePathname()
  const [route, setRoute] = useState<ContentRoute | undefined | null>(undefined)

  useEffect(() => {
    let cancelled = false
    loadContentRoute(active, pathname)
      .then((resolved) => {
        if (!cancelled) setRoute(resolved ?? null)
      })
      .catch(() => {
        if (!cancelled) setRoute(null)
      })
    return () => {
      cancelled = true
    }
  }, [active, pathname])

  if (route === undefined) {
    return <ContentSkeleton />
  }

  const ContentComponent = route?.component

  return (
    // F-192. resetKey is the pathname, so a screen that crashed once is not
    // permanently broken for the rest of the session.
    <ContentErrorBoundary resetKey={pathname}>
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
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const { modules, sidebarModules, loading, getRoutePath, parseRoutePath } = useSidebarNavigation()
  /*
   * ═══════════════════════════════════════════════════════════════════════
   * THE URL IS THE SOURCE OF TRUTH — NOT A DEFAULT SCREEN
   * ═══════════════════════════════════════════════════════════════════════
   *
   * This used to seed `active` to DEFAULT_ACTIVE (the dashboard) and only
   * correct it in the effect below, which cannot run until the sidebar tree has
   * arrived over the network. So a hard refresh on ANY module page painted the
   * DASHBOARD first and the real screen a moment later — the blink users
   * reported when moving between modules.
   *
   * `null` means "not resolved yet", and the shell renders a skeleton for it.
   * A loading state is honest; a different screen is not.
   */
  const [active, setActive] = useState<ActiveNav | null>(() => initialActive ?? null)

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: sync navigation state with URL once the menu tree is loaded */
  useEffect(() => {
    /*
     * `modules.length <= 1` was the old "tree not loaded yet" test, and it was
     * wrong twice: it pinned a tenant that legitimately has ONE module to the
     * default forever, and it fired before the fetch resolved. `loading` is the
     * question actually being asked.
     *
     * THE `children` GUARD IS ALSO GONE. A page that supplies its own content
     * still has a sidebar, and `active` is what highlights it. Bailing here left
     * /dashboard pinned to whatever initialActive said and highlighted nothing,
     * because that value ('m0') belonged to a module that no longer exists.
     * Syncing regardless costs nothing — when `children` are present the content
     * does not come from `active` anyway — and it makes the highlight and the
     * breadcrumb follow the URL, which is the only thing that knows the truth.
     */
    if (loading || modules.length === 0) return

    const parsed = parseRoutePath(pathname)
    if (parsed) {
      setActive((prev) => {
        if (prev
          && prev.moduleId === parsed.moduleId
          && prev.menuId === parsed.menuId
          && prev.submenuId === parsed.submenuId) {
          return prev
        }
        return parsed
      })
      return
    }

    // The path is not in this profile's menu. Fall back to their FIRST module
    // rather than to a hardcoded dashboard they may not even have rights to.
    setActive((prev) => prev ?? {
      moduleId: modules[0].id,
      menuId: modules[0].id,
      submenuId: modules[0].id,
    })
  }, [pathname, children, modules, loading, parseRoutePath])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleNavSelect = (next: ActiveNav) => {
    const path = getRoutePath(next)

    // A SELECTION THAT MAPS NOWHERE GOES NOWHERE. getRoutePath used to answer
    // '/dashboard' for an unresolvable key, so a bad selection silently opened
    // the dashboard and looked like it had worked.
    if (!path) {
      return
    }

    if (path.startsWith('http')) {
      window.open(path, '_blank', 'noopener,noreferrer')
      return
    }

    /*
     * A full navigation when only the search params are changing. See the
     * identical, directly-verified note in `gtg-page-shell.tsx`'s own
     * `handleNavSelect` — `router.push()` to a URL sharing the current
     * pathname (differing only by e.g. `?module=`) was confirmed to be a
     * silent no-op in production for the Platform Services consoles this
     * shell can also reach; a full navigation always works. An ordinary
     * cross-route click (a different pathname) is unaffected.
     */
    const currentPathname = typeof window !== 'undefined' ? window.location.pathname : null
    const nextPathname = path.split('?')[0]

    if (currentPathname !== null && currentPathname === nextPathname) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate: router.push() is the no-op being worked around here, confirmed directly (see the note above).
      window.location.href = path
      return
    }

    setActive(next)
    router.push(path)
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
  /*
   * The module the user is inside, as an `ai_modules` key — or null when the route is not
   * inside a module that has an AI Stack (or the flag is off). Resolved from the live menu
   * tree, never defaulted: a chat opened outside a module must not pick up some module's data.
   */
  const { stack: activeAiStack } = useActiveModule()
  const moduleChatKey = isModuleChatEnabled() ? (activeAiStack?.key ?? null) : null
  const agentOpenState = agentOpen ?? internalAgentOpen
  const setAgentOpen = useCallback((next: boolean) => {
    setInternalAgentOpen(next)
    onAgentOpenChange?.(next)
  }, [onAgentOpenChange])

  /*
   * The page the chat is opened on: the deepest menu node the sidebar resolved (a
   * `tblmenumaster_g2g` id), with the route as a fallback. The backend turns it into the
   * questions worth asking from that page - real data sources and curated suggestions for the
   * module it belongs to, nothing from other modules. `null` until it answers, and `[]` if it
   * cannot: the panel then shows no starter questions rather than the generic list.
   */
  const pageMenuId = active?.submenuId && /^\d+$/.test(active.submenuId) ? Number(active.submenuId) : null
  // Stored with the page they were made for, so a previous page's questions can never be
  // shown on the next one while its own are still loading.
  const [pagePromptState, setPagePromptState] = useState<{ path: string; prompts: string[] } | null>(null)
  const pagePrompts = pagePromptState?.path === pathname ? pagePromptState.prompts : null

  /*
   * PAGE ENTITIES. The kinds of record a page lists that the chat can find and open ("show this
   * person's document"). The context is rebuilt at the moment it is needed so it carries the
   * signed-in user's current session, never a stale one.
   */
  const entityProviders = useMemo(() => createG2gEntityProviders(), [])
  const lastEntityRef = useRef<{ id: number; title: string } | null>(null)
  const entityContext = useCallback(
    (): EntityContext<G2gEntityApp> => ({
      pathname,
      menuId: pageMenuId,
      moduleKey: moduleChatKey,
      // `recent` is the file the chat last opened or showed, so "where is this file?" has something to point at.
      app: { laravel: getLaravelContext(user), recent: lastEntityRef.current },
    }),
    [pathname, pageMenuId, moduleChatKey, user],
  )
  // Suggestions built from a page's real records are kept for a minute per page, so the page
  // re-reading itself (the snapshot changes often) does not refetch them every time.
  const entitySuggestionCache = useRef<{ path: string; at: number; list: string[] } | null>(null)

  const openEntity = useCallback(
    (providerKey: string, match: EntityMatch, action: 'open' | 'reveal' = 'open') => {
      const provider = entityProviders.find((candidate) => candidate.key === providerKey)
      if (!provider) return
      const context = entityContext()
      // "Show in folder" goes to where the record lives and highlights it; "Open" opens the record itself.
      const target = action === 'reveal' && provider.reveal ? provider.reveal(match, context) : provider.open(match, context)

      if (match.kind === 'file') lastEntityRef.current = { id: Number(match.id), title: match.title }

      if (target.kind === 'event') window.dispatchEvent(new CustomEvent(target.name, { detail: target.detail }))
      else router.push(target.href)
    },
    [entityProviders, entityContext, router],
  )

  /*
   * What is actually on the page - heading, counts, filters, search text, selected rows, the
   * rows of its tables - read from the content region while the chat is open. Any page gives
   * one; none registers anything. The backend turns it into questions about that page.
   */
  const pageContextOn = isModuleChatEnabled()
  const pageSnapshot = usePageSnapshot({
    enabled: Boolean(pageContextOn && agentOpenState),
    getRoot: () => document.querySelector('[data-page-context-root]'),
    watch: pathname,
  })

  useEffect(() => {
    // Any page, in or out of a module: the questions always come from the page the user is on.
    if (!pageContextOn || !agentOpenState) return

    let cancelled = false
    const aiStack = readAiStack()

    // Questions about the page's own records (documents, ...), from the records that really exist.
    const cached = entitySuggestionCache.current
    const recordQuestions: Promise<string[]> =
      cached && cached.path === pathname && Date.now() - cached.at < 60_000
        ? Promise.resolve(cached.list)
        : collectSuggestions(entityProviders, entityContext()).then((list) => {
            entitySuggestionCache.current = { path: pathname, at: Date.now(), list }
            return list
          })

    Promise.all([
      fetchPageContext({ menuId: pageMenuId, route: pathname, pageData: pageSnapshot, aiStack }).catch(() => null),
      recordQuestions,
    ])
      .then(([context, records]) => {
        if (cancelled) return
        // Questions about the page's real records come first and, when there are any, are the whole
        // answer. Otherwise the server's questions for the page. Outside a module the chat has no
        // module data to answer module-level questions with, so only questions about what is on the
        // page itself are offered; never a generic list.
        const usable = context !== null && (moduleChatKey || aiStack || context.scope === 'page' || context.scope === 'tab')
        const fromServer = usable && context ? context.suggestions.map((suggestion) => suggestion.prompt) : []
        setPagePromptState({ path: pathname, prompts: records.length > 0 ? records : fromServer })
      })
      .catch(() => {
        if (!cancelled) setPagePromptState({ path: pathname, prompts: [] })
      })

    return () => {
      cancelled = true
    }
  }, [pageContextOn, moduleChatKey, agentOpenState, pageMenuId, pathname, pageSnapshot, entityProviders, entityContext])

  useEffect(() => {
    agentMessagesRef.current = agentMessages
  }, [agentMessages])

  /*
   * CHAT ACTIONS. What the assistant can do from the page the user is on - each one an action G2G
   * already has, run through the same service the page's own button uses, as the signed-in user.
   * The universal flow (lib/chat-actions/flow.ts) is what guarantees a write needs an explicit
   * Confirm press and runs at most once; this block only holds the state and calls it.
   */
  const actionRegistry = useMemo(() => createG2gActionRegistry(), [])
  const [actionFlows, setActionFlows] = useState<Record<string, { key: string; state: FlowState }>>({})
  const actionFlowsRef = useRef(actionFlows)
  const actionContextRef = useRef<ActionContext<G2gActionApp> | null>(null)

  useEffect(() => {
    // Always the latest page and session, read at the moment an action is proposed or confirmed.
    actionContextRef.current = moduleChatKey
      ? {
          pathname,
          menuId: pageMenuId,
          moduleKey: moduleChatKey,
          snapshot: pageSnapshot,
          app: { laravel: getLaravelContext(user) },
        }
      : null
  })

  const availableActions = useMemo(() => {
    if (!moduleChatKey) return []

    return actionRegistry
      .available({ pathname, menuId: pageMenuId, moduleKey: moduleChatKey, snapshot: null, app: { laravel: getLaravelContext(user) } })
      .map(({ key, label, description, phrases }) => ({ key, label, description, phrases }))
  }, [actionRegistry, moduleChatKey, pathname, pageMenuId, user])

  /*
   * Pages the chat can take the user to: every sidebar entry that has a link. The sidebar is
   * already filtered by the server to the signed-in user's rights, so a page they cannot open is
   * never offered, and no route is named here.
   */
  const navTargets = useMemo<NavTarget[]>(() => {
    const out: NavTarget[] = []
    type Walkable = { label: string; accessLink?: string | null; children: Walkable[] }
    const walk = (nodes: Walkable[], trail: string[]) => {
      for (const node of nodes) {
        if (node.accessLink) out.push({ label: node.label, path: node.accessLink, trail })
        walk(node.children, [...trail, node.label])
      }
    }
    walk(modules, [])
    return out
  }, [modules])

  // The conversation the last lifecycle answer belonged to, so an approval request can be tied to it.
  const lastConversationIdRef = useRef<number | null>(null)

  const setFlow = useCallback((id: string, key: string, state: FlowState) => {
    const next = { ...actionFlowsRef.current, [id]: { key, state } }
    actionFlowsRef.current = next
    setActionFlows(next)
  }, [])

  const startAction = useCallback(
    (definition: ChatActionDefinition<G2gActionApp>, prefill: Record<string, string> = {}) => {
      const id = `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      setAgentOpen(true)
      setAgentMessages((current) => [...current, { id, role: 'assistant', content: '', action: { key: definition.key } }])
      setFlow(id, definition.key, actionFlow.start(definition, prefill))
    },
    [setAgentOpen, setFlow],
  )

  // Approval ledger: requests waiting for me to decide (administrators), and mine that have moved.
  const [pendingApprovals, setPendingApprovals] = useState<ActionRequest[]>([])
  const [myRequests, setMyRequests] = useState<ActionRequest[]>([])

  const refreshApprovals = useCallback(async () => {
    if (!moduleChatKey) return
    const [mine, pending] = await Promise.all([
      listActionRequests('mine', null).catch(() => [] as ActionRequest[]),
      // A refusal here just means "not an administrator" - there is nothing to decide.
      listActionRequests('pending', null).catch(() => [] as ActionRequest[]),
    ])
    setMyRequests(mine)
    setPendingApprovals(pending)
  }, [moduleChatKey])

  /**
   * Run an approved proposal: claim it on the server (approved -> executing, once - a second tab
   * or a double click loses the claim), run it as the signed-in user, then report the outcome so
   * the ledger and the card agree.
   */
  const runApproved = useCallback(
    async (id: string) => {
      const entry = actionFlowsRef.current[id]
      const definition = entry ? actionRegistry.get(entry.key) : undefined
      const context = actionContextRef.current
      if (!entry || !definition || !context) return

      const executing = actionFlow.beginApprovedExecution(entry.state)
      if (!executing || executing.requestId === undefined) return
      setFlow(id, entry.key, executing)

      try {
        await claimActionRequest(executing.requestId)
      } catch (error) {
        setFlow(
          id,
          entry.key,
          actionFlow.finish(executing, {
            ok: false,
            message: error instanceof Error ? error.message : 'This approval could not be claimed.',
          }),
        )
        return
      }

      const result = await actionFlow.executeVerified(definition, executing.values, context)

      await completeActionRequest(executing.requestId, result.ok, result.message).catch(() => undefined)
      setFlow(id, entry.key, actionFlow.finish(executing, result))
      if (result.ok) window.dispatchEvent(new CustomEvent('g2g:data-changed', { detail: { action: entry.key } }))
      void refreshApprovals()
    },
    [actionRegistry, refreshApprovals, setFlow],
  )

  // While a proposal waits for approval, ask the server for the verdict; approved runs itself.
  useEffect(() => {
    const waiting = Object.entries(actionFlows).filter(([, flowEntry]) => flowEntry.state.phase === 'awaiting_approval')
    if (waiting.length === 0) return

    const timer = window.setInterval(() => {
      for (const [id, flowEntry] of waiting) {
        const state = actionFlowsRef.current[id]?.state
        if (!state || state.phase !== 'awaiting_approval') continue

        getActionRequest(state.requestId)
          .then((request) => {
            const current = actionFlowsRef.current[id]
            if (!current) return
            const next = actionFlow.decided(current.state, request.status, request.decision_note)
            if (next === current.state) return
            setFlow(id, flowEntry.key, next)
            if (next.phase === 'approved') void runApproved(id)
          })
          .catch(() => undefined)
      }
    }, 5000)

    return () => window.clearInterval(timer)
  }, [actionFlows, runApproved, setFlow])

  useEffect(() => {
    if (!moduleChatKey) return
    // Deferred one tick: the first read is asynchronous work, not part of this render.
    const first = window.setTimeout(() => void refreshApprovals(), 0)
    const timer = window.setInterval(() => void refreshApprovals(), 30000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [moduleChatKey, refreshApprovals])

  const chatActionsApi = useMemo<ChatActionsApi | null>(() => {
    if (!moduleChatKey) return null

    const definitionOf = (id: string) => {
      const entry = actionFlowsRef.current[id]
      const definition = entry ? actionRegistry.get(entry.key) : undefined
      return entry && definition ? { entry, definition } : null
    }

    return {
      available: availableActions,
      start: (key) => {
        const definition = actionRegistry.get(key)
        if (definition) startAction(definition)
      },
      entry: (id) => {
        const found = actionFlows[id]
        const definition = found ? actionRegistry.get(found.key) : undefined
        return found && definition
          ? { label: definition.label, inputs: definition.inputs, state: found.state, requiresApproval: definition.requiresApproval === true }
          : null
      },
      loadOptions: async (input) => {
        const context = actionContextRef.current
        // The input came from this application's own definition, so it takes this application's context.
        const options = (input as ActionInput<G2gActionApp>).options
        return options && context ? options(context) : []
      },
      submit: (id, values, labels) => {
        const found = definitionOf(id)
        const context = actionContextRef.current
        if (!found || !context) return
        setFlow(id, found.entry.key, actionFlow.submit(found.entry.state, found.definition, values, context, labels))
      },
      edit: (id) => {
        const found = definitionOf(id)
        if (found) setFlow(id, found.entry.key, actionFlow.edit(found.entry.state))
      },
      cancel: (id) => {
        const found = definitionOf(id)
        if (!found) return
        const before = found.entry.state
        setFlow(id, found.entry.key, actionFlow.cancel(before))
        if (before.phase === 'awaiting_approval') {
          cancelActionRequest(before.requestId)
            .catch(() => undefined)
            .finally(() => void refreshApprovals())
        }
      },
      navigate: (path) => router.push(path),
      approvals: {
        pending: pendingApprovals,
        mine: myRequests.filter((request) => request.status === 'approved'),
        refresh: refreshApprovals,
        decide: async (requestId, decision, note) => {
          await resolveActionRequest(requestId, decision, note)
          await refreshApprovals()
        },
        // Resume an approval granted after the chat was closed: rebuild the card and run it once.
        resume: (request) => {
          const definition = actionRegistry.get(request.action_key)
          if (!definition || request.status !== 'approved' || !request.payload || !request.preview) return
          const id = `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
          setAgentOpen(true)
          setAgentMessages((current) => [...current, { id, role: 'assistant', content: '', action: { key: definition.key } }])
          setFlow(id, definition.key, { phase: 'approved', values: request.payload, preview: request.preview, requestId: request.id })
          void runApproved(id)
        },
      },
      confirm: (id) => {
        const found = definitionOf(id)
        const context = actionContextRef.current
        if (!found || !context) return

        if (found.definition.requiresApproval) {
          // Read from the ref: a second press in the same tick must find the first.
          const requesting = actionFlow.beginApproval(found.entry.state)
          if (!requesting) return
          setFlow(id, found.entry.key, requesting)

          createActionRequest({
            actionKey: found.entry.key,
            moduleKey: context.moduleKey,
            payload: requesting.values,
            preview: requesting.preview,
            conversationId: lastConversationIdRef.current,
          })
            .then((request) => {
              setFlow(id, found.entry.key, actionFlow.requested(requesting, request.id))
              void refreshApprovals()
            })
            .catch((error: unknown) => {
              setFlow(
                id,
                found.entry.key,
                actionFlow.requestFailed(requesting, {
                  ok: false,
                  message: error instanceof Error ? error.message : 'The request could not be sent for approval.',
                }),
              )
            })
          return
        }

        // Read from the ref, not render state: a second click in the same tick must see the first.
        const executing = actionFlow.beginExecution(found.entry.state)
        if (!executing) return

        setFlow(id, found.entry.key, executing)

        actionFlow
          .executeVerified(found.definition, executing.values, context)
          .then((result) => {
            setFlow(id, found.entry.key, actionFlow.finish(executing, result))

            // Let the page behind the chat show what was just written.
            if (result.ok) window.dispatchEvent(new CustomEvent('g2g:data-changed', { detail: { action: found.entry.key } }))
          })
      },
    }
  }, [moduleChatKey, actionRegistry, actionFlows, availableActions, setFlow, startAction, refreshApprovals, pendingApprovals, myRequests, runApproved, setAgentOpen, router])

  const handleAgentSendMessage = useCallback(async (message: string, moduleOverride?: string | null) => {
    const trimmed = message.trim()
    if (!trimmed) return

    // The module this question belongs to: the one the caller named (an AI Stack example run from a
    // module's own AI Stack page) or, as always, the one the open page belongs to. Never defaulted.
    const aiStack = readAiStack()
    const chatModule = isModuleChatEnabled() ? (moduleOverride ?? aiStack?.module ?? moduleChatKey) : null

    // A sentence that asks for an action THIS page offers opens the action flow - preview and
    // Confirm - instead of going to the assistant. Anything else is an ordinary question.
    const actionContext = actionContextRef.current
    const lifecycleOn = isChatLifecycleEnabled() && chatModule !== null

    // "open <page>": offered as a button, never done silently. Only pages in the user's own sidebar.
    const destination = lifecycleOn ? matchNavTarget(trimmed, navTargets) : null

    if (destination) {
      setAgentMessages((current) => [
        ...current,
        { id: `user-${Date.now()}`, role: 'user', content: trimmed },
        {
          id: `nav-${Date.now()}`,
          role: 'assistant',
          content: `Here is ${destination.label}.`,
          navigate: { label: destination.label, path: destination.path, trail: destination.trail },
        },
      ])
      return
    }

    // With the lifecycle on, the server recognises the request (stage 4) and proposes the action.
    const requested = !lifecycleOn && actionContext ? actionRegistry.match(trimmed, actionContext) : null

    if (requested) {
      setAgentMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: trimmed }])
      startAction(requested, prefillFromMessage(requested, trimmed))
      return
    }

    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    // "Show me this person's document": a request to find a real record on a page that lists them.
    // Searched through the page's own API as the signed-in user. Exactly one match opens; several are
    // ALL listed for the user to choose (nothing is opened for them); none says so. Anything that is
    // not such a request falls through to the assistant unchanged.
    if (pageContextOn) {
      const context = entityContext()

      if (entityProviders.some((provider) => provider.appliesTo(context))) {
        setAgentOpen(true)
        setAgentError(null)
        setAgentLoading(true)
        setAgentMessages((current) => [...current, userMessage])

        const outcome = await resolveEntity(trimmed, entityProviders, context)

        if (outcome) {
          const reply = (content: string, extra: Partial<AgentMessage> = {}) =>
            setAgentMessages((current) => [...current, { id: `entity-${Date.now()}`, role: 'assistant', content, ...extra }])

          if (outcome.kind === 'clarify') {
            reply(outcome.clarify.question, { choices: outcome.clarify.choices })
          } else if (outcome.kind === 'none') {
            reply(`No ${outcome.query.summary} were found.`)
          } else if (outcome.kind === 'similar') {
            // Nothing matched the whole request. These match part of it - listed, never opened.
            reply(
              `No ${outcome.query.summary} matched exactly. These ${outcome.noun} contain some of your words - choose the one you want:`,
              { entities: { providerKey: outcome.providerKey, noun: outcome.noun, summary: outcome.query.summary, matches: outcome.matches } },
            )
          } else if (outcome.kind === 'error') {
            reply(outcome.message, { variant: 'error' })
          } else if (outcome.kind === 'one') {
            const match = outcome.match
            // "Where is X?" with one answer: say where, then go there and highlight it.
            const reveal = outcome.query.onSingle === 'reveal' && match.revealable === true
            const text =
              match.kind === 'folder'
                ? `Opening the "${match.title}" folder (${match.location}).`
                : reveal
                  ? `"${match.title}" is in ${match.location}. Taking you there and highlighting it.`
                  : outcome.query.onSingle === 'reveal'
                    ? `"${match.title}" is in ${match.location}. Opening it for you.`
                    : `Opening "${match.title}"${match.subtitle ? ` (${match.subtitle})` : ''}.`

            reply(text, { entities: { providerKey: outcome.providerKey, noun: outcome.noun, summary: outcome.query.summary, matches: [match] } })
            openEntity(outcome.providerKey, match, reveal ? 'reveal' : 'open')
          } else {
            reply(
              `Found ${outcome.matches.length} ${outcome.query.summary}${outcome.matches.length >= MAX_LISTED ? ` (showing the first ${MAX_LISTED} - add a type or a name to narrow it)` : ''}. ${outcome.query.onSingle === 'reveal' ? 'Here is where each one is:' : 'Choose the one you want:'}`,
              { entities: { providerKey: outcome.providerKey, noun: outcome.noun, summary: outcome.query.summary, matches: outcome.matches } },
            )
          }

          setAgentLoading(false)
          return
        }
      }
    }

    const previousMessages = agentMessagesRef.current.filter((item) => item.id !== userMessage.id)
    const nextMessages = [...previousMessages, userMessage]
    setAgentOpen(true)
    setAgentError(null)
    setAgentMessages((current) => (current.some((item) => item.id === userMessage.id) ? current : [...current, userMessage]))
    setAgentLoading(true)

    try {
      /**
       * Module chat (flag `NEXT_PUBLIC_MODULE_CHAT_ENABLED`, default off).
       *
       * Opened inside a module that has an AI Stack, the question goes to the backend's
       * `/ask` with that module's key: the server validates the key against `ai_modules`,
       * enforces the module's active AI policies, and grounds the answer in that module's
       * own data only. The other paths below answer from organisation-wide context and
       * cannot apply policies, so they are not used while a module is open.
       *
       * One conversation per module: the key is part of the session key, so moving to
       * another module starts a fresh, correctly-tagged transcript instead of continuing
       * one that was opened under a different module.
       */
      // A page outside every module also goes to the Laravel lifecycle (with the screen) when it is on:
      // its suggested questions are about the screen, so the answer must be able to see it.
      if (chatModule || (pageContextOn && isChatLifecycleEnabled())) {
        const result = await askAssistant({
          message: trimmed,
          session_key: `${agentSessionIdRef.current}:${chatModule ?? 'org'}`,
          module_key: chatModule ?? undefined,
          ai_stack_tab: aiStack && aiStack.module === chatModule ? aiStack.tab : undefined,
          menu_id: pageMenuId ?? undefined,
          available_actions: lifecycleOn ? availableActions : undefined,
          // Read at the moment of asking, so the answer reflects the screen as it is now.
          page_data: (() => {
            const root = document.querySelector('[data-page-context-root]')
            return root ? readPage(root) : undefined
          })(),
        })

        // The lifecycle's extras, when the backend ran it.
        const lifecycle: LifecyclePayload | undefined = result.trace
          ? {
              conversationId: result.conversation_id,
              intent: result.intent ?? 'data',
              trace: result.trace,
              evidence: result.evidence ?? [],
              recommendations: result.recommendations ?? [],
              report: result.report ?? null,
              reportSuggestions: result.report_suggestions ?? [],
              templateSuggestions: result.template_suggestions ?? [],
            }
          : undefined
        lastConversationIdRef.current = result.conversation_id

        // A refusal (policy) or a failure arrives as a 200 with no answer and a reason. With a
        // lifecycle the evidence and trace are still worth showing beside the reason.
        if (result.answer === null && !lifecycle) {
          throw new Error(result.error || 'The assistant could not answer.')
        }

        setAgentMessages((current) => [
          ...current,
          {
            id: `assistant-${result.conversation_id}-${Date.now()}`,
            role: 'assistant',
            content: result.answer ?? result.error ?? 'The assistant could not answer.',
            variant: result.answer === null ? 'error' : undefined,
            conversationType: 'module',
            lifecycle,
          },
        ])

        // A proposed action opens its form - only if this page really offers it (re-checked here,
        // not trusted from the server), and still needs Confirm before anything is written.
        const proposed = result.proposed_action
        const definition = proposed ? actionRegistry.get(proposed.key) : undefined
        const context = actionContextRef.current
        if (definition && context && actionRegistry.available(context).some((item) => item.key === definition.key)) {
          startAction(definition, prefillFromMessage(definition, trimmed))
        }
        return
      }

      /**
       * Universal AI core path (flag `NEXT_PUBLIC_AI_CORE_ENABLED`, default off).
       *
       * The same request, made through the G2G chat engine behind the core's
       * `ChatEngine` interface. Only a failure to *set the core up* — it cannot load,
       * or the session has no organisation to build a context from — falls through to
       * the built-in path below. Once the request is sent, an error is shown, never
       * retried: re-sending would spend the model twice.
       */
      if (isAiCoreEnabled()) {
        let core: G2gAiCore | null = null
        let coreContext: AiCoreContext | null = null

        try {
          core = (await import('@/lib/ai-core/runtime')).getG2gAiCore()
          coreContext = await core.context()
        } catch (setupError) {
          console.error('[ai-core] unavailable, using the built-in chat path', setupError)
          core = null
        }

        if (core && coreContext) {
          const reply = await core.chatEngine.send(coreContext, {
            message: trimmed,
            conversationId: agentSessionIdRef.current,
            history: previousMessages.map((item) => ({ role: item.role, content: item.content })),
          })
          const meta = reply.answer.meta as
            | { messageId?: string; status?: string; conversationType?: string; tools?: string[] }
            | undefined

          setAgentMessages((current) => [
            ...current,
            {
              id: meta?.messageId || `assistant-${Date.now()}`,
              role: 'assistant',
              content: reply.answer.text,
              status: meta?.status,
              conversationType: meta?.conversationType,
              tools: meta?.tools,
            },
          ])
          return
        }
      }

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
            userId: laravelContext.userId || user?.id,
            subInstituteId: laravelContext.subInstituteId || user?.subInstituteId,
            role: user?.role,
            profileName: user?.profileName,
            employeeNo: user?.employeeNo,
            orgId: laravelContext.organizationId || user?.orgId,
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
  }, [actionRegistry, availableActions, entityContext, entityProviders, moduleChatKey, navTargets, openEntity, pageContextOn, pageMenuId, setAgentOpen, startAction, user])

  // Lets another part of the app (an AI Stack example, a chip) put a question to the chat: open it
  // and send, exactly as if the user had typed it. Nothing is sent unless a module chat is active.
  useEffect(() => {
    const onSend = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; moduleKey?: string }>).detail
      const message = detail?.message
      if (typeof message !== 'string' || message.trim() === '') return
      setAgentOpen(true)
      void handleAgentSendMessage(message, typeof detail?.moduleKey === 'string' ? detail.moduleKey : null)
    }
    window.addEventListener('g2g:chat-send', onSend)
    return () => window.removeEventListener('g2g:chat-send', onSend)
  }, [handleAgentSendMessage, setAgentOpen])

  /*
   * A sentinel for "the URL has not resolved to a menu row yet".
   *
   * It matches no module id, so the sidebar highlights nothing and the
   * breadcrumb stays at Home — both correct for a screen still resolving.
   * Passing a real ActiveNav here is what used to make the shell assert it was
   * on the dashboard before it knew where it was.
   */
  const resolvedActive: ActiveNav = active ?? { moduleId: '', menuId: '', submenuId: '' }
  const breadcrumbItems = resolveBreadcrumb(resolvedActive, modules)

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  /*
   * THE STORED PREFERENCE, not a hardcoded `true`.
   *
   * `sidebar_collapsed` was saved to the account by Settings and read by
   * nothing - the shell always started collapsed however anybody had set it.
   * `touched` is what stops the server's answer, which arrives a moment after
   * mount, from snapping the sidebar shut on somebody who has just opened it.
   */
  const { preferences, loaded: preferencesLoaded } = useAppPreferences()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [sidebarTouched, setSidebarTouched] = useState(false)
  const [sidebarSynced, setSidebarSynced] = useState(false)

  /*
   * Applied DURING RENDER, not in an effect.
   *
   * An effect would paint the collapsed default first and then widen it, so
   * somebody whose preference is "open" would watch the sidebar snap out on
   * every page load. `sidebarSynced` makes it happen exactly once, and
   * `sidebarTouched` means a person who has already moved it themselves wins
   * over the stored value for the rest of the visit.
   */
  if (preferencesLoaded && !sidebarSynced && !sidebarTouched) {
    setSidebarSynced(true)
    setSidebarCollapsed(preferences.sidebar_collapsed)
  }
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const toolbarButtonRef = useRef<HTMLButtonElement>(null)
  const [subheaderOpen, setSubheaderOpen] = useState(false)
  const subheaderButtonRef = useRef<HTMLButtonElement>(null)
  const subheaderPanelRef = useRef<HTMLDivElement>(null)

  /*
   * Click-outside and Escape close it, matching `gtg-user-menu.tsx`'s own
   * pattern. `open` deliberately does NOT depend on `pathname` — it must
   * survive an ordinary navigation (including a click on one of this bar's
   * own links, switching between e.g. Workflow and Scheduler), closing only
   * on an explicit user action. Escape returns focus to the trigger, the
   * same reason that menu does it.
   */
  useEffect(() => {
    if (!subheaderOpen) return

    function onClick(event: MouseEvent) {
      const target = event.target as Node
      if (
        subheaderPanelRef.current && !subheaderPanelRef.current.contains(target) &&
        subheaderButtonRef.current && !subheaderButtonRef.current.contains(target)
      ) {
        setSubheaderOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setSubheaderOpen(false)
      subheaderButtonRef.current?.focus()
    }

    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [subheaderOpen])

  useEffect(() => {
    if (consumeSidebarFirstOpenExpansion()) {
      queueMicrotask(() => {
        // A deliberate first-open expansion outranks the stored default.
        // Marking it touched stops the preference, which arrives a moment
        // later, from closing the sidebar again.
        setSidebarTouched(true)
        setSidebarCollapsed(false)
      })
    }
  }, [])

  // So "land on the last page I was on" has something to land on. Written on
  // every navigation inside the shell; the sign-in screen reads it back.
  useEffect(() => {
    if (pathname) rememberLastVisited(pathname)
  }, [pathname])

  return (
    <div role="application" aria-label="GapstoGrowth HRMS" className="flex h-screen w-full bg-background overflow-hidden">
      <GtgSidebar
        active={resolvedActive}
        onSelect={handleNavSelect}
        modules={sidebarModules}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={(collapsed) => {
          /*
           * Remembered, not just applied.
           *
           * This used to set local state only, so moving the sidebar was undone
           * by the next navigation - the shell lives inside each page, not in
           * the layout, so it unmounts every time. Persisting it per browser is
           * what makes the position survive.
           */
          setSidebarTouched(true)
          setSidebarCollapsed(collapsed)

          const context = getLaravelContext(user)

          if (!isLaravelContextReady(context)) return

          void accountService
            .updatePreferences(context, { sidebar_collapsed: collapsed })
            .catch(() => {})
        }}
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
          subheaderOpen={subheaderOpen}
          onSubheaderToggle={() => setSubheaderOpen((open) => !open)}
          subheaderButtonRef={subheaderButtonRef}
        />
        <div ref={subheaderPanelRef}>
          <PlatformServicesSubheader open={subheaderOpen} />
        </div>
        <BreadcrumbItemsProvider items={breadcrumbItems}>
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
              <main data-page-context-root className="g2g-page-scroll g2g-scrollbar flex-1 bg-background overflow-auto">
                {/*
                  @container/content. The sidebar is compensated with
                  padding-left on the wrapper above, but Tailwind's sm/md/lg/xl
                  breakpoints key off VIEWPORT width - so expanding the sidebar
                  removes 188px from every page while the page's grid keeps the
                  same column count, and cards that fit at "lg" no longer do.
                  Naming this element as a container lets a screen ask how much
                  room it ACTUALLY has, via @2xl/content: and friends. The
                  careers and assessment pages already work this way.
                */}
                <div className="@container/content w-full min-h-full p-6">
                  {children ?? (
                    <>
                      <GtgBreadcrumbFromContext />
                      {/* A SKELETON, NEVER A DIFFERENT SCREEN. Until the URL
                          resolves to a menu row, there is nothing truthful to
                          render — this is where the dashboard used to flash. */}
                      {active ? <ContentRenderer active={active} /> : <ContentSkeleton />}
                    </>
                  )}
                </div>
              </main>
            </div>
            <aside aria-label="AI Agent Panel" className="flex-shrink-0 border-l border-border bg-background overflow-hidden transition-[width] duration-300"
              style={{ width: agentOpenState ? 'var(--agent-panel-width)' : '0px', transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}>
              <div className="h-full">
                {agentOpenState && (
                  <ChatActionsContext.Provider value={chatActionsApi}>
                  <AgentPanel
                    suggestedPrompts={pageContextOn ? (pagePrompts ?? []) : undefined}
                    messages={agentMessages}
                    isLoading={agentLoading}
                    error={agentError}
                    onClose={() => setAgentOpen(false)}
                    onSendMessage={handleAgentSendMessage}
                    onOpenEntity={openEntity}
                  />
                  </ChatActionsContext.Provider>
                )}
              </div>
            </aside>
          </div>
        </BreadcrumbItemsProvider>
        <PlatformServicesLauncher
          isAgentOpen={agentOpenState}
          open={toolbarOpen}
          onOpenChange={setToolbarOpen}
          triggerRef={toolbarButtonRef}
        />
      </div>
    </div>
  )
}
