import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { listQueryString, patchListQuery, readListQuery } from '../../components/shared/scaffolds/list-query'
import {
  ALL_PRODUCTS, cappedQuote, consentSentence, consentViews, emailConsent, filterRequest, filtersFromView, hasActiveFilters, hostOf, isFromSignal, LEAD_LIST_QUERY,
  leadColumnCount, leadFilters, leadPatch, MAX_QUOTE, NOTHING_SEEN, noteSeen, productChoices, productFilterValue, quoteCaption, readLeadExtras, showProductFilter,
  signalDateText, signalEvidence, smsConsent, viewConditions, visibleColumns, whole, withLeadExtras,
} from './model'
import { contractLead, lead, options, signal } from './fixtures'
import type { Lead } from '../../types/crm'

/** Reading the server's answer: the contract's names, the presenter's names, a server that sends none of it, and junk. */
describe('reading the fields slice 6 adds', () => {
  it('reads the contract\'s snake_case names into the names the screens use', () => {
    const extras = readLeadExtras({
      product: { id: 9, key: 'scholarclone-erp', name: 'School ERP' },
      organisation_account: { id: 58, name: 'Hillcrest Academy' },
      source_signal_id: 77,
      source_signal: { id: 77, title: 'A signal', source_url: 'https://a.example/x', event_date: '2026-10-12', business_fit: 'g2g' },
      consent: { email: { allowed: false, reason: 'They opted out.' }, sms: { allowed: true, reason: null } },
    })
    assert.deepEqual(extras.product, { id: 9, key: 'scholarclone-erp', name: 'School ERP' })
    assert.deepEqual(extras.organisationAccount, { id: 58, name: 'Hillcrest Academy' })
    assert.equal(extras.sourceSignalId, 77)
    assert.deepEqual(extras.sourceSignal, {
      id: 77, title: 'A signal', sourceUrl: 'https://a.example/x', eventDate: '2026-10-12', sourcePublishedAt: null, businessFit: 'g2g', quote: null, quoteKind: null,
    })
    assert.deepEqual(extras.consent, { email: { allowed: false, reason: 'They opted out.' }, sms: { allowed: true, reason: null } })
  })

  it('reads the presenter\'s camelCase names just the same', () => {
    const extras = readLeadExtras({
      organisationAccount: { id: 58, name: 'Hillcrest Academy' },
      sourceSignalId: '77',
      sourceSignal: { id: 77, title: 'A signal', sourceUrl: 'https://a.example/x', eventDate: '2026-10-12', businessFit: 'g2g', quote: 'We will tender in March.' },
    })
    assert.deepEqual(extras.organisationAccount, { id: 58, name: 'Hillcrest Academy' })
    assert.equal(extras.sourceSignalId, 77)
    assert.equal(extras.sourceSignal?.sourceUrl, 'https://a.example/x')
    assert.equal(extras.sourceSignal?.eventDate, '2026-10-12')
    assert.equal(extras.sourceSignal?.businessFit, 'g2g')
    assert.equal(extras.sourceSignal?.quote, 'We will tender in March.')
  })

  it('reads the quote, what kind of text it is, and the publication day, as hp_erp\'s LeadSignalEvidence sends them', () => {
    const sent = readLeadExtras({
      source_signal: { id: 77, title: 'T', source_url: 'https://a.example/x', event_date: null, source_published_at: '2026-10-03', business_fit: null, quote: ' The school will tender. ', quote_kind: 'excerpt' },
    }).sourceSignal!
    assert.equal(sent.quote, 'The school will tender.')
    assert.equal(sent.quoteKind, 'excerpt')
    assert.equal(sent.sourcePublishedAt, '2026-10-03')
    assert.equal(readLeadExtras({ source_signal: { id: 1, quote: 'x', quote_kind: 'observed_event' } }).sourceSignal!.quoteKind, 'observed_event')
    assert.equal(readLeadExtras({ source_signal: { id: 1, quote: 'x', quoteKind: 'excerpt' } }).sourceSignal!.quoteKind, 'excerpt', 'camelCase too')
    assert.equal(readLeadExtras({ source_signal: { id: 1, quote: 'x', quote_kind: 'verbatim' } }).sourceSignal!.quoteKind, null, 'a kind the server does not define is "not said", never a quote')
  })

  it('leaves a field OUT when the server did not send it, and keeps null when the server sent null (an older server is not "nothing to show")', () => {
    assert.deepEqual(readLeadExtras({ firstName: 'Asha' }), {}, 'nothing sent, nothing read')
    assert.deepEqual(readLeadExtras(null), {})
    assert.deepEqual(readLeadExtras('text'), {})
    const nulls = readLeadExtras({ product: null, organisation_account: null, source_signal_id: null, source_signal: null, consent: null })
    assert.deepEqual(nulls, { product: null, organisationAccount: null, sourceSignalId: null, sourceSignal: null, consent: null })
    for (const key of ['product', 'organisationAccount', 'sourceSignalId', 'sourceSignal', 'consent']) assert.ok(key in nulls, `${key} is present as null`)
  })

  it('drops what cannot be trusted: a product with no usable id, a channel with no yes or no, a blank name becomes a number', () => {
    const extras = readLeadExtras({
      product: { id: 'abc', name: 'Broken' },
      organisation_account: { id: 0, name: 'Zero' },
      source_signal_id: -3,
      source_signal: { title: 'No id' },
      consent: { email: { allowed: 'yes', reason: 'x' }, sms: { allowed: false, reason: '   ' } },
    })
    assert.equal(extras.product, null)
    assert.equal(extras.organisationAccount, null)
    assert.equal(extras.sourceSignalId, null)
    assert.equal(extras.sourceSignal, null)
    assert.deepEqual(extras.consent, { sms: { allowed: false, reason: null } }, 'the email channel was not a yes or no, so it is left out, never assumed')
    assert.equal(readLeadExtras({ product: { id: 3, name: '  ' } }).product?.name, 'Product #3')
    assert.equal(readLeadExtras({ organisation_account: { id: 8 } }).organisationAccount?.name, 'Organisation #8')
  })

  it('withLeadExtras keeps every existing field and adds the read ones', () => {
    const read = withLeadExtras(contractLead() as unknown as Lead)
    assert.equal(read.leadNo, 'LEAD-0041')
    assert.equal(read.firstName, 'Asha')
    assert.equal(read.product?.name, 'School ERP')
    assert.equal(read.organisationAccount?.name, 'Hillcrest Academy')
    assert.equal(read.sourceSignalId, 77)
    assert.equal('sourceSignal' in read, false, 'the list answer has no source_signal, so none is invented')
    assert.equal('consent' in read, false, 'the list answer has no consent, so none is invented')
  })

  it('whole() accepts only whole numbers from 1 up', () => {
    assert.equal(whole(5), 5)
    assert.equal(whole('12'), 12)
    for (const bad of [0, '0', -1, '-1', 1.5, '1.5', 'abc', '', null, undefined, NaN, Infinity, {}, []]) assert.equal(whole(bad), null, `${String(bad)} is not a whole number from 1`)
  })
})

