'use client'

/**
 * One module's AI Stack, on a route that already knows which module it is.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS DELIBERATELY NOT HERE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No module picker. `/platform-services/ai-stack` renders a row of six module pills
 * because `?module=` is the only thing that scopes it — so somebody arriving from inside
 * a module was asked the question they had already answered by being there.
 *
 * Here the module comes from the route and the live menu tree (see `useActiveModule`), so
 * the tabs render for that module and nothing else. Switching modules is what the sidebar
 * is for, and the centralised AI & Intelligence section at `/ai/*` is a different screen
 * with a different scope — deliberately not merged into this one.
 *
 * WHAT IS STILL THE SAME
 *
 * The same `AiStackTabs`, the same nine shared screens, the same clients, endpoints and
 * chrome. Only the scope is now derived rather than asked for.
 */

import { Database, ServerCrash, Sparkles } from 'lucide-react'

import { AiStackTabs } from '@/components/ai-stack/ai-stack-host'
import { AiStackEmpty, AiStackLoading } from '@/components/ai-stack/ai-stack-chrome'
import { useActiveModule } from '@/hooks/use-active-module'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'

/**
 * The console body.
 *
 * `moduleId` arrives as a prop rather than through `use(params)` so the route file stays a
 * two-liner and every branch here is decided by the resolved module alone.
 */
export function ModuleAiStackConsole({ moduleId }: { moduleId: string }) {
  const { loading, navModule, label, stack } = useActiveModule(moduleId)
  const { loading: treeLoading, error: treeError } = useSidebarNavigation()

  /* A load in flight is not the same answer as a module that does not exist. */
  if (loading || treeLoading) {
    return (
      <div className="mt-6">
        <AiStackLoading label="Resolving this module…" />
      </div>
    )
  }

  /* The menu tree failed. Saying so beats rendering an empty stack that looks configured. */
  if (treeError) {
    return (
      <div className="mt-6 space-y-5">
        <AiStackEmpty icon={ServerCrash} title="The menu could not be loaded">
          {treeError} Your modules come from the same rights-filtered menu the sidebar uses, so without it this page
          cannot tell which module you opened.
        </AiStackEmpty>
      </div>
    )
  }

  /* The route named a row this profile cannot see. Decline, rather than open module one. */
  if (!navModule) {
    return (
      <div className="mt-6 space-y-5">
        <AiStackEmpty icon={ServerCrash} title="That module is not available to you">
          Nothing in your menu matches this address, so there is no module to show an AI Stack for. It may have been
          removed, or your profile may not have access to it.
        </AiStackEmpty>
      </div>
    )
  }

  const moduleName = label ?? navModule.label

  /*
   * NO DESCRIPTOR IS A REAL ANSWER, NOT A FALLBACK TRIGGER
   *
   * Reports, Agentic AI and any tenant-created module have no `ai_modules` row, so there is
   * no key to scope a stack by. Opening a neighbouring module's tabs here would put
   * another module's policies, prompts and ledger on screen under this module's name — the
   * exact leak this design exists to prevent — so this says so and stops.
   */
  if (!stack) {
    return (
      <div className="mt-6 space-y-5">
        <ModuleContextHeader name={moduleName} />

        <AiStackEmpty icon={Sparkles} title={`${moduleName} has no AI Stack`}>
          No AI configuration is registered for {moduleName}, so there are no {moduleName} policies, prompts,
          templates, agents or ledger entries to show — and another module&apos;s AI is never shown in its place.
        </AiStackEmpty>
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-5">
      <ModuleContextHeader name={moduleName} />

      {/*
        Keyed by the module's `ai_modules` key. Landing on a module with no stack and then
        opening one that has one remounts every tab, so a tab can never keep the previous
        module's loaded rows on screen under the new module's name.
      */}
      <AiStackTabs key={stack.key} module={stack} />
    </div>
  )
}

/**
 * The one line that says which module's AI this is.
 *
 * It names the module because every tab below is scoped to it, and somebody who arrived
 * from a module screen should not have to read the URL to know whose records they are
 * looking at.
 */
export function ModuleContextHeader({ name }: { name: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4">
      <span className="inline-flex rounded-lg bg-primary/10 p-2 text-primary">
        <Sparkles className="size-5" />
      </span>

      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Module</p>
        <h1 className="truncate text-lg font-semibold text-foreground">{name} AI Stack</h1>
      </div>

      <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
        <Database className="mr-1.5 inline size-3.5 align-text-bottom" />
        Every tab below reads {name}&rsquo;s own records.
      </p>
    </div>
  )
}
