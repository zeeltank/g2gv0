'use client'

import { Share2 } from 'lucide-react'
import { addedText, MISSING_TEXT, shareMark, sizeText, typeWord } from '@/lib/portfolio/sales-kit-model'
import type { KitCan, KitItem } from '@/services/product-master/kit-types'
import { KitActionButtons, KitManage, type KitRun } from './product-sales-kit-actions'
import { KitGlyph, type KitFetcher } from './product-sales-kit-glyph'

export interface KitEntryProps {
  item: KitItem
  can: KitCan
  fetcher: KitFetcher
  /** The entry whose file is being read for a download or a player, so its button can say so. */
  busy: boolean
  onRun: KitRun
  onEdit: (item: KitItem) => void
  onRemove: (item: KitItem) => void
  onShare: (item: KitItem) => void
}

/**
 * The facts of an entry in one quiet line. The words sit in separate spans with a gap between them, not in one string cut with a mark, so a screen reader reads each and the line wraps
 * on a phone.
 */
export function KitFacts({ item, withAdded = false }: { item: KitItem; withAdded?: boolean }) {
  if (item.missing) return <p className="text-xs text-foreground">{MISSING_TEXT}</p>
  const size = sizeText(item.size)
  const added = withAdded ? addedText(item) : ''
  const shared = shareMark(item)

  return (
    <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
      <span>{typeWord(item)}</span>
      {size && <span>{size}</span>}
      {shared && <span className="inline-flex items-center gap-1 text-foreground"><Share2 className="size-3" aria-hidden="true" />{shared}</span>}
      {added && <span>{added}</span>}
    </p>
  )
}

/** One entry of the shelf, drawn small. Its title is the one heading; the glyph is decoration; the actions wrap under the words on a phone. */
export function KitTile({ item, can, fetcher, busy, onRun, onEdit, onRemove, onShare }: KitEntryProps) {
  return (
    <li data-kit-entry={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card p-3">
      <KitGlyph item={item} fetcher={fetcher} />
      <div className="min-w-0 flex-1 basis-48 space-y-0.5">
        <h3 className="break-words text-sm font-medium text-foreground">{item.title}</h3>
        {item.description && <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
        <KitFacts item={item} />
      </div>
      <div className="flex items-center gap-1">
        <KitActionButtons item={item} busy={busy} onRun={onRun} />
        <KitManage item={item} can={can} onEdit={onEdit} onRemove={onRemove} onShare={onShare} />
      </div>
    </li>
  )
}

/**
 * The featured presentation: the one place the shelf is loud. A larger glyph, the title as a real heading, what it is for in full, and its main action as the page's biggest button
 * ("Open interactive deck" for the web deck, "Download PowerPoint" for the file).
 */
export function KitFeatured({ item, can, fetcher, busy, onRun, onEdit, onRemove, onShare }: KitEntryProps) {
  return (
    <section aria-labelledby={`kit-featured-${item.id}`} data-kit-entry={item.id} data-kit-featured="" className="@container rounded-xl border border-primary bg-card p-4 @xl:p-6">
      <div className="flex flex-col gap-4 @xl:flex-row @xl:items-center @xl:gap-6">
        <KitGlyph item={item} fetcher={fetcher} large />
        <div className="min-w-0 flex-1 space-y-2">
          <h3 id={`kit-featured-${item.id}`} className="break-words text-xl font-semibold tracking-tight text-foreground">{item.title}</h3>
          {item.description && <p className="max-w-prose text-sm text-muted-foreground">{item.description}</p>}
          <KitFacts item={item} withAdded />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <KitActionButtons item={item} large busy={busy} onRun={onRun} />
          <KitManage item={item} can={can} onEdit={onEdit} onRemove={onRemove} onShare={onShare} />
        </div>
      </div>
    </section>
  )
}
