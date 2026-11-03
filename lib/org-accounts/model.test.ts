import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listQueryString, patchListQuery, readListQuery, writeListQuery } from '../../components/shared/scaffolds/list-query'
import { ApiError } from '../../services/core'
import { OrgAccountsApiError } from '../../services/org-accounts/errors'
import {
  activityKindLabel, availableActions, basisText, formatAmount, headerSources, lifecycleLabel, lifecycleTone, openSignalsText, scoreText, shownText,
  sourceBadges, sourceTypeLabel,
} from './display'
import { EDIT_FIELDS, formFromIdentity, isDirty, ownerChoices, patchBody } from './edit-model'
import {
  classifyCreateFailure, classifyLoadFailure, classifySaveFailure, FORBIDDEN_PAGE_TEXT, linkFailureText, NETWORK_TEXT, NO_CREATE_RIGHT_TEXT, NO_LINK_RIGHT_TEXT,
} from './failure'
import { meta, orgItem, org360, org360WithCrm, suggestion, summary } from './fixtures'
import {
  clearFiltersPatch, isNarrowed, listScreenState, ORG_LIST_QUERY, queryToParams, rangeText, summaryTiles,
} from './list-model'
import { confirmCopy, decidedNotice, linkRequest, removeSuggestion } from './suggestions'

const read = (search: string) => readListQuery(new URLSearchParams(search), ORG_LIST_QUERY)

describe('the filters and the address', () => {
  it('opens on everything: no filter, page 1, and a clean address', () => {
    const query = read('')
    assert.deepEqual(query.filters, { lifecycle: 'all', crm: 'any', gtm: 'any', signals: 'any' })
    assert.equal(listQueryString(query, ORG_LIST_QUERY), '')
    assert.deepEqual(queryToParams(query), { page: 1, per_page: 20 })
  })

  it('writes every filter into the address and reads it back the same', () => {
    const query = read('')
    const next = patchListQuery(query, { q: 'kv', filters: { lifecycle: 'target', crm: 'no', gtm: 'yes', signals: 'yes' } }, ORG_LIST_QUERY)
    const search = listQueryString(next, ORG_LIST_QUERY)
    assert.equal(search, 'q=kv&lifecycle=target&crm=no&gtm=yes&signals=yes')
    assert.deepEqual(read(search), next)
  })

  it('leaves the open tab alone when it writes the filters', () => {
    const next = writeListQuery(new URLSearchParams('tab=duplicates'), read('lifecycle=customer'), ORG_LIST_QUERY)
    assert.equal(next.toString(), 'tab=duplicates&lifecycle=customer')
  })

  it('turns a pasted link into the request: Yes is 1, No is 0, Any and All send nothing', () => {
    assert.deepEqual(queryToParams(read('q=lake&lifecycle=engaged&crm=yes&gtm=no&signals=any&page=3')), {
      page: 3, per_page: 20, q: 'lake', lifecycle: 'engaged', has_crm: 1, has_gtm: 0,
    })
  })

  it('ignores a value the address should not carry', () => {
    const query = read('lifecycle=gone&crm=maybe&page=zero')
    assert.deepEqual(query.filters, { lifecycle: 'all', crm: 'any', gtm: 'any', signals: 'any' })
    assert.equal(query.page, 1)
  })

  it('goes back to page 1 when a filter changes', () => {
    const next = patchListQuery(read('page=4'), { filters: { lifecycle: 'archived' } }, ORG_LIST_QUERY)
    assert.equal(next.page, 1)
  })

  it('knows when the list is narrowed, and clearing shows everything', () => {
    assert.equal(isNarrowed(read('')), false)
    for (const search of ['q=x', 'lifecycle=target', 'crm=no', 'gtm=yes', 'signals=no']) assert.equal(isNarrowed(read(search)), true, search)
    const cleared = patchListQuery(read('q=x&lifecycle=target&crm=no'), clearFiltersPatch(), ORG_LIST_QUERY)
    assert.equal(isNarrowed(cleared), false)
  })
})

