import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listQueryString, patchListQuery, readListQuery, writeListQuery } from '../../components/shared/scaffolds/list-query'
import { ApiError } from '../../services/core'
import { OrgAccountsApiError } from '../../services/org-accounts/errors'
import {
  availableActions, basisText, formatAmount, linkedRecords, lifecycleLabel, ONLY_RECORD_TEXT, openSignalsText, placeConflictText, scoreText, shownText,
  sourceBadges, sourceTypeLabel, whyNowFacts,
} from './display'
import { EDIT_FIELDS, formFromIdentity, isDirty, ownerChoices, patchBody } from './edit-model'
import {
  classifyCreateFailure, classifyLoadFailure, classifySaveFailure, FORBIDDEN_PAGE_TEXT, linkFailureText, NETWORK_TEXT, NO_CREATE_RIGHT_TEXT, NO_LINK_RIGHT_TEXT, NOT_SET_UP_TEXT,
} from './failure'
import { meta, orgItem, org360, org360CrmOnly, org360WithCrm, placeConflictSuggestion, sameSourceSuggestion, suggestion, summary } from './fixtures'
import { ACCESS_LINKS, buildLinks, DEFAULT_LINKS, recordHref, signalReviewHref } from './links'
import { confidenceText, classificationText, consentText, openDealLines, relationshipText } from './old-sections'
import {
  clearFiltersPatch, DISCOVERED_QUERY, discoveredParams, discoveredState, isNarrowed, rangeText, SCOPE_IDS, scopeCounts, scopeTabs,
} from './scope-model'
import { confirmCopy, decidedNotice, linkRequest, removeSuggestion } from './suggestions'

const read = (search: string) => readListQuery(new URLSearchParams(search), DISCOVERED_QUERY)

describe('the scope switch', () => {
  it('has three scopes and opens on the CRM list, with a clean address', () => {
    assert.deepEqual([...SCOPE_IDS], ['crm', 'discovered', 'duplicates'])
    assert.equal(SCOPE_IDS[0], 'crm', 'the first scope is the default: today\'s list')
  })

  it('takes the counts from the org-accounts summary: discovered = organisations with no CRM organisation', () => {
    assert.deepEqual(scopeCounts(summary({ total: 9, with_crm: 4, suggestions: 3 })), { discovered: 5, duplicates: 3 })
    assert.deepEqual(scopeCounts(summary({ total: 3, with_crm: 3, suggestions: 0 })), { discovered: 0, duplicates: 0 }, 'zero is a real count')
  })

  it('never guesses a count before the summary is there, and prefers the live number of duplicates', () => {
    assert.deepEqual(scopeCounts(null), { discovered: null, duplicates: null })
    assert.deepEqual(scopeCounts(undefined, 2), { discovered: null, duplicates: 2 })
    assert.equal(scopeCounts(summary({ suggestions: 4 }), 1).duplicates, 1, 'it falls as pairs are decided')
    assert.equal(scopeCounts(summary({ suggestions: 4 }), 0).duplicates, 0)
    assert.equal(scopeCounts(summary({ total: 1, with_crm: 5 })).discovered, 0, 'never negative')
  })

  it('names the tabs: the CRM scope carries no count of its own', () => {
    assert.deepEqual(scopeTabs({ discovered: 5, duplicates: 3 }), [
      { id: 'crm', label: 'Organizations' }, { id: 'discovered', label: 'Discovered', count: 5 }, { id: 'duplicates', label: 'Possible duplicates', count: 3 },
    ])
    assert.equal(scopeTabs({ discovered: null, duplicates: null })[1].count, null)
  })
})

