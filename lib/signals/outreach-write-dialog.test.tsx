import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { absent, says } from '../agent/assertions'
import { axeViolations } from '../agent/a11y'
import { ApiError } from '../../services/core'
import type { OutreachPerson } from '../../services/signals/outreach-types'
import { people, person } from './outreach-fixtures'
import { cleanup, outreachKit } from './outreach-screen-kit'

/**
 * The Write message dialog as a person meets it: the real dialog with the real Checks section of a draft, the Outreach API as a fake that records every call, and the checks and the
 * approval queue as fakes that record theirs. What these tests prove: SMS is shown and cannot be chosen, people who cannot be written to are left out with the reason, "Save draft" saves
 * one draft per person through the Outreach API, and afterwards the dialog offers the checks and "Submit for approval" and NOTHING that sends, approves or schedules.
 */

const BODY = 'Hello {{first_name}}, we would like to talk with {{company}} about the new campus.'

async function open(list: OutreachPerson[] = [person(), people()[2]], options: Parameters<typeof outreachKit>[0] = {}, submit?: (messageId: number) => Promise<unknown>) {
  const s = await outreachKit(options)
  const { WriteMessageDialog } = await import('../../components/domain/signals/outreach/write-message-dialog')
  const events = { opened: [] as boolean[], saved: 0 }
  const props = { people: list, open: true, service: s.service, ...s.messageDeps, ...(submit ? { submit } : {}), onOpenChange: (next: boolean) => { events.opened.push(next) }, onSaved: () => { events.saved += 1 } }
  await s.mount(s.k.h(WriteMessageDialog, props))
  const render = async (next: Partial<typeof props>) => { await s.k.render(s.wrap(s.k.h(WriteMessageDialog, { ...props, ...next }))); await s.settle(30) }
  const dialog = () => s.dialog()!
  const subject = () => s.field('Subject', dialog())
  const message = () => s.field('Message', dialog())
  const fill = async (text = 'About the new campus', body = BODY) => { await s.type(subject(), text); await s.type(message(), body) }
  const save = () => s.press(s.button('Save draft', dialog()), 50)
  const buttons = () => Array.from(dialog().querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '')
  return { ...s, events, render, dialog, subject, message, fill, save, buttons }
}

describe('Write message: the channel', () => {
  afterEach(cleanup)

  it('shows SMS but switched off, with the words, and keeps Email chosen', async () => {
    const s = await open()
    const group = s.dialog().querySelector('[role="group"][aria-label="How to write"]')!
    const [email, sms] = Array.from(group.querySelectorAll('button'))
    assert.equal(email.textContent, 'Email')
    assert.equal(email.getAttribute('aria-pressed'), 'true')
    assert.equal(sms.textContent, 'SMS')
    assert.equal((sms as HTMLButtonElement).disabled, true)
    assert.equal(sms.getAttribute('aria-pressed'), 'false')
    assert.equal(sms.getAttribute('title'), 'SMS is not switched on for this organisation.')
    assert.equal(s.dialog().querySelector('[data-sms-off]')!.textContent, 'SMS is not switched on for this organisation.')
    await s.press(sms)
    assert.equal(email.getAttribute('aria-pressed'), 'true', 'pressing SMS changed nothing')
    assert.equal(sms.getAttribute('aria-pressed'), 'false')
  })
})

describe('Write message: who it goes to', () => {
  afterEach(cleanup)

  it('lists who will be written to with their reach, and who will be skipped with the reason', async () => {
    const everyone = [person({ consent_status: 'opted_in' }), people()[2], people()[3], people()[4], person({ id: 17, full_name: 'Dev Soni', email_opt_out: true, reach: 'blocked', consent_status: 'unknown' })]
    const s = await open(everyone)
    const written = s.dialog().querySelector('[aria-label="Will be written to"]')!
    const rows = written.querySelectorAll('[data-recipient]')
    assert.equal(rows.length, 2)
    says(rows[0].textContent, 'Meera Patel')
    says(rows[0].textContent, 'Email and phone')
    says(rows[0].textContent, 'Agreed to hear from us')
    says(rows[1].textContent, 'Riverdale Public School (company line)')
    says(rows[1].textContent, 'Email only')
    const skipped = Array.from(s.dialog().querySelectorAll('[data-skipped]')).map((li) => li.textContent)
    assert.deepEqual(skipped, [
      'Anita Rao: Will be skipped: no email address.',
      'Kiran Desai: Will be skipped: They opted out.',
      'Dev Soni: Will be skipped: They asked for no email.',
    ])
  })

  it('says nobody can be written to, and keeps Save draft off, when every person is skipped', async () => {
    const s = await open([people()[3], people()[4]])
    says(s.dialog().textContent, 'Nobody here can be written to yet. Add an email address first.')
    assert.equal(s.button('Save draft', s.dialog())!.disabled, true)
    assert.equal(s.dialog().querySelectorAll('[data-skipped]').length, 2)
  })
})

