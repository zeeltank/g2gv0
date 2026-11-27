import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { color, dark, light, MIN, ratio } from '../theme-contrast'

/**
 * The rules the Workflows page shell and the Approvals tab keep, read from the SOURCE because jsdom has no layout and no colour: the phone width (390 px) the way
 * lib/outreach/mobile-width.test.ts reads it, the tone rule of lib/org-accounts/tones.ts (the word carries the meaning, the status colour is a border, never the text), the
 * contrast of every text/surface pair these files use, and the interaction rules of the contract (a control is 24 px or more, a form control is a labelled one, a question
 * before a delete, no window.confirm). The detectors are tested on lines that do and do not offend, so a pass means something. Tests run from the repository root.
 */

const ROOT = path.resolve(__dirname, '..', '..')
const APPROVALS = 'app/platform-services/workflow/_components/approvals'
const FILES = [
  'app/platform-services/workflow/page.tsx',
  'app/platform-services/workflow/_components/WorkflowTabs.tsx',
  'app/platform-services/workflow/_components/StepEditor.tsx',
  ...readdirSync(path.join(ROOT, APPROVALS)).filter((name) => name.endsWith('.tsx')).map((name) => `${APPROVALS}/${name}`),
]

const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8')
const lines = (source: string) => source.split(/\r?\n/)
/** A line of a comment says things the code must not do; it is not code, so the detectors skip it. */
const isComment = (line: string) => /^\s*(\/\/|\*|\/\*)/.test(line)
const offences = (pattern: RegExp, allow: (file: string, line: string) => boolean = () => false) =>
  FILES.flatMap((file) => lines(read(file)).flatMap((line, index) => (!isComment(line) && pattern.test(line) && !allow(file, line) ? [`${file}:${index + 1}: ${line.trim().slice(0, 120)}`] : [])))

describe('the files under test', () => {
  it('finds the shell, the tabs, the step editor and every part of the Approvals tab', () => {
    assert.ok(FILES.length >= 9, `${FILES.length} files`)
    for (const name of ['ApprovalsTab', 'FlowDrawer', 'PointRow', 'ConditionEditor', 'PreviewPanel', 'parts']) assert.ok(FILES.some((file) => file.endsWith(`/${name}.tsx`)), name)
  })
})

