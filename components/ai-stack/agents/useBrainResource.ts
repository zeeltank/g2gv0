'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * G2G PORT: G2G has no academic-year selector, so the year is no part of the key and
 * every other line of LMS_K12's hook is unchanged. The organisation is scoped by the
 * bearer token on the backend, never by this key.
 */
const useSelectedAcademicYear = (): string => '';

/**
 * Load-once-per-key fetch with an explicit refresh, shared by every Brain
 * screen so they report failure the same way.
 *
 * Errors are surfaced, never swallowed into an empty result: a screen showing
 * "no rows" when the request actually 404'd is the failure mode this whole
 * integration was brought in to remove.
 *
 * THE SELECTED ACADEMIC YEAR IS PART OF EVERY KEY. Brain payloads are read
 * once on mount, so without this a switch from 2022 to 2021 would leave the
 * 2022 figures on screen under a 2021 heading — the one failure mode worse than
 * an error, because it looks like an answer. Every screen goes through this
 * hook, so putting the year here covers all of them and none of them has to
 * remember to.
 */
export function useBrainResource<T>(load: () => Promise<T>, deps: unknown[]) {
  const syear = useSelectedAcademicYear();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // The dependency list is the caller's plus the year, so it cannot be an array
  // literal here; that is the whole point of a shared loader hook. `load` closes
  // over nothing year-specific — the year is read from the session inside
  // brainFetch — so listing it is what forces the refetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const run = useCallback(load, [...deps, syear]);

  const fetchNow = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        // A non-refresh load means the KEY changed — a different year, or a
        // different filter — so what is held is an answer to a question nobody
        // is asking any more. Dropping it makes the screen say "loading" rather
        // than show last year's numbers under this year's heading. An explicit
        // refresh keeps its data, which is what makes it a refresh.
        setData(null);
        setLoading(true);
      }
      setError('');
      try {
        setData(await run());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Enterprise Brain request failed.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [run],
  );

  // Fetching on mount is exactly the "subscribe to an external system" case the
  // rule carves out; the setState calls it flags are the loading flag and the
  // resolved payload, which is what a data hook is for.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchNow(false);
  }, [fetchNow]);

  return {
    data,
    error,
    loading,
    refreshing,
    refresh: () => void fetchNow(true),
    setData,
  };
}