describe('the Discovered scope: its filters and its address', () => {
  it('opens on everything: no filter, page 1, and a clean address', () => {
    const query = read('')
    assert.deepEqual(query.filters, { lifecycle: 'all' })
    assert.equal(listQueryString(query, DISCOVERED_QUERY), '')
  })

  it('always asks for the organisations that have NO CRM organisation', () => {
    assert.deepEqual(discoveredParams(read('')), { has_crm: 0, page: 1, per_page: 20 })
    assert.deepEqual(discoveredParams(read('q=lake&lifecycle=target&page=3')), { has_crm: 0, page: 3, per_page: 20, q: 'lake', lifecycle: 'target' })
  })

  it('writes the filters into the address and reads them back the same, and leaves the open scope alone', () => {
    const next = patchListQuery(read(''), { q: 'kv', filters: { lifecycle: 'target' } }, DISCOVERED_QUERY)
    const search = listQueryString(next, DISCOVERED_QUERY)
    assert.equal(search, 'q=kv&lifecycle=target')
    assert.deepEqual(read(search), next)
    assert.equal(writeListQuery(new URLSearchParams('scope=discovered'), read('lifecycle=customer'), DISCOVERED_QUERY).toString(), 'scope=discovered&lifecycle=customer')
  })

  it('ignores a value the address should not carry, and goes back to page 1 when a filter changes', () => {
    const query = read('lifecycle=gone&page=zero')
    assert.deepEqual(query.filters, { lifecycle: 'all' })
    assert.equal(query.page, 1)
    assert.equal(patchListQuery(read('page=4'), { filters: { lifecycle: 'archived' } }, DISCOVERED_QUERY).page, 1)
  })

  it('knows when the list is narrowed, and clearing shows everything', () => {
    assert.equal(isNarrowed(read('')), false)
    for (const search of ['q=x', 'lifecycle=target']) assert.equal(isNarrowed(read(search)), true, search)
    assert.equal(isNarrowed(patchListQuery(read('q=x&lifecycle=target'), clearFiltersPatch(), DISCOVERED_QUERY)), false)
  })

  it('tells the states apart: a 403 and a 503 are their own, ahead of an error and of loading', () => {
    const base = { loaded: true, forbidden: false, unavailable: false, error: '', rows: 3, query: read('') }
    assert.equal(discoveredState({ ...base, loaded: false }), 'loading')
    assert.equal(discoveredState(base), 'ready')
    assert.equal(discoveredState({ ...base, error: 'x' }), 'error')
    assert.equal(discoveredState({ ...base, rows: 0 }), 'empty')
    assert.equal(discoveredState({ ...base, rows: 0, query: read('q=zzz') }), 'filtered-empty')
    assert.equal(discoveredState({ ...base, loaded: false, error: 'x', unavailable: true }), 'unavailable')
    assert.equal(discoveredState({ ...base, loaded: false, error: 'x', unavailable: true, forbidden: true }), 'forbidden')
  })

  it('says which rows are on the page', () => {
    assert.equal(rangeText({ page: 2, per_page: 20, total: 45, last_page: 3 }, 20), 'Showing 21–40 of 45')
    assert.equal(rangeText({ page: 1, per_page: 20, total: 0, last_page: 1 }, 0), null)
    assert.equal(rangeText(null, 5), null)
  })
})

describe('lifecycle, sources and links in words', () => {
  it('names each lifecycle', () => {
    assert.equal(lifecycleLabel('customer'), 'Customer')
    assert.equal(lifecycleLabel('engaged'), 'Engaged')
  })

  it('has a badge only for a source the organisation has a row in', () => {
    assert.deepEqual(sourceBadges(orgItem()).map((b) => b.key), ['crm', 'gtm', 'signals'])
    assert.deepEqual(sourceBadges(orgItem({ sources: { crm: null, gtm: null, signals: { company_id: 1, open_signals: 2, last_signal_at: null } } })).map((b) => b.key), ['signals'])
    assert.deepEqual(sourceBadges(orgItem({ sources: { crm: null, gtm: null, signals: null } })), [])
  })

  it('writes the open signals as a count, with the singular and a real zero', () => {
    assert.equal(openSignalsText(4), '4 open signals')
    assert.equal(openSignalsText(1), '1 open signal')
    assert.equal(openSignalsText(0), '0 open signals')
  })

  it('explains each link basis in words, and tells a lone record from a missing reason', () => {
    assert.equal(basisText('exact_name'), 'linked because the names are identical')
    assert.equal(basisText('exact_domain'), 'linked because the websites are the same')
    assert.equal(basisText('existing_link'), 'linked by an earlier link')
    assert.equal(basisText('manual'), 'confirmed by a person')
    // D6: a record with nothing to be linked to says so, and never "reason not recorded"; a linked record that lost its reason still admits it.
    assert.equal(basisText(null, true), ONLY_RECORD_TEXT)
    assert.equal(basisText(null), 'linked, reason not recorded')
    assert.ok(!basisText(null, true).includes('not recorded'))
  })

  it('names the kinds of source row', () => {
    assert.equal(sourceTypeLabel('crm_organization'), 'CRM organisation')
    assert.equal(sourceTypeLabel('gtm_account'), 'GTM account')
    assert.equal(sourceTypeLabel('g2g_company'), 'Signals company')
  })
})

