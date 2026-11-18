import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiError } from '../../services/core'
import { FactsApiError } from '../../services/facts/errors'
import {
  acceptNotice, bandView, cappedText, consentReason, consentRows, consentSourceText, consentSummary, contactPatch, countsText, decisionLine, entityLabel, entityPath, failureText,
  evidenceLabel, fieldLabel, groupFacts, isNoRight, isWaiting, lastPage, loadFailure, MAX_QUOTE, quoteText, queueParams, rangeText, recordLine, originLine, proposerText, scoreText, sourceView,
  statusView, strengthText, valueLink, wroteRecord,
} from './model'
import { appliedFact, consentData, dismissedFact, fact, phoneFact, websiteFact } from './fixtures'

describe('words for a band', () => {
  it('says each band in a word and a meaning, with a tone that is only a border', () => {
    assert.deepEqual(bandView('verified'), { label: 'Verified', tone: 'positive', meaning: bandView('verified').meaning })
    assert.equal(bandView('probable').label, 'Probable')
    assert.equal(bandView('possible').label, 'Possible')
    assert.equal(bandView('possible').tone, 'caution')
    for (const band of ['verified', 'probable', 'possible']) assert.ok(bandView(band).meaning.length > 20, `${band} has a meaning in words`)
  })

  it('shows a band it does not know by its own name, muted, never as one of the known ones', () => {
    assert.deepEqual(bandView('certain'), { label: 'certain', tone: 'muted', meaning: '' })
    assert.equal(bandView('').label, '—')
  })
})

describe('the score', () => {
  it('is a rounded percentage, and 0 and 1 are real answers', () => {
    assert.equal(scoreText(0.87), '87% sure')
    assert.equal(scoreText(0), '0% sure')
    assert.equal(scoreText(1), '100% sure')
    assert.equal(scoreText(0.995), '100% sure')
  })

  it('is nothing at all when it is not a number from 0 to 1 (never a made-up 0)', () => {
    for (const bad of [null, undefined, '0.5', Number.NaN, -0.1, 1.2, Infinity]) assert.equal(scoreText(bad), null, String(bad))
  })
})

describe('the state of a fact in words', () => {
  it('says waiting, accepted (and by whom), dismissed and replaced', () => {
    assert.deepEqual(statusView({ status: 'proposed', decided_by_name: null }), { label: 'Waiting for you', tone: 'caution' })
    assert.equal(statusView({ status: 'applied', decided_by_name: 'Anil Shah' }).label, 'Accepted by Anil Shah')
    assert.equal(statusView({ status: 'applied', decided_by_name: null }).label, 'Accepted')
    assert.equal(statusView({ status: 'dismissed', decided_by_name: 'Anil Shah' }).label, 'Dismissed by Anil Shah')
    assert.equal(statusView({ status: 'dismissed', decided_by_name: null }).label, 'Dismissed')
    assert.equal(statusView({ status: 'superseded', decided_by_name: null }).label, 'Replaced by a newer value')
  })

  it('names a status it does not know as it was written, muted', () => {
    assert.deepEqual(statusView({ status: 'frozen' as never, decided_by_name: null }), { label: 'frozen', tone: 'muted' })
  })

  it('only a proposed fact is waiting for a person', () => {
    assert.equal(isWaiting('proposed'), true)
    for (const status of ['applied', 'dismissed', 'superseded', '']) assert.equal(isWaiting(status), false, status)
  })
})

