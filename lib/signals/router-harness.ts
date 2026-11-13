import type { ReactElement } from 'react'
import { h } from '../scaffolds/h'

/**
 * A stand-in for Next's app router, so a screen that keeps its filters in the address (useListQuery, useUrlTab) can be rendered in a test. The address
 * is real state: `router.replace` changes it and the screen re-renders from it, exactly as in a browser, and every address that was written is recorded.
 * Import after dom-test-kit (it needs the fake DOM) and from inside the test, because it loads Next and React dynamically.
 */
export async function routerHarness(initialSearch = '', pathname = '/signal-review') {
  const React = await import('react')
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime')
  const { PathnameContext, SearchParamsContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime')

  const written: string[] = []
  let setUrl: ((url: string) => void) | null = null

  const router = {
    replace: (url: string) => { written.push(url); setUrl?.(url) },
    push: (url: string) => { written.push(url); setUrl?.(url) },
    back: () => undefined, forward: () => undefined, refresh: () => undefined, prefetch: () => undefined,
  }

  function Provider({ children }: { children: ReactElement }) {
    const [search, setSearch] = React.useState(initialSearch)
    setUrl = (url) => setSearch(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '')
    return h(
      AppRouterContext.Provider, { value: router as never },
      h(PathnameContext.Provider, { value: pathname }, h(SearchParamsContext.Provider, { value: new URLSearchParams(search) as never }, children)),
    )
  }

  return {
    /** Wraps an element in the router. */
    wrap: (element: ReactElement) => h(Provider, null, element),
    /** Every address the screen wrote, oldest first. */
    written,
    /** The search part of the last address written ('' when none). */
    lastSearch: () => { const url = written[written.length - 1]; return url && url.includes('?') ? url.slice(url.indexOf('?') + 1) : '' },
  }
}