describe('the Linked records rows', () => {
  it('has a row for each of the three sources, with the reason each is linked in words', () => {
    const rows = linkedRecords(org360WithCrm())
    assert.deepEqual(rows.map((r) => [r.key, r.found, r.name, r.basis]), [
      ['crm', true, 'Riverdale Public School', 'confirmed by a person'],
      ['gtm', true, 'Hillcrest Academy', 'linked by an earlier link'],
      ['signals', true, 'Hillcrest Academy', 'linked because the names are identical'],
    ])
    assert.equal(rows[0].detail, 'ACC-0011 · Education · Pune, Maharashtra')
    assert.equal(rows[1].detail, 'Stage: Qualified · 1 deal · Fit with the ideal customer: 82', 'the GTM stage, how many deals and the fit score the old tab showed')
    assert.equal(rows[2].detail, 'Education · Pune, Maharashtra · 3 signals')
  })

  it('says a source has no record rather than leaving a blank', () => {
    const rows = linkedRecords(org360())
    assert.deepEqual(rows.map((r) => [r.key, r.found, r.name, r.detail, r.basis]).slice(0, 1), [['crm', false, null, null, null]])
    assert.equal(rows[1].basis, 'linked because the names are identical')
    assert.equal(rows[2].basis, 'linked because the websites are the same')
  })

  it('says "only record found" for an organisation that exists in one place only', () => {
    const rows = linkedRecords(org360CrmOnly())
    assert.deepEqual(rows.map((r) => [r.key, r.found]), [['crm', true], ['gtm', false], ['signals', false]])
    assert.equal(rows[0].basis, ONLY_RECORD_TEXT)
    assert.equal(rows[1].basis, null)
  })

  it('pluralises the deals and the signals, and a real zero reads as zero', () => {
    const one = linkedRecords(org360({ gtm: { ...org360().gtm!, deals_count: 0 }, signals: { total: 1, needing_decision: 1, decided: 0, latest: [] } }))
    assert.ok(one[1].detail!.includes('0 deals'))
    assert.ok(one[2].detail!.endsWith('1 signal'))
  })
})

describe('why now', () => {
  it('states the four facts in words, and a real zero as 0', () => {
    assert.deepEqual(whyNowFacts({ open_signals: 2, next_event_date: '2026-12-01', open_deals: 1, last_activity_at: '2026-10-18T11:30:00+05:30' }).map((f) => [f.key, f.label, f.value]), [
      ['signals', 'Open signals', '2'], ['next_event', 'Next event', '1 Dec 2026'], ['deals', 'Open deals', '1'], ['last_activity', 'Last activity', '18 Oct 2026'],
    ])
    const none = whyNowFacts({ open_signals: 0, next_event_date: null, open_deals: 0, last_activity_at: null })
    assert.deepEqual(none.map((f) => f.value), ['0', 'None dated', '0', 'None yet'])
  })
})

describe('the score and the places of a possible duplicate', () => {
  it('is a share of the name words, rounded, and never past 0 to 100', () => {
    assert.equal(scoreText(0.8), '80% of the name words match')
    assert.equal(scoreText(0.667), '67% of the name words match')
    assert.equal(scoreText(1.4), '100% of the name words match')
    assert.equal(scoreText(Number.NaN), '0% of the name words match')
  })

  it('says "Different places" only for a pair whose places conflict, and names both', () => {
    assert.equal(placeConflictText(placeConflictSuggestion()), 'Different places: Mumbai, Maharashtra / Surat, Gujarat')
    assert.equal(placeConflictText(suggestion()), null, 'an ordinary pair says nothing about places')
    assert.equal(placeConflictText(placeConflictSuggestion({ left: { type: 'g2g_company', id: 1, name: 'A', place: null } })), 'Different places', 'a conflict with a missing place is still a conflict')
  })
})

