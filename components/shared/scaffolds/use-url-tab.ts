'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { readTab, writeTab } from './url-tab'

/**
 * The open tab of a detail page, kept in the URL. `ids` should be a module-level constant (it is a dependency); the first id is the default.
 * Needs a Suspense boundary above it, like any component that calls useSearchParams.
 */
export function useUrlTab(ids: readonly string[], name = 'tab'): readonly [string, (id: string) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fallback = ids[0] ?? ''

  const active = useMemo(() => readTab(searchParams, ids, fallback, name), [searchParams, ids, fallback, name])
  const setActive = useCallback((id: string) => {
    const qs = writeTab(new URLSearchParams(searchParams.toString()), id, fallback, name).toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [searchParams, fallback, name, router, pathname])

  return [active, setActive] as const
}