/** The filters: the address they live in, and the request they become. */
describe('the filters: address and request', () => {
  const read = (search: string) => readListQuery(new URLSearchParams(search), LEAD_LIST_QUERY)

  it('the default view has a clean address and means no filter at all', () => {
    const query = read('')
    assert.equal(listQueryString(query, LEAD_LIST_QUERY), '')
    assert.deepEqual(leadFilters(query.filters), { productId: null, consent: null, hasSignal: false })
    assert.deepEqual(filterRequest(leadFilters(query.filters)), {}, 'nothing is sent for "all"')
    assert.equal(hasActiveFilters(leadFilters(query.filters)), false)
  })

  it('a filter written to the address reads back the same (round trip), under the contract\'s names', () => {
    const wanted = { productId: 12, consent: 'blocked', hasSignal: true } as const
    const query = patchListQuery(read(''), { filters: { product_id: productFilterValue(wanted.productId), consent: wanted.consent, has_signal: '1' } }, LEAD_LIST_QUERY)
    const address = listQueryString(query, LEAD_LIST_QUERY)
    assert.equal(address, 'product_id=12&consent=blocked&has_signal=1')
    const back = leadFilters(read(address).filters)
    assert.deepEqual(back, wanted)
    assert.deepEqual(filterRequest(back), { productId: 12, consent: 'blocked', hasSignal: true })
  })

  it('each filter alone round-trips and sends only itself', () => {
    for (const [address, expected] of [
      ['product_id=4', { productId: 4 }],
      ['consent=allowed', { consent: 'allowed' }],
      ['has_signal=1', { hasSignal: true }],
    ] as const) {
      const filters = leadFilters(read(address).filters)
      assert.deepEqual(filterRequest(filters), expected, address)
      assert.equal(listQueryString(read(address), LEAD_LIST_QUERY), address)
    }
  })

  it('a mistyped address opens the unfiltered list, never an error and never a wrong filter', () => {
    for (const address of ['product_id=abc', 'product_id=0', 'product_id=-2', 'product_id=1.5', 'product_id=', 'consent=maybe', 'consent=', 'has_signal=2', 'has_signal=true', 'has_signal=0']) {
      assert.deepEqual(leadFilters(read(address).filters), { productId: null, consent: null, hasSignal: false }, address)
    }
  })

  it('leadFilters does not lean on the address reader: any text that is not a real choice is "no filter" when it is handed over directly', () => {
    assert.deepEqual(leadFilters({ product_id: '7', consent: 'weird', has_signal: 'true' }), { productId: 7, consent: null, hasSignal: false })
    assert.deepEqual(leadFilters({ consent: 'ALLOWED' }), { productId: null, consent: null, hasSignal: false }, 'the choices are exact words')
    assert.deepEqual(leadFilters({ product_id: '-2', has_signal: '1' }), { productId: null, consent: null, hasSignal: true })
  })

  it('each filter on its own marks the list as narrowed', () => {
    assert.equal(hasActiveFilters(leadFilters({ product_id: '4' })), true)
    assert.equal(hasActiveFilters(leadFilters({ consent: 'allowed' })), true)
    assert.equal(hasActiveFilters(leadFilters({ has_signal: '1' })), true)
    assert.equal(hasActiveFilters(leadFilters({})), false)
  })

  it('a chosen filter marks the list as narrowed; clearing it goes back to the clean address', () => {
    const narrowed = patchListQuery(read(''), { filters: { consent: 'blocked' } }, LEAD_LIST_QUERY)
    assert.equal(hasActiveFilters(leadFilters(narrowed.filters)), true)
    const cleared = patchListQuery(narrowed, { filters: { consent: '' } }, LEAD_LIST_QUERY)
    assert.equal(listQueryString(cleared, LEAD_LIST_QUERY), '')
    assert.equal(hasActiveFilters(leadFilters(cleared.filters)), false)
  })

  it('the three filter names are not the list query\'s reserved ones (an assertion in the scaffold would throw)', () => {
    assert.doesNotThrow(() => read('product_id=1&consent=blocked&has_signal=1'))
  })
})

