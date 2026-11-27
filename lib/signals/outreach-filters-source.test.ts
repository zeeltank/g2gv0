import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { FILTER_ALL_LABEL, FILTER_LABEL, FILTER_NOTE } from './outreach-model'

/**
 * What the filter bar (components/domain/signals/outreach/outreach-filter-bar.tsx) and its address hook may NOT contain, read from the source because jsdom draws no layout: no fixed pixel
 * widths, no gradients, no ALL-CAPS labels, no middle-dot or arrow in a sentence, no colour written by hand, no motion of its own, one column on a phone, and the bar placed exactly once on
 * each of the three views. A scan that matches nothing proves nothing, so the last test runs each rule on text it must flag.
 */

const DIR = 'components/domain/signals/outreach'
const read = (file: string) => readFileSync(path.resolve(DIR, file), 'utf8')
const BAR = read('outreach-filter-bar.tsx')
const HOOK = read('use-outreach-filters.ts')

/** The code and the words, without whole-line comments (they explain what is NOT done in the very words searched for). */
function code(source: string): string {
  let inBlock = false
  return source.split(/\r?\n/).filter((line) => {
    const text = line.trim()
    if (inBlock) { if (text.includes('*/')) inBlock = false; return false }
    if (text.startsWith('/*')) { if (!text.includes('*/')) inBlock = true; return false }
    return !text.startsWith('//') && !text.startsWith('*') && !text.startsWith('{/*')
  }).join('\n')
}

