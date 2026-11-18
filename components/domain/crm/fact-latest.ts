'use client'

import { useMemo, useRef } from 'react'

/**
 * "Only the newest read may change what is shown." `begin()` numbers a read as it starts; `isCurrent(n)` says whether that read is still the newest when its
 * answer arrives. A slower answer for the page, the filter or the record the person has left is then dropped instead of replacing the one they are on.
 * The counter lives in a ref inside this hook, so the screens that use it read no ref themselves.
 */
export function useLatestRead() {
  const counter = useRef(0)
  return useMemo(() => ({
    begin: (): number => { counter.current += 1; return counter.current },
    isCurrent: (read: number): boolean => read === counter.current,
  }), [])
}
