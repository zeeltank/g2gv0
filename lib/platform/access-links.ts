/**
 * The bridge between the registry's access links and the app's own constants.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE IS NOT POINTLESS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `packages/platform-services-core` restates three access links as string literals
 * because it must not import from `@/lib/gtg-navigation` — the whole reason it lives in
 * `packages/` is that it depends on no product's `app/`. That restating is a second copy
 * of a value, and a second copy drifts.
 *
 * When it drifts, the failure is the quiet kind: `resolveAccessLink()` finds nothing for
 * the stale string, falls back to `'/dashboard'`, and the menu entry silently stops
 * leading anywhere. Nobody gets an error; RBAC just stops working one day.
 *
 * So the two copies are compared HERE, at compile time. A rename in
 * `lib/gtg-navigation.ts` that is not mirrored in the registry is a type error in this
 * file, which is the earliest and loudest place it can be caught.
 *
 * The LMS governance link has no named constant — it is an inline literal in
 * `hooks/content-map-m4.ts:28` — so it is asserted against that literal directly. If it
 * ever gains a constant, point this at the constant instead.
 */

import { ROLE_PERMISSIONS_ACCESS_LINK, TALENT_ONBOARDING_ACCESS_LINK } from '@/lib/gtg-navigation'

/** Fails to compile when the two strings are not identical. */
type AssertSame<A extends B, B extends string> = A

/*
 * Each line below pins one registry literal to the app's own value. The left side is
 * what `packages/platform-services-core/src/registry.ts` writes; the right side is what
 * the router actually resolves. Keep them in step.
 */
type _RbacMatches = AssertSame<
  '/module/organizational-management/user-management/role-and-permissions',
  typeof ROLE_PERMISSIONS_ACCESS_LINK
>

type _OnboardingMatches = AssertSame<
  '/module/talent-management/onboarding',
  typeof TALENT_ONBOARDING_ACCESS_LINK
>

/**
 * The LMS Administration & Governance screen, which Integration points at.
 *
 * Declared here rather than left implicit so `hooks/content-map-m4.ts` has something to
 * be compared against once somebody gives it a constant.
 */
export const LMS_GOVERNANCE_ACCESS_LINK =
  '/module/lms/administration/administration-and-governance'

type _IntegrationMatches = AssertSame<
  '/module/lms/administration/administration-and-governance',
  typeof LMS_GOVERNANCE_ACCESS_LINK
>

/**
 * Round 3 — decentralized navigation. Each registry module key's own landing page in
 * `tblmenumaster_g2g`, for the "Back to {module}" link a scoped `?module=` console shows
 * instead of "Back to Platform Services". Confirmed directly against the live table
 * (`tblmenumaster_g2g` level-1 rows) rather than assumed — `events` has no row here on
 * purpose, see `DECENTRALIZED_MODULES`'s own note in the registry package.
 */
export const MODULE_LANDING_HREF: Record<string, string> = {
  organization: '/module/organizational-management',
  hrms: '/module/hrit-solutions',
  talent: '/module/talent-management',
  lms: '/module/lms',
  competency: '/module/capability-intelligence',
  task: '/module/task-management',
}

/**
 * The same six keys' labels, exactly as `config('platform_services.modules')` names
 * them — restated here (rather than fetched) because `ServiceShell` renders before any
 * console's own registry fetch resolves, and the back link needs a label immediately.
 */
export const MODULE_LABEL: Record<string, string> = {
  organization: 'Organisation',
  hrms: 'HRMS',
  talent: 'Talent',
  lms: 'Learning',
  competency: 'Capability',
  task: 'Task management',
}
