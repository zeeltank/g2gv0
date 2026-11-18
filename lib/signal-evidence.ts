/**
 * How the server's evidence class and product fit are worded on a signal card. Pure, so it can be tested without a browser.
 * The server decides the class from what it verified; the client only labels it. Older signals have none: nothing is shown for them.
 */

export type EvidenceClass = 'direct_evidence' | 'strong_indicator' | 'weak_indicator' | 'needs_further_research'

const LABELS: Record<EvidenceClass, { label: string; className: string; help: string }> = {
  direct_evidence: { label: 'Direct evidence', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', help: 'The source states a purchase step and its page was read.' },
  strong_indicator: { label: 'Strong indicator', className: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300', help: 'The source documents a project, but not a purchase decision.' },
  weak_indicator: { label: 'Weak indicator', className: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300', help: 'A background event. It is not proof the organisation will buy.' },
  needs_further_research: { label: 'Needs further research', className: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300', help: 'Nothing verified yet shows a need, or the evidence is an undated snippet.' },
}

/** The badge for a signal's evidence class, or null for a signal stored before classes existed (or an unknown value). */
export function evidenceBadge(value: string | null | undefined): { label: string; className: string; help: string } | null {
  return value && Object.prototype.hasOwnProperty.call(LABELS, value) ? LABELS[value as EvidenceClass] : null
}

/** "Career Guidance Programme (child product of Scholar K-12)" for a child-product match; the plain part name otherwise. */
export function fitHeading(fit: { kind?: string; name?: string; parent_product?: string } | null | undefined): string | null {
  if (!fit?.name) return null
  return fit.kind === 'child_product' && fit.parent_product ? `${fit.name} (child product of ${fit.parent_product})` : fit.name
}