/** Saved views keep the filters beside the search and sort they already kept. */
describe('saved views and the filters', () => {
  it('a view keeps the three filters, and applying it puts them back in the address words', () => {
    const kept = viewConditions({ productId: 12, consent: 'blocked', hasSignal: true })
    assert.deepEqual(kept, { productId: 12, consent: 'blocked', hasSignal: true })
    assert.deepEqual(filtersFromView(kept), { product_id: '12', consent: 'blocked', has_signal: '1' })
  })

  it('a view saved with no filter on clears the person\'s filters when applied', () => {
    const kept = viewConditions({ productId: null, consent: null, hasSignal: false })
    assert.deepEqual(filtersFromView(kept), { product_id: '', consent: '', has_signal: '' })
  })

  it('a view saved before the filters existed leaves the person\'s filters alone', () => {
    assert.equal(filtersFromView({ search: 'asha', sortKey: 'lead_score', sortAsc: true }), null)
    assert.equal(filtersFromView({}), null)
  })

  it('a value in a saved view that is not a real choice means "all", never a made-up filter', () => {
    assert.deepEqual(filtersFromView({ productId: 'abc', consent: 'maybe', hasSignal: 'yes' }), { product_id: '', consent: '', has_signal: '' })
  })

  it('a view round-trips through the address: save, apply, read back', () => {
    const wanted = { productId: 4, consent: 'allowed', hasSignal: false } as const
    const patch = filtersFromView(viewConditions(wanted))!
    const query = patchListQuery(readListQuery(new URLSearchParams(''), LEAD_LIST_QUERY), { filters: patch }, LEAD_LIST_QUERY)
    assert.deepEqual(leadFilters(query.filters), wanted)
  })
})

