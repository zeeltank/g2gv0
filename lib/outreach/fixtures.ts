/**
 * Servers' answers for the Outreach tests, shaped as hp_erp writes them (OutreachGateController, OutreachClaimsController, GTM OutreachController). One place, so
 * a test that changes a field changes it for what the screen reads.
 */

export interface WireCheck {
  key: string
  label: string
  passed: boolean
  detail: string
}

/** The ten checks the gate runs, in the order it runs and lists them (OutreachGate::checks), each with its server label and a passing detail. */
export const GATE_KEYS: ReadonlyArray<{ key: string; label: string; detail: string }> = [
  { key: 'banned_phrase', label: 'No banned phrases', detail: 'None of the banned phrases appears.' },
  { key: 'length', label: 'Short enough', detail: 'Subject 28 of 150, body 410 of 1500 characters.' },
  { key: 'link_count', label: 'At most one link', detail: 'The body has no link.' },
  { key: 'placeholder', label: 'No unfilled merge fields', detail: 'Every merge field is filled in.' },
  { key: 'unapproved_claim', label: 'Only approved claims', detail: 'The text states no numeric, percentage, guarantee or superlative claim.' },
  { key: 'recipient', label: 'Recipient identified', detail: 'The address belongs to one CRM record.' },
  { key: 'consent', label: 'Allowed to email', detail: 'Email is allowed on 1 CRM record.' },
  { key: 'suppression', label: 'Not on the suppression list', detail: 'Neither the address nor its domain is on the suppression list.' },
  { key: 'contact_status', label: 'Outreach contact is reachable', detail: 'No outreach contact with this address is bounced, unsubscribed or do-not-contact.' },
  { key: 'unsubscribe_link', label: 'Unsubscribe link reachable', detail: 'The unsubscribe link every email carries can be reached.' },
]

/** All ten checks, passing, except the ones named in `failing` (key -> the detail the server gives). */
export function wireChecks(failing: Record<string, string> = {}): WireCheck[] {
  return GATE_KEYS.map((c) => (c.key in failing ? { key: c.key, label: c.label, passed: false, detail: failing[c.key] } : { ...c, passed: true }))
}

/** The preview's answer. `passed` follows the checks unless said otherwise. */
export function gateAnswer(checks: WireCheck[] = wireChecks(), over: { passed?: boolean | null; checked_at?: string | null; id?: number } = {}) {
  return {
    status: 1,
    data: {
      message: { table: 'gtm_outreach_messages', id: over.id ?? 11 },
      passed: over.passed === undefined ? checks.length > 0 && checks.every((c) => c.passed) : over.passed,
      checks,
      checked_at: over.checked_at === undefined ? '2026-11-04T11:30:00+05:30' : over.checked_at,
    },
  }
}

/** Three of the ten fail: a banned phrase, an unapproved claim, and an address on the suppression list. */
export const FAILING = {
  banned_phrase: 'Contains “guaranteed results”.',
  unapproved_claim: 'No claim is approved for the product yet. Not an approved claim: “Cuts admin time by 40%.”.',
  suppression: 'The address is on the suppression list (domain example.org, unsubscribed).',
}

export function claim(over: Record<string, unknown> = {}) {
  return {
    id: 31, product_master_id: 9, product_name: 'School ERP', claim: 'Used by over 200 schools in India.', source_url: 'https://example.org/case-studies', status: 'approved',
    approved_by: 2, approved_at: '2026-11-03 10:00:00', created_by: 2, created_at: '2026-11-03 09:00:00', updated_at: '2026-11-03 10:00:00', ...over,
  }
}

export function claimsAnswer(claims: unknown[] = [claim()], total?: number) {
  return { status: 1, data: { claims, total: total ?? claims.length } }
}

/** A row of GET /api/gtm/outreach (gtm_outreach_messages.* plus the joined names). */
export function message(over: Record<string, unknown> = {}) {
  return {
    id: 11, account_id: 4, contact_id: 21, account_name: 'Hillcrest Academy', contact_name: 'Asha Menon', contact_email: 'asha@example.org', contact_status: 'active',
    sequence_key: null, step: 1, due_at: null, subject: 'A quick idea for Hillcrest', body: 'Hello Asha, we help schools run admissions without paper. Would a short call help?',
    status: 'approved', decision_note: null, deal_id: null, campaign_id: null, submitted_at: null, approved_at: '2026-11-04 09:00:00', scheduled_for: null, next_attempt_at: null,
    attempts: 0, last_attempt_at: null, sent_at: null, error: null, created_at: '2026-11-04 08:00:00', ...over,
  }
}

export function readiness(over: Record<string, unknown> = {}) {
  return {
    mailer: 'smtp', host: null, from: 'sales@example.org', from_name: 'Sales', platform_gate_allows: true, gtm_sending_enabled: true, scheduler_enabled: false, unsubscribe_link_ok: true,
    daily_cap: 50, sent_today: 0, require_second_approver: false, can_send: true, blockers: [], smtp: null, ...over,
  }
}

/** The refusal the server writes when the gate stops a send (OutreachGate::blocked), as the shared transport keeps it: HTTP 422 and the message. */
export const REFUSAL_TEXT = 'The outreach checks stopped this message. No banned phrases: Contains “guaranteed results”. Only approved claims: Not an approved claim: “Cuts admin time by 40%.”. Nothing was sent.'

export function attempt(over: Record<string, unknown> = {}) {
  return { id: 1, message_id: 11, attempt: 1, outcome: 'refused', code: 'gate_blocked', detail: REFUSAL_TEXT, scheduled: 1, actor_id: null, created_at: '2026-11-04 10:00:00', ...over }
}
