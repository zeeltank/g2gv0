import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  claimLevelText, dateBadge, dateExplanation, evidenceQuote, firstSeenText, formatDay, safeHttpUrl, scoreText, sourceLink, statusChip,
} from './signal-display'
import { signalRow } from './signal-fixtures'

describe('formatDay', () => {
  it('writes a day as day, month name and year, whatever the browser language', () => {
    assert.equal(formatDay('2026-10-12'), '12 Oct 2026')
    assert.equal(formatDay('2026-01-03 09:30:00'), '3 Jan 2026')
    assert.equal(formatDay('2026-11-02T13:42:00+05:30'), '2 Nov 2026')
  })

  it('is null for anything that is not a real calendar day', () => {
    for (const bad of [null, undefined, '', 'next week', '2026-13-01', '2026-02-30', '0000-00-00', '12/10/2026']) assert.equal(formatDay(bad), null, String(bad))
  })
})

describe('the date badge says what KIND of date it is', () => {
  it('"Event" when the source states the date of the event', () => {
    assert.deepEqual(dateBadge({ status: 'event_date_stated', date: '2026-10-12' }), { kind: 'event', text: 'Event 12 Oct 2026' })
  })

  it('"Published" when only the day the source was published is known', () => {
    assert.deepEqual(dateBadge({ status: 'source_date_only', date: '2026-10-03' }), { kind: 'published', text: 'Published 3 Oct 2026' })
  })

  it('"Date unknown" when there is no date', () => {
    assert.deepEqual(dateBadge({ status: 'undated', date: null }), { kind: 'unknown', text: 'Date unknown' })
  })

  it('never prints a date it was not given: a status without a usable date reads "Date unknown"', () => {
    assert.equal(dateBadge({ status: 'event_date_stated', date: null }).text, 'Date unknown')
    assert.equal(dateBadge({ status: 'source_date_only', date: 'garbage' }).text, 'Date unknown')
    assert.equal(dateBadge({ status: 'undated', date: '2026-10-12' }).text, 'Date unknown', 'an undated signal shows no date even if one is sent')
    assert.equal(dateBadge(undefined).text, 'Date unknown')
    assert.equal(dateBadge(null).kind, 'unknown')
  })

  it('explains how the date was found, and adds where on the page when the researcher recorded it', () => {
    assert.match(dateExplanation({ status: 'event_date_stated', date: '2026-10-12' }), /states the date the event happens/)
    assert.match(dateExplanation({ status: 'source_date_only', date: '2026-10-03' }, 'visible_relative'), /not the day the event happens \(worked out from “posted N days ago”\)/)
    assert.doesNotMatch(dateExplanation({ status: 'source_date_only', date: '2026-10-03' }), /\(from/)
    assert.match(dateExplanation({ status: 'undated', date: null }), /No date could be found/)
  })
})

describe('the status chip', () => {
  it('shows the stored "Follow-up" as "Contacted", and the other three in plain words', () => {
    assert.equal(statusChip('Follow-up').label, 'Contacted')
    assert.equal(statusChip('New').label, 'Needs decision')
    assert.equal(statusChip('Reviewed').label, 'Reviewed')
    assert.equal(statusChip('Dismissed').label, 'Not relevant')
  })

  it('never shows the stored word "Follow-up" anywhere', () => {
    for (const status of ['New', 'Follow-up', 'Reviewed', 'Dismissed'] as const) assert.doesNotMatch(statusChip(status).label, /Follow-up/)
  })

  it('shows an unknown status as it came instead of crashing', () => {
    assert.equal(statusChip('Archived' as never).label, 'Archived')
  })
})

describe('the evidence', () => {
  it('uses the kept quote, else the source excerpt, else nothing', () => {
    assert.match(evidenceQuote(signalRow())!, /^invites sealed bids/)
    assert.equal(evidenceQuote(signalRow({ assessment: null, primary_source: { url: 'https://a.example', excerpt: ' From the page. ' } })), 'From the page.')
    assert.equal(evidenceQuote(signalRow({ assessment: null, primary_source: null })), null)
  })

  it('links only to http(s) addresses', () => {
    assert.equal(safeHttpUrl('https://a.example/x'), 'https://a.example/x')
    assert.equal(safeHttpUrl('http://a.example'), 'http://a.example/')
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://a.example', '//a.example', 'not a url', '', null, undefined]) assert.equal(safeHttpUrl(bad), null, String(bad))
  })

  it('finds the source address in the order: the signal, its primary source, the kept quote', () => {
    assert.equal(sourceLink(signalRow())!.title, 'Tender notice 42')
    assert.equal(sourceLink(signalRow({ source_url: 'javascript:x', primary_source: { url: 'https://b.example/p' }, source_title: null }))!.url, 'https://b.example/p')
    assert.equal(sourceLink(signalRow({ source_url: null, source_title: null, primary_source: null, assessment: { provenance: { public_fact: { source_url: 'https://c.example/q' } } } }))!.title, 'c.example')
    assert.equal(sourceLink(signalRow({ source_url: 'javascript:x', primary_source: null, assessment: null })), null)
  })

  it('says when and how a signal was first seen', () => {
    assert.equal(firstSeenText(signalRow()), '2 Nov 2026 by run #81')
    assert.equal(firstSeenText(signalRow({ research_run_id: null, entered_manually: true })), '2 Nov 2026, added by hand')
    assert.equal(firstSeenText(signalRow({ first_discovered_at: null })), null)
  })

  it('states the claim level and the score without inventing a maximum', () => {
    assert.match(claimLevelText('confirmed')!, /^Confirmed/)
    assert.match(claimLevelText('hypothesis')!, /^A hypothesis/)
    assert.equal(claimLevelText(null), null)
    assert.equal(scoreText(signalRow()), 'Score 24')
    assert.equal(scoreText(signalRow({ scores: null })), null)
  })
})
