import type { ConfirmOptions } from '@/components/shared/scaffolds/use-confirm'
import type { OrgLinkRequest, OrgSuggestion } from '@/services/org-accounts/types'
import { placeConflictText } from './display'

export type LinkAction = OrgLinkRequest['action']

/** The body of POST /links for one possible duplicate. The action is the one the person chose, nothing else. */
export function linkRequest(suggestion: OrgSuggestion, action: LinkAction): OrgLinkRequest {
  return {
    left_type: suggestion.left.type,
    left_id: suggestion.left.id,
    right_type: suggestion.right.type,
    right_id: suggestion.right.id,
    action,
  }
}

/** The list without the decided pair. Another pair, even one naming the same row, stays. */
export function removeSuggestion(list: readonly OrgSuggestion[], key: string): OrgSuggestion[] {
  return list.filter((s) => s.key !== key)
}

export const CONFIRM_LABEL = 'Confirm: same organisation'
export const REJECT_LABEL = 'Not the same'

/**
 * The question asked before a decision, which says what will happen (and what will not). A pair in two different places warns about it first: the
 * same name in two places is usually two organisations. Neither answer destroys anything, so neither button is red.
 */
export function confirmCopy(suggestion: OrgSuggestion, action: LinkAction): ConfirmOptions {
  const names = `${suggestion.left.name} and ${suggestion.right.name}`
  if (action === 'confirm') {
    const places = placeConflictText(suggestion)
    return {
      title: `Are ${names} the same organisation?`,
      description: places
        ? `${places}. The same name in two different places is usually two organisations. If you confirm, these two will be shown as one organisation. Nothing in either record is changed.`
        : 'These two will be shown as one organisation. Nothing in either record is changed.',
      confirmLabel: CONFIRM_LABEL,
      tone: 'default',
    }
  }
  return {
    title: `Are ${names} different organisations?`,
    description: 'These two will not be suggested as the same organisation again. Nothing in either record is changed.',
    confirmLabel: REJECT_LABEL,
    tone: 'default',
  }
}

/** What the list says after a decision succeeded. */
export function decidedNotice(suggestion: OrgSuggestion, action: LinkAction): string {
  return action === 'confirm'
    ? `${suggestion.left.name} and ${suggestion.right.name} are now shown as one organisation.`
    : `${suggestion.left.name} and ${suggestion.right.name} will not be suggested as the same organisation again.`
}
