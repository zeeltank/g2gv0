'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth/gtg-auth'
import { getGreeting } from '@/lib/greeting'
import { HrDashboard } from './hr/hr-dashboard'

/**
 * THE HOME DASHBOARD — a role switch, and nothing else.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE USED TO BE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 537 lines in which every number was a module-level literal: "12,548
 * employees", "Engineering 3245", a six-month attendance chart, a hiring
 * funnel, five invented "AI Insights" sentences. It rendered identically for
 * every role, so an employee saw fabricated organisation-wide figures — and an
 * organisation with nineteen people was told it had twelve thousand.
 *
 * The original is kept in the scratchpad as REFERENCE-static-main-dashboard.tsx
 * only as a layout reference for the remaining batches.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WHY THE SWITCH IS HERE AND THE SECURITY IS NOT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `user.role` is derived by mapProfileNameToRole(), a substring match on a
 * tenant-editable profile NAME. That is fine for deciding which component to
 * render — a presentation choice — and unfit as a security boundary.
 *
 * The boundary is the 403 from `profile:admin,hr`, which resolves role_key from
 * the TOKEN OWNER. If a profile named "Deparment Administrator" trips the
 * substring test, this renders the HR shell, the API refuses it, and
 * HrDashboard shows the permission message. That is the correct failure: the
 * frontend can be wrong about what to show, never about what it may fetch.
 */
export function MainDashboard() {
  const { user } = useAuth()
  const role = user?.role

  if (role === 'admin' || role === 'hr') {
    return <HrDashboard />
  }

  // EVERY OTHER ROLE. The employee dashboard is batch 3; until it exists this
  // says so and points at the pages that DO hold their data. Showing them the
  // HR dashboard would only produce a 403, and showing the old static screen
  // would show them numbers that were never true.
  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="border-b border-border/60 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{getGreeting(user?.name ?? '')}</h1>
        <p className="text-sm text-muted-foreground">Here is where to find your own work and capability.</p>
      </div>

      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-base font-semibold">Your personal dashboard is coming</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organisation-wide figures are for HR and administrators. In the meantime, everything
              recorded about you lives on your profile.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-9 gap-2 px-3 text-xs font-semibold">
              <Link href="/profile">
                My Capability &amp; Profile <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-9 gap-2 px-3 text-xs font-semibold">
              <Link href="/module/task-management">
                My Tasks <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