describe('the field and the kind of record', () => {
  it('uses the server\'s label, else makes the key readable', () => {
    assert.equal(fieldLabel({ field: 'email', field_label: 'Email address' }), 'Email address')
    assert.equal(fieldLabel({ field: 'linkedin_url' }), 'Linkedin url')
    assert.equal(fieldLabel({ field: 'x_url', field_label: '   ' }), 'X url')
    assert.equal(fieldLabel({ field: '' }), 'Field')
  })

  it('names the three kinds, and a kind it does not know by its own name', () => {
    assert.equal(entityLabel('contact'), 'Contact')
    assert.equal(entityLabel('organization', true), 'Organisations')
    assert.equal(entityLabel('lead', true), 'Leads')
    assert.equal(entityLabel('ticket_note'), 'Ticket note')
    assert.equal(entityLabel(''), 'Record')
  })

  it('opens a record through the person\'s own menu, and nothing for an id that is not a positive whole number or a kind with no page', () => {
    const resolve = (link: string) => `/m${link}`
    assert.equal(entityPath('contact', 31, resolve), '/m/module/crm/marketing/contacts/31')
    assert.equal(entityPath('organization', 135, resolve), '/m/module/crm/marketing/organizations/135')
    assert.equal(entityPath('lead', 7, resolve), '/m/module/crm/marketing/leads/7')
    assert.equal(entityPath('contact', 0, resolve), null)
    assert.equal(entityPath('contact', 1.5, resolve), null)
    assert.equal(entityPath('vendor', 3, resolve), null)
  })
})

describe('a value that is a web address', () => {
  it('is a link only for an address field AND an http or https value', () => {
    assert.equal(valueLink('website', 'https://hillcrest.example.edu'), 'https://hillcrest.example.edu/')
    assert.equal(valueLink('linkedin_url', 'http://www.linkedin.com/in/asha-menon'), 'http://www.linkedin.com/in/asha-menon')
    assert.equal(valueLink('website', 'javascript:alert(1)'), null)
    assert.equal(valueLink('website', 'data:text/html,<b>x</b>'), null)
    assert.equal(valueLink('website', 'ftp://files.example.org'), null)
    assert.equal(valueLink('website', 'not a url'), null)
  })

  it('is never a link for a field that is not an address (an email stays text)', () => {
    assert.equal(valueLink('email', 'https://example.com'), null)
    assert.equal(valueLink('title', 'https://example.com'), null)
  })
})

describe('what the record holds', () => {
  it('shows the record\'s value next to a suggestion only when there is one, and says it will not be replaced', () => {
    assert.match(recordLine(fact({ record_value: '+91 11111 22222' }))!, /The record holds “\+91 11111 22222”\. Accepting keeps this as a fact and does not replace it\./)
    assert.equal(recordLine(fact({ record_value: null })), null)
    assert.equal(recordLine(fact({ record_value: '   ' })), null, 'a blank column says nothing: the server\'s column_written is the only truth about a write')
  })

  it('says the record already holds the same value (compared without capitals or edge spaces)', () => {
    assert.equal(recordLine(fact({ value: 'Asha.Menon@Hillcrest.example.edu', record_value: ' asha.menon@hillcrest.example.edu ' })), 'The record already holds this value.')
  })

  it('says after accepting whether the record was written, from column_written, not from the value', () => {
    assert.equal(recordLine(appliedFact({ column_written: true })), 'Written to the record.')
    assert.equal(recordLine(appliedFact({ column_written: false, record_value: null })), 'Kept as a fact. The record was not changed.')
    assert.equal(recordLine(appliedFact({ column_written: false, record_value: 'Head' })), 'The record already held “Head”, so this was kept as a fact and the record was not changed.')
    assert.equal(recordLine(appliedFact({ column_written: undefined })), null, 'a server that does not say gets no claim')
  })

  it('says nothing about a dismissed or replaced fact', () => {
    assert.equal(recordLine(dismissedFact({ record_value: 'x' })), null)
    assert.equal(recordLine(fact({ status: 'superseded', record_value: 'x' })), null)
  })
})

