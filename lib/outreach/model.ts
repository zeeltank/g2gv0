import type { ApprovedClaim, ClaimList, GateCheck, GateFailure, GateReport, MessageFacts } from './types'

/**
 * The rules of the Checks section of the GTM Outreach screen (slice 10b) that need no browser: what each check says in plain words, the order they are shown
 * in, the summary line, how the server's answer is read, how a refused send is recognised, and what a failed request means. Tested on their own
 * (lib/outreach/model.test.ts).
 *
 * THE GATE IS A REASON NOT TO SEND. Nothing in this file decides that anything may be sent, and every default leans the same way: an answer that cannot be
 * read, a check that did not say it passed, a list with no check in it, all read as "failed" and never as "passed".
 */

// ── Reading the server's answer ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null)

/** Text a person may read: a string with something in it. Blank and non-strings are null. */
export function readableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** A whole number from 1 up, from a number or a string of digits; anything else (0, negative, 1.5, "abc", null) is null. */
export function whole(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN
  return Number.isSafeInteger(n) && n >= 1 ? n : null
}

/** An address a link may point at: http or https only. Anything else (a script, a relative path, junk) is null and is shown as plain text instead. */
export function httpUrl(value: unknown): string | null {
  const text = readableText(value)
  if (text === null) return null
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

const humanise = (key: string): string => {
  const text = key.replace(/_/g, ' ').trim()
  return text === '' ? 'A check' : text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The checks in a list. A check PASSES only when the server said `passed: true` (the boolean itself): a string "true", a 1, a missing field and an item that is
 * not an object at all all read as failed, because a check that cannot be read cannot vouch for the message.
 */
export function readChecks(raw: unknown): GateCheck[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const r = record(item)
    if (!r) return { key: 'unknown', label: '', passed: false, detail: '' }
    return { key: readableText(r.key) ?? 'unknown', label: readableText(r.label) ?? '', passed: r.passed === true, detail: readableText(r.detail) ?? '' }
  })
}

/**
 * The preview's answer (`{status, data:{passed, checks, checked_at}}`) as a report, or null when it is not that shape (so the screen can say it got an answer it
 * cannot read, rather than draw an empty list that looks like "nothing failed").
 */
export function readReport(body: unknown): GateReport | null {
  const data = record(record(body)?.data)
  if (!data || !Array.isArray(data.checks)) return null
  const checks = readChecks(data.checks)
  const serverPassed = typeof data.passed === 'boolean' ? data.passed : null
  return { checks, passed: summarize(checks, serverPassed).passed, checkedAt: readableText(data.checked_at) }
}

// ── Words ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** One sentence per check key, for each result. The server's own words for the specifics (`detail`) are shown under it. */
export const CHECK_SENTENCES: Readonly<Record<string, { passed: string; failed: string }>> = {
  banned_phrase: { passed: 'The message uses no banned phrase.', failed: 'The message uses a banned phrase.' },
  length: { passed: 'The subject and the text are short enough.', failed: 'The subject or the text is too long.' },
  link_count: { passed: 'The message has no more than one link.', failed: 'The message has more than one link.' },
  placeholder: { passed: 'Every merge field is filled in.', failed: 'A merge field is still unfilled.' },
  unapproved_claim: { passed: 'Every claim in the message is an approved one.', failed: 'The message states a claim nobody has approved.' },
  recipient: { passed: 'The person it is for is identified.', failed: 'The person it is for cannot be identified.' },
  consent: { passed: 'The person has allowed email.', failed: 'The person has not allowed email, or this could not be read.' },
  suppression: { passed: 'The address is not on the suppression list.', failed: 'The address, or its domain, is on the suppression list.' },
  contact_status: { passed: 'The contact is one who can be emailed.', failed: 'The contact is marked as someone who must not be emailed.' },
  unsubscribe_link: { passed: 'The unsubscribe link can be reached.', failed: 'The unsubscribe link cannot be reached.' },
  gate: { passed: 'The checks ran.', failed: 'The checks could not run, so the message is held back.' },
}

