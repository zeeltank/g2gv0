/**
 * The Platform Services registry — one description of each platform-administration
 * screen, read by the avatar menu, the console index and every service page.
 *
 * WHY THIS FILE EXISTS
 *
 * LMS K-12 keeps the same twelve entries as three hand-written objects in one component:
 * a list of labels, a map of routes beside it, and a map of icons beside that. Its own
 * report flags the cost — a screen that graduates from "coming soon" to built has to be
 * updated in `Header.tsx`, in `routeMapper.ts`'s interceptors, and again in
 * `coming-soon/page.tsx`'s `GRADUATED_MODULES`. Three places, no rule saying which wins,
 * and the failure is silent: a stale route quietly sends somebody to a placeholder over
 * a working feature.
 *
 * So the menu here is a list of RECORDS rather than a list of strings. Adding a service,
 * renaming one, or promoting one from `coming-soon` to `live` is an edit to this file and
 * to nothing else.
 *
 * It lives in `packages/` rather than `lib/` for the same reason
 * `ai-intelligence-core` does: it must not depend on any one product's `app/`.
 * That is also why `icon` is a lucide glyph NAME and not a component — this package
 * imports no React, and the app resolves the glyph in `lib/platform/icons.ts`.
 */

/**
 * What state a service is in, from this product's point of view.
 *
 * The same three words `AiCapability` uses, and the same rule applies: each one is a
 * claim somebody can check by opening the screen. NEVER mark something `coming-soon`
 * that already works — a construction notice over a working feature reads as broken —
 * and never mark something `live` because its tables exist. `tblcustom_fields` has held
 * rows for a year with no API in front of it; Fields Configuration is `coming-soon`.
 */
export type PlatformServiceStatus = 'live' | 'in-progress' | 'coming-soon'

/** Which column of the menu a service sits in. */
export type PlatformSection = 'services' | 'setup'

/**
 * Where a service's screen actually is.
 *
 * THIS IS THE FIELD THAT MAKES THIS TYPE DIFFERENT FROM `AiCapability`, which carries
 * `href?` and `accessLink?` as two independent optionals. Under that shape "this has no
 * screen yet" and "somebody forgot to fill it in" are the same value — `undefined` on
 * both — so a console cannot tell them apart and renders an empty panel for each.
 *
 * A discriminated union makes `not-built` something you have to WRITE. That is what lets
 * the console render an honest "not built yet" panel, naming what exists today and what
 * still has to be built, instead of a blank screen that looks like a bug.
 *
 *   existing-screen  lives in the module tree; the path differs per deployment, so the
 *                    stable `access_link` is resolved against THIS user's own menu.
 *   existing-route   a real Next route this app already serves (`/settings?s=audit`).
 *   own-route        a plane built by this work (`/platform-services/event-bus`).
 *   not-built        no screen yet. The console says so, and says what is there instead.
 */
export type PlatformDestination =
  | { kind: 'existing-screen'; accessLink: string }
  | { kind: 'existing-route'; href: string }
  | { kind: 'own-route'; href: string }
  | { kind: 'not-built' }

export interface PlatformService {
  /** Stable dotted id. Screens and tests reference this, never the name. */
  id: string
  /**
   * URL segment under `/platform-services/`. Lowercase, hyphenated, and STABLE — it gets
   * bookmarked the day it ships, so renaming one is a route change, not a label change.
   * `ai.prompts` keeping the slug `prompts` while its label reads "Template Management"
   * is the precedent.
   */
  slug: string
  /** The menu label, exactly as it reads in the dropdown. */
  name: string
  section: PlatformSection
  /** A lucide glyph name, resolved by the app. Keeps this package free of React. */
  icon: string
  /** What the service is for. One sentence, sentence case. */
  purpose: string
  /** Why it is one shared service rather than a thing each module rebuilds. */
  whyCentral: string
  /** What G2G actually holds today — named tables, named endpoints, no aspiration. */
  todayInG2g: string
  /** What still has to be built. Empty for a service that is done. */
  toBuild: readonly string[]
  status: PlatformServiceStatus
  destination: PlatformDestination
  /**
   * Which phase gives this service a working screen.
   *
   * This is what replaces LMS K-12's separate `lib/roadmap/registry.ts`. "What's Coming"
   * is derived from the services whose status is not `live`, so the roadmap and the
   * "not built yet" panels read the same rows and cannot disagree — which is the whole
   * argument that registry makes for its own existence, satisfied without a second list.
   */
  phase: 1 | 2 | 3
}