describe('the six states of the list', () => {
  const base = { loaded: true, forbidden: false, error: '', rows: 3, summaryTotal: 3, query: read('') }

  it('tells them apart', () => {
    assert.equal(listScreenState({ ...base, loaded: false }), 'loading')
    assert.equal(listScreenState(base), 'ready')
    assert.equal(listScreenState({ ...base, error: 'x' }), 'error')
    assert.equal(listScreenState({ ...base, rows: 0, summaryTotal: 0 }), 'empty')
    assert.equal(listScreenState({ ...base, rows: 0, summaryTotal: 5, query: read('q=zzz') }), 'filtered-empty')
    assert.equal(listScreenState({ ...base, rows: 0, summaryTotal: 0, query: read('q=zzz') }), 'filtered-empty')
  })

  it('treats a 403 as its own state, ahead of an error and of loading', () => {
    assert.equal(listScreenState({ ...base, loaded: false, forbidden: true, error: 'x' }), 'forbidden')
  })
})

describe('the summary and the range', () => {
  it('shows the six counts, with the live number of possible duplicates when it is known', () => {
    const tiles = summaryTiles(summary({ total: 9, suggestions: 4 }))
    assert.deepEqual(tiles.map((t) => [t.label, t.value]), [['organisations', 9], ['discovered', 2], ['target', 1], ['engaged', 1], ['customers', 1], ['possible duplicates', 4]])
    assert.equal(summaryTiles(summary({ suggestions: 4 }), 1).at(-1)?.value, 1)
    assert.equal(summaryTiles(summary({ suggestions: 4 }), 0).at(-1)?.value, 0, 'zero is a real count')
  })

  it('says which rows are on the page', () => {
    assert.equal(rangeText({ page: 2, per_page: 20, total: 45, last_page: 3 }, 20), 'Showing 21–40 of 45')
    assert.equal(rangeText({ page: 1, per_page: 20, total: 0, last_page: 1 }, 0), null)
    assert.equal(rangeText(null, 5), null)
  })
})

describe('lifecycle, sources and links in words', () => {
  it('names each lifecycle and gives it a tone, and archived looks inactive', () => {
    assert.equal(lifecycleLabel('customer'), 'Customer')
    assert.equal(lifecycleTone('customer'), 'success')
    assert.equal(lifecycleTone('archived'), 'inactive')
  })

  it('has a badge only for a source the organisation has a row in', () => {
    assert.deepEqual(sourceBadges(orgItem()).map((b) => b.key), ['crm', 'gtm', 'signals'])
    assert.deepEqual(sourceBadges(orgItem({ sources: { crm: null, gtm: null, signals: { company_id: 1, open_signals: 2, last_signal_at: null } } })).map((b) => b.key), ['signals'])
    assert.deepEqual(sourceBadges(orgItem({ sources: { crm: { id: 1, account_no: null }, gtm: null, signals: null } })).map((b) => b.key), ['crm'])
    assert.deepEqual(sourceBadges(orgItem({ sources: { crm: null, gtm: null, signals: null } })), [])
  })

  it('writes the open signals as a count, with the singular and a real zero', () => {
    assert.equal(openSignalsText(4), '4 open signals')
    assert.equal(openSignalsText(1), '1 open signal')
    assert.equal(openSignalsText(0), '0 open signals')
    assert.equal(sourceBadges(orgItem()).find((b) => b.key === 'signals')?.detail, '3 open signals')
  })

  it('explains each link basis in words, and admits when none is recorded', () => {
    assert.equal(basisText('exact_name'), 'linked because the names are identical')
    assert.equal(basisText('exact_domain'), 'linked because the websites are the same')
    assert.equal(basisText('existing_link'), 'linked by an earlier link')
    assert.equal(basisText('manual'), 'confirmed by a person')
    assert.equal(basisText(null), 'linked, reason not recorded')
  })

  it('lists the header badges for the pointers the identity has, each with its reason', () => {
    assert.deepEqual(headerSources(org360().identity.links), [
      { key: 'gtm', label: 'GTM', basis: 'linked because the names are identical' },
      { key: 'signals', label: 'Signals', basis: 'linked because the websites are the same' },
    ])
    assert.deepEqual(headerSources(org360WithCrm().identity.links).map((s) => s.key), ['crm', 'gtm', 'signals'])
  })

  it('names the kinds of source row', () => {
    assert.equal(sourceTypeLabel('crm_organization'), 'CRM organisation')
    assert.equal(sourceTypeLabel('g2g_company'), 'Signals company')
  })
})

