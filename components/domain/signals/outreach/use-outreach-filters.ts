'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { changeFilters, filtersActive, readFilters, writeFilters, type FilterKey } from '@/lib/signals/outreach-model'
import type { OutreachFacets, OutreachFilters } from '@/services/signals/outreach-types'

/**
 * The four filters (Product, Sub-product, ICP, Region) as the address holds them, shared by Companies, All people and Messages: whichever of the three is open reads the same
 * `?product=&subProduct=&icp=&region=`, so switching between them keeps the narrowing, and a link or a reload opens the same narrowed list. Setting them writes the address and keeps
 * every other parameter in it (the open view and section, a person, a tab). The address is the only place they are kept: nothing is held here.
 *
 * `set` takes the filter or filters that changed (an empty string clears one) and the facets on screen, which the cascade needs: choosing another product clears a sub-product that
 * does not belong to it. Needs a Suspense boundary above it, like any component that reads the address.
 */
export function useOutreachFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Stable by CONTENT: opening a person or a section rewrites the address but leaves the four filters alone, and a list that asks the server again whenever its filters change must not.
  const key = JSON.stringify(readFilters(searchParams))
  const filters = useMemo(() => JSON.parse(key) as OutreachFilters, [key])

  const write = useCallback((next: OutreachFilters) => {
    const text = writeFilters(new URLSearchParams(searchParams.toString()), next).toString()
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  const set = useCallback((patch: Partial<Record<FilterKey, string>>, facets: OutreachFacets | null | undefined) => write(changeFilters(filters, patch, facets)), [filters, write])
  const clear = useCallback(() => write({}), [write])

  return { filters, active: filtersActive(filters), set, clear }
}