describe('the decision and the origin lines', () => {
  it('says who decided and when, with the reason a person gave; nothing for a fact still waiting', () => {
    assert.equal(decisionLine(fact()), null)
    assert.match(decisionLine(appliedFact({ decided_at: '2026-11-03T15:22:00+00:00' }))!, /^Accepted on 3 Nov 2026/)
    const dismissed = decisionLine(dismissedFact())!
    assert.match(dismissed, /^Dismissed on 3 Nov 2026/)
    assert.match(dismissed, /Reason given: That is the school office, not her\.$/)
    assert.equal(decisionLine(appliedFact({ decided_at: null })), 'Accepted')
  })

  it('says only what is known about where a suggestion came from', () => {
    assert.match(originLine(fact())!, /^Suggested by the Organisation agent · method: web lookup · found 3 Nov 2026/)
    assert.equal(originLine({ proposed_by: null, method: null, created_at: null }), null)
    assert.equal(originLine({ proposed_by: 'import', method: null, created_at: null }), 'Suggested by an import')
  })

  it('says who suggested it in words, not as a stored key (a user key carries an id, not a name)', () => {
    assert.equal(proposerText('agent:organisation'), 'the Organisation agent')
    assert.equal(proposerText('agent:contact_research'), 'the Contact research agent')
    assert.equal(proposerText('agent'), 'an agent')
    assert.equal(proposerText('user:12'), 'a team member')
    assert.equal(proposerText('import'), 'an import')
    assert.equal(proposerText('some-new-source'), 'some-new-source')
    assert.equal(proposerText('  '), null)
    assert.equal(proposerText(null), null)
  })
})

describe('evidence', () => {
  it('names a piece of evidence as a sentence with a capital, or by its kind when the label is blank', () => {
    assert.equal(evidenceLabel({ kind: 'profile.email-match', label: 'their email address is on the profile' }), 'Their email address is on the profile')
    assert.equal(evidenceLabel({ kind: 'profile.email-match', label: '  ' }), 'Profile email match')
    assert.equal(evidenceLabel({ kind: '', label: '' }), 'Evidence')
  })

  it('says how much a piece counts, a contradiction counts against it and a weight of 0 adds nothing', () => {
    assert.equal(strengthText({ kind: 'profile.email-match', weight: 0.95 }), 'Strength 95%')
    assert.equal(strengthText({ kind: 'x', weight: 0.355 }), 'Strength 36%')
    assert.equal(strengthText({ kind: 'contradiction', weight: 0 }), 'Counts against it')
    assert.equal(strengthText({ kind: 'x', weight: 0 }), 'Adds nothing to the score')
    assert.equal(strengthText({ kind: 'x', weight: Number.NaN }), 'Adds nothing to the score')
    assert.equal(strengthText({ kind: 'x', weight: 7 }), 'Strength 100%', 'never more than 100')
  })

  it('keeps a quote as trimmed text and cuts a very long one, saying so', () => {
    assert.equal(quoteText('  Principal: Asha  '), 'Principal: Asha')
    assert.equal(quoteText('   '), null)
    assert.equal(quoteText(null), null)
    const long = quoteText('a'.repeat(MAX_QUOTE + 50))!
    assert.equal(long.length, MAX_QUOTE + 1)
    assert.ok(long.endsWith('…'))
    assert.equal(quoteText('b'.repeat(MAX_QUOTE))!.length, MAX_QUOTE, 'exactly at the limit is not cut')
  })

  it('makes an http or https address a web link shown as host and path, so a person sees where it goes', () => {
    assert.deepEqual(sourceView('https://www.hillcrest.example.edu/team/'), { kind: 'web', href: 'https://www.hillcrest.example.edu/team/', text: 'www.hillcrest.example.edu/team' })
    assert.deepEqual(sourceView('http://example.org'), { kind: 'web', href: 'http://example.org/', text: 'example.org' })
    assert.equal((sourceView('https://example.org/' + 'p'.repeat(200)) as { text: string }).text.length, 81)
  })

  it('makes a path inside this application an internal link', () => {
    assert.deepEqual(sourceView('/module/crm/marketing/contacts/31'), { kind: 'internal', href: '/module/crm/marketing/contacts/31', text: '/module/crm/marketing/contacts/31' })
  })

  it('never makes anything else a link: a script address, a protocol-relative address, a data address and a file are shown as plain text', () => {
    for (const bad of ['javascript:alert(1)', '//evil.example/x', '\\\\evil\\x', 'data:text/html;base64,AAAA', 'file:///etc/passwd', 'vbscript:x', 'mailto:a@b.example']) {
      const view = sourceView(bad)
      assert.ok(view && view.kind === 'text', `${bad} is text`)
    }
  })

  it('has no source view when there is no address', () => {
    assert.equal(sourceView(null), null)
    assert.equal(sourceView(undefined), null)
    assert.equal(sourceView('   '), null)
  })
})

