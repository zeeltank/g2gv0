import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createLatestOnly, listErrorMode, regionSignature, revalidateChoice, showsRunProgress } from './signal-run-view'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10))

describe('Stale responses never overwrite newer results', () => {
  it('only the newest request is accepted', () => {
    const guard = createLatestOnly()
    const slowPage1 = guard.next()
    const fastPage2 = guard.next()
    assert.equal(guard.isLatest(fastPage2), true)
    assert.equal(guard.isLatest(slowPage1), false, 'the slower, earlier answer is dropped')
  })

  it('a change that obsoletes everything drops answers still in flight', () => {
    const guard = createLatestOnly()
    const t = guard.next()
    guard.invalidate()
    assert.equal(guard.isLatest(t), false)
  })

  it('the signal list takes a ticket per load and drops an answer that is not the latest', () => {
    const src = read('components/domain/signals/signal-list.tsx')
    assert.match(src, /const ticket = latest\.current\.next\(\)/)
    assert.match(src, /if \(!latest\.current\.isLatest\(ticket\)\) return/)
    assert.ok((src.match(/isLatest\(ticket\)/g) ?? []).length >= 3, 'the success, the failure and the loading flag are all guarded')
  })
})

describe('A failed refresh keeps the list that was on screen', () => {
  it('shows the error beside an existing list and replaces only an empty screen', () => {
    assert.equal(listErrorMode(null, true), 'none')
    assert.equal(listErrorMode('boom', true), 'beside')
    assert.equal(listErrorMode('boom', false), 'replace')
  })

  it('the list no longer clears its data when a load fails', () => {
    const src = read('components/domain/signals/signal-list.tsx')
    const catchBlock = src.slice(src.indexOf('} catch (e) {\n      if (!latest'), src.indexOf('}, [context, productKey, runDate'))
    assert.match(catchBlock, /setError\(/)
    assert.doesNotMatch(catchBlock, /setData\(null\)/)
    assert.doesNotMatch(catchBlock, /onTotal\?\.\(null\)/)
  })
})

describe('A failed run stays visible', () => {
  it('the progress panel is shown while running and after a followed run failed or was skipped', () => {
    assert.equal(showsRunProgress(true, null), true)
    assert.equal(showsRunProgress(false, { status: 'failed' }), true)
    assert.equal(showsRunProgress(false, { status: 'skipped' }), true)
    assert.equal(showsRunProgress(false, { status: 'success' }), false)
    assert.equal(showsRunProgress(false, { status: 'partial' }), false)
    assert.equal(showsRunProgress(false, null), false)
  })

  it('the screen uses it instead of showing progress only while running', () => {
    const src = read('components/domain/signals/company-opportunities.tsx')
    assert.match(src, /showsRunProgress\(run\.running, run\.activeRun\) && <ResearchProgress/)
    assert.doesNotMatch(src, /\{run\.running && <ResearchProgress/)
  })
})

describe('Changing the places does not restart the run being followed', () => {
  it('the same places are the same signature whatever the array identity or order', () => {
    const a = { country: 'India', state: 'Gujarat', city: null }
    const b = { country: 'India', state: 'Goa' }
    assert.equal(regionSignature([a, b]), regionSignature([{ ...b }, { ...a }]))
    assert.equal(regionSignature([]), regionSignature(null))
    assert.notEqual(regionSignature([a]), regionSignature([b]))
  })

  it('the hook keeps the run effect off the model and the places, and never drops a run it is following', () => {
    const src = read('components/domain/signals/use-generate-signals.ts')
    // the product effect no longer depends on loadStatus (which changes with the model and the places)
    assert.match(src, /\}, \[productKey, offerId, adopt\]\)/)
    assert.doesNotMatch(src, /\[productKey, offerId, loadStatus, follow\]/)
    // another model or other places only re-read the status, and not while a run is in flight
    assert.match(src, /if \(!productKey \|\| inFlight\.current\) return/)
    // reading the status uses its own counter, so it can never end the poll of a run
    assert.match(src, /const seq = \+\+statusSeq\.current/)
    assert.doesNotMatch(src, /const mine = \+\+generation\.current/)
  })

  it('Generate is told the ICP type directly, not through state that lags a render', () => {
    assert.match(read('components/domain/signals/company-opportunities.tsx'), /run\.generate\(c\.list, icpType\)/)
  })
})

describe('A remembered product is checked against the products as they are now', () => {
  const products = [
    { key: 'scholarclone', ready: true, offers: [{ offer_id: 'SCH-11' }] },
    { key: 'enterprise_brain', ready: false, offers: [{ offer_id: 'EB-01' }] },
  ]
  const opts = { allowAll: false, allowSub: true }

  it('a still-valid choice is kept', () => {
    assert.equal(revalidateChoice('enterprise_brain', products, opts), 'enterprise_brain')
    assert.equal(revalidateChoice('enterprise_brain::EB-01', products, opts), 'enterprise_brain::EB-01')
  })

  it('a removed sub-product falls back to its product, a removed product to the screen default', () => {
    assert.equal(revalidateChoice('enterprise_brain::EB-99', products, opts), 'enterprise_brain')
    assert.equal(revalidateChoice('gone_product', products, opts), 'scholarclone')
  })

  it('nothing chosen yet stays nothing', () => {
    assert.equal(revalidateChoice(null, products, opts), null)
  })

  it('the selector re-checks the choice when the products change', () => {
    assert.match(read('components/domain/signals/product-selector.tsx'), /revalidateChoice\(choice, products,/)
  })
})

describe('Results come from the exact run, and a scope change starts the dates over', () => {
  it('the list asks the server for the finished run by id', () => {
    assert.match(read('services/signals/opportunities.ts'), /if \(q\.runId\) params\.run_id = String\(q\.runId\)/)
    assert.match(read('components/domain/signals/signal-list.tsx'), /runId: runId \?\? undefined/)
  })

  it('the screen shows the finished run only until a day is picked, and clears it when the scope changes', () => {
    const src = read('components/domain/signals/company-opportunities.tsx')
    assert.match(src, /runId=\{picked === null \? viewRunId : null\}/)
    assert.match(src, /const pick = \(d: string\) => \{[^}]*setViewRunId\(null\)/)
    assert.match(src, /\}, \[key, offerId, icpType, regionsSig\]\)/)
  })

  it('a date chosen under one sub-product or ICP type is not carried to another', () => {
    assert.match(read('components/domain/signals/company-opportunities.tsx'), /setPicked\(null\); setAllSignals\(false\); setTotal\(null\)(; setManualNotice\(null\))?\s*\n\s*\}, \[offerId, icpType\]\)/)
  })
})
