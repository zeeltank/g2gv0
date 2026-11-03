import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  checkPrices, currencySymbol, describeRates, formatPerMillion, normaliseCurrency, per1kToPerMillion, perMillionToPer1k, rowCurrency, toRequestNumber,
} from './model-price'

const per1k = (typed: string) => perMillionToPer1k(typed).per1k ?? null
const error = (typed: string) => perMillionToPer1k(typed).error

describe('per million to per 1,000 (what is typed to what is sent)', () => {
  it('moves the decimal point three places, so 28.8 per million is exactly 0.0288', () => {
    assert.equal(per1k('28.8'), '0.0288')
    assert.equal(per1k('115.2'), '0.1152')
    assert.equal(per1k('1000'), '1')
    assert.equal(per1k('0.001'), '0.000001')
    assert.equal(per1k('1234.567'), '1.234567')
  })

  it('sends 0.0288 and 0.1152 as numbers, the default price the developer company sets', () => {
    assert.equal(toRequestNumber(per1k('28.8')), 0.0288)
    assert.equal(toRequestNumber(per1k('115.2')), 0.1152)
    assert.equal(toRequestNumber(null), null)
  })

  it('does it on the digits, because dividing or multiplying by a thousand in floating point is wrong in the last place', () => {
    assert.notEqual(0.03 / 1000, 0.00003, 'the trap going out')
    assert.equal(per1k('0.03'), '0.00003')
    assert.equal(toRequestNumber(per1k('0.03')), 0.00003)

    assert.notEqual(0.00003 * 1000, 0.03, 'the trap coming back')
    assert.equal(per1kToPerMillion(0.00003), '0.03')
    assert.equal(per1kToPerMillion(0.1152), '115.2')
  })

  it('keeps a real zero as zero: a free model is a price', () => {
    assert.equal(per1k('0'), '0')
    assert.equal(per1k('0.0'), '0')
    assert.equal(per1k('0.000'), '0')
    assert.equal(toRequestNumber('0'), 0)
  })

  it('keeps a blank as unknown (null), never as zero', () => {
    assert.equal(per1k(''), null)
    assert.equal(per1k('   '), null)
    assert.equal(perMillionToPer1k('').error, undefined)
    assert.equal(toRequestNumber(per1k('')), null)
  })

  it('ignores zeros that do not change the value', () => {
    assert.equal(per1k('28.8000'), '0.0288')
    assert.equal(per1k('007.5'), '0.0075')
    assert.equal(per1k(' 28.8 '), '0.0288')
    assert.equal(per1k('.5'), '0.0005')
    assert.equal(per1k('5.'), '0.005')
  })

  it('refuses more than three decimals per million, which is more than six per 1,000 tokens', () => {
    assert.match(error('0.0001')!, /at most 3 decimal places/)
    assert.match(error('28.8001')!, /at most 3 decimal places/)
    assert.equal(error('28.123'), undefined, 'three is the stored six')
  })

  it('refuses a negative price, a price that is not a plain number, and one too large for the stored rate', () => {
    assert.equal(error('-1'), 'A price cannot be negative.')
    assert.equal(error('-0.5'), 'A price cannot be negative.')
    for (const text of ['abc', '1e3', '1,150', '12.3.4', '₹28', '28 .8', '.', '+5', 'Infinity']) {
      assert.match(error(text)!, /Enter a number/, text)
    }
    assert.equal(error('1000000000'), 'That price is too large.')
    assert.equal(per1k('999999999.999'), '999999.999999', 'the largest the column holds')
  })
})

describe('per 1,000 to per million (what is stored to what is shown)', () => {
  it('shows what was entered: 0.0288 is 28.8 and 0.1152 is 115.2', () => {
    assert.equal(per1kToPerMillion(0.0288), '28.8')
    assert.equal(per1kToPerMillion(0.1152), '115.2')
    assert.equal(per1kToPerMillion(0.000001), '0.001')
    assert.equal(per1kToPerMillion(123456.123456), '123456123.456')
  })

  it('reads a DECIMAL sent as text', () => {
    assert.equal(per1kToPerMillion('0.028800'), '28.8')
    assert.equal(per1kToPerMillion('1.000000'), '1000')
  })

  it('shows a stored zero as 0, and an unknown price as an empty box', () => {
    assert.equal(per1kToPerMillion(0), '0')
    assert.equal(per1kToPerMillion(null), '')
    assert.equal(per1kToPerMillion(undefined), '')
    assert.equal(per1kToPerMillion(''), '')
    assert.equal(per1kToPerMillion('n/a'), '')
    assert.equal(per1kToPerMillion(-1), '')
    assert.equal(per1kToPerMillion(Number.NaN), '')
  })

  it('goes there and back to the same price for every price with up to three decimals', () => {
    for (let thousandths = 0; thousandths <= 30_000; thousandths += 1) {
      const typed = (thousandths / 1000).toFixed(3).replace(/\.?0+$/, '') || '0'
      const sent = per1k(typed)
      assert.notEqual(sent, null, typed)
      assert.equal(per1kToPerMillion(toRequestNumber(sent)), typed, typed)
    }
  })
})

