/**
 * The fallback shown when the chosen research date saved no signals: the latest genuine saved signals of the product, in a clearly separate
 * section, each keeping its own research date. They are never counted for the chosen date and never copied.
 */

/** The fallback is only looked for on the plain, unfiltered view of a date that has no signals: a filter that matches nothing is not an empty day. */
export function wantsFallback(args: { itemCount: number; search: string; view: string; status: string; loaded: boolean }): boolean {
  return args.loaded && args.itemCount === 0 && !args.search && args.view === 'all' && !args.status
}

/** The label above the fallback. `original` is the already formatted original research date. */
export function fallbackHeading(original: string): string {
  return `No new signals for this date. Showing previously generated signals from ${original}.`
}

/** True when the fallback really is another day's (never the chosen day's own rows). */
export function isOtherDay(resolved: string | null | undefined, chosen: string | null | undefined): resolved is string {
  return Boolean(resolved) && resolved !== chosen
}
