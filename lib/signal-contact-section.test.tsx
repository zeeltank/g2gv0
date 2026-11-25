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
})
