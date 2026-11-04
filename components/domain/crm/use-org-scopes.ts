'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isLaravelContextReady, type LaravelContext } from '@/lib/laravel-context'
import { availableActions } from '@/lib/org-accounts/display'
import { classifyLoadFailure, linkFailureText, type LoadFailure } from '@/lib/org-accounts/failure'
import { decidedNotice, linkRequest, removeSuggestion, type LinkAction } from '@/lib/org-accounts/suggestions'
import type { OrgAccountsApi } from '@/services/org-accounts/api-types'
import type { OrgAccountSummary, OrgMeta, OrgSuggestion } from '@/services/org-accounts/types'
import type { DecisionInProgress } from './org-account-duplicates'
import type { ScreenNotice } from './org-account-parts'

/**
 * What the Organizations list's scope switch (Organizations | Discovered | Possible duplicates) shares: the counts on the switch (the /api/org-accounts
 * summary), what this person may do (meta), and the possible duplicates with the decisions on them. The CRM scope needs none of it, so a failure here never
 * touches the CRM list: the switch just shows no counts and the other scopes say what went wrong.
 */
export function useOrgScopes(service: OrgAccountsApi, context: LaravelContext) {
  const [summary, setSummary] = useState<OrgAccountSummary | null>(null)
  const [summaryProblem, setSummaryProblem] = useState<LoadFailure | null>(null)
  const [meta, setMeta] = useState<OrgMeta | null>(null)

  const [suggestions, setSuggestions] = useState<OrgSuggestion[] | null>(null)
  const [suggestionsError, setSuggestionsError] = useState('')
  // How many pairs the summary counted and how many the server sent, each noted once: the difference is what the server held back.
  const [countedAtFirst, setCountedAtFirst] = useState<number | null>(null)
  const [sentAtFirst, setSentAtFirst] = useState<number | null>(null)
  const [busy, setBusy] = useState<DecisionInProgress | null>(null)
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState<ScreenNotice | null>(null)

  // Only the newest request may change what is shown.
  const latestSummary = useRef(0)
  const latestSuggestions = useRef(0)
  const suggestionsStarted = useRef(false)

  const refreshSummary = useCallback(async () => {
    if (!isLaravelContextReady(context)) return
    const mine = ++latestSummary.current
    try {
      const response = await service.list({ per_page: 1 })
      if (mine !== latestSummary.current) return
      setSummary(response.summary)
      setSummaryProblem(null)
      setCountedAtFirst((current) => current ?? response.summary.suggestions)
    } catch (cause) {
      if (mine !== latestSummary.current) return
      setSummaryProblem(classifyLoadFailure(cause, 'The counts could not be loaded.'))
    }
  }, [context, service])

  useEffect(() => {
    queueMicrotask(() => { void refreshSummary() })
  }, [refreshSummary])

  // What this person may do. If it cannot be read, nothing is offered.
  useEffect(() => {
    if (!isLaravelContextReady(context)) return
    let cancelled = false
    service.meta().then((response) => { if (!cancelled) setMeta(response.data) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [context, service])

  const loadSuggestions = useCallback(async () => {
    if (!isLaravelContextReady(context)) return
    const mine = ++latestSuggestions.current
    setSuggestionsError('')
    try {
      const response = await service.suggestions()
      if (mine !== latestSuggestions.current) return
      setSuggestions(response.data)
      setSentAtFirst((current) => current ?? response.data.length)
    } catch (cause) {
      if (mine !== latestSuggestions.current) return
      setSuggestionsError(classifyLoadFailure(cause, 'The possible duplicates could not be loaded.').message)
    }
  }, [context, service])

  /** Reads the possible duplicates the first time the scope is opened (and only then). */
  const ensureSuggestions = useCallback(() => {
    if (suggestionsStarted.current) return
    suggestionsStarted.current = true
    void loadSuggestions()
  }, [loadSuggestions])

  const retrySuggestions = useCallback(() => { void loadSuggestions() }, [loadSuggestions])

  /**
   * A person's answer to one pair. A settled pair goes at once; then the counts and the pairs are read again, because two records that now count as one
   * organisation change both the counts and which other pairs could still be confirmed (a pair that would now be refused is not offered any more).
   */
  const decide = useCallback(async (suggestion: OrgSuggestion, action: LinkAction): Promise<boolean> => {
    setBusy({ key: suggestion.key, action })
    setFailure('')
    try {
      await service.link(linkRequest(suggestion, action))
      setSuggestions((current) => (current === null ? current : removeSuggestion(current, suggestion.key)))
      setNotice({ tone: 'success', text: decidedNotice(suggestion, action) })
      void refreshSummary()
      void loadSuggestions()
      return true
    } catch (cause) {
      setFailure(linkFailureText(cause))
      return false
    } finally {
      setBusy(null)
    }
  }, [service, refreshSummary, loadSuggestions])

  const hidden = countedAtFirst !== null && sentAtFirst !== null ? Math.max(0, countedAtFirst - sentAtFirst) : 0
  /** The live number of possible duplicates once the list has loaded (it falls as pairs are decided), else null: the summary's own number is used then. */
  const liveDuplicates = suggestions !== null ? suggestions.length + hidden : null

  return {
    summary, summaryProblem, meta, can: availableActions(meta), refreshSummary,
    suggestions, suggestionsError, hidden, liveDuplicates, ensureSuggestions, retrySuggestions,
    busy, failure, decide, notice, setNotice,
  }
}