describe('the Product box', () => {
  it('offers All products first and then every record by its own label', () => {
    const choices = productChoices(options, null)
    assert.deepEqual(choices[0], { value: '', label: ALL_PRODUCTS })
    assert.deepEqual(choices.slice(1).map((c) => c.label), ['ScholarClone', 'ScholarClone › School ERP', 'G2G'])
    assert.deepEqual(choices.slice(1).map((c) => c.value), ['4', '9', '12'])
  })

  it('keeps a product the address names even when the list does not hold it, so the box never shows a wrong value', () => {
    const choices = productChoices(options, 99)
    assert.deepEqual(choices.at(-1), { value: '99', label: 'Product #99' })
    assert.equal(productChoices(options, 9).length, options.length + 1, 'a product that IS in the list is not added twice')
  })

  it('is drawn only when there is a product to choose or one is already chosen', () => {
    const none = leadFilters({})
    assert.equal(showProductFilter([], none), false)
    assert.equal(showProductFilter(options, none), true)
    assert.equal(showProductFilter([], leadFilters({ product_id: '7' })), true, 'a chosen product can always be cleared')
  })
})

/** The Product column appears only when there is something to show; the consent chip and the signal marker add no column. */
describe('which columns show', () => {
  const none = leadFilters({})

  it('a list with no product has exactly the columns it always had', () => {
    const seen = noteSeen(NOTHING_SEEN, [lead(), lead({ id: '42', consentStatus: 'opted_out' })])
    assert.deepEqual(visibleColumns(seen, none), { product: false }, 'a blocked lead adds a chip inside a cell, not a column')
    assert.equal(leadColumnCount(visibleColumns(seen, none)), 9)
  })

  it('the Product column appears when a lead has a product', () => {
    const withProduct = noteSeen(NOTHING_SEEN, [lead({ product: { id: 9, key: null, name: 'School ERP' } })])
    assert.deepEqual(visibleColumns(withProduct, none), { product: true })
    assert.equal(leadColumnCount({ product: true }), 10)
  })

  it('a lead whose product is null shows nothing', () => {
    assert.deepEqual(noteSeen(NOTHING_SEEN, [lead({ product: null })]), NOTHING_SEEN)
  })

  it('a column that has shown keeps its place on the next page (columns do not come and go while paging)', () => {
    const first = noteSeen(NOTHING_SEEN, [lead({ product: { id: 9, key: null, name: 'School ERP' } })])
    const second = noteSeen(first, [lead()])
    assert.equal(second.product, true)
    assert.ok(second === first, 'unchanged state is the same object')
  })

  it('a filter on the product shows the column even when the filtered list is empty, so the person sees what they filtered on', () => {
    assert.deepEqual(visibleColumns(NOTHING_SEEN, leadFilters({ product_id: '9' })), { product: true })
    assert.deepEqual(visibleColumns(NOTHING_SEEN, leadFilters({ consent: 'blocked', has_signal: '1' })), { product: false }, 'the other two filters have no column of their own')
  })
})

