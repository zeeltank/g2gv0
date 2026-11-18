'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { patchListQuery, readListQuery, writeListQuery, type ListQueryConfig, type ListQueryPatch } from './list-query'

/**
 * A list screen's search, sort, page and filters, kept in the URL (the rules are in list-query.ts, where they are tested).
 *
 * Define `config` once at module level: it is a dependency here, and a new object on every render would make every consumer re-run.
 * Changes use router.replace, not push, so typing in a search box does not fill the history with one entry per keystroke.
 * Needs a Suspense boundary above it, like any component that calls useSearchParams (a screen reached through the content map has one already).
 */
export function useListQuery(config: ListQueryConfig) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const query = useMemo(() => readListQuery(searchParams, config), [searchParams, config])

  const setQuery = useCallback((patch: ListQueryPatch) => {
    const next = patchListQuery(query, patch, config)
    const qs = writeListQuery(new URLSearchParams(searchParams.toString()), next, config).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [query, searchParams, config, router, pathname])

  /** Clicking the column the list is sorted by flips the direction; clicking another column sorts by it, in the default direction. */
  const toggleSort = useCallback((key: string) => {
    setQuery(query.sort === key ? { dir: query.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: config.dir ?? 'asc' })
  }, [query.sort, query.dir, config.dir, setQuery])

  return {
    query,
    setQuery,
    setSearch: useCallback((q: string) => setQuery({ q }), [setQuery]),
    setPage: useCallback((page: number) => setQuery({ page }), [setQuery]),
    setFilter: useCallback((name: string, value: string) => setQuery({ filters: { [name]: value } }), [setQuery]),
    toggleSort,
  }
}
