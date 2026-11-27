'use client'

import { useEffect, useRef, useState } from 'react'
import { FileX, Link2, Play, Presentation } from 'lucide-react'
import { FileTypeIcon } from '@/components/ui/file-icon'
import { cn } from '@/lib/utils'
import { tileOf } from '@/lib/portfolio/sales-kit-model'
import type { KitItem } from '@/services/product-master/kit-types'

/** Reads one entry's file as a picture. Must keep its identity between renders (wrap it in useCallback): a new one is a new read. */
export type KitFetcher = (itemId: number) => Promise<Blob>

/**
 * What a picture does while it waits: nothing is read until the tile scrolls into view (a shelf of twenty pictures reads the few on screen), the bytes are read with the bearer token
 * and shown from a blob address, and that address is released when the tile goes away. A browser with no IntersectionObserver reads at once. A picture that cannot be read leaves the
 * file glyph in its place, so the tile never shows a broken image.
 */
function KitThumb({ item, fetcher }: { item: KitItem; fetcher: KitFetcher }) {
  const box = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined')
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const node = box.current
    if (visible || !node) return
    const watcher = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) setVisible(true) })
    watcher.observe(node)
    return () => watcher.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let live = true
    let made: string | null = null
    fetcher(item.id)
      .then((blob) => {
        if (!live) return
        made = URL.createObjectURL(blob)
        setSrc(made)
      })
      .catch(() => { if (live) setFailed(true) })
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [visible, fetcher, item.id])

  return (
    <span ref={box} className="flex size-full items-center justify-center overflow-hidden rounded-md bg-muted">
      {src && !failed
        ? <img src={src} alt="" className="size-full object-cover" />
        : <FileTypeIcon mimeType={item.mimeType} fileName={item.fileName} className="h-3/4 w-3/4" />}
    </span>
  )
}

/**
 * The left of a tile or of the featured card: a thumbnail for a picture, the file glyph for a file, a play tile for a video, a link tile for an address, a plain note for a file that is
 * gone. Always decorative: the title and the type word next to it say what it is.
 */
export function KitGlyph({ item, fetcher, large = false }: { item: KitItem; fetcher: KitFetcher; large?: boolean }) {
  const tile = tileOf(item)
  const frame = cn('flex shrink-0 items-center justify-center rounded-lg border border-border', large ? 'size-20 @xl:size-28' : 'size-12')
  const icon = large ? 'size-8 @xl:size-10' : 'size-5'

  if (tile === 'thumbnail') return <span className={cn(frame, 'overflow-hidden')} aria-hidden="true"><KitThumb item={item} fetcher={fetcher} /></span>
  if (tile === 'file') return <span className={cn(frame, 'bg-muted p-1.5')} aria-hidden="true"><FileTypeIcon mimeType={item.mimeType} fileName={item.fileName} className="h-full w-full" /></span>
  if (tile === 'video') return <span className={cn(frame, 'bg-muted text-muted-foreground')} aria-hidden="true"><Play className={icon} /></span>
  if (tile === 'link') return <span className={cn(frame, 'bg-muted text-muted-foreground')} aria-hidden="true">{item.kind === 'presentation' ? <Presentation className={icon} /> : <Link2 className={icon} />}</span>

  return <span className={cn(frame, 'border-dashed bg-muted text-muted-foreground')} aria-hidden="true"><FileX className={icon} /></span>
}
