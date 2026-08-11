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
import { CmMyCapability } from './cm-my-capability'
import { competencyGapService, type CompetencyGap } from '@/services/competency/gap'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'

export function CmMyCapabilityScreen() {
  const [gap, setGap] = useState<CompetencyGap | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'no-role'>('loading')

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
        setState(err?.status === 422 ? 'no-role' : 'error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return <p className="p-6 text-sm text-muted-foreground">Loading your capability profile…</p>
  }

  if (state === 'no-role') {
    return (
      <div className="p-6">
        <p className="text-sm font-medium text-foreground">No job role assigned yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your capability profile compares you against the role you hold. Once a job role is
          assigned, the requirements and any gaps appear here.
        </p>
      </div>
    )
  }

  if (state === 'error') {
    // A LOAD FAILURE IS NOT AN EMPTY PROFILE. Same rule as the notification bell:
    // reporting a connection problem as "nothing to show" is the dead-bell lie.
    return (
      <div className="p-6">
        <p className="text-sm font-medium text-foreground">Your capability profile could not be loaded</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This is a connection problem, not an empty profile.
        </p>
      </div>
    )
  }

  return <CmMyCapability gap={gap} />
}
