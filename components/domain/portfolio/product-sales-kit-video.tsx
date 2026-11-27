'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { kitErrorText } from './product-sales-kit-parts'
import type { KitFetcher } from './product-sales-kit-glyph'
import type { KitItem } from '@/services/product-master/kit-types'

/**
 * Plays a video from the Sales Kit in the page. The bytes are read with the bearer token (a video tag sends no header), shown from a blob address, and the address is released the moment
 * the player closes, so a closed video holds no memory. A video too big to hold is never sent here: its button is Download.
 */
export function KitVideoDialog({ item, fetcher, onClose, onDownload }: {
  /** The video to play; null closes the player. */
  item: KitItem | null
  fetcher: KitFetcher
  onClose: () => void
  onDownload: (item: KitItem) => void
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-4xl">
        {item && <Player key={item.id} item={item} fetcher={fetcher} onClose={onClose} onDownload={onDownload} />}
      </DialogContent>
    </Dialog>
  )
}

function Player({ item, fetcher, onClose, onDownload }: { item: KitItem; fetcher: KitFetcher; onClose: () => void; onDownload: (item: KitItem) => void }) {
  const [state, setState] = useState<{ src: string | null; error: string }>({ src: null, error: '' })

  useEffect(() => {
    let live = true
    let made: string | null = null
    fetcher(item.id)
      .then((blob) => {
        if (!live) return
        made = URL.createObjectURL(blob)
        setState({ src: made, error: '' })
      })
      .catch((cause) => { if (live) setState({ src: null, error: kitErrorText(cause, 'The video could not be opened.') }) })
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [item.id, fetcher])

  return (
    <>
      <DialogHeader className="mb-0">
        <DialogTitle className="break-words pr-6">{item.title}</DialogTitle>
        <DialogDescription>{item.description || 'Video from the Sales Kit.'}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1">
        {state.error
          ? <p role="alert" className="rounded-lg border border-destructive bg-card p-3 text-sm text-foreground">{state.error}</p>
          : state.src
            ? <video src={state.src} controls autoPlay playsInline aria-label={item.title} className="max-h-[70vh] w-full rounded-lg bg-black" />
            : <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Opening the video</p>}
      </div>
      <DialogFooter className="mt-0">
        <Button type="button" variant="outline" onClick={() => onDownload(item)}><Download aria-hidden="true" />Download</Button>
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </>
  )
}