const FIXED_PIXELS = /\b(?:min-|max-)?[wh]-\[[^\]]*px\]|\bstyle=\{\{|\bw-\d+px\b/
const GRADIENT = /\b(?:bg-gradient|bg-linear|from-|via-|to-)[\w[]/
const SHOUTING = /\buppercase\b|\btracking-(?:wide|wider|widest)\b|\bsmall-caps\b/
const HAND_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/
const MOTION = /\banimate-|\bduration-\d|\btransition\b/
const DOT_OR_ARROW = /·|→|->|—/

describe('the filter bar and its hook', () => {
  it('reads the files it means to scan', () => {
    assert.ok(code(BAR).length > 500, 'the bar has code')
    assert.ok(code(HOOK).length > 300, 'the hook has code')
  })

  for (const [name, source] of [['outreach-filter-bar.tsx', BAR], ['use-outreach-filters.ts', HOOK]] as const) {
    it(`${name}: sets no fixed pixel width, no inline style, no gradient, no hand-written colour and no motion of its own`, () => {
      const text = code(source)
      assert.equal(FIXED_PIXELS.test(text), false, 'a fixed pixel width or inline style')
      assert.equal(GRADIENT.test(text), false, 'a gradient')
      assert.equal(HAND_COLOUR.test(text), false, 'a colour that is not a design token')
      assert.equal(MOTION.test(text), false, 'motion the bar starts by itself')
    })

    it(`${name}: has no ALL-CAPS styling, and no middle dot, arrow or dash in what it says`, () => {
      const text = code(source)
      assert.equal(SHOUTING.test(text), false)
      assert.equal(DOT_OR_ARROW.test(text.replace(/=>/g, '')), false)
    })
  }

  it('says its words in sentence case: no word of four capitals or more, and each starts with a capital', () => {
    const words = [...Object.values(FILTER_LABEL), ...Object.values(FILTER_ALL_LABEL), FILTER_NOTE, 'Clear filters', 'No companies match these filters.', 'No people match these filters.', 'No messages match these filters.']
    for (const word of words) {
      assert.equal(/\b[A-Z]{4,}\b/.test(word), false, word)
      assert.match(word, /^[A-Z]/, `${word} starts with a capital`)
    }
  })

  it('stacks the four selects in ONE column to begin with and widens to two and four by the width of the bar\'s own box, not by a fixed size', () => {
    const text = code(BAR)
    assert.match(text, /grid grid-cols-1 gap-3 @lg\/filters:grid-cols-2 @3xl\/filters:grid-cols-4/)
    assert.match(text, /@container\/filters/)
    assert.equal(/whitespace-nowrap|\bnowrap\b/.test(text), false, 'nothing is kept from wrapping')
    assert.match(text, /min-w-0/, 'a long option name can shrink instead of widening the column')
  })

  it('names every select, and the group, in words', () => {
    const text = code(BAR)
    assert.match(text, /aria-label=\{FILTER_LABEL\[key\]\}/)
    assert.match(text, /role="group" aria-label="Filter by product, sub-product, ICP and region"/)
    assert.match(text, /aria-describedby=\{noteId\}/)
  })

  it('offers only the four selects and a Clear filters button: nothing that sends, approves or schedules', () => {
    const text = code(BAR)
    assert.equal(/\b(send|approve|schedule|dispatch)/i.test(text), false)
    assert.equal(/\bfetch\s*\(|\bapiClient\b|services\//.test(text.replace(/@\/services\/signals\/outreach-types/g, '')), false, 'the bar reaches no network')
    assert.deepEqual([...text.matchAll(/from '([^']+)'/g)].map((match) => match[1]).sort(), [
      '@/components/ui/button', '@/components/ui/select', '@/lib/signals/outreach-model', '@/services/signals/outreach-types', 'lucide-react', 'react',
    ])
  })

  it('keeps the filters in the address and nowhere else: the hook holds no state of its own and writes the address with replace', () => {
    const text = code(HOOK)
    assert.equal(/\buseState\b|\buseReducer\b|localStorage|sessionStorage/.test(text), false)
    assert.match(text, /router\.replace\(/)
    assert.match(text, /useSearchParams\(\)/)
    assert.equal(/router\.push\(/.test(text), false, 'a filter does not add a step to the Back button')
  })
})

describe('where the bar is placed', () => {
  const place = (file: string) => {
    const text = code(read(file))
    return {
      bars: (text.match(/<OutreachFilterBar\b/g) ?? []).length,
      hooks: (text.match(/\buseOutreachFilters\(\)/g) ?? []).length,
      sends: /filtersKey\(filters\)|filterQuery\(filters\)|outreachQuery\(state, \{\}, filters\)/.test(text),
    }
  }

  it('is on Companies, All people and Messages once each, each reading the address through the same hook', () => {
    for (const file of ['outreach-companies.tsx', 'outreach-people.tsx', 'messages-panel.tsx']) {
      const found = place(file)
      assert.equal(found.bars, 1, `${file} draws the bar once`)
      assert.equal(found.hooks, 1, `${file} reads the filters once`)
      assert.equal(found.sends, true, `${file} sends the filters it reads`)
    }
  })

  it('is NOT on the company page or the person drawer', () => {
    for (const file of ['outreach-company-page.tsx', 'outreach-company-people.tsx', 'outreach-person-panel.tsx']) {
      assert.equal(/OutreachFilterBar|useOutreachFilters/.test(read(file)), false, file)
    }
  })

  it('puts the Messages bar above the status chips, inside the queue', () => {
    const text = read('messages-panel.tsx')
    assert.ok(text.indexOf('<OutreachFilterBar') > 0 && text.indexOf('<OutreachFilterBar') < text.indexOf('aria-label="Show messages that are"'))
  })
})

describe('the scans catch what they are meant to catch', () => {
  it('flags each thing the bar must not contain', () => {
    assert.equal(FIXED_PIXELS.test('className="w-[180px]"'), true)
    assert.equal(FIXED_PIXELS.test('style={{ width: 4 }}'), true)
    assert.equal(GRADIENT.test('className="bg-gradient-to-r from-primary to-accent"'), true)
    assert.equal(SHOUTING.test('className="text-xs uppercase tracking-wider"'), true)
    assert.equal(HAND_COLOUR.test('className="text-[#336699]"'), true)
    assert.equal(MOTION.test('className="animate-pulse"'), true)
    assert.equal(DOT_OR_ARROW.test('Product · Region'), true)
    assert.equal(DOT_OR_ARROW.test('All -> none'), true)
  })

  it('does not flag the classes and words the bar legitimately uses', () => {
    const fine = 'className="grid grid-cols-1 gap-3 @lg/filters:grid-cols-2 min-w-0 space-y-1 text-xs font-medium text-muted-foreground" Not recorded (3)'
    assert.equal(FIXED_PIXELS.test(fine) || GRADIENT.test(fine) || SHOUTING.test(fine) || HAND_COLOUR.test(fine) || MOTION.test(fine) || DOT_OR_ARROW.test(fine), false)
  })
})
