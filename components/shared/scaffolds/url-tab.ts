/**
 * Which tab of a detail page is open, kept in the URL (?tab=usage) so a link opens the same tab and the Back button works.
 * Pure functions, tested on their own (lib/scaffolds/page-tabs.test.tsx); use-url-tab.ts wires them to the router.
 */

type ParamReader = { get(name: string): string | null }

/** The tab the URL names, or `fallback` when it names none or one that does not exist. */
export function readTab(params: ParamReader, ids: readonly string[], fallback: string, name = 'tab'): string {
  const value = params.get(name)
  return value !== null && ids.includes(value) ? value : fallback
}

/** `base` with the tab set. The first tab is the default and is left out, so the plain URL opens it. Other parameters are kept. */
export function writeTab(base: URLSearchParams, id: string, fallback: string, name = 'tab'): URLSearchParams {
  const out = new URLSearchParams(base)
  if (id === fallback) out.delete(name)
  else out.set(name, id)
  return out
}
