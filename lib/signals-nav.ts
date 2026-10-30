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
  return { modules: uniqueFound.length === 0 ? modules : next, tabs: uniqueFound.length === 0 ? null : uniqueFound, owners }
}

/** The tabs a user is shown: all four when the menu carries no Signals group, otherwise the ones their rights include (plus /signals itself, the landing tab). */
export function visibleSignalsTabs(tabs: string[] | null) {
  if (tabs === null) return [...SIGNALS_TABS]

  return SIGNALS_TABS.filter((t) => t.href === '/signals' || tabs.includes(t.href))
}
