import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CURRENCIES, currencyOf, decimalsOf, defaultCurrencyCode } from './currencies'
import { formatAmount, formatMoney, moneyPrefix } from './format'
import { priceWithTax } from './tax'

/**
 * The money rules of S16 (contract sections 2 and 3). The tax vectors are the SAME twelve that hp_erp's TaxCalculatorTest proves: when the two sides disagree on
 * a paisa, one of the two test files fails. The catalogue is the same twelve currencies in the same order as hp_erp config/currencies.php.
 */

describe('the currency catalogue', () => {
  it('holds the twelve currencies of the contract, in its order, with the contract\'s symbols, digits and countries', () => {
    assert.deepEqual(CURRENCIES.map((c) => [c.code, c.name, c.symbol, c.decimals, c.country]), [
      ['INR', 'Indian Rupee', '₹', 2, 'IN'], ['USD', 'US Dollar', '$', 2, 'US'], ['EUR', 'Euro', '€', 2, 'EU'], ['GBP', 'Pound Sterling', '£', 2, 'GB'],
      ['AED', 'UAE Dirham', 'د.إ', 2, 'AE'], ['SGD', 'Singapore Dollar', 'S$', 2, 'SG'], ['AUD', 'Australian Dollar', 'A$', 2, 'AU'], ['CAD', 'Canadian Dollar', 'C$', 2, 'CA'],
      ['JPY', 'Japanese Yen', '¥', 0, 'JP'], ['CHF', 'Swiss Franc', 'CHF', 2, 'CH'], ['SAR', 'Saudi Riyal', '﷼', 2, 'SA'], ['ZAR', 'South African Rand', 'R', 2, 'ZA'],
    ])
  })

  it('finds a code in any case, and answers null for an empty value and for a legacy one (never a guess)', () => {
    assert.equal(currencyOf('usd')?.code, 'USD')
    assert.equal(currencyOf(' Inr ')?.symbol, '₹')
    for (const legacy of ['Rs', 'XYZ', 'rupees', '', '  ', null, undefined]) assert.equal(currencyOf(legacy), null, String(legacy))
  })

  it('starts a new Sub-product in the organisation\'s default when it is in the list, and in the rupee otherwise', () => {
    assert.equal(defaultCurrencyCode({ defaultCurrency: 'USD' }), 'USD')
    assert.equal(defaultCurrencyCode({ defaultCurrency: 'eur' }), 'EUR')
    for (const meta of [{ defaultCurrency: 'XXX' }, { defaultCurrency: '' }, { defaultCurrency: null }, {}, null, undefined]) assert.equal(defaultCurrencyCode(meta), 'INR')
  })

  it('knows the digits of a code: 0 for the yen, 2 for the others and for a legacy or empty code', () => {
    assert.equal(decimalsOf('JPY'), 0)
    for (const code of ['INR', 'USD', 'Rs', '', null, undefined]) assert.equal(decimalsOf(code), 2, String(code))
  })
})

