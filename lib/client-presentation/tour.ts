/**
 * The product tour: ONE slide per product that replaces the sub-module spotlights, the "how it works" slide and the screens galleries
 * with seven tabs: Summary, Problem, Intelligence, AI capability, Research, Features and modules, Role-wise benefits.
 *
 * Pure TypeScript (no React), so the scene, the keyboard handling, the tests and the PowerPoint builder share one definition of what a tab is.
 * A tab is not a separate slide: it is a range of BEATS of the one slide, so Next / Back, the progress bar, `?slide=&beat=` links and the
 * presenter's "step n of N" work exactly as they do for every other scene. Features and Roles take one beat per group / per role.
 * The Research tab exists only when it has items, so a tour never shows an empty tab.
 */
export const TOUR_TABS = ['summary', 'problem', 'intelligence', 'ai', 'research', 'features', 'roles'] as const
export type TourTab = (typeof TOUR_TABS)[number]

export const TOUR_TAB_LABELS: Record<TourTab, string> = {
  summary: 'Summary',
  problem: 'Problem',
  intelligence: 'Intelligence',
  ai: 'AI capability',
  research: 'Research',
  features: 'Features and modules',
  roles: 'Role-wise benefits',
}

export interface TourSub {
  id: string
  name: string
  tagline: string
  /** The edited screenshot of this module, or null when it has none. */
  shot: string | null
}

/** Which scene plays a tour: 'ink' is the Core scene (the default), 'sketchbook' the illustrated scene (paper, cut-outs, stop-motion). */
export type TourStyle = 'ink' | 'sketchbook'

/** One picture of an illustrated tour (docs/client-presentation/assets/tour-art.json): a licensed photo, or a generated cartoon or sketch. */
export interface TourArtImage {
  id: string
  kind: 'photo' | 'cartoon' | 'sketch'
  src: string
  w: number
  h: number
  alt: string
}

/** The few words the illustrated scene prints on its own, so no scene has another product's wording built in. */
export interface TourLabels {
  draft: string
  /** The buttons exist only where the product has them: a read-only note (Compass's AI counsellor) has neither, and the card then shows none. Both or neither. */
  apply?: string
  discard?: string
}

export interface AtlasTour {
  /** Absent means 'ink'. */
  style?: TourStyle
  labels?: TourLabels
  /** Pictures by slot name; only the illustrated scene reads them. */
  art?: Record<string, TourArtImage[]>
  summary: { lines: string[] }
  problem: { label: string; beats: string[]; turn: string; scattered: string[]; record: string }
  intelligence: { lead: string; modules: { id: string; name: string; asks: string }[]; close: string }
  ai: { lead: string; uses: { name: string; line: string }[]; guard: string; control: string; sample: { label: string; text: string } }
  /** `lead` is the words above the rows; absent means "Designed from". */
  research: { lead?: string; items: { text: string; source: string }[] }
  features: { groups: { title: string; subs: TourSub[] }[] }
  roles: { role: string; who: string; benefits: string[]; use: string; modules: { id: string; name: string }[] }[]
}

export interface TourStep {
  tab: TourTab
  /** 0-based position inside the tab (the group, or the role, being shown). */
  step: number
}

/** The scene style of a tour. */
export const tourStyle = (t: AtlasTour): TourStyle => t.style ?? 'ink'

/** The tabs this tour actually shows, in order. Research is left out until it has data. */
export function tourTabs(t: AtlasTour): TourTab[] {
  return TOUR_TABS.filter((tab) => tab !== 'research' || t.research.items.length > 0)
}

/** How many beats (steps) each tab takes. */
export function stepsOfTab(t: AtlasTour, tab: TourTab): number {
  switch (tab) {
    case 'features': return t.features.groups.length
    case 'roles': return t.roles.length
    case 'research': return t.research.items.length > 0 ? 1 : 0
    default: return 1
  }
}

/** One entry per beat, beat 0 first. */
export function tourSteps(t: AtlasTour): TourStep[] {
  const out: TourStep[] = []
  for (const tab of tourTabs(t)) for (let step = 0; step < stepsOfTab(t, tab); step++) out.push({ tab, step })
  return out
}

/** The highest beat number: presses of Next after the entrance. */
export const tourBeats = (t: AtlasTour): number => Math.max(0, tourSteps(t).length - 1)

export function tabOfBeat(t: AtlasTour, beat: number): TourTab {
  const steps = tourSteps(t)
  return steps[Math.min(Math.max(0, beat), steps.length - 1)].tab
}

/** The beat a click on a tab goes to. An unknown or hidden tab stays where it is (null). */
export function firstBeatOfTab(t: AtlasTour, tab: TourTab): number | null {
  const at = tourSteps(t).findIndex((s) => s.tab === tab)
  return at < 0 ? null : at
}

/**
 * Shift + a digit jumps to a tab: the digit is the tab's number in the bar. Plain digits 1 to 5 stay "open this product", so this reads
 * the physical key (`code`), which Shift does not change.
 */
export function tabForCode(t: AtlasTour, code: string): TourTab | null {
  const m = /^Digit([1-9])$/.exec(code)
  if (!m) return null
  return tourTabs(t)[Number(m[1]) - 1] ?? null
}