describe('a list the server capped', () => {
  it('says "Showing 20 of 45" and never claims to show all', () => {
    assert.equal(shownText(20, 45), 'Showing 20 of 45')
    assert.ok(!shownText(20, 45).includes('all'))
  })

  it('says it shows all only when it does, and does not believe a total smaller than the rows in hand', () => {
    assert.equal(shownText(3, 3), 'Showing all 3')
    assert.equal(shownText(3, 1), 'Showing all 3')
  })
})

describe('which actions are offered', () => {
  it('offers nothing before the server has said what is allowed', () => {
    assert.deepEqual(availableActions(null), { edit: false, createCrm: false, confirmLinks: false })
    assert.deepEqual(availableActions(undefined), { edit: false, createCrm: false, confirmLinks: false })
  })

  it('offers each action only with its right', () => {
    assert.equal(availableActions(meta({ edit: false })).edit, false)
    assert.equal(availableActions(meta({ confirm_links: false })).confirmLinks, false)
    assert.equal(availableActions(meta({ create_crm_organization: false })).createCrm, false)
    assert.deepEqual(availableActions(meta()), { edit: true, createCrm: true, confirmLinks: true })
  })
})

describe('where the links go', () => {
  const menu = (held: string[]) => (accessLink: string) => (held.includes(accessLink) ? accessLink : '/dashboard')

  it('draws a link only for a screen the person has a menu row for', () => {
    const links = buildLinks(menu([ACCESS_LINKS.crmOrganisations, ACCESS_LINKS.gtm]))
    assert.equal(links.crmOrganisations, '/module/crm/marketing/organizations')
    assert.equal(links.gtm, '/gtm/prospecting')
    assert.equal(links.signals, null)
    assert.equal(links.opportunities, null)
    assert.equal(links.contacts, null)
  })

  it('finds Signal Review under the access_link its menu row really has, `/signal-review`, and under the other spelling too', () => {
    // The first version asked only for /module/crm/signal-review, which the menu never holds on the dev database (row 506 is /signal-review): no link was drawn.
    assert.equal(buildLinks(menu(['/signal-review'])).signalReview, '/signal-review')
    assert.equal(buildLinks(menu(['/module/crm/signal-review'])).signalReview, '/module/crm/signal-review')
    assert.equal(buildLinks(menu(['/signal-review', '/module/crm/signal-review'])).signalReview, '/signal-review', 'the real row wins')
    assert.equal(buildLinks(menu([])).signalReview, null)
  })

  it('opens Signal Review on one signal with every status and the title in the search, and nothing without the screen', () => {
    assert.equal(signalReviewHref(DEFAULT_LINKS, 'Tender & bids'), '/signal-review?status=all&q=Tender%20%26%20bids')
    assert.equal(signalReviewHref({ signalReview: null }, 'x'), null)
    assert.equal(recordHref('/module/crm/sales/opportunities', 72), '/module/crm/sales/opportunities/72')
    assert.equal(recordHref(null, 72), null)
  })
})

describe('the sections only the old Account 360 had', () => {
  it('keeps the open opportunities and every GTM deal, and drops the closed CRM ones', () => {
    const names = openDealLines(org360WithCrm().deals).map((d) => d.name)
    assert.deepEqual(names, ['Riverdale ERP rollout', 'Riverdale pilot'])
    assert.deepEqual(openDealLines([{ source: 'crm', id: 1, name: 'No stage', stage: null, amount: null, currency: null, closing_date: null }]).map((d) => d.name), ['No stage'])
  })

  it('writes a confidence as a percentage, and nothing for none', () => {
    assert.equal(confidenceText(0.7), '70%')
    assert.equal(confidenceText(0), '0%')
    assert.equal(confidenceText(1.7), '100%')
    assert.equal(confidenceText(null), null)
  })

  it('reads a relationship from this organisation and towards it', () => {
    const r = { fromType: 'organization', fromId: '11', toType: 'organization', toId: '999', relationshipType: 'subsidiary_of' }
    assert.equal(relationshipText(r, '11'), 'subsidiary of → organization #999')
    assert.equal(relationshipText(r, '999'), 'subsidiary of ← organization #11')
  })

  it('writes consent and classification in words', () => {
    assert.equal(consentText('opted_in'), 'Consent: opted in')
    assert.equal(consentText(null), null, 'a GTM contact has none recorded and says nothing')
    assert.equal(classificationText('buying_signal'), 'buying signal')
    assert.equal(classificationText(null), 'unclassified')
  })
})

