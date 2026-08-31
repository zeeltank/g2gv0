'use client'

/**
 * G-UI-01 — the route container for the capability screen.
 *
 * `CmMyCapability` is PRESENTATIONAL: it takes a `gap` and renders it, which is
 * why it could be unit-reasoned about and still be unreachable. Content-map
 * components take no props, so it needed a container to fetch with. That missing
 * container is the whole of why Slice 1's deliverable could not be opened by
 * anyone — the component was correct, the API was correct, and nothing joined
 * them.
 *
 * THE SUBJECT IS THE TOKEN OWNER. There is no user_id picker here: an employee
 * sees their own gap, and the server returns 403 for a colleague (asserted by the
 * smoke suite). A picker for elevated roles is a separate screen with its own
 * permission, not a parameter on this one.
 */

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ClipboardList, UserRound, WifiOff } from 'lucide-react'
import { CmMyCapability } from './cm-my-capability'
// The employee's own assessment, below their capability. Mounted here rather
// than on a new menu because this screen ALREADY means 'my own capability' and
// already carries the employee's identity from their token — a separate menu
// would need its own rights row to say the same thing twice.
import { CmMyAssessment } from './cm-my-assessment'
// The rating control. It lives here because this screen already means 'my
// own capability' and already carries the employee's identity from their
// token. The only other rating UI sits in the Employee Directory, which
// employees do not have — so self-rating was unreachable by the people
// it is for.
import { CmSelfRatingPanel } from './cm-self-rating-panel'
import { competencyGapService, type CompetencyGap } from '@/services/competency/gap'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'

/**
 * WHAT THIS SCREEN IS FOR, IN PLAIN WORDS.
 *
 * Shown on every state where there is nothing to display. A person who lands on
 * an empty screen should learn what it is meant to do and what would fill it —
 * not be told a percentage and left to work it out.
 *
 * THE VOCABULARY IS DELIBERATELY ORDINARY. "Capability coverage at 50%" is a
 * sentence for whoever built the gate, not for the employee reading it. The same
 * fact stated as "your company has not finished checking people's skills yet"
 * needs no glossary.
 */
function WhatThisIs({ steps }: { steps: string[] }) {
  return (
    <Card className="mx-auto mt-6 max-w-xl p-5 text-left">
      <h4 className="text-sm font-semibold">What this page shows you</h4>
      <p className="mt-1 text-sm text-muted-foreground">
        Your job needs certain skills. This page lists them, shows which ones you have already been
        checked on, and points out the ones where you are not there yet — so you know what to work
        on next.
      </p>

      <h4 className="mt-5 text-sm font-semibold">How it gets filled in</h4>
      <ol className="mt-2 flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm text-muted-foreground">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-foreground">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="mt-5 text-xs text-muted-foreground">
        Nothing here is filled in by you. Your manager or HR team sets it up, and this page updates
        on its own once they do.
      </p>
    </Card>
  )
}

