'use client'

/**
 * The Centralized AI Stack.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE AI STACK LIVES HERE AND NOT INSIDE MODULE SCREENS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The AI Stack used to appear only where somebody had hand-mounted `<AiStackTabs>` in a
 * screen — nine screens, each with its own descriptor. That is why it was visible in some
 * modules and simply absent from the rest: the stack was a property of the screen's source
 * code, not of the module. Organisation and HRMS had none at all, and Talent, LMS,
 * Capability and Task each had it on one or two screens and nowhere else.
 *
 * It is now reached from the Platform Services bar, for every module the bar scopes to,
 * whether or not any of that module's screens ever had a stack. The tabs, the client and
 * the endpoints are the same nine shared screens the per-screen stacks used; what changes is
 * the scope they are given — the module's own `ai_modules` row — so a policy, prompt,
 * template, agent or ledger row saved here belongs to that module and to no other.
 *
 * `?module=` picks the module, exactly as it does on every other scoped console. With none,
 * the page offers the six rather than guessing, the same way the unscoped Workflow and
 * Scheduler consoles show the whole estate instead of one module's slice.
 *
 * ── AND WHEN A MODULE *IS* NAMED, THE PICKER IS NOT OFFERED BACK ─────────────
 *
 * The picker existed because `?module=` was the only thing that scoped this page, so an
 * unrecognised or missing value had to be resolved by asking. A recognised one does not.
 * Pressing AI Stack from inside a module now goes to `/module/{moduleId}/ai-stack` (see
 * `platform-services-subheader.tsx`), which has no picker at all — this page keeps its own
 * as the centralised entry point, and simply stops re-asking a question a scoped arrival
 * has already answered.
 */

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { AiStackTabs } from '@/components/ai-stack/ai-stack-host'
import { ModuleContextHeader } from '@/components/ai-stack/module-ai-stack-console'
import { CENTRAL_AI_STACKS } from '@/lib/ai-stack/central'
import { isDecentralizedModule, MODULE_LABEL, type DecentralizedModuleKey } from '@/lib/platform/access-links'
import { DECENTRALIZED_MODULES } from '@shared/platform-services-core'
import { cn } from '@/lib/utils'

import { ServiceShell } from '../_components/ServiceShell'

export default function AiStackPage() {
  return (
    <ServiceShell slug="ai-stack">
      <Suspense fallback={null}>
        <AiStackConsole />
      </Suspense>
    </ServiceShell>
  )
}

function AiStackConsole() {
  const rawModule = useSearchParams().get('module')
  const moduleKey: DecentralizedModuleKey | null = isDecentralizedModule(rawModule) ? rawModule : null
  const stack = moduleKey ? CENTRAL_AI_STACKS[moduleKey] : null

  return (
    <div className="mt-6 space-y-6">
      {stack ? (
        <>
          <ModuleContextHeader name={stack.label} />
          {/*
            Keyed by module so switching modules remounts every tab. A tab that survived
            the switch would keep the previous module's loaded rows on screen under the
            new name.
          */}
          <AiStackTabs key={stack.key} module={stack} />
        </>
      ) : (
        <>
          <nav
            aria-label="Choose a module"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="mr-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Module
            </span>
            {DECENTRALIZED_MODULES.map((key) => (
              <Link
                key={key}
                href={`/platform-services/ai-stack?module=${key}`}
                aria-current={key === moduleKey ? 'page' : undefined}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  key === moduleKey
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {MODULE_LABEL[key]}
              </Link>
            ))}
          </nav>

          <p className="rounded-lg border border-dashed border-border bg-card px-5 py-8 text-sm text-muted-foreground">
            Choose a module above to open its AI Stack. Each one is scoped to that module alone — its own policies,
            models, prompts, templates, knowledge sources, automations, usage, guardrails and activity. Opening a
            module and pressing AI Stack from inside it goes straight to that module&apos;s stack instead.
          </p>
        </>
      )}
    </div>
  )
}
