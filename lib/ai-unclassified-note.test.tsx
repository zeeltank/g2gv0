import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AiUnclassifiedNote } from '@/components/domain/signals/ai-unclassified-note'

describe('the note on an AI-delivered signal that has no ICP type', () => {
  it('tells a person where to find it', () => {
    const html = renderToStaticMarkup(<AiUnclassifiedNote signal={{ ai_source: 'claude', customer_model: null }} />)
    assert.match(html, /ICP type not stated/)
    assert.match(html, /All ICP types/)
    assert.match(html, /data-testid="ai-unclassified"/)
  })

  it('is absent when the signal has an ICP type, or did not come from an AI source', () => {
    assert.equal(renderToStaticMarkup(<AiUnclassifiedNote signal={{ ai_source: 'gemini', customer_model: 'b2g' }} />), '')
    assert.equal(renderToStaticMarkup(<AiUnclassifiedNote signal={{ ai_source: null, customer_model: null }} />), '')
    assert.equal(renderToStaticMarkup(<AiUnclassifiedNote signal={{ customer_model: null }} />), '')
  })
})