/** The Consent chip: what it says, and the reason in plain words. */
describe('consent: the chip and its reason', () => {
  it('a lead that opted out is BLOCKED, in words, with the reason', () => {
    const view = emailConsent(lead({ consentStatus: 'opted_out' }))!
    assert.equal(view.allowed, false)
    assert.equal(view.word, 'Blocked: opted out')
    assert.equal(view.reason, 'They opted out of email, so email to them is blocked.')
    assert.equal(view.from, 'record')
  })

  it('a suppressed lead is BLOCKED as suppressed, and suppressed is checked before opted out', () => {
    assert.equal(emailConsent(lead({ consentStatus: 'suppressed' }))!.word, 'Blocked: suppressed')
    assert.equal(emailConsent(lead({ consentStatus: 'opted_out', suppressedAt: '2026-10-01 09:00:00' }))!.word, 'Blocked: suppressed')
    assert.equal(emailConsent(lead({ consentStatus: 'suppressed' }))!.reason, 'This lead is suppressed, so email to them is blocked.')
  })

  it('the email opt-out flag blocks even when the status says nothing', () => {
    const view = emailConsent(lead({ emailOptOut: true, consentStatus: null }))!
    assert.equal(view.allowed, false)
    assert.equal(view.word, 'Blocked: opted out')
  })

  it('an opt-out wins over an opt-in: both on one record is blocked, never allowed', () => {
    const view = emailConsent(lead({ consentStatus: 'opted_in', emailOptOut: true }))!
    assert.equal(view.allowed, false)
    assert.equal(view.word, 'Blocked: opted out')
  })

  it('an opt-in is "Opted in" with no reason; a lead nothing is recorded for says nothing at all (never "allowed")', () => {
    const optedIn = emailConsent(lead({ consentStatus: 'opted_in' }))!
    assert.deepEqual([optedIn.allowed, optedIn.word, optedIn.reason], [true, 'Opted in', null])
    assert.equal(emailConsent(lead({ consentStatus: 'unknown' })), null)
    assert.equal(emailConsent(lead({ consentStatus: null })), null)
  })

  it('the gate\'s answer wins when the server sends it, and its own sentence is the reason', () => {
    const blocked = emailConsent(lead({ consent: { email: { allowed: false, reason: 'The address is on the suppression list.' } } }))!
    assert.equal(blocked.from, 'gate')
    assert.equal(blocked.allowed, false)
    assert.equal(blocked.word, 'Blocked')
    assert.equal(blocked.reason, 'The address is on the suppression list.')
    // the gate says allowed even though the record is silent: allowed, with no reason to give
    const allowed = emailConsent(lead({ consent: { email: { allowed: true, reason: null } } }))!
    assert.deepEqual([allowed.allowed, allowed.word, allowed.reason], [true, 'Allowed', null])
  })

  it('a gate that allows says "Opted in" when the record also says so, and plain "Allowed" otherwise', () => {
    const both = emailConsent(lead({ consentStatus: 'opted_in', consent: { email: { allowed: true, reason: null } } }))!
    assert.deepEqual([both.allowed, both.word, both.from], [true, 'Opted in', 'gate'])
    const gateOnly = emailConsent(lead({ consentStatus: 'unknown', consent: { email: { allowed: true, reason: null } } }))!
    assert.equal(gateOnly.word, 'Allowed')
  })

  it('a gate that blocks without a sentence is explained from the record, and when the record is silent too, says so honestly', () => {
    const fromRecord = emailConsent(lead({ consentStatus: 'opted_out', consent: { email: { allowed: false, reason: null } } }))!
    assert.equal(fromRecord.word, 'Blocked: opted out')
    assert.equal(fromRecord.reason, 'They opted out of email, so email to them is blocked.')
    const silent = emailConsent(lead({ consent: { email: { allowed: false, reason: null } } }))!
    assert.equal(silent.word, 'Blocked')
    assert.equal(silent.reason, 'No reason was given.')
  })

  it('SMS is read from the gate only; without the gate nothing is said about it', () => {
    assert.equal(smsConsent(lead()), null)
    assert.equal(smsConsent(lead({ consent: { email: { allowed: true, reason: null } } })), null)
    const blocked = smsConsent(lead({ consent: { sms: { allowed: false, reason: 'No consent has been recorded for this channel.' } } }))!
    assert.deepEqual([blocked.label, blocked.allowed, blocked.word, blocked.reason], ['SMS', false, 'Blocked', 'No consent has been recorded for this channel.'])
    assert.equal(smsConsent(lead({ consent: { sms: { allowed: false, reason: null } } }))!.reason, 'No reason was given.')
  })

  it('consentViews lists email first, then SMS, and only what can be said', () => {
    assert.deepEqual(consentViews(lead()), [])
    const both = consentViews(lead({ consent: { email: { allowed: true, reason: null }, sms: { allowed: false, reason: 'Nope.' } } }))
    assert.deepEqual(both.map((v) => v.channel), ['email', 'sms'])
  })

  it('the sentence for a screen reader holds the channel, the state and the reason', () => {
    assert.equal(consentSentence(emailConsent(lead({ consentStatus: 'opted_out' }))!), 'Email: Blocked: opted out. They opted out of email, so email to them is blocked.')
    assert.equal(consentSentence(emailConsent(lead({ consentStatus: 'opted_in' }))!), 'Email: Opted in.')
  })
})

