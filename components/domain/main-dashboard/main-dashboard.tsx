'use client'

import { useAuth } from '@/components/auth/gtg-auth'
import { HrDashboard } from './hr/hr-dashboard'
import { MeDashboard } from './me/me-dashboard'

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

  // EVERY OTHER ROLE gets their own dashboard: their tasks, their capability
  // against their job role, how their role's work is classified, their learning
  // and their HR record. It replaces the placeholder that used to stand here.
  //
  // NOTHING ON IT IS ORGANISATION-WIDE, and that is not a restriction imposed on
  // this component — /api/dashboard/me/* accepts no subject at all, so there is
  // no id on this screen that could ask for anybody else's figures. An admin
  // landing here by a misread of `user.role` sees their OWN data, which is a
  // correct answer rather than a 403.
  return <MeDashboard />
}
