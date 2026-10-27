import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { ResearchContextView } from '../components/domain/signals/research-context-notice'
import type { ResearchContext } from '../services/portfolio/types'

const base = (over: Partial<ResearchContext> = {}): ResearchContext => ({
  product: { key: 'g2g', label: 'G2G', custom: false },
  icp: { source: 'database', profile_id: 7, name: 'G2G ICP', version: 3, regions: ['Gujarat'], saved: true },
  product_fields: [{ field: 'description', saved: true, used_for: 'the product description' }, { field: 'features', saved: false, used_for: 'features and capabilities' }],
  icp_fields: [{ field: 'regions', saved: true, used_for: 'geography' }],
  kept_for_people: [{ field: 'pricing_model', saved: false, used_for: 'pricing model: kept for the sales team' }],
  offer_count: 2, warnings: [], ...over,
})
const html = (d: ResearchContext) => renderToStaticMarkup(createElement(ResearchContextView, { data: d }))

describe('Research context shown before Generate (rendered from the backend report)', () => {
  it('names the product, ICP, version, source, offers and regions', () => {
    const h = html(base())
    assert.match(h, /Will use: G2G/)
    assert.match(h, /G2G ICP/)
    assert.match(h, / v3 /)
    assert.match(h, /\(saved\)/)
    assert.match(h, /2 offers/)
    assert.match(h, /regions: Gujarat/)
  })

  it('says the built-in definition is in use when no ICP is saved, and shows no warning box when there is nothing to warn about', () => {
    const h = html(base({ icp: { source: 'template', profile_id: null, name: 'Built-in', version: null, regions: [], saved: false } }))
    assert.match(h, /built-in definition/)
    assert.match(h, /no region set/)
    assert.doesNotMatch(html(base()), /role="status"/)
  })

  it('shows the missing-field warnings and a link to the product page, and flags unsaved fields', () => {
    const h = html(base({ warnings: ['The ICP does not say a geography: searches will not be limited to a region.'] }))
    assert.match(h, /does not say a geography/)
    assert.match(h, /href="\/portfolio\/g2g\?tab=icp"/)
    assert.match(h, /features and capabilities \(not saved\)/)
  })

  it('states there is no active ICP instead of naming another product\'s', () => {
    const h = html(base({ icp: null, warnings: ['This product has no active ICP, so research cannot start.'] }))
    assert.match(h, /G2G has no active ICP/)
    assert.doesNotMatch(h, /Will use/)
  })

  it('lists the fields research does not use, so nothing is assumed to be sent to a provider', () => {
    const h = html(base())
    assert.match(h, /Kept for your team, not used by research/)
    assert.match(h, /pricing model: kept for the sales team \(not saved\)/)
  })
})