export function CmMyCapabilityScreen() {
  const [gap, setGap] = useState<CompetencyGap | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'no-role' | 'gated'>('loading')
  // The readiness gate's OWN words. It says which gate, why, and what clears it —
  // replacing that with a generic message throws away the only actionable part.
  const [gate, setGate] = useState<{ message: string; remedy: string | null } | null>(null)

  useEffect(() => {
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) {
      setState('error')
      return
    }
    let cancelled = false

    competencyGapService
      .mine(context, Number(context.userId))
      .then((res) => {
        if (cancelled) return
        setGap(res.data ?? null)
        setState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        // 422 is the server saying "this employee has no job role", which is a
        // real state and not a failure. Reporting it as an error would tell
        // someone their screen is broken when their record is simply incomplete.
        // 409 = A READINESS GATE IS BLOCKING THIS, and it is not a failure at
        // all. The server returns which gate, the shortfall, and the remedy.
        // Reporting that as "a connection problem" sends someone to look at the
        // network for a state the server just explained in words.
        if (err?.status === 409) {
          // ApiError carries `status` and `message` — and NOTHING ELSE. It is
          // constructed as `new ApiError(payload.message, response.status,
          // payload.errors)`, so the gate's `remedy` field is DROPPED before it
          // reaches here. Reading err.body would have silently shown the
          // fallback text instead of the server's real one.
          //
          // err.message DOES carry the server's sentence, which names the gate,
          // the threshold and the current value. That is the useful half.
          setGate({
            message: String(err?.message ?? 'This screen is waiting on a readiness gate.'),
            remedy: null,
          })
          setState('gated')
          return
        }
        setState(err?.status === 422 ? 'no-role' : 'error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  /*
   * THE ASSESSMENT IS NOT PART OF THE GAP, AND MUST NOT SHARE ITS FATE.
   *
   * <CmMyAssessment /> used to sit at the bottom of this component, AFTER four
   * early returns for the capability-gap fetch: loading, no-role, gated and
   * error. So if the gap call 422'd (no job role), 409'd (readiness gate) or
   * simply failed, the employee never saw a published assessment they were
   * perfectly entitled to take - two features with completely independent
   * preconditions, coupled by nothing but render order.
   *
   * It is rendered FIRST now and outside every one of those branches, because
   * `/competency/ai-assessment/mine` answers for itself: it returns its own
   * empty state with its own reason, and needs nothing this screen fetched.
   */
  const assessment = <CmMyAssessment />

  /*
   * SELF-RATING SURVIVES EVERY BRANCH BELOW, for the same reason the
   * assessment does — it answers for itself.
   *
   * The gap fetch can 422 (no job role), 409 (a readiness gate) or simply
   * fail. None of those stop an employee recording their own view:
   * /my-capability is a different endpoint with different preconditions and
   * its own empty state. Rendering this only in the happy branch would
   * repeat exactly the coupling the assessment was moved out of.
   */
  const selfRating = <CmSelfRatingPanel />

  if (state === 'loading') {
    // SKELETON, NOT A SENTENCE. The design system ships one; a hand-written
    // "Loading…" line is a second loading language in the same product, and it
    // gives no sense of what is arriving. The shapes match the real content.
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
        <div className="flex flex-col gap-3 pt-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        {/* THE ASSESSMENT SURVIVES THIS BRANCH.
            Whatever the capability gap could not answer, a published assessment
            is still takeable - it depends on none of it. */}
        {selfRating}
        {assessment}
      </div>
    )
  }

  if (state === 'no-role') {
    return (
      <div className="p-6">
        <EmptyState
          icon={<UserRound className="size-8" />}
          title="Your job role has not been set yet"
          description="This page compares you against the role you hold, so it needs to know what that role is."
        />
        <WhatThisIs
          steps={[
            'Your HR team records which job role you hold.',
            'They list the skills that role needs.',
            'Someone checks how you are doing on each one.',
            'This page then shows where you stand.',
          ]}
        />
        {/* THE ASSESSMENT SURVIVES THIS BRANCH.
            Whatever the capability gap could not answer, a published assessment
            is still takeable - it depends on none of it. */}
        {selfRating}
        {assessment}
      </div>
    )
  }

  if (state === 'gated') {
    // THE RAW GATE SENTENCE IS NO LONGER SHOWN. It read "This needs capability
    // coverage at 50% or above. It is currently 0%." — accurate, and meaningless
    // to the person reading it. They cannot act on a percentage, and it sounds
    // like a fault rather than a normal early state.
    //
    // The server message is kept in `gate.message` and rendered only as small
    // print, so support can still see the exact reason without it being the
    // headline.
    return (
      <div className="p-6">
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title="Not enough people have been checked yet"
          description="Your company is still setting this up. Once enough people have had their skills checked, your own results appear here automatically."
        />
        <WhatThisIs
          steps={[
            'HR lists the skills each job role needs.',
            'Managers check how people are doing on those skills.',
            'Once about half the team has been checked, this page opens.',
            'You will then see your own skills and where the gaps are.',
          ]}
        />
        {gate?.message && (
          <p className="mx-auto mt-4 max-w-xl text-center text-xs text-muted-foreground">
            Technical detail for your IT team: {gate.message}
          </p>
        )}
        {/* THE ASSESSMENT SURVIVES THIS BRANCH.
            Whatever the capability gap could not answer, a published assessment
            is still takeable - it depends on none of it. */}
        {selfRating}
        {assessment}
      </div>
    )
  }

  if (state === 'error') {
    // A LOAD FAILURE IS NOT AN EMPTY PROFILE. Reporting a connection problem as
    // "nothing to show" is the dead-bell lie: it tells someone their record is
    // empty when in fact nothing was ever fetched.
    return (
      <div className="p-6">
        <EmptyState
          icon={<WifiOff className="size-8" />}
          title="We could not load your page"
          description="Something went wrong while fetching your details. This is a connection problem, not an empty record — please try again in a moment."
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          }
        />
        {/* THE BRANCH THAT MOST NEEDED THIS. A failure fetching the capability
            gap says nothing about whether an assessment is takeable, and
            hiding one because an unrelated call failed is how a published
            test becomes invisible. */}
        {selfRating}
        {assessment}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <CmMyCapability gap={gap} />
      {/* Takes no props. It cannot be pointed at another person because it
          accepts no subject — the endpoints behind it have no user_id. */}
      {selfRating}
      {assessment}
    </div>
  )
}