describe('grouping a record\'s facts', () => {
  it('puts what waits first, then accepted, dismissed and replaced, and leaves an empty group out', () => {
    const groups = groupFacts([dismissedFact({ id: 9 }), fact({ id: 1 }), appliedFact({ id: 4 }), phoneFact({ id: 2 }), fact({ id: 8, status: 'superseded' })])
    assert.deepEqual(groups.map((g) => [g.key, g.facts.map((f) => f.id)]), [['proposed', [1, 2]], ['applied', [4]], ['dismissed', [9]], ['superseded', [8]]])
    assert.deepEqual(groupFacts([appliedFact()]).map((g) => g.key), ['applied'])
    assert.deepEqual(groupFacts([]), [])
  })

  it('keeps a fact whose status it does not know in "Other" and never drops it', () => {
    const groups = groupFacts([fact({ id: 1 }), fact({ id: 2, status: 'frozen' as never })])
    assert.deepEqual(groups.map((g) => [g.key, g.title, g.facts.map((f) => f.id)]), [['proposed', 'Waiting for you', [1]], ['other', 'Other', [2]]])
  })

  it('says when the server cut a record\'s list short, and nothing when every fact is shown (a replaced fact is not counted by the server)', () => {
    assert.equal(cappedText({ proposed: 2, applied: 1, dismissed: 1 }, [fact(), phoneFact(), appliedFact()]), 'Showing the 3 newest of 4 facts.')
    assert.equal(cappedText({ proposed: 1, applied: 1, dismissed: 0 }, [fact(), appliedFact(), fact({ id: 9, status: 'superseded' })]), null)
    assert.equal(cappedText({ proposed: 0, applied: 0, dismissed: 0 }, []), null)
  })

  it('counts in words, and says so when there is nothing', () => {
    assert.equal(countsText({ proposed: 2, applied: 1, dismissed: 1 }), '2 waiting, 1 accepted, 1 dismissed')
    assert.equal(countsText({ proposed: 0, applied: 3, dismissed: 0 }), '3 accepted')
    assert.equal(countsText({ proposed: 0, applied: 0, dismissed: 0 }), 'No facts yet')
  })
})

describe('the suggestions queue', () => {
  it('asks only for what is waiting, a page at a time, with the kind only when one was chosen', () => {
    assert.deepEqual(queueParams('', 1), { status: 'proposed', page: 1, per_page: 25 })
    assert.deepEqual(queueParams('organization', 3), { status: 'proposed', page: 3, per_page: 25, type: 'organization' })
  })

  it('counts pages and says which rows are shown', () => {
    assert.equal(lastPage({ per_page: 25, total: 51 }), 3)
    assert.equal(lastPage({ per_page: 25, total: 0 }), 1)
    assert.equal(lastPage(null), 1)
    assert.equal(lastPage({ per_page: 0, total: 5 }), 1, 'a page size of 0 cannot divide')
    assert.equal(rangeText({ page: 2, per_page: 25, total: 61 }, 25), 'Showing 26–50 of 61')
    assert.equal(rangeText({ page: 1, per_page: 25, total: 0 }, 0), null)
    assert.equal(rangeText(null, 3), null)
  })
})

