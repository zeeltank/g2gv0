import type { LaravelContext } from '@/lib/laravel-context'

/*
 * The Country > State / Province > City lists. The data lives on the backend (a local extract of an open location database): countries and a
 * country's states are small and fetched whole, cities are searched on the server and cut to a page, so the browser never holds a whole state.
 *
 * This file is pure: it takes the service as an argument, so it is tested without a network. It does three things the screen relies on:
 *  - caches answers and shares one request between callers that ask for the same thing (no duplicate calls);
 *  - never caches a failure (the next open tries again);
 *  - gives each screen a "latest only" guard so a slow answer for an old selection can never overwrite a newer one.
 */

export interface CountryOption { code: string; iso3?: string; name: string; emoji: string | null; has_states: boolean }
export interface StateOption { code: string; name: string; type: string | null }
export interface CityOption { id: number; name: string }

export interface StatesAnswer { country: CountryOption; states: StateOption[]; has_states: boolean; label: string; has_cities: boolean; message: string | null }
export interface CitiesAnswer { country_code: string; state_code: string | null; cities: CityOption[]; total: number; truncated: boolean; message: string | null }
export interface CountriesAnswer { default_country_code: string; countries: CountryOption[]; data_version: string | null }

export interface LocationService {
  getLocationCountries: (c: LaravelContext) => Promise<{ data: CountriesAnswer }>
  getLocationStates: (c: LaravelContext, country: string) => Promise<{ data: StatesAnswer }>
  getLocationCities: (c: LaravelContext, country: string, state: string | null, q: string, limit: number) => Promise<{ data: CitiesAnswer }>
}

export const DEFAULT_COUNTRY_CODE = 'IN'
export const CITY_PAGE = 50

/** Lower case, accents and extra spaces ignored: "Sao Paulo" finds "São Paulo". */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Options whose text (or code, exactly) matches the query, those that START with it first. An empty query keeps every option in its given order. */
export function filterByQuery<T>(options: T[], query: string, text: (option: T) => string, code?: (option: T) => string | null | undefined): T[] {
  const q = foldText(query)
  if (q === '') return options
  const starts: T[] = []
  const contains: T[] = []
  for (const o of options) {
    const name = foldText(text(o))
    const c = code?.(o)
    if (name.startsWith(q) || (c ? foldText(c) === q : false)) starts.push(o)
    else if (name.includes(q)) contains.push(o)
  }
  return [...starts, ...contains]
}

export interface LocationLoader {
  countries: () => Promise<CountriesAnswer>
  states: (countryCode: string) => Promise<StatesAnswer>
  cities: (countryCode: string, stateCode: string | null, query: string) => Promise<CitiesAnswer>
  /** How many requests were really sent (for tests and diagnostics). */
  readonly requests: number
}

export function createLocationLoader(service: LocationService, context: LaravelContext): LocationLoader {
  const memo = new Map<string, Promise<unknown>>()
  let sent = 0

  // One shared promise per key; a rejected one is forgotten so the next call asks again.
  const once = <T>(key: string, make: () => Promise<T>): Promise<T> => {
    const hit = memo.get(key)
    if (hit) return hit as Promise<T>
    sent += 1
    const promise = make().catch((error) => {
      memo.delete(key)
      throw error
    })
    memo.set(key, promise)
    return promise
  }

  return {
    countries: () => once('countries', async () => (await service.getLocationCountries(context)).data),
    states: (countryCode) => once(`states|${countryCode}`, async () => (await service.getLocationStates(context, countryCode)).data),
    cities: (countryCode, stateCode, query) => {
      const q = foldText(query)
      return once(`cities|${countryCode}|${stateCode ?? ''}|${q}`, async () => (await service.getLocationCities(context, countryCode, stateCode, query.trim(), CITY_PAGE)).data)
    },
    get requests() { return sent },
  }
}

/**
 * Numbers each request and tells whether a given one is still the newest. A slow answer for an old country, state or search is dropped:
 *   const ticket = latest.next(); const data = await load(); if (!latest.isLatest(ticket)) return
 */
export function latestOnly() {
  let current = 0
  return {
    next: () => ++current,
    isLatest: (ticket: number) => ticket === current,
    /** Make every request started so far stale (a parent selection changed). */
    invalidate: () => { current += 1 },
  }
}
