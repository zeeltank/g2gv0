import assert from 'node:assert/strict'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Responder } from '../facts/screen-kit'
import { gateAnswer, wireChecks } from '../outreach/fixtures'
import type { GateApi } from '../../services/outreach/gate-service'
import type { OutreachApi } from '../../services/signals/outreach'
import { fakeOutreachService } from './outreach-fake-service'

/**
 * A whole Outreach screen in a fake browser, for the tests of the Outreach tab: the real components, a router that keeps the address (so `?view=`, `?person=` and the pushes of a row click
 * can be read back), a signed-in session, the Outreach API as a fake that records every call (lib/signals/outreach-fake-service.ts), and `fetch` replaced by a small answer for the
 * one call the screens make outside that API: the list of people an owner can be chosen from (the CRM leads screen's own). The checks of a draft and the approval queue are fakes too, so
 * a test can see that the dialog asked for them and that nothing else was reached. Import from inside the test, after the DOM kit.
 */

export const EMPLOYEES = [{ id: 5, first_name: 'Asha', last_name: 'Rao' }, { id: 6, first_name: 'Vikram', last_name: 'Nair' }]

const live: Array<{ restore: () => void }> = []

/** Closes everything a test mounted and puts `fetch` back. Call it in `afterEach`. */
export async function cleanup() {
  await disposeAll()
  for (const screen of live.splice(0)) screen.restore()
}

/** `respond` answers the calls the screens make outside the Outreach API (the Messages queue reads the GTM API): a test that mounts the real queue gives it the answers. */
export async function outreachKit(options: { search?: string; pathname?: string; overrides?: Partial<OutreachApi>; respond?: Responder } = {}) {
  const screen = await screenKit({
    search: options.search ?? '',
    pathname: options.pathname ?? '/signals/outreach',
    respond: (call) => (call.path.endsWith('/table_data') ? EMPLOYEES : options.respond?.(call)),
  })
  live.push(screen)
  const { k } = screen
  const fake = fakeOutreachService(options.overrides)

  const gateCalls: number[] = []
  const submitted: number[] = []
  const gate: GateApi = {
    checks: async (_table, id) => { gateCalls.push(id); return gateAnswer(wireChecks(), { id }) },
    approvedClaims: async () => ({ status: 1, data: { claims: [], total: 0 } }),
  }
  const submit = async (messageId: number) => { submitted.push(messageId); return { status: 1 } }
  const messageDeps = { gate, submit }

  const mount = (element: ReturnType<typeof k.h>, settle = 40) => screen.mount(element, settle)
  const settle = (ms = 30) => k.tick(ms)
  const press = async (target: Element | null | undefined, wait = 25) => {
    assert.ok(target, 'the control to press exists')
    await k.click(target)
    await k.tick(wait)
  }

  /** Types into a box the way a person does, so React's onChange runs. */
  const type = async (field: Element | null | undefined, text: string) => {
    assert.ok(field, 'the box to type in exists')
    const proto = field.tagName === 'TEXTAREA' ? k.w.HTMLTextAreaElement.prototype : k.w.HTMLInputElement.prototype
    const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
    await k.act(async () => { set.call(field, text); field.dispatchEvent(new k.w.Event('input', { bubbles: true })) })
  }

  const rowOf = (text: string) => k.all('tbody tr').find((row) => row.textContent?.includes(text)) ?? null
  const chip = (label: string) => k.all('[role="group"][aria-label="Show"] button').find((button) => button.textContent?.startsWith(label)) as HTMLButtonElement | undefined
  const button = (label: string, within: ParentNode = k.w.document) => Array.from(within.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
  /** The dialog on top: a dialog opened from the person's drawer sits above the drawer, which is itself a dialog. */
  const dialog = () => k.all('[role="dialog"]').pop() ?? null
  const confirmDialog = () => k.all('[role="alertdialog"]').pop() ?? null
  const field = (label: string, within: ParentNode = k.w.document) => {
    const text = Array.from(within.querySelectorAll('label')).find((l) => l.textContent?.replace(/\s*\*$/, '').trim() === label)
    return (text?.htmlFor ? k.w.document.getElementById(text.htmlFor) : null) as HTMLInputElement | HTMLTextAreaElement | null
  }
  /** Opens a searchable drop-down by its name and chooses one option. */
  const choose = async (name: string, option: string) => {
    await press(k.one(`[role="combobox"][aria-label="${name}"]`))
    await press(k.all('[role="option"]').find((o) => o.textContent?.includes(option)))
  }
  /** The four filters' selects are the shared Select: it commits an option on pointer down, not on click. Opens the list of one by its name and chooses an option by its words. */
  const pick = async (name: string, optionText: string) => {
    await press(k.one(`[role="combobox"][aria-label="${name}"]`))
    const list = k.all('[role="listbox"]').filter((el) => el.getAttribute('aria-label') === name).pop()
    assert.ok(list, `the list of ${name} is open`)
    const option = Array.from(list.querySelectorAll('[role="option"]')).find((o) => o.textContent?.trim() === optionText) as HTMLElement | undefined
    assert.ok(option, `${optionText} is among the choices of ${name}: ${Array.from(list.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim()).join(' | ')}`)
    await k.act(async () => { option.dispatchEvent(new k.w.Event('pointerdown', { bubbles: true, cancelable: true })) })
    // The closed list stays in the page for 150 ms (its fade); wait it out so a later reading of the page does not see options that are no longer offered.
    await k.tick(200)
  }
  /** What a filter's select shows as its choice. */
  const shown = (name: string) => k.one(`[role="combobox"][aria-label="${name}"]`)?.textContent?.trim() ?? null
  /** The words of every option a filter's select offers, read by opening it and closing it again. */
  const optionsOf = async (name: string) => {
    await press(k.one(`[role="combobox"][aria-label="${name}"]`))
    const list = k.all('[role="listbox"]').filter((el) => el.getAttribute('aria-label') === name).pop()
    assert.ok(list, `the list of ${name} is open`)
    const words = Array.from(list.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim() ?? '')
    await k.press('Escape', k.one(`[role="combobox"][aria-label="${name}"]`)!)
    await k.tick(200)
    return words
  }
  const openMenu = async (name = 'More actions') => {
    const trigger = k.one(`button[aria-label="${name}"]`)
    assert.ok(trigger, 'the menu button exists')
    await k.act(async () => { trigger.dispatchEvent(new k.w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ctrlKey: false })) })
    await k.tick(15)
  }
  const menuItem = (text: string) => k.all('[role="menuitem"]').find((item) => item.textContent?.trim() === text)

  return { ...screen, fake, calls: fake.calls, service: fake.service, gate, gateCalls, submit, submitted, messageDeps, mount, settle, press, type, rowOf, chip, button, dialog, confirmDialog, field, choose, pick, shown, optionsOf, openMenu, menuItem }
}
