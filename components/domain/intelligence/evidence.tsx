'use client'

import type { InsightEvidence } from '@/services/intelligence/types'
import { compactEntities, type EntityGroup } from '@/lib/intelligence-center/entity-links'
import { evidenceLine, evidenceSources, openLabel, safeDeepLink } from '@/lib/intelligence-center/model'
import { LINK_CLASS } from '@/lib/intelligence-center/tones'
import { IntelLink } from './ui'

function Group({ group, fallbackLink, summaryOnly }: { group: EntityGroup; fallbackLink: string | null; summaryOnly: boolean }) {
  const moduleHref = group.module?.href ?? fallbackLink
  const moduleName = group.module?.label ?? openLabel(fallbackLink).replace(/^Open in /, '').replace(/^Open the record$/, 'the module')
  return (
    <li data-entity-group={group.entityType}>
      <span>{group.summary}</span>
      {!summaryOnly && group.shown.length > 0 && (
        <>
          {': '}
          {group.shown.map((record, index) => (
            <span key={`${record.id}-${index}`}>
              {index > 0 && ', '}
              {record.href ? <IntelLink to={record.href} className={LINK_CLASS}>{record.text}</IntelLink> : <span>{record.text}</span>}
            </span>
          ))}
          {group.more > 0 && <span>{` and ${group.more} more`}</span>}
        </>
      )}
      {!summaryOnly && group.noPage && (
        <span className="block text-xs text-muted-foreground" data-no-direct-page>
          No direct page for {group.count === 1 ? 'this record' : 'these records'}: find {group.count === 1 ? 'it' : 'them'} in{' '}
          {moduleHref ? <IntelLink to={moduleHref} className={LINK_CLASS}>{moduleName}</IntelLink> : <span>{moduleName}</span>}.
        </span>
      )}
    </li>
  )
}

/**
 * The evidence of one insight, tidy: each metric and window on one line, and the records folded into one line per kind ("11 opportunities listed", the
 * first three as links where the record has a page of its own, "and 8 more"). A record without a page says so and points to its module: no URL is guessed.
 */
export function EvidenceList({
  evidence,
  fallbackLink = null,
  parts = 'all',
}: {
  evidence: readonly InsightEvidence[]
  fallbackLink?: string | null
  /** `measures`: the metrics and windows, with each kind of record as a count only. `records`: only the records, with their links. */
  parts?: 'all' | 'measures' | 'records'
}) {
  const lines = parts === 'records' ? [] : evidence.filter((e) => e.kind !== 'entity')
  const groups = compactEntities(evidence)
  const sources = evidenceSources(evidence)
  const fallback = safeDeepLink(fallbackLink)
  if (lines.length === 0 && groups.length === 0) return null
  return (
    <div data-evidence>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {lines.map((item, index) => (
          <li key={`${item.kind}-${index}`}>{evidenceLine(item)}</li>
        ))}
        {groups.map((group) => (
          <Group key={group.entityType} group={group} fallbackLink={fallback} summaryOnly={parts === 'measures'} />
        ))}
      </ul>
      {parts !== 'records' && sources.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Source: {sources.join(', ')}</p>}
    </div>
  )
}
