import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ContactSection, telHref } from '@/components/domain/signals/signal-contact-section'
import type { SignalContact } from '@/services/signals/opportunities'

const base: SignalContact = {
  status: 'not_available', name: null, designation: null, company: 'Sunrise Public School', email: null, phone: null,
  website: 'https://sunrise.example.org', linkedin: null, location: [], email_source: null, phone_source: null, verified: false,
  message: 'Not available: email address and phone number.',
}

describe('signal contact section', () => {
  it('makes the phone a tel: link and the email a mailto: link', () => {
    const html = renderToStaticMarkup(<ContactSection c={{
      ...base, status: 'complete', phone: '+919876543210', email: 'asha@sunriseschool.in', name: 'Asha Rao', designation: 'Principal',
      location: { city: 'Pune', state: 'Maharashtra', country: 'India' },
      email_source: { status: 'crm_record', label: 'CRM lead L-7', url: null }, phone_source: { status: 'stated_in_source', label: 'Stated in the signal\'s source', url: 'https://news.test/a' },
    }} />)
    assert.match(html, /href="tel:\+919876543210"/)
    assert.match(html, /href="mailto:asha@sunriseschool\.in"/)
    assert.match(html, /Asha Rao/)
    assert.match(html, /Principal/)
    assert.match(html, /Pune, Maharashtra, India/)
    assert.match(html, /Unverified · CRM lead L-7/)
    assert.match(html, /Phone and email found/)
  })

  it('shows Not Available for every missing detail instead of hiding the section', () => {
    const html = renderToStaticMarkup(<ContactSection c={base} />)
    assert.match(html, /data-testid="signal-contact"/)
    assert.equal((html.match(/Not Available/g) ?? []).length >= 5, true)
    assert.doesNotMatch(html, /href="tel:/)
    assert.doesNotMatch(html, /href="mailto:/)
    assert.match(html, /Contact needed/)
    assert.match(html, /Not available: email address and phone number\./)
    assert.match(html, /Sunrise Public School/)
  })

  it('shows whichever of phone or email exists', () => {
    const html = renderToStaticMarkup(<ContactSection c={{ ...base, status: 'partial', email: 'principal@sunriseschool.in' }} />)
    assert.match(html, /href="mailto:principal@sunriseschool\.in"/)
    assert.doesNotMatch(html, /href="tel:/)
    assert.match(html, /Partly found/)
  })

  it('renders nothing only when the API sent no contact block', () => {
    assert.equal(renderToStaticMarkup(<ContactSection c={undefined} />), '')
  })

  it('cleans a number for dialling', () => {
    assert.equal(telHref('+91 98765-43210'), 'tel:+919876543210')
  })
  it('lists every contact found on the public web with tel/mailto links, source links and an Unverified label', () => {
    const html = renderToStaticMarkup(<ContactSection c={{
      ...base, status: 'complete', phone: '+919822011223', email: 'asha@sunriseschool.in',
      contacts: [
        { name: 'Asha Rao', designation: 'Principal', email: 'asha@sunriseschool.in', phone: '+919822011223', linkedin: 'https://www.linkedin.com/in/asha', source_url: 'https://s/1', email_source_url: 'https://s/e', phone_source_url: 'https://s/p', verification: 'unverified' },
        { name: 'Vikram Shah', designation: 'Director', email: null, phone: null, linkedin: null, source_url: 'https://s/2', email_source_url: null, phone_source_url: null, verification: 'unverified' },
        { name: null, designation: 'Organisation contact (published)', email: 'office@sunriseschool.in', phone: null, linkedin: null, source_url: 'https://s/3', email_source_url: 'https://s/3', phone_source_url: null, verification: 'unverified' },
      ],
      research: { state: 'found', searched_at: null, can_search: true },
    }} />)
    assert.equal((html.match(/data-testid="found-contact"/g) ?? []).length, 3)
    assert.match(html, /Found on the public web \(3\)/)
    assert.match(html, /href="mailto:office@sunriseschool\.in"/)
    assert.match(html, /href="https:\/\/s\/e"/)
    assert.match(html, /href="https:\/\/www\.linkedin\.com\/in\/asha"/)
    assert.match(html, /Organisation contact/)
    assert.equal((html.match(/Unverified/g) ?? []).length >= 3, true)
    assert.match(html, /Vikram Shah/)
    assert.match(html, /Not Available/)   // the second person has neither phone nor email
  })

  it('offers the search when it can run, and hides it when no provider is set up', () => {
    const on = renderToStaticMarkup(<ContactSection c={{ ...base, research: { state: 'not_searched', searched_at: null, can_search: true } }} onSearch={() => {}} onRefresh={() => {}} />)
    assert.match(on, /data-testid="find-contacts"/)
    assert.match(on, /No public search has been run/)
    const off = renderToStaticMarkup(<ContactSection c={{ ...base, research: { state: 'not_set_up', searched_at: null, can_search: false } }} onSearch={() => {}} />)
    assert.doesNotMatch(off, /data-testid="find-contacts"/)
    assert.match(off, /not set up/)
    const none = renderToStaticMarkup(<ContactSection c={{ ...base, research: { state: 'none_found', searched_at: null, can_search: true } }} />)
    assert.match(none, /found no contact details/)
    assert.match(none, /Not Available/)   // still shown, never hidden
  })
  it('says why the card is empty: a failed search is a provider problem, an empty one is "nothing published"', () => {
    const failed = renderToStaticMarkup(<ContactSection c={{ ...base, research: { state: 'not_searched', searched_at: null, can_search: true, attempt: { at: 'x', outcome: 'failed', searches: 2, failed: 2, found: 0 } } }} onSearch={() => {}} />)
    assert.match(failed, /could not run: 2 of 2 requests/)
    assert.match(failed, /provider or key problem/)
    const none = renderToStaticMarkup(<ContactSection c={{ ...base, research: { state: 'none_found', searched_at: null, can_search: true, attempt: { at: 'x', outcome: 'none', searches: 5, failed: 0, found: 0 } } }} />)
    assert.match(none, /made 5 requests and found no published contact details/)
    assert.match(none, /Not Available/)
  })
})
