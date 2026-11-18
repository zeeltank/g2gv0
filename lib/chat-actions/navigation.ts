/**
 * Navigation from the chat: "open the department page", "take me to leave requests".
 *
 * Application-agnostic and pure. The application supplies the destinations it actually offers
 * the signed-in user - in G2G, the rights-filtered sidebar - so a page the user cannot see is
 * never a candidate, and nothing here names a route.
 */

export interface NavTarget {
  label: string
  path: string
  /** Where it sits, e.g. ["Organization", "Department Management"]. */
  trail: string[]
}

const GO_VERBS = ['open', 'go to', 'goto', 'take me to', 'navigate to', 'show me the page', 'bring me to', 'switch to', 'visit']

const FILLER = new Set(['the', 'a', 'an', 'page', 'screen', 'section', 'to', 'me', 'please', 'tab', 'module'])

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Whether the sentence is asking to GO somewhere (as opposed to asking a question about it). */
export function asksToNavigate(message: string): boolean {
  const text = ` ${normalise(message)} `
  return GO_VERBS.some((verb) => text.includes(` ${normalise(verb)} `))
}

/**
 * The destination a sentence asks for, or null.
 *
 * Every word of the destination's label must appear in the sentence (after dropping the verb and
 * filler); among those, the longest label wins so "leave requests" beats "leave". Two equally
 * good matches are ambiguous, and an ambiguous request returns null rather than guess where to send
 * the user.
 */
export function matchNavTarget(message: string, targets: NavTarget[]): NavTarget | null {
  if (!asksToNavigate(message)) return null

  const words = new Set(normalise(message).split(' ').filter((word) => word && !FILLER.has(word)))
  let best: { target: NavTarget; size: number } | null = null
  let tie = false

  for (const target of targets) {
    const labelWords = normalise(target.label).split(' ').filter((word) => word && !FILLER.has(word))
    if (labelWords.length === 0 || !labelWords.every((word) => words.has(word))) continue

    if (best === null || labelWords.length > best.size) {
      best = { target, size: labelWords.length }
      tie = false
    } else if (labelWords.length === best.size && target.path !== best.target.path) {
      tie = true
    }
  }

  return best && !tie ? best.target : null
}
