import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BADGE_COLORS, PALETTE, contrast } from './palette'

test('every status badge reaches 4.5:1 on both themes', () => {
  for (const theme of ['ink', 'paper'] as const) {
    for (const [name, c] of Object.entries(BADGE_COLORS[theme])) {
      const r = contrast(c.fg, c.bg)
      assert.ok(r >= 4.5, `${theme} ${name} contrast ${r.toFixed(2)}`)
    }
  }
})

test('body and headline text reach 4.5:1 on their own backgrounds', () => {
  assert.ok(contrast(PALETTE.onInk, PALETTE.ink) >= 7)
  assert.ok(contrast(PALETTE.onInkSoft, PALETTE.ink) >= 4.5)
  assert.ok(contrast(PALETTE.textInk, PALETTE.paper) >= 7)
  assert.ok(contrast(PALETTE.textBody, PALETTE.paper) >= 4.5)
})

test('the badge background also stands apart from the scene background', () => {
  assert.ok(contrast(BADGE_COLORS.ink.LIVE.bg, PALETTE.ink) >= 1.1)
  assert.ok(contrast(BADGE_COLORS.paper.LIVE.bg, PALETTE.paper) >= 1.05)
})