export type Verdict = 'Passed' | 'Failed'

/** The word a person reads for one check. Colour only helps; this is what carries the meaning. */
export const verdict = (check: GateCheck): Verdict => (check.passed ? 'Passed' : 'Failed')

/** The plain sentence for one check. A key this screen has no sentence for falls back to the server's label, then to the key written out. */
export function checkSentence(check: GateCheck): string {
  const known = Object.prototype.hasOwnProperty.call(CHECK_SENTENCES, check.key) ? CHECK_SENTENCES[check.key] : null
  if (known) return check.passed ? known.passed : known.failed
  const name = check.label !== '' ? check.label : humanise(check.key)
  return check.passed ? `${name}.` : `${name}: this check failed.`
}

/** The failing checks first, then the passing ones; each group keeps the order the server ran them in. */
export function orderChecks(checks: readonly GateCheck[]): GateCheck[] {
  return [...checks.filter((c) => !c.passed), ...checks.filter((c) => c.passed)]
}

export interface Summary {
  total: number
  failed: number
  /** The client's verdict: at least one check, every one passed, and the server did not say it failed. */
  passed: boolean
  line: string
}

/**
 * The line over the list. The count is of the CHECKS shown (what a person can see and tally); a server that says "not passed" with no failed check in the list
 * still reads as not passed. There is no wording for "you can send": passing the checks is not permission to send, and sending is a separate switch.
 */
export function summarize(checks: readonly GateCheck[], serverPassed: boolean | null = null): Summary {
  const total = checks.length
  const failed = checks.filter((c) => !c.passed).length
  if (total === 0) return { total, failed, passed: false, line: 'No check came back, so nothing here vouches for this message: you cannot send this yet.' }
  if (failed > 0) return { total, failed, passed: false, line: `${failed} of ${total} check${total === 1 ? '' : 's'} failed: you cannot send this yet.` }
  if (serverPassed === false) return { total, failed, passed: false, line: 'The server says this message did not pass, although none of the checks shown failed: you cannot send this yet.' }
  return { total, failed, passed: true, line: total === 1 ? 'The check passed.' : `All ${total} checks passed.` }
}

/** True when the list holds a failed "claim" check, which is when the approved claims are worth showing beside it. */
export const needsClaims = (checks: readonly GateCheck[]): boolean => checks.some((c) => c.key === 'unapproved_claim' && !c.passed)

// ── The message the checks were run on ──────────────────────────────────────────────────────────────────────────────────────────────

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * What the checks read of a message: the subject, the text and the address and status of the contact. A report belongs to one signature; when the message in
 * the list has another one (it was edited and saved), the report is out of date and the screen says so instead of showing it as current.
 */
export function messageSignature(message: MessageFacts): string {
  return JSON.stringify([textOf(message.subject), textOf(message.body), textOf(message.contact_email), textOf(message.contact_status)])
}

/** The product a message is declared to be about, when this server's list says so (it does only once the S10a column exists). */
export const messageProductId = (message: MessageFacts): number | null => whole(message.product_master_id)

/** Which statuses are still drafts the checks are for. A sent, sending or cancelled message is finished, and its checks would only mislead. */
export const CHECKABLE_STATUSES: readonly string[] = ['draft', 'rejected', 'pending_approval', 'approved', 'failed']

export const isCheckable = (status: string | undefined): boolean => typeof status === 'string' && CHECKABLE_STATUSES.includes(status)

// ── A refused send ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The first words of the refusal the server writes when the checks stop a send (hp_erp OutreachGate::blocked). */
export const GATE_REFUSAL_PREFIX = 'The outreach checks stopped this message.'

/**
 * Is this failed request the gate's refusal? The server answers HTTP 422 with code `gate_blocked`, but the shared transport keeps only the message, so the
 * refusal is recognised by its fixed first sentence; an error that carries the code itself (a transport that keeps it) is recognised too.
 */