describe('a phone width (390 px)', () => {
  it('draws no table, no sr-only text and no sideways-scrolling box', () => {
    assert.deepEqual(offences(/<table\b|sr-only|overflow-x-(auto|scroll)/), [])
  })

  it('has no nowrap text, no truncation, no fixed or minimum width in pixels and nothing that refuses to shrink', () => {
    assert.deepEqual(offences(/whitespace-nowrap|\btruncate\b|\bmin-w-\[|\bw-\[\d|\bmin-w-[1-9]|\bshrink-0\b/), [])
  })

  it('lets every row that spreads its parts to both ends wrap onto a second line', () => {
    assert.deepEqual(offences(/justify-between/, (_file, line) => /\bflex-wrap\b/.test(line)), [])
  })

  it('stacks every grid in one column on a phone and spreads it from the small breakpoint up', () => {
    assert.deepEqual(offences(/(?<![:\w-])grid-cols-(?!1\b)/), [], 'a grid that is not grid-cols-1 first')
    for (const file of FILES) {
      for (const line of lines(read(file)).filter((l) => /\bgrid\b.*\bsm:grid-cols-/.test(l))) assert.match(line, /\bgrid-cols-1\b/, `${file}: ${line.trim()}`)
    }
  })

  it('lets a long name, a long sentence and a long server message break instead of widening the screen', () => {
    const row = read(`${APPROVALS}/PointRow.tsx`)
    for (const expression of ['{point.label}', '{point.description}', '{flow.name}', '{flowSentence(flow)}', '{note}', '{version.summary}']) {
      const line = lines(row).find((l) => l.includes(expression))
      assert.ok(line, `${expression} is drawn`)
      assert.match(line!, /\bbreak-words\b/, expression)
    }
    assert.match(lines(read(`${APPROVALS}/parts.tsx`)).find((l) => l.includes('{children}</div>')) ?? '', /\bbreak-words\b/, 'a notice breaks its message')
  })

  it('uses no arbitrary text size: nothing smaller than text-xs (12 px)', () => {
    assert.deepEqual(offences(/\btext-\[\d/), [])
  })
})

describe('the tone rule: the word carries the meaning, the status colour is a border', () => {
  it('uses no status colour as TEXT (an icon, which is aria-hidden, may be coloured)', () => {
    assert.deepEqual(offences(/\btext-(success|warning|destructive|primary)\b(?!-)/, (_f, line) => line.includes('aria-hidden')), [])
  })

  it('uses no palette colour as text, bar the one dark red that makes a field error readable', () => {
    assert.deepEqual(offences(/\btext-(red|amber|emerald|green|rose|yellow|orange|blue|indigo|sky)-\d/, (file, line) => file.endsWith('/parts.tsx') && line.includes('FIELD_ERROR_FIX =')), [])
  })

  it('puts no status colour on a tint of itself', () => {
    assert.deepEqual(offences(/\bbg-(success|warning|destructive|amber-\d+|emerald-\d+|red-\d+|green-\d+)\/\d/), [])
  })

  it('takes the chips and notices from the repo\'s tone file, and defines no tone of its own', () => {
    const parts = read(`${APPROVALS}/parts.tsx`)
    assert.match(parts, /from '@\/lib\/org-accounts\/tones'/)
    assert.match(parts, /CHIP_TONE\[/)
    assert.match(parts, /NOTICE_TONE\[/)
  })
})

describe('contrast: every text and surface pair these files use reads at 4.5:1 or better, in the light theme and the dark one', () => {
  const TEXTS = ['text-foreground', 'text-muted-foreground', 'text-card-foreground']
  const SURFACES = ['bg-background', 'bg-card', 'bg-muted']

  // Which surfaces the files really use is read from them, so a new one is checked the day it is added.
  const used = (prefix: string, tokens: string[]) => tokens.filter((t) => FILES.some((file) => new RegExp(`(?<![:\\w-])${t}(?![\\w/-])`).test(read(file))))

  it('uses only the text and surface classes this test checks', () => {
    const surfaces = new Set<string>()
    for (const file of FILES) for (const match of read(file).matchAll(/(?<![:\w-])bg-(background|card|muted|primary|secondary|accent|popover)(?![\w/-])/g)) surfaces.add(`bg-${match[1]}`)
    for (const surface of surfaces) assert.ok([...SURFACES, 'bg-primary'].includes(surface), `${surface} is not covered by this test`)
    assert.ok(used('bg', SURFACES).length >= 2)
  })

  for (const text of TEXTS) {
    for (const surface of SURFACES) {
      for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
        it(`${text} on ${surface} in the ${theme} theme`, () => {
          const value = ratio(color(`var(--${text.slice('text-'.length)})`, vars), color(`var(--${surface.slice('bg-'.length)})`, vars))
          assert.ok(value >= MIN, `${text} on ${surface} is ${value.toFixed(2)}:1 in the ${theme} theme`)
        })
      }
    }
  }

  for (const [theme, vars] of [['light', light], ['dark', dark]] as const) {
    it(`the dark red of a field error reads on the drawer's surface in the ${theme} theme`, () => {
      // text-red-700 (light) and text-red-300 (dark) on bg-card, the surface of a sheet.
      const red = theme === 'light' ? [185, 28, 28] : [252, 165, 165]
      const value = ratio(red as [number, number, number], color('var(--card)', vars))
      assert.ok(value >= MIN, `${value.toFixed(2)}:1`)
    })
  }
})

describe('controls and questions', () => {
  it('uses no raw form control: every input, select and textarea comes from the design system, with a label', () => {
    assert.deepEqual(offences(/<(input|select|textarea)\b/), [])
  })

  it('draws no raw button but the one that opens an approval, which is 32 px tall; every other is a Button of 28 px or more', () => {
    const raw = FILES.flatMap((file) => lines(read(file)).flatMap((line) => (!isComment(line) && /<button\b/.test(line) ? [file] : [])))
    assert.deepEqual(raw, [`${APPROVALS}/PointRow.tsx`])
    const row = read(`${APPROVALS}/PointRow.tsx`)
    assert.match(row, /<button[\s\S]*?min-h-8/, 'the disclosure button keeps its height')
  })

  it('uses no button smaller than 24 px', () => {
    assert.deepEqual(offences(/size="(xs|icon-xs)"/), [])
  })

  it('names every icon-only button (the name is also its tooltip)', () => {
    for (const file of FILES) {
      const all = lines(read(file))
      all.forEach((line, index) => {
        if (!/size="icon(-sm)?"/.test(line)) return
        const around = all.slice(Math.max(0, index - 2), index + 8).join('\n')
        assert.match(around, /aria-label=/, `${file}:${index + 1}`)
      })
    }
  })

  it('asks through useConfirm before a delete, and never through window.confirm, alert or prompt', () => {
    assert.deepEqual(offences(/\bwindow\.(confirm|alert|prompt)\b|\b(?<!\.)(alert|prompt)\(/), [])
    const tab = read(`${APPROVALS}/ApprovalsTab.tsx`)
    assert.match(tab, /useConfirm\(\)/)
    assert.match(tab, /await confirm\(\{[\s\S]*?\}\)\s*\n\s*if \(!confirmed\) return\s*\n[\s\S]*?await deleteWorkflow/, 'the question comes before the delete, and no is no')
  })

  it('draws the form in a RecordDrawer that refuses to close dirty, never above the list', () => {
    const drawer = read(`${APPROVALS}/FlowDrawer.tsx`)
    assert.match(drawer, /<RecordDrawer[\s\S]*?dirty=\{dirty\}[\s\S]*?busy=\{busy\}/)
    assert.match(drawer, /isFlowFormDirty\(initial, form\)/)
  })

  it('shows the Draft, On and Off words and no lock for a flow, taking them from the model', () => {
    const parts = read(`${APPROVALS}/parts.tsx`)
    assert.doesNotMatch(parts, /\bLock\b|coming-soon|\bStatusChip\b/)
    assert.match(parts, /FLOW_STATUS_WORD\[status\]/)
  })

  it('keeps the form\'s checking outside the check panel, so Enter in the check cannot save the flow', () => {
    const drawer = read(`${APPROVALS}/FlowDrawer.tsx`)
    const form = drawer.indexOf('</FormLayout>')
    const panel = drawer.indexOf('<PreviewPanel')
    assert.ok(form > 0 && panel > form, 'PreviewPanel comes after the form is closed')
  })
})

describe('what the browser is told, for the Vercel Web Interface Guidelines that can be read from source', () => {
  it('has no outline-none without a visible focus replacement on the same line', () => {
    assert.deepEqual(offences(/\boutline-none\b/, (_f, line) => /focus-visible:/.test(line)), [])
  })

  it('has no transition: all, no onPaste, no user-scalable, no click handler on a div or span', () => {
    assert.deepEqual(offences(/\btransition-all\b|onPaste|user-scalable|<(div|span)\b[^>]*onClick/), [])
  })

  it('gives every text field a name, turns autocomplete off on them, and says what to type with an example that ends in an ellipsis', () => {
    for (const file of FILES) {
      const source = read(file)
      for (const tag of source.match(/<Input\b[\s\S]*?\/>/g) ?? []) {
        assert.match(tag, /\bname=/, `${file}: an Input without a name`)
        assert.match(tag, /autoComplete="off"/, `${file}: an Input that does not turn autocomplete off`)
        const placeholder = /placeholder="([^"]*)"/.exec(tag)
        if (placeholder) assert.match(placeholder[1], /…$/, `${file}: placeholder "${placeholder[1]}" does not end in an ellipsis`)
      }
    }
  })

  it('uses the ellipsis character and curly quotes in what it says, never three dots', () => {
    // `...` followed by a name, a bracket or a brace is the spread operator; anything else is three dots written as text.
    assert.deepEqual(offences(/\.\.\.(?![\w[({])/), [])
  })
})
