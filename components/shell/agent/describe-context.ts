import type { PageContext } from '@/lib/intelligence/ai-workspace'
import type { PageSnapshot } from '@/lib/page-context/dom-snapshot'
import type { WorkspaceContextInfo } from './workspace-chrome'

/**
 * The "Working with ..." line: the page the backend resolved, its module, and what the browser
 * read off the screen (search text, filters, how many rows). Null when nothing is known, so the
 * banner stays hidden rather than naming a page it has not read.
 */
export function describeWorkspaceContext(
  context: PageContext | null,
  snapshot: PageSnapshot | null,
): WorkspaceContextInfo | null {
  const subject = context?.page?.title || snapshot?.title || context?.module?.label || null
  if (!subject) return null

  const details: string[] = []
  if (snapshot?.search?.query) details.push(`search "${snapshot.search.query}"`)
  if (snapshot?.filters?.length) {
    details.push(
      snapshot.filters
        .filter((filter) => filter.value)
        .slice(0, 3)
        .map((filter) => `${filter.label}: ${filter.value}`)
        .join(' · '),
    )
  }
  if (snapshot?.selected?.length) details.push(`${snapshot.selected.length} selected`)
  else if (snapshot?.metrics?.[0]) details.push(`${snapshot.metrics[0].value} shown`)

  return {
    subject,
    moduleLabel: context?.module?.label ?? null,
    details: details.filter(Boolean),
  }
}