/** The signal a lead came from. */
describe('the signal a lead came from', () => {
  it('a lead with no signal says none', () => {
    assert.deepEqual(signalEvidence(lead()), { kind: 'none' })
    assert.equal(isFromSignal(lead()), false)
  })

  it('a lead is "from a signal" by the new id, by the older source column, or by the signal itself', () => {
    assert.equal(isFromSignal(lead({ sourceSignalId: 77 })), true)
    assert.equal(isFromSignal(lead({ sourceCompanyOpportunityId: '40' })), true)
    assert.equal(isFromSignal(lead({ sourceSignal: signal() })), true)
    assert.equal(isFromSignal(lead({ sourceSignalId: null, sourceCompanyOpportunityId: null })), false)
    assert.equal(isFromSignal(lead({ sourceCompanyOpportunityId: '0' })), false, 'an id of 0 is no signal')
  })

  it('an id with nothing behind it is "unreadable", honestly, and keeps the id', () => {
    assert.deepEqual(signalEvidence(lead({ sourceSignalId: 77 })), { kind: 'unreadable', id: '77' })
    assert.deepEqual(signalEvidence(lead({ sourceCompanyOpportunityId: '40', sourceSignal: null })), { kind: 'unreadable', id: '40' })
  })

  it('a readable signal gives the title, the link, the date and the fit', () => {
    const evidence = signalEvidence(lead({ sourceSignal: signal() }))
    assert.deepEqual(evidence, {
      kind: 'signal', id: 77, title: 'Hillcrest Academy plans a new ERP rollout', url: 'https://news.example.com/hillcrest-erp', host: 'news.example.com',
      dateText: 'Event date: 12 Oct 2026', fitText: 'Scholarclone', quote: null, quoteKind: null,
    })
  })

  it('the date is the event\'s when one is stated, else the day the source was published (said so), else unknown', () => {
    assert.equal(signalDateText('2026-10-12', '2026-10-03'), 'Event date: 12 Oct 2026', 'the event date wins')
    assert.equal(signalDateText(null, '2026-10-03'), 'Published: 3 Oct 2026 (the event date is not stated)')
    assert.equal(signalDateText(null, null), 'Date unknown')
    assert.equal(signalDateText('not a date', undefined), 'Date unknown')
    assert.equal(signalDateText('2026-02-30', '2026-10-03'), 'Published: 3 Oct 2026 (the event date is not stated)', 'an impossible event day is no event day')
    const evidence = signalEvidence(lead({ sourceSignal: signal({ eventDate: null, sourcePublishedAt: '2026-10-03' }) }))
    assert.ok(evidence.kind === 'signal')
    assert.equal(evidence.dateText, 'Published: 3 Oct 2026 (the event date is not stated)')
  })

  it('what the text under a signal is called depends on what it is: a quotation is copied from the source, an observed event is a description', () => {
    assert.equal(quoteCaption('excerpt'), 'What the source said, copied from it.')
    assert.equal(quoteCaption('observed_event'), 'What the signal observed: a description, not a quote from the source.')
    assert.equal(quoteCaption(null), 'As recorded with the signal.')
    const kind = (quoteKind: 'excerpt' | 'observed_event' | null | undefined) => (signalEvidence(lead({ sourceSignal: signal({ quote: 'Some text.', quoteKind }) })) as { quoteKind: string | null }).quoteKind
    assert.equal(kind('excerpt'), 'excerpt')
    assert.equal(kind('observed_event'), 'observed_event')
    assert.equal(kind(undefined), null)
    // no text, no kind: a kind with nothing to describe is dropped
    assert.equal((signalEvidence(lead({ sourceSignal: signal({ quote: null, quoteKind: 'excerpt' }) })) as { quoteKind: string | null }).quoteKind, null)
  })

  it('a signal with no fit recorded has NO fit (null), not an empty one', () => {
    const evidence = signalEvidence(lead({ sourceSignal: signal({ businessFit: null }) }))
    assert.ok(evidence.kind === 'signal')
    assert.equal(evidence.fitText, null)
    assert.equal((signalEvidence(lead({ sourceSignal: signal({ businessFit: 'multiple' }) })) as { fitText: string }).fitText, 'Several products', 'a code the signal screens know keeps their words')
  })

  it('an undated signal says "Date unknown", never a date, and an untitled one is named by its number', () => {
    const evidence = signalEvidence(lead({ sourceSignal: signal({ eventDate: null, title: null }) }))
    assert.ok(evidence.kind === 'signal')
    assert.equal(evidence.dateText, 'Date unknown')
    assert.equal(evidence.title, 'Signal #77')
    assert.equal((signalEvidence(lead({ sourceSignal: signal({ eventDate: '2026-02-31' }) })) as { dateText: string }).dateText, 'Date unknown', 'a day that does not exist is not printed')
  })

  it('an address that is not http(s) is never a link (a stored javascript: address must not become clickable)', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://x.example/a', 'not a url']) {
      const evidence = signalEvidence(lead({ sourceSignal: signal({ sourceUrl: bad }) }))
      assert.ok(evidence.kind === 'signal')
      assert.equal(evidence.url, null, bad)
      assert.equal(evidence.host, null, bad)
    }
  })

  it('a quote is shown only when the server sends one, and a long one is cut with an ellipsis', () => {
    assert.equal(cappedQuote(null), null)
    assert.equal(cappedQuote('   '), null)
    assert.equal(cappedQuote('We will tender in March.'), 'We will tender in March.')
    const long = cappedQuote('x'.repeat(MAX_QUOTE + 50))!
    assert.equal(long.length, MAX_QUOTE + 1)
    assert.ok(long.endsWith('…'))
    assert.equal(cappedQuote('y'.repeat(MAX_QUOTE)), 'y'.repeat(MAX_QUOTE), 'exactly the limit is not cut')
  })

  it('hostOf drops a leading www. and answers null for anything that is not an address', () => {
    assert.equal(hostOf('https://www.example.com/a'), 'example.com')
    assert.equal(hostOf('https://news.example.com/a'), 'news.example.com')
    assert.equal(hostOf(null), null)
    assert.equal(hostOf('nope'), null)
  })
})

