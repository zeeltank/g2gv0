import type { ConfirmOptions } from '@/components/shared/scaffolds/use-confirm'
import type { OrgLinkRequest, OrgSuggestion } from '@/services/org-accounts/types'

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

/** The question asked before a decision, which says what will happen (and what will not). */
export function confirmCopy(suggestion: OrgSuggestion, action: LinkAction): ConfirmOptions {
  const names = `${suggestion.left.name} and ${suggestion.right.name}`
  return action === 'confirm'
    ? {
      title: `Are ${names} the same organisation?`,
      description: 'These two will be shown as one organisation. Nothing in either record is changed.',
      confirmLabel: CONFIRM_LABEL,
    }
    : {
      title: `Are ${names} different organisations?`,
      description: 'These two will not be suggested as the same organisation again. Nothing in either record is changed.',
      confirmLabel: REJECT_LABEL,
    }
}

/** What the list says after a decision succeeded. */
export function decidedNotice(suggestion: OrgSuggestion, action: LinkAction): string {
  return action === 'confirm'
    ? `${suggestion.left.name} and ${suggestion.right.name} are now shown as one organisation.`
    : `${suggestion.left.name} and ${suggestion.right.name} will not be suggested as the same organisation again.`
}