describe('Write message: the form', () => {
  afterEach(cleanup)

  it('says in words what is missing, under each box, and saves nothing', async () => {
    const s = await open()
    await s.press(s.button('Save draft', s.dialog()))
    says(s.dialog().textContent, 'Write a subject.')
    says(s.dialog().textContent, 'Write at least 20 characters.')
    assert.equal(s.subject()!.getAttribute('aria-invalid'), 'true')
    assert.equal(s.message()!.getAttribute('aria-invalid'), 'true')
    assert.deepEqual(s.calls.writeMessages, [])
    await s.fill()
    assert.equal(s.subject()!.getAttribute('aria-invalid'), null, 'the sentence goes away once the box is right')
  })

  it('counts the characters written so far', async () => {
    const s = await open()
    await s.type(s.message(), 'Hello there')
    says(s.dialog().textContent, 'Write at least 20 characters. 11 so far.')
  })

  it('adds a merge word to the box the person was typing in, and shows the preview for the first person', async () => {
    const s = await open()
    await s.type(s.subject(), 'Hello ')
    await s.type(s.message(), 'Dear ')
    await s.press(s.button('First name', s.dialog()))
    assert.equal((s.message() as HTMLTextAreaElement).value, 'Dear {{first_name}}', 'the body was the last box used')
    await s.k.act(async () => { s.subject()!.dispatchEvent(new s.k.w.FocusEvent('focusin', { bubbles: true })) })
    await s.press(s.button('Company', s.dialog()))
    assert.equal((s.subject() as HTMLInputElement).value, 'Hello {{company}}')
    const preview = s.dialog().querySelector('[data-preview]')!
    says(preview.textContent, 'Preview for Meera Patel')
    says(preview.textContent, 'Hello Riverdale Public School')
    says(preview.textContent, 'Dear Meera')
  })

  it('fills "there" in the preview for a company line with no name', async () => {
    const s = await open([people()[2]])
    await s.type(s.message(), 'Dear {{first_name}}')
    says(s.dialog().querySelector('[data-preview]')!.textContent, 'Dear there')
  })

  it('has no accessibility violation a fake page can see', async () => {
    const s = await open()
    assert.deepEqual(await axeViolations(s.dialog()), [])
  })
})

