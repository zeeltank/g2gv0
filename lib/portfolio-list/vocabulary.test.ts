import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * The owner's words (13 Nov 2026): "same as product portfolio: product and sub product". Product and Sub-product are the only names on screen; a service is a Sub-product of
 * type Service. The words Catalogue, Offer, Item and Product line are retired from screens (slice 15, track P3-A; a scan test enforces it on the files of this track).
 *
 * The whole-screen tests also read the rendered text of every state and menu for the same words. This scan reads the SOURCE of every file this track ships: it looks only at what a
 * person could read (string literals and the text between tags), never at identifiers or comments, so `itemType` and `items.map` are not offences. A bare lowercase word
 * (`'item'`, `'catalogue'`) is an API value (the record kind, the name the merge keeps), never a label, and a label is never written that way.
 */

const FILES = [
  'app/portfolio/page.tsx',
  'app/module/crm/sales/products/page.tsx', 'app/module/crm/sales/services/page.tsx', 'app/module/crm/sales/products/[id]/page.tsx', 'app/module/crm/sales/services/[id]/page.tsx',
  'app/module/crm/sales/products/lines/[id]/page.tsx',
  'components/domain/portfolio/portfolio-list.tsx', 'components/domain/portfolio/portfolio-list-table.tsx', 'components/domain/portfolio/portfolio-list-toolbar.tsx',
  'components/domain/portfolio/portfolio-list-chips.tsx', 'components/domain/portfolio/portfolio-more-menu.tsx', 'components/domain/portfolio/portfolio-matches.tsx',
  'components/domain/portfolio/portfolio-redirect.tsx',
  'lib/portfolio-list/model.ts', 'lib/portfolio-list/query.ts', 'lib/portfolio-list/import-template.ts', 'lib/portfolio-list/tones.ts', 'lib/portfolio-redirect.ts', 'lib/signals-nav.ts',
]

// A word is the word only when it is not part of a longer or hyphenated one: `items-center` (a class name) and `itemType` (an identifier) are not offences.
const FORBIDDEN = /(?<![\w-])(catalogues?|catalogs?|offers?|items?|product[ -]lines?)(?![\w-])/i

/** Source with the comments taken out (block comments, whole-line comments and trailing ones after whitespace; a `//` inside a string, like a URL, is kept). */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => (/^\s*\/\//.test(line) ? '' : line.replace(/(^|[\s;,{(])\/\/[^'"`]*$/, '$1')))
    .join('\n')
}

/** What a person could read in a piece of source: string literals and the text between tags. */
export function readableText(source: string): string[] {
  const code = withoutComments(source)
  const out: string[] = []
  for (const m of code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) out.push((m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ' ')) // a `${expression}` inside a template is code, not text
  for (const m of code.matchAll(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g)) out.push(m[1])
  // Text on a line of its own inside a tag (a long paragraph wrapped over lines).
  for (const m of code.matchAll(/^\s*([A-Z][^<>{}=;]*[a-z.,])\s*$/gm)) out.push(m[1])
  return out
}

/** The readable pieces that name a retired word, as "file: piece". */
function offences(file: string, source: string): string[] {
  return readableText(source)
    .filter((text) => FORBIDDEN.test(text) && !/^[a-z]+$/.test(text))
    .map((text) => `${file}: ${text.slice(0, 120)}`)
}

describe('the files of this track say Product and Sub-product, never Catalogue, Offer, Item or Product line', () => {
  it('finds none in what a person could read, in any file', () => {
    const found = FILES.flatMap((file) => offences(file, readFileSync(path.resolve(file), 'utf8')))
    assert.deepEqual(found, [], 'a retired word is on a screen')
  })

  it('reads every file it lists', () => {
    for (const file of FILES) assert.ok(readFileSync(path.resolve(file), 'utf8').length > 100, `${file} is empty or missing`)
    assert.equal(FILES.length, 19)
  })

  it('sees a retired word in a label, a sentence, an attribute and the text between tags, in either case', () => {
    for (const source of [
      "const label = 'Catalogue'",
      'const s = "Add an Offer to the portfolio"',
      'const t = `Delete ${n} items from CRM`',
      '<h2>Product lines</h2>',
      '<Button aria-label="Open the catalogue">Go</Button>',
      '<p>\n  Every item in the catalogue is listed here.\n</p>',
      "const w = 'product line'",
    ]) assert.ok(offences('x.tsx', source).length > 0, `should be seen: ${source}`)
  })

  it('ignores identifiers, comments, API values and the other words', () => {
    for (const source of [
      'const itemType = row.itemMasterId',
      'items.map((item) => item.id)',
      "if (row.kind === 'item') return 1",
      "nameKept === 'catalogue'",
      '<option value="catalogue">CRM name</option>',
      '// the catalogue row is never deleted',
      '/* an offer is a Sub-product */',
      "const label = 'Sub-product'",
      "const t = `Deleted ${n} sub-products.`",
      'const id = "itemx-list"; const url = "/portfolio/products/5"',
    ]) assert.deepEqual(offences('x.tsx', source), [], `should be ignored: ${source}`)
  })
})
