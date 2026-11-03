import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio } from '../theme-contrast'

/**
 * The tabs of the shared PageTabs scaffold (the Organizations scopes, the Contacts "Suggestions" tab and others) must read at 4.5:1 on the page in both themes.
 *
 * Found in a real browser (axe, 4 Nov 2026): the selected tab was `text-primary`, which is 4.32:1 on the dark page. The jsdom tests compute no colour, so this
 * reads the two class strings out of the component and measures them with the REAL theme (app/globals.css), the way lib/org-accounts/contrast.test.ts does.
 */

const source = readFileSync(path.resolve('components/shared/scaffolds/page-tabs.tsx'), 'utf8')
const match = source.match(/selected \? '([^']+)' : '([^']+)'/)

describe('PageTabs colours', () => {
  it('has a selected and an idle class string to measure', () => {
    assert.ok(match, 'the ternary `selected ? \'...\' : \'...\'` is still in page-tabs.tsx')
  })

  for (const [index, label] of [[1, 'selected'], [2, 'idle']] as const) {
    for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
      it(`the ${label} tab reads at ${MIN}:1 or better on the page in the ${theme} theme`, () => {
        const classes = (match as RegExpMatchArray)[index]
        const text = classes.split(/\s+/).find((c) => c.startsWith('text-') && !c.startsWith('text-sm') && !c.startsWith('text-xs'))
        assert.ok(text, `${label}: ${classes} names a text colour`)
        const value = ratio(color(`var(--${text.slice('text-'.length)})`, vars), color(vars['--background'], vars))
        assert.ok(value >= MIN, `${label} tab (${text}) is ${value.toFixed(2)}:1 in the ${theme} theme`)
      })
    }
  }
})
