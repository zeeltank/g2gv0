'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { SearchInput } from '@/components/ui/search-input'

/**
 * The search box of a list screen. It sends what was typed once typing pauses, not on every keystroke, and shows the search the URL holds when that
 * changes from outside (the Back button, a pasted link, a "clear" button).
 */
export function ListSearch({ value, onSearch, placeholder = 'Search…', label = 'Search', delay = 300 }: {
  /** The search the list currently shows (the committed one, from the URL). */
  value: string
  onSearch: (q: string) => void
  placeholder?: string
  label?: string
  /** Milliseconds of quiet before the search is sent. */
  delay?: number
}) {
  const [text, setText] = useState(value)
  const lastSent = useRef(value)
  const send = useRef(onSearch)
  useEffect(() => { send.current = onSearch })

  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    const typed = text.trim()
    if (typed === lastSent.current) return
    const timer = setTimeout(() => {
      lastSent.current = typed
      send.current(typed)
    }, delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  return (
    <SearchInput
      value={text}
      onChange={(event) => setText(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
      icon={<Search className="size-4" aria-hidden="true" />}
    />
  )
}