describe('both prices or neither', () => {
  it('accepts two prices, and two blanks (unknown)', () => {
    assert.deepEqual(checkPrices('28.8', '115.2'), { input: '0.0288', output: '0.1152', errors: {} })
    assert.deepEqual(checkPrices('', ''), { input: null, output: null, errors: {} })
    assert.deepEqual(checkPrices('0', '0').errors, {})
  })

  it('asks for the output price when only the input price is there, under the output field', () => {
    const check = checkPrices('28.8', '')
    assert.deepEqual(Object.keys(check.errors), ['output_cost_per_1k'])
    assert.match(check.errors.output_cost_per_1k![0], /leave both blank/)
  })

  it('asks for the input price when only the output price is there, under the input field', () => {
    const check = checkPrices('', '115.2')
    assert.deepEqual(Object.keys(check.errors), ['input_cost_per_1k'])
  })

  it('does not take a zero for a blank: a zero price with a blank one is still half a rate', () => {
    assert.deepEqual(Object.keys(checkPrices('0', '').errors), ['output_cost_per_1k'])
  })

  it('puts each problem under the price it belongs to and does not add a second complaint to a price that is already wrong', () => {
    const check = checkPrices('-1', 'abc')
    assert.deepEqual(Object.keys(check.errors).sort(), ['input_cost_per_1k', 'output_cost_per_1k'])
    assert.equal(check.errors.input_cost_per_1k![0], 'A price cannot be negative.')
    assert.match(check.errors.output_cost_per_1k![0], /Enter a number/)

    const oneWrong = checkPrices('28.8001', '')
    assert.deepEqual(Object.keys(oneWrong.errors), ['input_cost_per_1k'], 'the blank output is not also flagged')
  })
})

describe('how a price is written', () => {
  it('writes the symbol first and at least two decimals, keeping every typed decimal', () => {
    assert.equal(formatPerMillion('28.8', 'INR'), '₹28.80')
    assert.equal(formatPerMillion('115.2', 'INR'), '₹115.20')
    assert.equal(formatPerMillion('28.125', 'INR'), '₹28.125')
    assert.equal(formatPerMillion('1150', 'USD'), '$1150.00')
    assert.equal(formatPerMillion('0.3', 'USD'), '$0.30')
    assert.equal(formatPerMillion('12', 'EUR'), 'EUR 12.00', 'a currency with no symbol of its own is written as its code')
    assert.equal(formatPerMillion('', 'INR'), '')
  })

  it('describes a full rate in the row\'s own currency, and a half rate as nothing', () => {
    assert.equal(describeRates({ input_cost_per_1k: 0.0288, output_cost_per_1k: 0.1152, currency: 'INR' }), '₹28.80 / ₹115.20')
    assert.equal(describeRates({ input_cost_per_1k: 0.0003, output_cost_per_1k: 0.0012, currency: 'USD' }), '$0.30 / $1.20')
    assert.equal(describeRates({ input_cost_per_1k: 0.0288, output_cost_per_1k: null, currency: 'INR' }), null)
    assert.equal(describeRates({ input_cost_per_1k: null, output_cost_per_1k: null, currency: 'INR' }), null)
  })

  it('reads a row with no currency as dollars, because that is what an older server\'s rates were', () => {
    assert.equal(rowCurrency({}), 'USD')
    assert.equal(rowCurrency({ currency: null }), 'USD')
    assert.equal(rowCurrency({ currency: ' inr ' }), 'INR')
    assert.equal(describeRates({ input_cost_per_1k: 0.0003, output_cost_per_1k: 0.0012 }), '$0.30 / $1.20')
  })

  it('has a symbol for rupees and dollars and uses the code for the rest', () => {
    assert.equal(currencySymbol('INR'), '₹')
    assert.equal(currencySymbol('USD'), '$')
    assert.equal(currencySymbol('EUR'), 'EUR')
    assert.equal(normaliseCurrency(' usd '), 'USD')
    assert.equal(normaliseCurrency(''), null)
    assert.equal(normaliseCurrency(5), null)
  })
})