export function gateRefusalMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  const { code, status } = error as { code?: unknown; status?: unknown }
  if (code === 'gate_blocked') return error.message
  return status === 422 && error.message.startsWith(GATE_REFUSAL_PREFIX) ? error.message : null
}

export const isGateRefusal = (error: unknown): boolean => gateRefusalMessage(error) !== null

/** What the attempts list says next to an attempt the gate stopped (the scheduler's deferral writes the same code). */
export function attemptNote(code: string | null | undefined): string | null {
  return code === 'gate_blocked' ? 'Held back by the outreach checks. Nothing was sent.' : null
}

// ── A failed request ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const UNAVAILABLE_TEXT = 'The outreach checks are not available on this server yet.'
export const FORBIDDEN_TEXT = 'The outreach checks are not available on this server yet, or your role does not include them.'
export const BUSY_TEXT = 'Too many checks were asked for in a minute. Wait a moment, then try again.'
export const NETWORK_TEXT = 'The request did not reach the server. Check your connection and try again.'
export const UNREADABLE_TEXT = 'The server answered, but not in a form this screen can read.'

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

export function classifyGateFailure(error: unknown, fallback = 'The checks could not be run.'): GateFailure {
  const status = statusOf(error)
  if (status === 404) return { kind: 'unavailable', message: UNAVAILABLE_TEXT }
  if (status === 403) return { kind: 'unavailable', message: FORBIDDEN_TEXT }
  if (status === 429) return { kind: 'busy', message: BUSY_TEXT }
  if (status !== null) return { kind: 'error', message: readableText((error as { message?: unknown }).message) ?? `The server answered ${status}.` }
  if (error instanceof TypeError) return { kind: 'error', message: NETWORK_TEXT }
  return { kind: 'error', message: readableText((error as { message?: unknown } | null)?.message) ?? fallback }
}

// ── The approved claims ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The approved claims in a list answer (`{status, data:{claims, total}}`), or null when it is not that shape. Only a claim the server marks `approved` is kept:
 * this list is shown as "what IS approved", so anything else (proposed, retired, an unreadable status) must never appear in it.
 */
export function readClaims(body: unknown): ClaimList | null {
  const data = record(record(body)?.data)
  if (!data || !Array.isArray(data.claims)) return null
  const claims: ApprovedClaim[] = []
  for (const item of data.claims) {
    const r = record(item)
    const id = r ? whole(r.id) : null
    const claim = r ? readableText(r.claim) : null
    if (!r || id === null || claim === null || r.status !== 'approved') continue
    claims.push({ id, productId: whole(r.product_master_id), productName: readableText(r.product_name), claim, sourceUrl: readableText(r.source_url) })
  }
  const total = typeof data.total === 'number' && Number.isFinite(data.total) && data.total >= claims.length ? Math.floor(data.total) : claims.length
  return { claims, total }
}

/** The heading over the list: the claims of the product the message is about, or all of them when this server does not say which product that is. */
export const claimsHeading = (productId: number | null): string => (productId === null ? 'Approved claims (all products)' : 'Approved claims for this product')

/** What the list says when there is nothing in it. The rule is the gate's own (slice 10, decision 3): no approved claim means no such claim passes. */
export const NO_CLAIMS_TEXT = 'No claim is approved yet, so no number, percentage, guarantee or "best" claim can pass the checks.'
export const CLAIMS_FORBIDDEN_TEXT = 'You do not have access to the list of approved claims.'
export const CLAIMS_UNAVAILABLE_TEXT = 'The list of approved claims is not available on this server yet.'

export function classifyClaimsFailure(error: unknown): GateFailure {
  const status = statusOf(error)
  if (status === 403) return { kind: 'unavailable', message: CLAIMS_FORBIDDEN_TEXT }
  if (status === 404) return { kind: 'unavailable', message: CLAIMS_UNAVAILABLE_TEXT }
  return classifyGateFailure(error, 'The approved claims could not be read.')
}