describe('what a decision says', () => {
  it('says after accepting whether the record itself was changed', () => {
    assert.equal(acceptNotice({ field: 'email', field_label: 'Email address', column_written: true, record_value: 'a@b.example' }), 'Accepted. The email address was written to the record.')
    assert.equal(acceptNotice({ field: 'x_url', column_written: false, record_value: null }), 'Accepted and kept as a fact. The record was not changed.')
    assert.equal(acceptNotice({ field: 'phone', column_written: false, record_value: '+91 11111' }), 'Accepted and kept as a fact. The record was not changed because it already holds “+91 11111”.')
    assert.equal(acceptNotice({ field: 'phone', record_value: null }), 'Accepted.')
  })

  it('says a record was written only for an accepted fact that says so', () => {
    assert.equal(wroteRecord({ status: 'applied', column_written: true }), true)
    assert.equal(wroteRecord({ status: 'applied', column_written: false }), false)
    assert.equal(wroteRecord({ status: 'proposed', column_written: true }), false)
    assert.equal(wroteRecord({ status: 'applied', column_written: undefined }), false)
  })

  it('patches a contact only for an accepted contact fact that wrote a field the contact page shows', () => {
    assert.deepEqual(contactPatch(appliedFact({ field: 'email', value: 'a@b.example' })), { email: 'a@b.example' })
    assert.deepEqual(contactPatch(appliedFact({ field: 'secondary_email', value: 'c@d.example' })), { secondaryEmail: 'c@d.example' })
    assert.deepEqual(contactPatch(appliedFact({ field: 'title', value: 'Principal' })), { title: 'Principal' })
    assert.equal(contactPatch(appliedFact({ field: 'linkedin_url', value: 'https://www.linkedin.com/in/x' })), null, 'the contact page has no such field')
    assert.equal(contactPatch(appliedFact({ column_written: false })), null, 'a fact kept in the ledger changed nothing')
    assert.equal(contactPatch(websiteFact({ status: 'applied', column_written: true })), null, 'an organisation fact is not a contact\'s')
    assert.equal(contactPatch(fact()), null, 'a fact still waiting changed nothing')
  })
})

describe('failures', () => {
  it('says a 403 in words (the person may read, not decide)', () => {
    assert.match(failureText(new ApiError('This action is unauthorized.', 403), 'x'), /needs the edit right/)
    assert.equal(isNoRight(new ApiError('no', 403)), true)
    assert.equal(isNoRight(new ApiError('no', 404)), false)
    assert.equal(isNoRight(new TypeError('Failed to fetch')), false)
  })

  it('says a 404 means the suggestion (or its record) is gone', () => {
    assert.match(failureText(new ApiError('Not found.', 404), 'x'), /can no longer be found/)
  })

  it('says a 409 not_pending in words, with what the fact became, and entity_gone as a removed record', () => {
    const decided = new FactsApiError('Already decided.', 409, undefined, undefined, 'not_pending', dismissedFact())
    assert.equal(failureText(decided, 'x'), 'Someone had already decided this: it is now dismissed. Nothing was changed.')
    const accepted = new FactsApiError('Already decided.', 409, undefined, undefined, 'not_pending', appliedFact())
    assert.equal(failureText(accepted, 'x'), 'Someone had already decided this: it is now accepted. Nothing was changed.')
    const bare = new FactsApiError('Already decided.', 409, undefined, undefined, 'not_pending', null)
    assert.equal(failureText(bare, 'x'), 'Someone had already decided this. Nothing was changed.')
    const gone = new FactsApiError('Gone.', 409, undefined, undefined, 'entity_gone', null)
    assert.equal(failureText(gone, 'x'), 'The record this belongs to has been removed, so nothing was changed.')
  })

  it('uses the server\'s own sentence for another status, a plain one for a lost connection, the fallback otherwise', () => {
    assert.equal(failureText(new ApiError('A reason can have at most 500 characters.', 422), 'x'), 'A reason can have at most 500 characters.')
    assert.equal(failureText(new ApiError('', 500), 'x'), 'The server answered 500.')
    assert.match(failureText(new TypeError('Failed to fetch'), 'x'), /did not reach the server/)
    assert.equal(failureText(new Error(''), 'It failed.'), 'It failed.')
  })

  it('classifies a failed read: forbidden and not found cannot be retried, 503 is not set up, the rest is an error', () => {
    assert.deepEqual(loadFailure(new ApiError('no', 403), 'x', 'suggestions'), { kind: 'forbidden', message: 'You do not have access to suggestions here.' })
    assert.equal(loadFailure(new ApiError('no', 404), 'x').kind, 'notFound')
    assert.deepEqual(loadFailure(new ApiError('no', 503), 'x', 'consent information'), { kind: 'unavailable', message: 'Consent information are not set up on this server yet.' })
    assert.deepEqual(loadFailure(new ApiError('The server is busy.', 500), 'x'), { kind: 'error', message: 'The server is busy.' })
  })
})