describe('Write message: saving drafts', () => {
  afterEach(cleanup)

  it('saves one draft per person who can be written to, with the words as typed, and tells the screen', async () => {
    const s = await open([person(), people()[2], people()[3], people()[4]])
    await s.fill('  About the new campus ')
    await s.save()
    assert.deepEqual(s.calls.writeMessages, [{ person_ids: [11, 13], subject: 'About the new campus', body: BODY }])
    assert.equal(s.events.saved, 1)
    says(s.dialog().querySelector('[data-draft-summary]')!.textContent, '2 drafts saved.')
    assert.equal(s.dialog().querySelectorAll('[data-draft]').length, 2)
    says(s.dialog().textContent, 'Nothing has been sent.')
    says(s.dialog().textContent, 'Skipped: Anita Rao (no email address); Kiran Desai (They opted out).')
  })

  it('offers the checks and Submit for approval for each draft, and no button that sends, approves or schedules', async () => {
    const s = await open()
    await s.fill()
    await s.save()
    const labels = s.buttons()
    assert.equal(labels.filter((label) => label === 'Submit for approval').length, 2, 'one for each draft')
    assert.equal(labels.filter((label) => label === 'Show checks').length, 2)
    assert.ok(labels.includes('Close'))
    assert.deepEqual(labels.filter((label) => /^(send|approve|schedule|dispatch)/i.test(label)), [], JSON.stringify(labels))
    assert.ok(!/Send now|Approve and/.test(s.dialog().textContent ?? ''))
  })

  it('says that approving and sending happen in Messages and links there', async () => {
    const s = await open()
    await s.fill()
    await s.save()
    says(s.dialog().textContent, 'Approving and sending happen in Messages.')
    assert.equal(s.dialog().querySelector('a[href="/signals/outreach?view=messages"]')!.textContent, 'Messages')
  })

  it('shows the checks of one draft when asked, from the checks the Messages queue uses', async () => {
    const s = await open()
    await s.fill()
    await s.save()
    absent(s.dialog().querySelector('[data-outreach-checks]'), 'collapsed until asked, so many drafts do not ask the server many times')
    assert.deepEqual(s.gateCalls, [])
    await s.press(s.button('Show checks', s.dialog()), 50)
    assert.deepEqual(s.gateCalls, [7000])
    const section = s.dialog().querySelector('[data-outreach-checks]')!
    says(section.textContent, 'All 10 checks passed.')
    assert.equal(s.dialog().querySelectorAll('[data-outreach-checks]').length, 1)
    assert.ok(s.button('Hide checks', s.dialog()))
  })

  it('shows the checks at once when there is only one draft', async () => {
    const s = await open([person()])
    await s.fill()
    await s.save()
    assert.deepEqual(s.gateCalls, [7000])
    says(s.dialog().querySelector('[data-outreach-checks]')!.textContent, 'All 10 checks passed.')
    absent(s.button('Show checks', s.dialog()), 'nothing to expand for one draft')
  })

  it('puts a draft in the approval queue when Submit for approval is pressed, once, and says so', async () => {
    const s = await open()
    await s.fill()
    await s.save()
    const first = s.dialog().querySelector('[data-draft="7000"]')!
    await s.press(s.button('Submit for approval', first), 40)
    assert.deepEqual(s.submitted, [7000])
    assert.equal(first.querySelector('[data-submitted="7000"]')!.textContent, 'Submitted for approval')
    absent(s.button('Submit for approval', first), 'a submitted draft cannot be submitted again')
    assert.ok(s.button('Submit for approval', s.dialog().querySelector('[data-draft="7001"]')!), 'the other draft still can')
  })

  it('says why in words when a draft cannot be submitted, and offers it again', async () => {
    let refuse = true
    const taken: number[] = []
    const s = await open([person()], {}, async (id) => { if (refuse) throw new ApiError('This message needs a recipient with an email address.', 422); taken.push(id) })
    await s.fill()
    await s.save()
    await s.press(s.button('Submit for approval', s.dialog()), 40)
    says(s.dialog().querySelector('[role="alert"]')!.textContent, 'This message needs a recipient with an email address.')
    refuse = false
    await s.press(s.button('Submit for approval', s.dialog()), 40)
    assert.deepEqual(taken, [7000])
    assert.ok(s.dialog().querySelector('[data-submitted="7000"]'))
  })

  it('names, in words, each person the server refused, and counts the drafts that were saved', async () => {
    const s = await open([person(), people()[2]], {
      overrides: { writeMessages: async (body) => ({ status: 1, data: { drafted: 1, refused: 1, results: [
        { person_id: body.person_ids[0], ok: true, message_id: 7100, code: null, message: null },
        { person_id: body.person_ids[1], ok: false, message_id: null, code: 'suppressed', message: 'Their address is on the suppression list.' },
      ] } }) },
    })
    await s.fill()
    await s.save()
    assert.equal(s.dialog().querySelector('[data-draft-summary]')!.textContent, '1 draft saved, 1 could not be written.')
    const refused = s.dialog().querySelector('[data-draft-refused]')!
    says(refused.textContent, 'Could not be written: Their address is on the suppression list.')
    assert.equal(s.dialog().querySelectorAll('[data-draft]').length, 1)
  })

  it('keeps the form, with what was typed, and says why when the server cannot save', async () => {
    const s = await open([person()], { overrides: { writeMessages: async () => { throw new ApiError('The server is busy.', 500) } } })
    await s.fill()
    await s.save()
    says(s.dialog().querySelector('[role="alert"]')!.textContent, 'The server is busy.')
    assert.equal((s.subject() as HTMLInputElement).value, 'About the new campus')
    assert.equal(s.events.saved, 0)
    assert.ok(s.button('Save draft', s.dialog()), 'it can be tried again')
  })
})

describe('Write message: closing and opening', () => {
  afterEach(cleanup)

  it('closes from Cancel and from Close after saving', async () => {
    const s = await open()
    await s.press(s.button('Cancel', s.dialog()))
    assert.deepEqual(s.events.opened, [false])
    await s.fill()
    await s.save()
    await s.press(s.button('Close', s.dialog().querySelector('.flex.justify-end') ?? s.dialog()))
    assert.deepEqual(s.events.opened, [false, false])
  })

  it('starts from an empty form every time it opens', async () => {
    const s = await open()
    await s.fill()
    assert.equal((s.message() as HTMLTextAreaElement).value, BODY)
    await s.render({ open: false })
    absent(s.dialog(), 'it is closed')
    await s.render({ open: true })
    assert.equal((s.subject() as HTMLInputElement).value, '')
    assert.equal((s.message() as HTMLTextAreaElement).value, '')
  })
})
