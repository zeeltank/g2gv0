import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { disposeAll } from '../scaffolds/dom-test-kit'
import { screenKit, type Call } from '../leads/screen-kit'
import { ANY_CURRENCY, currencyChoices, currencyPayload, currencyValue } from './tax-rate-currency'

/**
 * The Tax Rates admin has a Currency (S16, 25 Nov 2026; hp_erp contract sections 4 and 6): each rate is tied to one currency of the catalogue (India: GST in INR) or to none
 * ("Any currency", stored as null). The list shows it in a column, the row's select changes it, and the add form chooses it. As a person meets it: the REAL screen and
 * service, only the network replaced. The choice list and the null round trip are also proved on their own, first.
 */

describe('the currency choice of a tax rate', () => {
  it('lists "Any currency" first, then the twelve catalogue currencies with symbol, code and name', () => {
    const choices = currencyChoices(null)
    assert.deepEqual(choices[0], { label: 'Any currency', value: ANY_CURRENCY })
    assert.equal(choices.length, 13)
    assert.deepEqual(choices[1], { label: '₹ INR - Indian Rupee', value: 'INR' })
    assert.ok(choices.some((c) => c.value === 'JPY' && c.label === '¥ JPY - Japanese Yen'))
  })

  it('keeps a stored code that is not in the list as one more choice, as typed and marked (never fixed silently)', () => {
    const choices = currencyChoices('Rs')
    assert.ok(choices.some((c) => c.value === 'Rs' && c.label === 'Rs (not in the list)'))
    assert.equal(choices.length, 14)
    assert.equal(currencyChoices('inr').length, 13, 'a catalogue code in any case is not a legacy value')
  })

  it('holds null as "Any currency" and sends it back as null, and a code as itself in upper case', () => {
    for (const none of [null, undefined, '', '  ']) assert.equal(currencyValue(none), ANY_CURRENCY)
    assert.equal(currencyValue('inr'), 'INR')
    assert.equal(currencyValue('Rs'), 'Rs')
    assert.equal(currencyPayload(ANY_CURRENCY), null)
    assert.equal(currencyPayload('USD'), 'USD')
  })
})

const RATES = [
  { id: '1', name: 'GST 18%', percentage: 18, isDefault: true, isActive: true, currency: 'INR' },
  { id: '2', name: 'VAT 20%', percentage: 20, isDefault: false, isActive: true, currency: null },
  { id: '3', name: 'Old rate', percentage: 5, isDefault: false, isActive: true },
]

async function open(onWrite: (call: Call) => unknown = () => ({ status: 1, message: 'ok', data: {} })) {
  const screen = await screenKit({
    pathname: '/module/crm/settings',
    respond: (call: Call) => {
      if (call.method === 'GET' && call.path.endsWith('/crm/tax-rates/admin')) return { status: 1, message: '', data: RATES }
      if (call.method !== 'GET') return onWrite(call)
      return undefined
    },
  })
  const { CrmTaxRateAdmin } = await import('../../components/domain/crm/crm-tax-rate-admin')
  await screen.mount(screen.k.h(CrmTaxRateAdmin, {}), 60)
  return { ...screen, writes: () => screen.calls.filter((c) => c.method !== 'GET') }
}

type Screen = Awaited<ReturnType<typeof open>>
const trigger = (s: Screen, label: string) => {
  const found = s.k.all('[role="combobox"]').find((c) => c.getAttribute('aria-label') === label)
  assert.ok(found, `the select "${label}" is on the screen`)
  return found
}
/** Waits (up to about 3 seconds, in short steps: a busy machine can be slow) until `ready` is true. A test never depends on one fixed pause. */
async function until(s: Screen, ready: () => boolean) {
  for (let i = 0; i < 120 && !ready(); i++) await s.k.tick(25)
}
/** The list is drawn again (a change reloads it) and the server has been asked `writes` times in all. */
const settled = (s: Screen, writes: number) => () => s.writes().length >= writes && s.k.all('[data-tax-rate-currency]').length === 3 && !s.k.bodyText().includes('Loading tax rates')
async function choose(s: Screen, label: string, optionText: string, writesAfter: number) {
  const opener = trigger(s, label)
  await s.k.click(opener)
  await s.k.tick(10)
  // The options of THIS select only (its list carries the same label as its box): every row has an "Any currency", and a closed list of another row stays on the page.
  const list = s.k.all('[role="listbox"]').filter((el) => el.getAttribute('aria-label') === label).pop()
  assert.ok(list, `the list of "${label}" is open`)
  const option = Array.from(list.querySelectorAll('[role="option"]')).find((o) => o.textContent?.trim() === optionText) as HTMLElement | undefined
  assert.ok(option, `${optionText} is among the choices`)
  // The shared Select commits an option on pointer down, not on click.
  await s.k.act(async () => { option.dispatchEvent(new s.k.w.Event('pointerdown', { bubbles: true, cancelable: true })) })
  await until(s, settled(s, writesAfter))
  await s.k.tick(20)
}