describe('consent', () => {
  it('lists email, SMS and WhatsApp in that order, each Allowed or Not allowed in a word', () => {
    const rows = consentRows(consentData().data)
    assert.deepEqual(rows.map((r) => [r.key, r.label, r.word]), [['email', 'Email', 'Allowed'], ['sms', 'SMS', 'Not allowed'], ['whatsapp', 'WhatsApp', 'Not allowed']])
  })

  it('says why: the server\'s sentence first, then the code in words, then an honest "no reason was given"; nothing when allowed and nothing blocks it', () => {
    assert.equal(consentReason({ allowed: false, reason: 'They opted out.', code: 'opted_out' }), 'They opted out.')
    assert.equal(consentReason({ allowed: false, reason: '  ', code: 'no_address' }), 'There is no address for this channel.')
    assert.equal(consentReason({ allowed: false, reason: null, code: 'brand_new_code' }), 'No reason was given.')
    assert.equal(consentReason({ allowed: false, reason: null }), 'No reason was given.')
    assert.equal(consentReason({ allowed: true, reason: null, code: null }), null)
  })

  it('leaves out a channel the server did not report or reported without a yes or no, and never assumes it is allowed', () => {
    const rows = consentRows({ channels: { email: { allowed: true, reason: null }, sms: { allowed: 'maybe' as never, reason: null } } })
    assert.deepEqual(rows.map((r) => r.key), ['email'])
    assert.deepEqual(consentRows(null), [])
    assert.deepEqual(consentRows({ channels: {} }), [])
  })

  it('sums up in one line', () => {
    assert.equal(consentSummary(consentRows(consentData().data)), 'Email allowed · SMS not allowed · WhatsApp not allowed')
  })

  it('says where an answer was read from in words, with the date when there is one', () => {
    assert.match(consentSourceText({ source: 'suppressed_at', value: 'bounced', at: '2026-11-03T15:22:57+00:00' }), /^Suppressed on the record: bounced \(3 Nov 2026/)
    assert.equal(consentSourceText({ source: 'email_opt_out', value: '1', at: null }), 'Email opt-out flag: opted out', 'the stored 1 is said in words')
    assert.equal(consentSourceText({ source: 'consent_status', value: 'opted_out', at: null }), 'Consent status on the record: opted out')
    assert.equal(consentSourceText({ source: 'gtm_contacts', value: 'unsubscribed', at: null }), 'Outreach contact status: unsubscribed')
    assert.equal(consentSourceText({ source: 'gtm_suppressions', value: null, at: null }), 'Suppression list: —')
    assert.equal(consentSourceText({ source: 'some_new_source', value: 'x', at: null }), 'Some new source: x')
  })
})