describe('words and numbers', () => {
  it('shows a missing amount as a dash and a real zero as zero', () => {
    assert.equal(formatAmount(null, 'INR'), '—')
    assert.equal(formatAmount(0, 'INR'), 'INR 0.00')
    assert.equal(formatAmount(150000, 'INR'), 'INR 150000.00')
    assert.equal(formatAmount(10, null), '10.00')
  })
})

describe('what a failure means', () => {
  it('reads a 403 as no access and a 503 as "not set up", neither as an error to retry', () => {
    assert.deepEqual(classifyLoadFailure(new ApiError('Forbidden', 403), 'x'), { kind: 'forbidden', message: FORBIDDEN_PAGE_TEXT })
    assert.equal(classifyLoadFailure(new ApiError('Not here', 404), 'x').kind, 'notFound')
    assert.deepEqual(classifyLoadFailure(new ApiError('Organisation 360 is not set up on this server yet.', 503), 'x'), { kind: 'unavailable', message: NOT_SET_UP_TEXT })
    assert.deepEqual(classifyLoadFailure(new ApiError('Boom', 500), 'x'), { kind: 'error', message: 'Boom' })
    assert.deepEqual(classifyLoadFailure(new TypeError('Failed to fetch'), 'x'), { kind: 'error', message: NETWORK_TEXT })
  })

  it('gives each refused decision on a pair its own sentence', () => {
    assert.equal(linkFailureText(new ApiError('nope', 403)), NO_LINK_RIGHT_TEXT)
    assert.equal(linkFailureText(new ApiError('One of these is already linked to another organisation.', 409)), 'One of these is already linked to another organisation.')
    assert.equal(linkFailureText(new ApiError('Gone.', 404)), 'Gone.')
    assert.equal(linkFailureText(new ApiError('Invalid.', 422, { left_id: ['Unknown row.'], right_id: ['Unknown row.', 'Not yours.'] })), 'Unknown row. Not yours.')
    assert.equal(linkFailureText(new ApiError('Invalid.', 422)), 'Invalid.')
  })

  it('asks about restoring only for the deleted-name 409', () => {
    const conflict = new OrgAccountsApiError('A deleted organisation has this name.', 409, undefined, undefined, 'deleted_name_exists', 41)
    assert.deepEqual(classifyCreateFailure(conflict), { kind: 'deleted_name_exists' })
    assert.equal(classifyCreateFailure(new OrgAccountsApiError('Clash.', 409, undefined, undefined, 'other', null)).kind, 'failed')
    assert.equal(classifyCreateFailure(new ApiError('x', 409)).kind, 'failed')
    assert.deepEqual(classifyCreateFailure(new ApiError('x', 403)), { kind: 'forbidden', message: NO_CREATE_RIGHT_TEXT })
    assert.deepEqual(classifyCreateFailure(new ApiError('Invalid.', 422, { name: ['Name is required.'] })), { kind: 'failed', message: 'Name is required.' })
  })

  it('places a 422 beside its field and the rest at the top of the form', () => {
    const split = classifySaveFailure(new ApiError('Invalid.', 422, { owner_user_id: ['Choose a person of this organisation.'], other: ['Something else.'] }), EDIT_FIELDS)
    assert.deepEqual(split.byField, { owner_user_id: ['Choose a person of this organisation.'] })
    assert.deepEqual(split.unplaced, ['Something else.'])
    assert.deepEqual(classifySaveFailure(new ApiError('Invalid.', 422), EDIT_FIELDS).unplaced, ['Invalid.'])
    assert.equal(classifySaveFailure(new ApiError('x', 403), EDIT_FIELDS).unplaced[0], 'You are not allowed to change organisations.')
  })
})

