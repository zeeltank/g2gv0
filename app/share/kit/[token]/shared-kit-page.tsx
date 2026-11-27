import { notFound } from 'next/navigation'

import { resolveApiBaseUrl } from '@/lib/api-config'
import { fetchSharedItem, viewOf, type SharedFetchDeps } from '@/lib/share-kit/shared-item'

import { SharedKitView } from './shared-kit-view'

/**
 * The shared page, as a function a test can call: it asks the server about the token and answers the page, or `notFound()` for ANY refusal: an unknown, stopped or expired link, a malformed token,
 * a wrong answer, a server that does not answer, a deck this site does not have. The same plain 404 each time, so a visitor cannot tell which. Nothing is rendered from an answer that was
 * not entirely right.
 */
export async function sharedKitElement(token: string, deps: SharedFetchDeps = {}) {
  const item = await fetchSharedItem(token, deps)
  const view = item ? viewOf(item) : null
  if (!item || !view) notFound()

  return <SharedKitView item={item} view={view} token={token} apiBase={deps.apiBase ?? resolveApiBaseUrl()} />
}
