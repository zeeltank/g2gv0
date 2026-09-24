/**
 * The glyph each platform service wears.
 *
 * WHY THE MAP IS HERE AND THE NAME IS IN THE PACKAGE
 *
 * `packages/platform-services-core` must not import React — it is meant to be consumable
 * by anything, and a package that pulls in `lucide-react` is a package that has decided
 * its consumer is a React app. So the registry carries a glyph NAME and this file, which
 * is app code, turns it into a component.
 *
 * Keyed by slug rather than by name: the slug is the registry's stable identifier, so
 * renaming a service keeps its icon, while renaming a slug is already a route change
 * nobody makes silently. Same reasoning as LMS K-12's `aiCapabilityIcons`.
 *
 * A slug with no entry falls back to its own initial, which is what the sidebar does for
 * an unresolvable icon — a missing glyph never costs the row its shape.
 */

import { createElement } from 'react'
import {
  CalendarClock,
  CirclePlus,
  ClipboardCheck,
  LayoutDashboard,
  Map as MapIcon,
  Plug,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UserPlus,
  Waypoints,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  rbac: ShieldCheck,
  workflow: Workflow,
  scheduler: CalendarClock,
  integration: Plug,
  audit: ClipboardCheck,
  'event-bus': Waypoints,
  onboarding: UserPlus,
  'add-process': CirclePlus,
  'fields-configuration': SlidersHorizontal,
  'mobile-app-rights': Smartphone,
  'platform-administration': LayoutDashboard,
  'whats-coming': MapIcon,
}

export function platformServiceIcon(slug: string): LucideIcon | undefined {
  return PLATFORM_ICONS[slug]
}

/**
 * One service's glyph, rendered.
 *
 * ── WHY `createElement` AND NOT `const Icon = …; <Icon />` ──────────────────
 *
 * That shape reads naturally and `react-hooks/static-components` rejects it: assigning a
 * component to a local during render means React sees a new component type on every
 * render and remounts it, discarding any state it held. These glyphs are stateless, so
 * the practical cost here is nil — but the rule cannot know that, and the same pattern
 * copied to a component that does hold state is a real bug that presents as "the input
 * keeps clearing itself".
 *
 * `createElement` takes the component as a value rather than as a JSX tag, which is the
 * honest way to say "the type is data" and keeps the lookup out of the render path's
 * component identity.
 *
 * Renders nothing for an unknown slug. Callers that want a visible fallback supply their
 * own — the avatar menu uses the label's first initial, the same thing the sidebar does
 * for an unresolvable icon.
 */
export function PlatformServiceIcon({ slug, className }: { slug: string; className?: string }) {
  const icon = PLATFORM_ICONS[slug]

  if (!icon) return null

  return createElement(icon, { className, 'aria-hidden': true })
}
