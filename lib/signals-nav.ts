import type { ActiveNav, NavModule, NavNode } from '@/lib/gtg-navigation'

/**
 * The four screens of Signals. They are tabs on the Signals screen, so the sidebar lists only the Signals / Market Signals entry.
 * Each one keeps its own route (deep links and bookmarks still work); only the sidebar's child rows are folded away, in code, never in the database.
 */
export const SIGNALS_TABS = [
  { key: 'opportunities', label: 'Company Opportunities', href: '/signals', hint: 'Generate and review signals' },
  { key: 'ingestion', label: 'Ingestion Engine', href: '/ingestion', hint: 'Analyse a page or document' },
  { key: 'portfolio', label: 'Product Portfolio', href: '/portfolio', hint: 'Products, offers and ICPs' },
  { key: 'partners', label: 'Partner Network', href: '/partners', hint: 'Delivery and sales partners' },
] as const

export type SignalsTabKey = (typeof SIGNALS_TABS)[number]['key']

const TAB_PATHS: ReadonlySet<string> = new Set(SIGNALS_TABS.map((t) => t.href))
const TAB_LABELS: ReadonlyMap<string, string> = new Map(
  SIGNALS_TABS.map((t) => [t.label.toLowerCase(), t.href]),
)

const EXTRA_FOLDED_PATHS: ReadonlySet<string> = new Set([
  '/module/crm/marketing/signal-inbox',
  '/module/crm/signals',
])

const EXTRA_FOLDED_LABELS: ReadonlySet<string> = new Set([
  'signal inbox',
  'inbox',
])

/**
 * The retired Signal Review screen: it was merged into Company Opportunities on 13 Nov 2026 (owner decision), and its two addresses now redirect to /signals.
 * Its menu ROW stays in the database with status 1, because a Role & Permissions save deletes the rights of every row that is not status 1, so the row can still
 * arrive in a person's menu. The sidebar never draws it, whatever the person's rights: it is dropped here, in code, and a visit to either address highlights
 * Market Signals (see `owners`). Both spellings are the same screen (the row's own access_link, and the one under the CRM root's path).
 */
const SIGNAL_REVIEW_PATHS = ['/signal-review', '/module/crm/signal-review'] as const

export interface CollapsedSignalsNav {
  modules: NavModule[]
  /** The Signals tab links this user's menu actually contained (their menu rights decide it). Null when the tree has no Signals group. */
  tabs: string[] | null
  /** Each folded-away path -> the menu entry that now stands for it, so the sidebar and breadcrumb stay on "Signals" for those routes. */
  owners: Record<string, ActiveNav>
}

const isSignalInboxNode = (n: NavNode): boolean => {
  const label = n.label.trim().toLowerCase()
  const link = (n.accessLink ?? '').trim().toLowerCase()
  return label === 'signal inbox' || label === 'inbox' || link === '/module/crm/marketing/signal-inbox'
}

/** The Signal Review row: a leaf (a row with children is never dropped, so nothing else can disappear with it) by either address or by its name. */
const isSignalReviewNode = (n: NavNode): boolean => {
  if (n.children.length > 0) return false
  const label = n.label.trim().toLowerCase()
  const link = (n.accessLink ?? '').trim().toLowerCase().replace(/\/+$/, '')
  return label === 'signal review' || (SIGNAL_REVIEW_PATHS as readonly string[]).includes(link)
}

/** The same tree without the Signal Review row, at any depth. A branch that does not hold it comes back as the same objects, and nothing is changed in place. */
function withoutSignalReview<T extends NavNode>(nodes: T[]): T[] {
  let changed = false
  const out: T[] = []
  for (const node of nodes) {
    if (isSignalReviewNode(node)) {
      changed = true
      continue
    }
    const children = withoutSignalReview(node.children)
    if (children !== node.children) {
      changed = true
      out.push({ ...node, children })
    } else {
      out.push(node)
    }
  }
  return changed ? out : nodes
}

const isSignalsParent = (n: NavNode): boolean => {
  const label = n.label.trim().toLowerCase()
  const link = (n.accessLink ?? '').trim().toLowerCase()
  return label === 'signals' || label === 'market signals' || link === '/module/crm/signals' || link === '/signals'
}

