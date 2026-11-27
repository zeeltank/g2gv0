'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { OutreachListQuery, OutreachListResponse, OutreachSummary } from '@/services/signals/outreach-types'
import { errorText } from './outreach-parts'

interface ListState<T> {
  rows: T[]
  summary: OutreachSummary | null
  total: number
  lastPage: number
  loading: boolean
  error: string
}

/**
 * One page of the Companies or the All people list. It asks again whenever the query changes (a chip, a search, a sort, a page) or `reload()` is called, and only the answer to
 * the LATEST question is kept: a slow answer to an earlier one arrives after it and is dropped, so the list never shows rows that do not match the chip that is pressed.
 * The summary (the numbers on the chips) is kept while the next page loads, so the chips do not blink. A failure keeps the sentence for the screen to show and leaves the chips as they were.
 */
export function useOutreachList<T>(load: (query: OutreachListQuery) => Promise<OutreachListResponse<T>>, query: OutreachListQuery, failure: string) {
  const key = JSON.stringify(query)
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<ListState<T>>({ rows: [], summary: null, total: 0, lastPage: 1, loading: true, error: '' })
  const asked = useRef(0)

  const run = useCallback(async () => {
    const mine = ++asked.current
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const response = await loadRef.current(JSON.parse(key) as OutreachListQuery)
      if (mine !== asked.current) return
      setState({ rows: response.data, summary: response.summary, total: response.meta.total, lastPage: Math.max(1, response.meta.last_page), loading: false, error: '' })
    } catch (cause) {
      if (mine === asked.current) setState((current) => ({ ...current, rows: [], total: 0, lastPage: 1, loading: false, error: errorText(cause, failure) }))
    }
  }, [key, failure])

  // `version` is read so `reload()` asks again even though the query did not change.
  useEffect(() => { void version; queueMicrotask(() => { void run() }) }, [run, version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  return { ...state, reload }
}
