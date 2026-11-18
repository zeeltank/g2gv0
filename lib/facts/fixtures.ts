import type {
  ConsentData, Fact, FactCounts, FactEvidence, FactsEntityData, FactsEnvelope, FactsQueueData,
} from '../../services/facts/types'

/** Data for the facts screens' tests, shaped as the contract in docs/agentic-crm/slices/S04-contact-facts-and-consent.md writes it. */

export const NOW = '2026-11-03T15:22:57+00:00'
export const CONTACT_ID = 31
export const ORG_ID = 135

export function evidence(over: Partial<FactEvidence> = {}): FactEvidence {
  return {
    kind: 'site.own-page', label: "the organisation's own website states it", weight: 0.8, source_url: 'https://hillcrest.example.edu/contact',
    quote: 'Write to the principal at principal@hillcrest.example.edu', retrieved_at: NOW, ...over,
  }
}

export const PROFILE_MATCH: FactEvidence = evidence({
  kind: 'profile.email-match', label: 'their email address is on the profile', weight: 0.95, source_url: 'https://www.linkedin.com/in/asha-menon', quote: null,
})

export function fact(over: Partial<Fact> = {}): Fact {
  return {
    id: 1, entity_type: 'contact', entity_id: CONTACT_ID, field: 'email', field_label: 'Email address', value: 'asha.menon@hillcrest.example.edu', value_kind: 'personal',
    status: 'proposed', band: 'probable', score: 0.87, method: 'web_lookup', source_url: 'https://hillcrest.example.edu/contact', proposed_by: 'agent:organisation',
    decided_by_name: null, decided_at: null, evidence: [evidence(), PROFILE_MATCH], rationale: 'Two independent sources agree, one of them the organisation itself.',
    column_written: false, record_value: null, decision_note: null, supersedes_id: null, created_at: NOW, entity_name: 'Asha Menon', ...over,
  }
}

export const phoneFact = (over: Partial<Fact> = {}) => fact({
  id: 2, field: 'phone', field_label: 'Phone number', value: '+91 98765 43210', value_kind: null, band: 'possible', score: 0.4, method: 'web_lookup',
  evidence: [evidence({ kind: 'web.cited-claim', label: 'a cited web source states it', weight: 0.4, source_url: 'https://directory.example.org/schools/hillcrest', quote: 'Office: +91 98765 43210' })],
  rationale: 'One web source states it.', record_value: '+91 11111 22222', ...over,
})

export const websiteFact = (over: Partial<Fact> = {}) => fact({
  id: 3, entity_type: 'organization', entity_id: ORG_ID, entity_name: 'Hillcrest Academy', field: 'website', field_label: 'Website', value: 'https://hillcrest.example.edu', value_kind: null,
  band: 'verified', score: 0.96, evidence: [evidence({ source_url: 'https://hillcrest.example.edu/', quote: null })], rationale: 'The organisation’s own website states it.', ...over,
})

export const appliedFact = (over: Partial<Fact> = {}) => fact({
  id: 4, status: 'applied', field: 'title', field_label: 'Job title', value: 'Principal', value_kind: null, band: 'verified', score: 0.93, decided_by_name: 'Anil Shah',
  decided_at: NOW, column_written: true, record_value: 'Principal', evidence: [evidence({ quote: 'Principal: Asha Menon' })], ...over,
})

export const dismissedFact = (over: Partial<Fact> = {}) => fact({
  id: 5, status: 'dismissed', field: 'secondary_email', field_label: 'Second email address', value: 'info@hillcrest.example.edu', value_kind: 'role', band: 'possible', score: 0.35,
  decided_by_name: 'Anil Shah', decided_at: NOW, decision_note: 'That is the school office, not her.', evidence: [evidence({ kind: 'search.cites-profile', label: 'a search for them cites this profile', weight: 0.35, quote: null })], ...over,
})

export const COUNTS: FactCounts = { proposed: 2, applied: 1, dismissed: 1 }

export function entityData(over: Partial<FactsEntityData> = {}): FactsEnvelope<FactsEntityData> {
  return {
    status: 1,
    data: {
      entity: { type: 'contact', id: CONTACT_ID, name: 'Asha Menon' },
      facts: [fact(), phoneFact(), appliedFact(), dismissedFact()],
      counts: COUNTS,
      ...over,
    },
  }
}

export function queueData(rows: Fact[] = [fact(), phoneFact(), websiteFact()], over: Partial<FactsQueueData> = {}): FactsEnvelope<FactsQueueData> {
  return { status: 1, data: { rows, pagination: { page: 1, per_page: 25, total: rows.length }, ...over } }
}

export function consentData(over: Partial<ConsentData> = {}): FactsEnvelope<ConsentData> {
  return {
    status: 1,
    data: {
      channels: {
        email: { allowed: true, reason: null, code: null },
        sms: { allowed: false, reason: 'No consent has been recorded for this channel.', code: 'no_consent_recorded' },
        whatsapp: { allowed: false, reason: 'No phone number on record.', code: 'no_address' },
      },
      sources: [{ source: 'gtm_contacts', value: 'active', at: NOW }],
      ...over,
    },
  }
}
