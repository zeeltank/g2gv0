import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * The Automations and Runs tabs at a phone width (390 px). jsdom has no layout, so this reads the source, the way lib/outreach/mobile-width.test.ts and
 * lib/campaigns/mobile-width.test.ts do. What widened a page in a real browser before: a table, a box with a fixed or minimum width in pixels, a line of
 * nowrap text, a `justify-between` row that cannot wrap, a grid with columns on a narrow screen, and a long name that cannot break. The tabs draw lists, not
 * tables, so there is no column to hide; the test says so and fails if a table is added.
 */

const dir = path.resolve('app/platform-services/workflow/_components/automations')
const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(dir, f))
const read = (file: string) => readFileSync(file, 'utf8')
const lines = (source: string) => source.split(/\r?\n/)
const at = (file: string, index: number, line: string) => `${path.basename(file)}:${index + 1}: ${line.trim().slice(0, 140)}`

function offences(test: (line: string) => boolean): string[] {
  return files.flatMap((file) => lines(read(file)).flatMap((line, i) => (test(line) ? [at(file, i, line)] : [])))
}

describe('the Automations and Runs tabs at a phone width', () => {
  it('finds the files it scans', () => {
    assert.ok(files.length >= 14, `${files.length} files`)
    for (const name of ['automations-tab.tsx', 'runs-tab.tsx', 'automation-row.tsx', 'builder-drawer.tsx', 'run-drawer.tsx', 'recipe-gallery.tsx']) {
      assert.ok(files.some((f) => path.basename(f) === name), name)
    }
  })

  it('draws no table, so there is no column to hide and nothing to overflow sideways', () => {
    assert.deepEqual(offences((l) => /<table\b|<Table\b|<thead\b/.test(l)), [])
    assert.deepEqual(offences((l) => /overflow-x-(auto|scroll)/.test(l)), [], 'no box that scrolls sideways')
  })

  it('has no nowrap text, no truncation and no width or minimum width in pixels', () => {
    assert.deepEqual(offences((l) => /whitespace-nowrap|\btruncate\b|\bw-\[\d|\bmin-w-\[|\bmin-w-[1-9]|\bw-(\d{2,}|[3-9])\b(?!\/)|\bshrink-0\b/.test(l)), [])
  })

  it('lets every row with `justify-between` wrap onto a second line', () => {
    const rows = offences((l) => /\bjustify-between\b/.test(l) && !/\bflex-wrap\b/.test(l))
    assert.deepEqual(rows, [])
    assert.ok(offences((l) => /\bjustify-between\b/.test(l) === false).length > 0)
  })

  it('stacks every grid in one column on a narrow screen, and spreads it from the small breakpoint up', () => {
    const grids = offences((l) => /\bgrid-cols-/.test(l) && !/\bgrid-cols-1\b/.test(l))
    assert.deepEqual(grids, [], 'a grid starts at one column')
    assert.deepEqual(offences((l) => /(?<![:\w-])grid-cols-[2-9]/.test(l)), [], 'no multi-column grid at the base width')
  })

  it('wraps the rows that hold text and controls, and lets the text box shrink next to them', () => {
    const rows = offences((l) => /className="[^"]*\bflex\b[^"]*\bitems-start\b/.test(l) && !/\bflex-wrap\b/.test(l) && !/\bflex-col\b/.test(l))
    // A flex row of an icon and a sentence (a notice) keeps the text in a box that can shrink; those are checked by the next test.
    for (const row of rows) assert.match(row, /gap-2/, row)
    const sources = files.map((f) => read(f)).join('\n')
    assert.match(sources, /min-w-0 flex-1 basis-full space-y-2 sm:basis-0/, 'the sentence of an automation row')
    assert.match(sources, /min-w-0 flex-1 basis-full space-y-1 sm:basis-0/, 'the text of a run row')
  })

  it('lets a long name, sentence, reason or detail break instead of widening the screen', () => {
    const shown = [
      ['automation-row.tsx', '{sentence}'], ['automation-row.tsx', 'Called “{plainWorkflowName(workflow.name)}”'], ['runs-tab.tsx', '{run.workflow_name'], ['runs-tab.tsx', '{reason}'],
      ['recipe-gallery.tsx', '{recipe.title}'], ['recipe-gallery.tsx', '{recipe.sentence}'], ['run-drawer.tsx', '{step.title}'], ['run-drawer.tsx', '{reasonText}'],
      ['builder-parts.tsx', 'messages.join('], ['grouped-picker.tsx', '{option.label}'], ['record-picker.tsx', '{row.label}'], ['try-it-panel.tsx', '{view.headline}'],
      ['try-it-panel.tsx', '{line.text}'], ['status-strip.tsx', '{loading'],
    ] as const
    for (const [name, needle] of shown) {
      const file = files.find((f) => path.basename(f) === name)!
      const found = lines(read(file)).filter((l) => l.includes(needle))
      assert.ok(found.length > 0, `${name} shows ${needle}`)
      for (const line of found) assert.match(line, /\bbreak-words\b/, `${name}: ${line.trim().slice(0, 100)}`)
    }
  })

  it('keeps the drawers as wide as the screen allows and scrolling on their own', () => {
    const drawer = read(path.resolve('components/shared/scaffolds/record-drawer.tsx'))
    assert.match(drawer, /flex w-full flex-col/, 'full width on a phone')
    assert.match(drawer, /overflow-y-auto/)
    assert.deepEqual(offences((l) => /<RecordDrawer\b/.test(l) && /width="(md|lg|xl)"/.test(l) === false && !/open\s*$/.test(l) && /width=/.test(l)), [])
  })

  it('makes every control at least 24 px: no extra-small control, no 20 px switch, no 10 or 11 px text', () => {
    assert.deepEqual(offences((l) => /<Switch\b[^>]*\bsize="sm"/.test(l)), [])
    assert.deepEqual(offences((l) => /\btext-\[(9|10|11)px\]/.test(l)), [])
    assert.deepEqual(offences((l) => /<Button\b[^>]*\bclassName="[^"]*\bsize-[1-5]\b/.test(l)), [])
  })

  it('gives a checkbox or a radio button a label that is itself at least 24 px high, so the whole line is the target', () => {
    for (const file of files) {
      const source = lines(read(file))
      source.forEach((line, i) => {
        if (!/<input\b[^>]*type="(checkbox|radio)"/.test(line)) return
        const label = source.slice(Math.max(0, i - 6), i + 1).reverse().find((l) => /<label\b/.test(l))
        assert.ok(label && /\bmin-h-(6|8)\b/.test(label), at(file, i, line))
      })
    }
  })

  it('draws the list of automations as one column of rows, whatever the width', () => {
    const list = read(files.find((f) => path.basename(f) === 'automations-tab.tsx')!)
    assert.match(list, /<ul aria-label="Automations" className="divide-y/)
  })
})
