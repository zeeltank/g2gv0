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
import { isAiCoreEnabled, isModuleChatEnabled } from '@/lib/ai-core/flag'
import { useActiveModule } from '@/hooks/use-active-module'
import { askAssistant } from '@/lib/intelligence/ai-conversations'
import { fetchPageContext } from '@/lib/intelligence/ai-workspace'
import { readPage } from '@/lib/page-context/dom-snapshot'
import { createG2gActionRegistry } from '@/lib/chat-actions/g2g/registry'
import type { G2gActionApp } from '@/lib/chat-actions/g2g/actions'
import { prefillFromMessage } from '@/lib/chat-actions/registry'
import * as actionFlow from '@/lib/chat-actions/flow'
import type { ActionContext, ActionInput, ChatActionDefinition, FlowState } from '@/lib/chat-actions/types'
import { ChatActionsContext, type ChatActionsApi } from '@/components/shell/agent/chat-actions-context'
import { usePageSnapshot } from '@/lib/page-context/use-page-snapshot'
import type { G2gAiCore } from '@/lib/ai-core/runtime'
import type { AppContext as AiCoreContext } from 'darshana-ai-core'
import { accountService } from '@/services/account'
import { useAuth } from '@/components/auth/gtg-auth'


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
   * What is actually on the page - heading, counts, filters, search text, selected rows, the
   * rows of its tables - read from the content region while the chat is open. Any page gives
   * one; none registers anything. The backend turns it into questions about that page.
   */
  const pageSnapshot = usePageSnapshot({
    enabled: Boolean(moduleChatKey && agentOpenState),
    getRoot: () => document.querySelector('[data-page-context-root]'),
    watch: pathname,
  })

  useEffect(() => {
    if (!moduleChatKey || !agentOpenState) return

    let cancelled = false

    fetchPageContext({ menuId: pageMenuId, route: pathname, pageData: pageSnapshot })
      .then((context) => {
        if (!cancelled) {
          setPagePromptState({ path: pathname, prompts: context.suggestions.map((suggestion) => suggestion.prompt) })
        }
      })
      .catch(() => {
        if (!cancelled) setPagePromptState({ path: pathname, prompts: [] })
      })

    return () => {
      cancelled = true
    }
  }, [moduleChatKey, agentOpenState, pageMenuId, pathname, pageSnapshot])

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
      .map(({ key, label, description }) => ({ key, label, description }))
  }, [actionRegistry, moduleChatKey, pathname, pageMenuId, user])

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
        return found && definition ? { label: definition.label, inputs: definition.inputs, state: found.state } : null
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
        if (found) setFlow(id, found.entry.key, actionFlow.cancel(found.entry.state))
      },
      confirm: (id) => {
        const found = definitionOf(id)
        const context = actionContextRef.current
        if (!found || !context) return

        // Read from the ref, not render state: a second click in the same tick must see the first.
        const executing = actionFlow.beginExecution(found.entry.state)
        if (!executing) return

        setFlow(id, found.entry.key, executing)

        found.definition
          .execute(executing.values, context)
          .catch((error: unknown) => ({
            ok: false,
            message: error instanceof Error ? error.message : 'The action failed.',
          }))
          .then((result) => {
            setFlow(id, found.entry.key, actionFlow.finish(executing, result))

            // Let the page behind the chat show what was just written.
            if (result.ok) window.dispatchEvent(new CustomEvent('g2g:data-changed', { detail: { action: found.entry.key } }))
          })
      },
    }
  }, [moduleChatKey, actionRegistry, actionFlows, availableActions, setFlow, startAction])

  const handleAgentSendMessage = useCallback(async (message: string) => {
    const trimmed = message.trim()
    if (!trimmed) return

    // A sentence that asks for an action THIS page offers opens the action flow - preview and
    // Confirm - instead of going to the assistant. Anything else is an ordinary question.
    const actionContext = actionContextRef.current
    const requested = actionContext ? actionRegistry.match(trimmed, actionContext) : null

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

    const previousMessages = agentMessagesRef.current
    const nextMessages = [...previousMessages, userMessage]
    setAgentOpen(true)
    setAgentError(null)
    setAgentMessages(nextMessages)
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
      if (moduleChatKey) {
        const result = await askAssistant({
          message: trimmed,
          session_key: `${agentSessionIdRef.current}:${moduleChatKey}`,
          module_key: moduleChatKey,
          menu_id: pageMenuId ?? undefined,
          // Read at the moment of asking, so the answer reflects the screen as it is now.
          page_data: (() => {
            const root = document.querySelector('[data-page-context-root]')
            return root ? readPage(root) : undefined
          })(),
        })

        // A refusal (policy) or a failure arrives as a 200 with no answer and a reason.
        if (result.answer === null) {
          throw new Error(result.error || 'The assistant could not answer.')
        }

        setAgentMessages((current) => [
          ...current,
          {
            id: `assistant-${result.conversation_id}-${Date.now()}`,
            role: 'assistant',
            content: result.answer ?? '',
            conversationType: 'module',
          },
        ])
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
  }, [actionRegistry, moduleChatKey, pageMenuId, setAgentOpen, startAction, user])

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
                    suggestedPrompts={moduleChatKey ? (pagePrompts ?? []) : undefined}
                    messages={agentMessages}
                    isLoading={agentLoading}
                    error={agentError}
                    onClose={() => setAgentOpen(false)}
                    onSendMessage={handleAgentSendMessage}
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