describe('the edit form', () => {
  const identity = { lifecycle: 'target' as const, owner_user_id: 5 as number | null }

  it('starts from the identity and is clean until something changes', () => {
    const initial = formFromIdentity(identity)
    assert.deepEqual(initial, { lifecycle: 'target', owner: '5' })
    assert.equal(isDirty(initial, { ...initial }), false)
    assert.equal(isDirty(initial, { ...initial, lifecycle: 'customer' }), true)
  })

  it('sends only what changed, and "nobody" as null', () => {
    const initial = formFromIdentity(identity)
    assert.deepEqual(patchBody(initial, { ...initial, lifecycle: 'customer' }), { lifecycle: 'customer' })
    assert.deepEqual(patchBody(initial, { ...initial, owner: '9' }), { owner_user_id: 9 })
    assert.deepEqual(patchBody(initial, { ...initial, owner: '' }), { owner_user_id: null })
    assert.deepEqual(patchBody(initial, { ...initial }), {})
  })

  it('has nobody as an owner when there is none, and keeps the current owner among the choices', () => {
    assert.equal(formFromIdentity({ lifecycle: 'target', owner_user_id: null }).owner, '')
    assert.deepEqual(ownerChoices([{ id: '9', name: 'Bela' }], { owner_user_id: 5, owner_name: 'Anil Shah' }), [{ id: '5', name: 'Anil Shah' }, { id: '9', name: 'Bela' }])
    assert.deepEqual(ownerChoices([{ id: '5', name: 'Anil Shah' }], { owner_user_id: 5, owner_name: 'Anil Shah' }), [{ id: '5', name: 'Anil Shah' }])
    assert.deepEqual(ownerChoices([], { owner_user_id: 7, owner_name: null }), [{ id: '7', name: 'User #7' }])
  })
})

describe('deciding on a possible duplicate', () => {
  const pair = suggestion()

  it('builds the request from the pair and the chosen action only', () => {
    assert.deepEqual(linkRequest(pair, 'confirm'), { left_type: 'crm_organization', left_id: 11, right_type: 'g2g_company', right_id: 32, action: 'confirm' })
    assert.equal(linkRequest(pair, 'reject').action, 'reject')
  })

  it('removes only the decided pair', () => {
    const other = suggestion({ key: 'other' })
    assert.deepEqual(removeSuggestion([pair, other], pair.key), [other])
    assert.deepEqual(removeSuggestion([pair], 'missing'), [pair])
  })

  it('asks a question that says what will happen, and neither answer looks destructive', () => {
    const confirm = confirmCopy(pair, 'confirm')
    assert.equal(confirm.confirmLabel, 'Confirm: same organisation')
    assert.equal(confirm.description, 'These two will be shown as one organisation. Nothing in either record is changed.')
    assert.ok(confirm.title.includes('Riverdale Public School') && confirm.title.includes('Riverdale School Society'))
    const reject = confirmCopy(pair, 'reject')
    assert.equal(reject.confirmLabel, 'Not the same')
    assert.ok(String(reject.description).includes('will not be suggested'))
    assert.equal(confirm.tone, 'default')
    assert.equal(reject.tone, 'default')
    assert.ok(decidedNotice(pair, 'confirm').includes('one organisation'))
    assert.ok(decidedNotice(pair, 'reject').includes('not be suggested'))
  })

  it('D2: warns in the confirm question when the two are in different places, and only then', () => {
    const conflict = confirmCopy(placeConflictSuggestion(), 'confirm')
    assert.ok(String(conflict.description).startsWith('Different places: Mumbai, Maharashtra / Surat, Gujarat.'))
    assert.ok(String(conflict.description).includes('usually two organisations'))
    assert.ok(!String(confirmCopy(pair, 'confirm').description).includes('Different places'))
    assert.ok(!String(confirmCopy(placeConflictSuggestion(), 'reject').description).includes('Different places'), 'turning a pair down needs no warning')
  })

  it('D3: a pair of one source cannot be confirmed (the fixture says so)', () => {
    assert.equal(sameSourceSuggestion().confirmable, false)
    assert.equal(suggestion().confirmable, true)
  })
})
