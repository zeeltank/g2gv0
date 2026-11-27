import type { ReactNode } from 'react'

import { PublicPlayer } from '@/components/domain/lms/client-presentation/public-player'
import { fileWord, hostOf, sharedFileUrl, sizeWords, type SharedKitItem, type SharedView } from '@/lib/share-kit/shared-item'

/*
 * What a visitor who is not signed in sees at /share/kit/<token>, once the server has said yes: the title, one line on what it is for, the product, then the thing. A server component, with no
 * script of its own: nothing here reads the visitor's browser or talks to the API from it. The file is shown from the API's own address (`<api>/public/sales-kit/<token>/file`), which sends a PDF,
 * a picture or a video inline and everything else as a download.
 */

const BUTTON = 'inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring/50'
const LINK = 'text-sm font-medium text-foreground underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring'

/** "27 Dec 2026" from the server's `expiresAt`, or null when it is not a date. */
export function expiryWords(expiresAt: string | null): string | null {
  const day = new Date(`${(expiresAt ?? '').slice(0, 10)}T00:00:00`)
  return Number.isNaN(day.getTime()) ? null : `This link works until ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`
}

function Frame({ item, children }: { item: SharedKitItem; children: ReactNode }) {
  const expiry = expiryWords(item.expiresAt)

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <header className="space-y-2">
          <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{item.title}</h1>
          {item.description && <p className="max-w-prose text-base text-muted-foreground">{item.description}</p>}
          {item.productName && <p className="text-sm text-muted-foreground">{item.productName}</p>}
        </header>
        {children}
        {expiry && <p className="text-sm text-muted-foreground">{expiry}</p>}
      </div>
    </main>
  )
}

export function SharedKitView({ item, view, token, apiBase }: { item: SharedKitItem; view: SharedView; token: string; apiBase: string }) {
  // The deck is the whole page: the same player the signed link at /present opens, with no presenter notes in it.
  if (view.mode === 'deck') return <PublicPlayer productKey={view.deck} />

  if (view.mode === 'link') {
    const host = hostOf(view.url)
    return (
      <Frame item={item}>
        <div className="space-y-2">
          <a href={view.url} target="_blank" rel="noopener noreferrer" className={BUTTON}>Open link</a>
          {host && <p className="text-sm text-muted-foreground">{`Opens ${host} in a new tab.`}</p>}
        </div>
      </Frame>
    )
  }

  const shown = sharedFileUrl(apiBase, token, true)
  const saved = sharedFileUrl(apiBase, token, false)
  const size = sizeWords(item.size)

  if (view.mode === 'download') {
    return (
      <Frame item={item}>
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="space-y-1">
            {item.fileName && <p className="break-words text-base font-medium">{item.fileName}</p>}
            <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
              <span>{fileWord(item.fileName, item.mimeType)}</span>
              {size && <span>{size}</span>}
            </p>
          </div>
          <a href={saved} download className={BUTTON}>Download</a>
        </div>
      </Frame>
    )
  }

  return (
    <Frame item={item}>
      {view.mode === 'image' && (
        <img src={shown} alt={item.title} className="h-auto max-h-[75vh] max-w-full self-start rounded-lg border border-border object-contain" />
      )}
      {view.mode === 'pdf' && <iframe src={shown} title={item.title} className="h-[75vh] w-full rounded-lg border border-border bg-card" />}
      {view.mode === 'video' && <video src={shown} controls playsInline preload="metadata" aria-label={item.title} className="max-h-[75vh] w-full rounded-lg bg-black" />}
      <p>
        <a href={saved} download className={LINK}>Download</a>
        {size && <span className="ml-3 text-sm text-muted-foreground">{size}</span>}
      </p>
    </Frame>
  )
}
