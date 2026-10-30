import type { ActiveNav, NavModule, NavNode } from '@/lib/gtg-navigation'

/**
 * The four screens of Signals. They are tabs on the Signals screen now, so the sidebar lists only the Signals entry. Each one keeps its own
 * route (deep links and bookmarks still work); only the sidebar's child rows are folded away, in code, never in the database.
 */
export const SIGNALS_TABS = [
  { key: 'opportunities', label: 'Company Opportunities', href: '/signals', hint: 'Generate and review signals' },
  { key: 'inbox', label: 'Signal Inbox', href: '/module/crm/marketing/signal-inbox', hint: 'Social listening & intent signals' },
  { key: 'ingestion', label: 'Ingestion Engine', href: '/ingestion', hint: 'Analyse a page or document' },
  { key: 'portfolio', label: 'Product Portfolio', href: '/portfolio', hint: 'Products, offers and ICPs' },
  { key: 'partners', label: 'Partner Network', href: '/partners', hint: 'Delivery and sales partners' },
] as const

export type SignalsTabKey = (typeof SIGNALS_TABS)[number]['key']

const TAB_PATHS: ReadonlySet<string> = new Set(SIGNALS_TABS.map((t) => t.href))
const TAB_LABELS: ReadonlyMap<string, string> = new Map(
  SIGNALS_TABS.map((t) => [t.label.toLowerCase(), t.href]),
)

export interface CollapsedSignalsNav {
  modules: NavModule[]
  /** The Signals tab links this user's menu actually contained (their menu rights decide it). Null when the tree has no Signals group. */
  tabs: string[] | null
  /** Each folded-away path -> the menu entry that now stands for it, so the sidebar and breadcrumb stay on "Signals" for those routes. */
  owners: Record<string, ActiveNav>
}

/**
 * Folds the four Signals child rows into their parent entry. Pure: the menu tree is not changed in place and nothing is persisted.
 *
 * A parent entry that loses all its children becomes a link to /signals (unless it already links somewhere). Children that are not one of the
 * four stay. A tree with no such group is returned as it is. Rights are untouched: a row the user cannot see was never in the tree.
 */
export function collapseSignalsNav(modules: NavModule[]): CollapsedSignalsNav {
  const owners: Record<string, ActiveNav> = {}
  const found: string[] = []

  const isFoldedChild = (c: NavNode): boolean => {
    if (c.children.length > 0) return false
    if (c.accessLink && TAB_PATHS.has(c.accessLink)) return true
    if (TAB_LABELS.has(c.label.trim().toLowerCase())) return true
    return false
  }

  const resolveChildHref = (c: NavNode): string | null => {
    if (c.accessLink && TAB_PATHS.has(c.accessLink)) return c.accessLink
    return TAB_LABELS.get(c.label.trim().toLowerCase()) ?? null
  }

  const visit = (node: NavNode, moduleId: string, parent: NavNode | null): NavNode => {
    const folded = node.children.filter(isFoldedChild)
    const kept = node.children.filter((c) => !folded.includes(c)).map((c) => visit(c, moduleId, node))
    if (folded.length === 0) {
      if (node.accessLink === '/module/crm/signals') {
        return { ...node, accessLink: '/signals', children: kept }
      }
      return kept.length === node.children.length && kept.every((k, i) => k === node.children[i])
        ? node
        : { ...node, children: kept }
    }

    const menuId = parent ? parent.id : node.id
    for (const f of folded) {
      const link = resolveChildHref(f) ?? (f.accessLink as string)
      if (link) {
        owners[link] = { moduleId, menuId, submenuId: node.id }
        found.push(link)
      }
    }

    owners['/signals'] = { moduleId, menuId, submenuId: node.id }
    if (node.accessLink) {
      owners[node.accessLink] = { moduleId, menuId, submenuId: node.id }
    }

    // When the Signals children are folded into this node, it navigates directly to /signals
    const nextAccessLink = (node.label.trim().toLowerCase() === 'signals' || node.accessLink === '/module/crm/signals' || kept.length === 0)
      ? '/signals'
      : (node.accessLink || '/signals')

    return { ...node, accessLink: nextAccessLink, children: kept }
  }

  // The hook's own walk treats a module's direct children as menus (parent = none), so the owners recorded here must too.
  const next = modules.map((m) => ({ ...m, children: m.children.map((c) => visit(c, m.id, null)) }) as NavModule)

  return { modules: found.length === 0 ? modules : next, tabs: found.length === 0 ? null : [...new Set(found)], owners }
}

/** The tabs a user is shown: all four when the menu carries no Signals group, otherwise the ones their rights include (plus /signals itself, the landing tab). */
export function visibleSignalsTabs(tabs: string[] | null) {
  if (tabs === null) return [...SIGNALS_TABS]

  return SIGNALS_TABS.filter((t) => t.href === '/signals' || tabs.includes(t.href))
}
