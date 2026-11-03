'use client'

import { useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { useConfirm } from '@/components/shared/scaffolds/use-confirm'
import { scoreText, shownText, sourceTypeLabel } from '@/lib/org-accounts/display'
import { returnFocusTo } from './org-account-focus'
import { CONFIRM_LABEL, confirmCopy, REJECT_LABEL, type LinkAction } from '@/lib/org-accounts/suggestions'
import type { OrgSuggestion } from '@/services/org-accounts/types'

export const EMPTY_DUPLICATES_TEXT = 'No possible duplicates. Names that match exactly are linked automatically.'

export interface DecisionInProgress {
  key: string
  action: LinkAction
}

/**
 * The "Possible duplicates" tab: each pair of names that look alike, side by side, with how much of their name words match and two buttons. Either
 * button first asks, in words, what will happen. `onDecide` does the work and answers true once the pair is settled, so the pair can go and the
 * focus can move on; a refused decision leaves the pair where it is and the screen shows the server's message in `failure`.
 */
export function OrgDuplicatesPanel({ suggestions, error, hidden, canConfirm, busy, failure, onRetry, onDecide }: {
  /** null until the first answer. */
  suggestions: readonly OrgSuggestion[] | null
  error: string
  /** How many more the server has than it sent. */
  hidden: number
  canConfirm: boolean
  busy: DecisionInProgress | null
  failure: string
  onRetry: () => void
  onDecide: (suggestion: OrgSuggestion, action: LinkAction) => Promise<boolean>
}) {
  const { confirm, confirmDialog } = useConfirm()
  const heading = useRef<HTMLHeadingElement>(null)

  const decide = async (suggestion: OrgSuggestion, action: LinkAction, trigger: HTMLElement) => {
    if (busy) return
    if (!(await confirm(confirmCopy(suggestion, action)))) {
      returnFocusTo(trigger)
      return
    }
    // The button that was pressed leaves the page with its pair, so then the focus goes to the heading instead of to nowhere.
    if (await onDecide(suggestion, action)) heading.current?.focus()
    else returnFocusTo(trigger)
  }

  return (
    <section aria-labelledby="org-duplicates-heading" className="space-y-3">
      <div>
        <h2 id="org-duplicates-heading" ref={heading} tabIndex={-1} className="text-base font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Possible duplicates
        </h2>
        <p className="text-sm text-muted-foreground">
          Names that look alike but are not identical. Confirming shows the two as one organisation; nothing in either record is changed.
        </p>
      </div>

      {failure && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{failure}</div>}

      {!canConfirm && suggestions !== null && suggestions.length > 0 && (
        <p className="text-sm text-muted-foreground">You can see these pairs, but you are not allowed to confirm or reject them.</p>
      )}

      {error && <ErrorState title="Possible duplicates could not be loaded" description={error} retry={onRetry} />}

      {!error && suggestions === null && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading possible duplicates…
        </div>
      )}

      {!error && suggestions !== null && suggestions.length === 0 && (
        <p role="status" className="rounded-lg border-2 border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">{EMPTY_DUPLICATES_TEXT}</p>
      )}

      {!error && suggestions !== null && suggestions.length > 0 && (
        <>
          <ul className="space-y-3">
            {suggestions.map((suggestion) => {
              const working = busy?.key === suggestion.key
              return (
                <li key={suggestion.key} data-pair={suggestion.key} aria-busy={working} className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Side side={suggestion.left} />
                    <Side side={suggestion.right} />
                  </div>
                  <p className="text-sm text-muted-foreground">{scoreText(suggestion.score)}</p>
                  {canConfirm && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={(event) => void decide(suggestion, 'confirm', event.currentTarget)}
                        disabled={busy !== null}
                        aria-label={`${CONFIRM_LABEL}: ${suggestion.left.name} and ${suggestion.right.name}`}
                      >
                        {working && busy?.action === 'confirm' ? 'Saving…' : CONFIRM_LABEL}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(event) => void decide(suggestion, 'reject', event.currentTarget)}
                        disabled={busy !== null}
                        aria-label={`${REJECT_LABEL}: ${suggestion.left.name} and ${suggestion.right.name}`}
                      >
                        {working && busy?.action === 'reject' ? 'Saving…' : REJECT_LABEL}
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            {shownText(suggestions.length, suggestions.length + hidden)}
            {hidden > 0 && '. The rest are offered after you decide on these and open this tab again.'}
          </p>
        </>
      )}

      {confirmDialog}
    </section>
  )
}

function Side({ side }: { side: OrgSuggestion['left'] }) {
  return (
    <div className="min-w-0">
      <p className="break-words font-medium text-foreground">{side.name}</p>
      <p className="text-xs text-muted-foreground">{sourceTypeLabel(side.type)}</p>
    </div>
  )
}
