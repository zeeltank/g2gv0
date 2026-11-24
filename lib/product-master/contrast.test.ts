import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio, token } from '../theme-contrast'
import { chipClass, TEXT_ON_SURFACE } from './tones'

/**
 * The chips, notices and links of the Portfolio pages (lib/product-master/tones.ts) must read at 4.5:1 or better, in the light theme and the dark one.
 *
 * Why this exists: the first version drew the readiness, sold and ICP chips with the shared StatusBadge (`text-success` on `bg-success/10` is 2.03:1,
 * `text-warning` 1.89:1) and the active side of the old Catalogue | Product lines switch as `text-primary` on `bg-primary/10` (4.31:1). The jsdom tests compute no colour; a real
 * browser's axe run found it. The method is the Organisation 360 parts' (lib/org-accounts/contrast.test.ts): ratios come from the REAL theme (app/globals.css)
 * and from the class strings in tones.ts. Tests run from the repository root (`npm test`).
 */

describe('contrast of the Portfolio chips, notices and links', () => {
  for (const { name, classes } of TEXT_ON_SURFACE) {
    for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
      it(`${name} reads at ${MIN}:1 or better in the ${theme} theme`, () => {
        const text = color(`var(${token(classes, 'text')})`, vars)
        const surface = color(`var(${token(classes, 'bg')})`, vars)
        const value = ratio(text, surface)
        assert.ok(value >= MIN, `${name} (${classes}) is ${value.toFixed(2)}:1 in the ${theme} theme`)
      })
    }
  }

  it('gives every tone the readiness and ICP rules use a chip that is one of the checked looks', () => {
    for (const tone of ['success', 'primary', 'pending', 'inactive', 'default'] as const) {
      const classes = chipClass(tone)
      assert.ok(TEXT_ON_SURFACE.some((pair) => classes.endsWith(pair.classes)), `${tone}: ${classes} is checked above`)
    }
  })
})

describe('the retired Products and Services screens leave nothing to scan', () => {
  // Until 23 Nov 2026 a scan here read nine components of the old product-line screens for the patterns that failed in a real browser (a status colour as TEXT,
  // a tint of one as a surface, the shared Badge). They were deleted with the old screens (slice 15, WPD); the same two rules are applied to the live Portfolio
  // files by lib/portfolio/contrast.test.ts and lib/portfolio-list/contrast.test.ts. A file brought back under one of those names would not be scanned by anyone.
  const RETIRED = [
    'product-lines-view.tsx', 'product-line-record-page.tsx', 'product-links-panels.tsx', 'product-line-columns.tsx', 'product-signals-icp-tab.tsx',
    'product-offer-about.tsx', 'product-usage-tab.tsx', 'product-master-parts.tsx', 'product-scope-switch.tsx',
  ]

  it('finds no component of the retired Products and Services screens, so none is left to scan or to import', () => {
    const back = RETIRED.filter((name) => existsSync(path.resolve('components/domain/crm', name)))
    assert.deepEqual(back, [], 'a file of the old product-line screens is back; the Portfolio pages replaced it')
  })
})
