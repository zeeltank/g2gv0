/**
 * Recognises a lesson link that points at the client presentation, so My Learning can play it inside the lesson instead of showing
 * the plain "opens in a new tab" card. Mirrors lib/sales-training/deck.ts `salesTrainingKeyOf`, and ignores the host: the lesson row
 * stores an absolute address, the frame always loads the same-origin page.
 */
export const CLIENT_PRESENTATION_KEYS = ['scholarclone'] as const
export type ClientPresentationKey = (typeof CLIENT_PRESENTATION_KEYS)[number]

export interface ClientPresentationLink {
  key: ClientPresentationKey
  /** `?mode=short` opens the five-slide version. */
  mode: 'full' | 'short'
}

export function clientPresentationLinkOf(src: string | null | undefined): ClientPresentationLink | null {
  if (!src) return null
  const [path, query = ''] = src.split('#')[0].split('?')
  const m = /\/module\/lms\/learning\/client-presentation\/([a-z0-9-]+)\/?$/i.exec(path)
  if (!m) return null
  const key = m[1].toLowerCase()
  if (!(CLIENT_PRESENTATION_KEYS as readonly string[]).includes(key)) return null
  return { key: key as ClientPresentationKey, mode: new URLSearchParams(query).get('mode') === 'short' ? 'short' : 'full' }
}

/** Same-origin page for a link; `embed` asks the deck to report progress to its parent and to hide nothing else. */
export function clientPresentationPage(link: ClientPresentationLink, embed = false): string {
  const params = new URLSearchParams()
  if (link.mode === 'short') params.set('mode', 'short')
  if (embed) params.set('embed', '1')
  const q = params.toString()
  return `/module/lms/learning/client-presentation/${link.key}${q ? `?${q}` : ''}`
}