/** Which fact writes which field of a lead. */
describe('a fact accepted in the Evidence tab', () => {
  const written = (over: Record<string, unknown>) => ({ entity_type: 'lead', field: 'email', value: 'a@b.example', status: 'applied', column_written: true, ...over }) as Parameters<typeof leadPatch>[0]

  it('writes the lead\'s own property for each field a lead has a column for', () => {
    assert.deepEqual(leadPatch(written({ field: 'email', value: 'a@b.example' })), { email: 'a@b.example' })
    assert.deepEqual(leadPatch(written({ field: 'secondary_email', value: 's@b.example' })), { secondaryEmail: 's@b.example' })
    assert.deepEqual(leadPatch(written({ field: 'phone', value: '+91 11111 22222' })), { phone: '+91 11111 22222' })
    assert.deepEqual(leadPatch(written({ field: 'mobile', value: '+91 98765 43210' })), { mobile: '+91 98765 43210' })
    assert.deepEqual(leadPatch(written({ field: 'website', value: 'https://hillcrest.example.edu' })), { website: 'https://hillcrest.example.edu' })
    assert.deepEqual(leadPatch(written({ field: 'title', value: 'Principal' })), { designation: 'Principal' }, 'a job title lands in the lead\'s designation')
  })

  it('writes nothing for a field kept in the ledger only, a fact that did not write the record, or a fact about another kind of record', () => {
    assert.equal(leadPatch(written({ field: 'linkedin_url' })), null)
    assert.equal(leadPatch(written({ field: 'employer' })), null)
    assert.equal(leadPatch(written({ column_written: false })), null, 'accepted but the column already held a value')
    assert.equal(leadPatch(written({ column_written: undefined })), null)
    assert.equal(leadPatch(written({ status: 'proposed' })), null)
    assert.equal(leadPatch(written({ status: 'dismissed' })), null)
    assert.equal(leadPatch(written({ entity_type: 'contact' })), null)
    assert.equal(leadPatch(written({ entity_type: 'organization' })), null)
  })
})