describe('the tax rule (price + tax extra), proven with the contract\'s vectors', () => {
  const VECTORS: Array<[price: number | string, percent: number, decimals: number, tax: number, total: number]> = [
    [1000, 18, 2, 180, 1180],
    [999.99, 5, 2, 50, 1049.99],
    [0, 18, 2, 0, 0],
    [1500, 0, 2, 0, 1500],
    [1, 12, 2, 0.12, 1.12],
    [0.05, 5, 2, 0, 0.05],
    [0.1, 5, 2, 0.01, 0.11],
    [2499, 28, 2, 699.72, 3198.72],
    [1000, 18, 0, 180, 1180],
    [1050, 5, 0, 53, 1103],
    [19.99, 7.5, 2, 1.5, 21.49],
    [100, 12.5, 2, 12.5, 112.5],
  ]

  for (const [price, percent, decimals, tax, total] of VECTORS) {
    it(`${price} at ${percent}% with ${decimals} digits is tax ${tax} and total ${total}`, () => {
      assert.deepEqual(priceWithTax(price, percent, decimals), { subtotal: Number(price), tax, total })
    })
  }

  it('rounds half up, on the decimal text and not on the binary double (1.005 is 1.01, 0.285 is 0.29)', () => {
    assert.equal(priceWithTax(1.005, 0, 2)?.subtotal, 1.01)
    assert.equal(priceWithTax('0.285', 0, 2)?.subtotal, 0.29)
    assert.equal(priceWithTax('0.284', 0, 2)?.subtotal, 0.28)
    assert.equal(priceWithTax('1234.565', 0, 2)?.subtotal, 1234.57)
  })

  it('takes a text price as exactly as a number, and a text percentage too', () => {
    assert.deepEqual(priceWithTax('999.99', '5', 2), priceWithTax(999.99, 5, 2))
    assert.deepEqual(priceWithTax('  2499 ', '28.000', 2), { subtotal: 2499, tax: 699.72, total: 3198.72 })
  })

  it('treats a null, undefined or empty percentage as no tax', () => {
    for (const percent of [null, undefined, '']) assert.deepEqual(priceWithTax(1000, percent, 2), { subtotal: 1000, tax: 0, total: 1000 })
  })

  it('has no answer for a price that is not a non-negative number (the screen says so instead of inventing a total)', () => {
    for (const bad of [null, undefined, '', '  ', 'abc', '1,500', '-5', -5, Number.NaN, Number.POSITIVE_INFINITY, '1.2.3']) assert.equal(priceWithTax(bad, 18, 2), null, String(bad))
    assert.equal(priceWithTax(100, -5, 2), null, 'a negative rate has no answer either')
    assert.equal(priceWithTax(100, 'x', 2), null)
  })

  it('reads an exponent text and a very small price without losing a digit', () => {
    assert.equal(priceWithTax('1e3', 18, 2)?.total, 1180)
    assert.equal(priceWithTax(0.000001, 18, 2)?.total, 0)
    assert.equal(priceWithTax('0.005', 0, 2)?.subtotal, 0.01)
  })

  it('keeps a large price exact (a product of price and rate never goes through a binary double)', () => {
    assert.deepEqual(priceWithTax('999999999999.99', 18, 2), { subtotal: 999999999999.99, tax: 180000000000, total: 1179999999999.99 })
  })
})

describe('how an amount is written', () => {
  it('puts the symbol in front, with the digits and the grouping of its currency (Indian for the rupee, international for the others)', () => {
    assert.equal(formatMoney(120000, 'INR'), '₹1,20,000.00')
    assert.equal(formatMoney(1500, 'INR'), '₹1,500.00')
    assert.equal(formatMoney(1234567.5, 'USD'), '$1,234,567.50')
    assert.equal(formatMoney(1234567.5, 'EUR'), '€1,234,567.50')
    assert.equal(formatMoney(1500, 'JPY'), '¥1,500')
    assert.equal(formatMoney(12.5, 'SGD'), 'S$12.50')
  })

  it('leaves a space after a symbol that is a word or Arabic script (CHF, R, د.إ), so the two never run together', () => {
    assert.equal(formatMoney(1500, 'CHF'), 'CHF 1,500.00')
    assert.equal(formatMoney(1500, 'ZAR'), 'R 1,500.00')
    assert.equal(formatMoney(1500, 'AED'), 'د.إ 1,500.00')
    assert.equal(moneyPrefix('SAR'), '﷼ ')
  })

  it('reads a code in any case', () => {
    assert.equal(formatMoney(5, 'inr'), '₹5.00')
    assert.equal(formatMoney(5, ' usd '), '$5.00')
  })

  it('writes an unknown (legacy) code as typed, never as a symbol it does not have: "Rs 1,234.00"', () => {
    assert.equal(formatMoney(1234, 'Rs'), 'Rs 1,234.00')
    assert.equal(formatMoney(1234567, 'XYZ'), 'XYZ 1,234,567.00')
  })

  it('writes the number alone when there is no code, and nothing when there is no amount', () => {
    assert.equal(formatMoney(5, null), '5.00')
    assert.equal(formatMoney(5, ''), '5.00')
    assert.equal(formatMoney(5, undefined), '5.00')
    for (const nothing of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(formatMoney(nothing, 'INR'), null, String(nothing))
    assert.equal(formatAmount(null, 'INR'), null)
  })

  it('puts a minus sign in front of the symbol, and never writes a negative zero', () => {
    assert.equal(formatMoney(-1500, 'INR'), '-₹1,500.00')
    assert.equal(formatMoney(-0.001, 'INR'), '₹0.00')
  })

  it('gives the number alone (formatAmount) with the same grouping, for the badge that draws the symbol itself', () => {
    assert.equal(formatAmount(120000, 'INR'), '1,20,000.00')
    assert.equal(formatAmount(120000, 'USD'), '120,000.00')
    assert.equal(formatAmount(120000, 'JPY'), '120,000')
    assert.equal(formatAmount(1.5, null), '1.50')
  })
})