describe('the Tax Rates admin: the Currency of each rate', () => {
  afterEach(async () => { await disposeAll() })

  it('shows each rate\'s currency in its row: the symbol badge and name for a currency, "Any currency" for none or for a server that sends no currency yet', async () => {
    const s = await open()
    const cells = s.k.all('[data-tax-rate-currency]')
    assert.equal(cells.length, 3, 'one per rate')
    assert.equal(cells[0].querySelector('[role="img"]')?.getAttribute('aria-label'), 'Indian Rupee (INR)', 'the badge of the rupee')
    assert.ok(cells[0].textContent!.includes('INR'))
    assert.ok(cells[1].textContent!.includes('Any currency'))
    assert.equal(cells[1].querySelector('[role="img"]'), null, 'no badge for no currency')
    assert.ok(cells[2].textContent!.includes('Any currency'), 'a rate the server sent with no currency field is read as any')
    s.restore()
  })

  it('changes a rate\'s currency with its select: one PUT that carries the code, and "Any currency" carries null', async () => {
    const s = await open()
    await choose(s, 'Currency for VAT 20%', '€ EUR - Euro', 1)
    await choose(s, 'Currency for GST 18%', 'Any currency', 2)
    const puts = s.writes()
    assert.equal(puts.length, 2)
    assert.equal(puts[0].method, 'PUT')
    assert.ok(puts[0].path.endsWith('/crm/tax-rates/2'))
    assert.equal((puts[0].body as { currency: unknown }).currency, 'EUR')
    assert.ok(puts[1].path.endsWith('/crm/tax-rates/1'))
    assert.strictEqual((puts[1].body as { currency: unknown }).currency, null, 'null, not the word "any"')
    assert.equal('percentage' in (puts[0].body as object), false, 'the percentage is never sent: it is fixed once a rate is created')
    s.restore()
  })

  it('says why in a sentence beside the rate when the server refuses the currency', async () => {
    const s = await open(() => ({ __status: 422, status: 0, message: 'Choose a currency from the list.' }))
    await choose(s, 'Currency for VAT 20%', '€ EUR - Euro', 1)
    await until(s, () => s.k.all('li').some((li) => li.textContent!.includes('VAT 20%') && li.querySelector('[role="alert"]') !== null))
    const row = s.k.all('li').find((li) => li.textContent!.includes('VAT 20%'))!
    assert.equal(row.querySelector('[role="alert"]')?.textContent, 'Choose a currency from the list.')
    s.restore()
  })

  it('chooses the currency when adding a rate, "Any currency" by default (sent as null), and a currency as its code', async () => {
    const s = await open()
    await s.k.click(s.k.withText('Add tax rate')!)
    const setValue = (input: HTMLInputElement, value: string) => s.k.act(async () => {
      Object.getOwnPropertyDescriptor(s.k.w.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new s.k.w.Event('input', { bubbles: true }))
    })
    await setValue(s.k.one('input[placeholder^="Name"]') as HTMLInputElement, 'GST 5%')
    await setValue(s.k.one('input[placeholder="Percent"]') as HTMLInputElement, '5')
    assert.ok(trigger(s, 'Currency of the new tax rate').textContent!.includes('Any currency'), 'the default is Any currency')
    await s.k.click(s.k.withText('Add')!)
    await until(s, settled(s, 1))
    const first = s.writes()[0]
    assert.equal(first.method, 'POST')
    assert.deepEqual({ name: (first.body as Record<string, unknown>).name, percentage: (first.body as Record<string, unknown>).percentage, currency: (first.body as Record<string, unknown>).currency }, { name: 'GST 5%', percentage: 5, currency: null })

    await s.k.click(s.k.withText('Add tax rate')!)
    await setValue(s.k.one('input[placeholder^="Name"]') as HTMLInputElement, 'GST 12%')
    await setValue(s.k.one('input[placeholder="Percent"]') as HTMLInputElement, '12')
    await choose(s, 'Currency of the new tax rate', '₹ INR - Indian Rupee', 1)
    await s.k.click(s.k.withText('Add')!)
    await until(s, settled(s, 2))
    assert.equal((s.writes()[1].body as { currency: unknown }).currency, 'INR')
    s.restore()
  })
})
