import assert from 'node:assert/strict'
import { test } from 'node:test'

import { PALETTE, contrast } from './palette'

test('body and headline text reach 4.5:1 on their own backgrounds', () => {
  assert.ok(contrast(PALETTE.onInk, PALETTE.ink) >= 7)
  assert.ok(contrast(PALETTE.onInkSoft, PALETTE.ink) >= 4.5)
  assert.ok(contrast(PALETTE.textInk, PALETTE.paper) >= 7)
  assert.ok(contrast(PALETTE.textBody, PALETTE.paper) >= 4.5)
})