/**
 * Folds the Signals child rows (and eliminates Signal Inbox) into their parent Market Signals / Signals entry.
 * Pure: the menu tree is not changed in place and nothing is persisted.
 *
 * Market Signals / Signals becomes a direct, flat link to /signals with zero children, eliminating dropdown chevrons.
 */
export function collapseSignalsNav(modules: NavModule[]): CollapsedSignalsNav {
  const owners: Record<string, ActiveNav> = {}
  const found: string[] = []

  const isFoldedChild = (c: NavNode): boolean => {
    if (c.children.length > 0) return false
    const link = (c.accessLink ?? '').trim()
    const label = c.label.trim().toLowerCase()
    if (link && (TAB_PATHS.has(link) || EXTRA_FOLDED_PATHS.has(link))) return true
    if (TAB_LABELS.has(label) || EXTRA_FOLDED_LABELS.has(label)) return true
    return false
  }

  const resolveChildHref = (c: NavNode): string | null => {
    const link = (c.accessLink ?? '').trim()
    const label = c.label.trim().toLowerCase()
    if (link && TAB_PATHS.has(link)) return link
    if (TAB_LABELS.has(label)) return TAB_LABELS.get(label)!
    if (link && EXTRA_FOLDED_PATHS.has(link)) return link
    if (EXTRA_FOLDED_LABELS.has(label)) return '/signals'
    return null
  }

  const visit = (node: NavNode, moduleId: string, parent: NavNode | null): NavNode => {
    const folded = node.children.filter(isFoldedChild)
    const kept = node.children.filter((c) => !folded.includes(c) && !isSignalInboxNode(c)).map((c) => visit(c, moduleId, node))
    const isParent = isSignalsParent(node)

    if (isParent || folded.length > 0) {
      const menuId = parent ? parent.id : node.id
      for (const f of folded) {
        const link = resolveChildHref(f) ?? (f.accessLink as string)
        if (link) {
          owners[link] = { moduleId, menuId, submenuId: node.id }
          if (link !== '/module/crm/marketing/signal-inbox' && link !== '/module/crm/signals') {
            found.push(link)
          }
        }
      }

      owners['/signals'] = { moduleId, menuId, submenuId: node.id }
      owners['/module/crm/signals'] = { moduleId, menuId, submenuId: node.id }
      owners['/module/crm/marketing/signal-inbox'] = { moduleId, menuId, submenuId: node.id }
      for (const path of SIGNAL_REVIEW_PATHS) {
        owners[path] = { moduleId, menuId, submenuId: node.id }
      }
      for (const tab of SIGNALS_TABS) {
        owners[tab.href] = { moduleId, menuId, submenuId: node.id }
      }
      if (node.accessLink) {
        owners[node.accessLink] = { moduleId, menuId, submenuId: node.id }
      }

      // If it's the Signals / Market Signals parent, or lost all children, it links directly to /signals with NO children
      if (isParent) {
        found.push('/signals')
        return { ...node, accessLink: '/signals', children: [] }
      }

      const nextAccessLink = kept.length === 0 ? '/signals' : (node.accessLink || '/signals')
      return { ...node, accessLink: nextAccessLink, children: kept }
    }

    if (node.accessLink === '/module/crm/signals') {
      return { ...node, accessLink: '/signals', children: kept }
    }

    return kept.length === node.children.length && kept.every((k, i) => k === node.children[i])
      ? node
      : { ...node, children: kept }
  }

  // Filter out any standalone or misplaced Signal Inbox nodes, and walk the tree
  const next = modules
    .filter((m) => !isSignalInboxNode(m))
    .map((m) => ({
      ...m,
      children: m.children.filter((c) => !isSignalInboxNode(c)).map((c) => visit(c, m.id, null)),
    }) as NavModule)

  const uniqueFound = [...new Set(found)]
  // The Signal Review row is dropped from whichever tree comes back, so it never reaches the sidebar, even for a person whose menu holds no Signals row at all.
  const shown = withoutSignalReview(uniqueFound.length === 0 ? modules : next)
  return { modules: shown, tabs: uniqueFound.length === 0 ? null : uniqueFound, owners }
}

/** These are app sections, so their visibility must not depend on optional sidebar menu rows. */
export function visibleSignalsTabs(_tabs: string[] | null) {
  return [...SIGNALS_TABS]
}