describe('the score of a possible duplicate', () => {
  it('is a share of the name words, rounded, and never past 0 to 100', () => {
    assert.equal(scoreText(0.8), '80% of the name words match')
    assert.equal(scoreText(0.667), '67% of the name words match')
    assert.equal(scoreText(1.4), '100% of the name words match')
    assert.equal(scoreText(Number.NaN), '0% of the name words match')
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
    assert.deepEqual(availableActions(null, org360()), { edit: false, createCrm: false, confirmLinks: false })
    assert.deepEqual(availableActions(undefined), { edit: false, createCrm: false, confirmLinks: false })
  })

  it('offers each action only with its right', () => {
    assert.equal(availableActions(meta({ edit: false }), org360()).edit, false)
    assert.equal(availableActions(meta({ confirm_links: false }), org360()).confirmLinks, false)
    assert.equal(availableActions(meta(), org360()).edit, true)
    assert.equal(availableActions(meta(), org360()).confirmLinks, true)
  })

  it('offers "Create CRM organisation" with the right, and only when there is no CRM organisation yet', () => {
    assert.equal(availableActions(meta(), org360()).createCrm, true)
    assert.equal(availableActions(meta({ create_crm_organization: false }), org360()).createCrm, false, 'no right')
    assert.equal(availableActions(meta(), org360WithCrm()).createCrm, false, 'already has one')
    assert.equal(availableActions(meta(), null).createCrm, false, 'nothing opened')
  })
})

describe('words and numbers', () => {
  it('shows a missing amount as a dash and a real zero as zero', () => {
    assert.equal(formatAmount(null, 'INR'), '—')
    assert.equal(formatAmount(0, 'INR'), 'INR 0.00')
    assert.equal(formatAmount(150000, 'INR'), 'INR 150000.00')
    assert.equal(formatAmount(10, null), '10.00')
  })

  it('names the kinds of activity', () => {
    assert.equal(activityKindLabel('decision'), 'Decision')
    assert.equal(activityKindLabel('lead'), 'Lead')
  })
})

describe('what a failure means', () => {
  it('reads a 403 on a page as no access, not as an error to retry', () => {
    assert.deepEqual(classifyLoadFailure(new ApiError('Forbidden', 403), 'x'), { kind: 'forbidden', message: FORBIDDEN_PAGE_TEXT })
    assert.equal(classifyLoadFailure(new ApiError('Not here', 404), 'x').kind, 'notFound')
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

  it('asks a question that says what will happen', () => {
    const confirm = confirmCopy(pair, 'confirm')
    assert.equal(confirm.confirmLabel, 'Confirm: same organisation')
    assert.equal(confirm.description, 'These two will be shown as one organisation. Nothing in either record is changed.')
    assert.ok(confirm.title.includes('Riverdale Public School') && confirm.title.includes('Riverdale School Society'))
    const reject = confirmCopy(pair, 'reject')
    assert.equal(reject.confirmLabel, 'Not the same')
    assert.ok(String(reject.description).includes('will not be suggested'))
    assert.ok(decidedNotice(pair, 'confirm').includes('one organisation'))
    assert.ok(decidedNotice(pair, 'reject').includes('not be suggested'))
  })
})
