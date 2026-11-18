'use client'

import { useEffect, useRef, useState } from 'react'

import { hasContent, readPage, snapshotKey, type PageSnapshot } from './dom-snapshot'

interface Options {
  /** Only read while something wants it (the chat is open): reading is not free. */
  enabled: boolean
  /** Finds the region that holds the page - not the sidebar, header or chat. */
  getRoot: () => Element | null
  /** Anything that means "this is a different page now" (the pathname). */
  watch: string
}

const SETTLE_MS = 700
const DEBOUNCE_MS = 900

/**
 * The page as it is now, kept current while `enabled`.
 *
 * Pages load their data after they mount, and a person changes what is on screen - a
 * filter, a search, a selection - without the route changing. So the snapshot is read once
 * the page has settled and read again, debounced, whenever its content or its controls
 * change. It is cleared the moment the route changes: a previous page's data must never be
 * offered as the new page's.
 *
 * Application-agnostic: it reports what the page shows and leaves the use to the caller.
 */
export function usePageSnapshot({ enabled, getRoot, watch }: Options): PageSnapshot | null {
  const [snapshot, setSnapshot] = useState<PageSnapshot | null>(null)
  const lastKey = useRef('')
  const getRootRef = useRef(getRoot)

  useEffect(() => {
    getRootRef.current = getRoot
  })

  useEffect(() => {
    if (!enabled) return

    let timer: ReturnType<typeof setTimeout> | undefined
    let observer: MutationObserver | undefined
    let observed: Element | null = null

    const read = () => {
      const root = getRootRef.current()
      if (!root) return

      const next = readPage(root)
      const key = snapshotKey(next)

      if (key !== lastKey.current) {
        lastKey.current = key
        setSnapshot(hasContent(next) ? next : null)
      }
    }

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(read, delay)
    }

    // The content region may not exist yet on the first pass; look for it until it does.
    const attach = () => {
      const root = getRootRef.current()
      if (!root) {
        timer = setTimeout(attach, 300)
        return
      }

      observed = root
      observer = new MutationObserver(() => schedule(DEBOUNCE_MS))
      observer.observe(root, { childList: true, subtree: true, characterData: true })
      // Typing in a search box and choosing a row change state, not (always) the DOM.
      root.addEventListener('input', onInteract, true)
      root.addEventListener('change', onInteract, true)
      root.addEventListener('click', onInteract, true)
      schedule(SETTLE_MS)
    }

    const onInteract = () => schedule(DEBOUNCE_MS)

    attach()

    return () => {
      if (timer) clearTimeout(timer)
      observer?.disconnect()
      observed?.removeEventListener('input', onInteract, true)
      observed?.removeEventListener('change', onInteract, true)
      observed?.removeEventListener('click', onInteract, true)
      // A previous page's data is not the next page's.
      lastKey.current = ''
      setSnapshot(null)
    }
  }, [enabled, watch])

  return snapshot
}
