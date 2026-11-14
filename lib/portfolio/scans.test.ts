import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import ts from 'typescript'
import { PORTFOLIO_COMPONENTS, PORTFOLIO_FILES } from './files'

/**
 * Two scans of the source of the Sub-product form and pages, because what they guard cannot be seen by the jsdom screen tests alone.
 *
 * VOCABULARY. The owner's words are Product and Sub-product (a service is a Sub-product of type Service). Catalogue, Offer, Item and Product line are retired
 * from every screen. The screen tests read the words of the tabs they open; this reads EVERY string a person can see in the files, including the ones in a
 * state no test opens (an error, an empty state, a dialog). It reads the syntax tree, so a comment, an import, a type, a property name or a class string is
 * never mistaken for a word on screen.
 *
 * STRUCTURE (390 px). jsdom computes no layout, so a phone-width page is proved by structure: no fixed width, a row of controls that can wrap, a table inside
 * a scrolling box.
 */
const BANNED = /\b(catalogues?|offers?|items?|product[ -]lines?)\b/i

interface Seen { line: number; text: string }

/** Every string in the file a person could read: JSX text, and a string with a space in it or a capital letter, or any string in a label-like attribute. */
export function visibleStrings(source: string, tsx = true): Seen[] {
  const file = ts.createSourceFile(tsx ? 'x.tsx' : 'x.ts', source, ts.ScriptTarget.Latest, true, tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found: Seen[] = []
  const LABEL_ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'description', 'confirmLabel', 'legend', 'hint', 'otherLabel', 'notFoundText', 'backLabel'])

  const inside = (node: ts.Node, test: (n: ts.Node) => boolean): boolean => {
    for (let n: ts.Node | undefined = node.parent; n; n = n.parent) if (test(n)) return true
    return false
  }
  const record = (node: ts.Node, text: string) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file))
    found.push({ line: line + 1, text })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const text = node.getText(file).replace(/\s+/g, ' ').trim()
      if (text !== '') record(node, text)
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const parent = node.parent
      const skip =
        ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isLiteralTypeNode(parent) || ts.isModuleDeclaration(parent) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) || (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) ||
        (ts.isCaseClause(parent)) ||
        inside(node, (n) => ts.isJsxAttribute(n) && ['className', 'class', 'id', 'htmlFor', 'href', 'role', 'type', 'key', 'form', 'accept', 'inputMode', 'autoComplete'].includes(n.name.getText(file))) ||
        inside(node, (n) => ts.isTypeNode(n))
      if (!skip) {
        const attribute = ts.isJsxAttribute(parent) ? parent.name.getText(file) : ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) ? parent.parent.name.getText(file) : null
        const text = node.text
        const labelLike = attribute !== null && LABEL_ATTRIBUTES.has(attribute)
        if (text.trim() !== '' && (labelLike || /\s/.test(text.trim()) || /^[A-Z]/.test(text.trim()))) record(node, text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)

  return found
}

describe('the vocabulary scan reads what a person reads, and nothing else', () => {
  it('finds a retired word in text, in a label and in a string with a space, but not in a comment, an import, a class, a type or a property name', () => {
    const probe = `
      import { Item } from './item'
      // an offer in a comment
      type Kind = 'item' | 'offer'
      const KEYS = { offer: 1, item: 2 }
      export const A = () => (
        <div className="flex items-center gap-2">
          <h1 title="Catalogue page">The Catalogue</h1>
          {x ? 'No items yet' : 'Product line'}
        </div>
      )`
    const hits = visibleStrings(probe).filter((s) => BANNED.test(s.text)).map((s) => s.text)
    assert.deepEqual(hits.sort(), ['Catalogue page', 'No items yet', 'Product line', 'The Catalogue'].sort())
  })
})

describe('the words of the Sub-product form and pages', () => {
  for (const file of PORTFOLIO_FILES) {
    it(`${file} says Product and Sub-product, never Catalogue, Offer, Item or Product line`, () => {
      const source = readFileSync(path.resolve(file), 'utf8')
      const hits = visibleStrings(source, file.endsWith('.tsx')).filter((s) => BANNED.test(s.text)).map((s) => `${file}:${s.line}: ${s.text.slice(0, 100)}`)
      assert.deepEqual(hits, [])
    })
  }
})

describe('the structure of the Sub-product form and pages at 390 px', () => {
  const sources = PORTFOLIO_COMPONENTS.map((file) => ({ file, text: readFileSync(path.resolve(file), 'utf8') }))

  it('uses no fixed width: no w-N, no w-[..], no min-w except min-w-0 (a max width, a size for an icon and a percentage are fine)', () => {
    const offences: string[] = []
    for (const { file, text } of sources) {
      text.split(/\r?\n/).forEach((line, i) => {
        for (const m of line.matchAll(/(?<![\w:-])(?:[a-z0-9]+:)*(w-(?:\d+|\[[^\]]+\])|min-w-(?!0\b|full\b)[\w[\]-]+)/g)) offences.push(`${path.basename(file)}:${i + 1}: ${m[1]}`)
      })
    }
    assert.deepEqual(offences, [], 'a fixed width is what makes a page scroll sideways on a phone')
  })

  it('lets a row of header, filter and button controls wrap (flex-wrap) or shrink (min-w-0) in every file that spreads one with justify-between', () => {
    for (const { file, text } of sources) {
      if (!text.includes('justify-between')) continue
      assert.ok(text.includes('flex-wrap') || text.includes('min-w-0'), `${file} spreads a row with justify-between and has nothing to let it wrap`)
    }
  })

  it('puts every table inside a box that scrolls sideways', () => {
    for (const { file, text } of sources) {
      if (!/<Table\b/.test(text)) continue
      assert.ok(text.includes('overflow-x-auto'), `${file} draws a table with no overflow-x-auto box around it`)
    }
  })

  it('draws the form in a drawer that is full width on a phone and a column on a larger screen (the scaffold\'s own rule)', () => {
    const scaffold = readFileSync(path.resolve('components/shared/scaffolds/record-drawer.tsx'), 'utf8')
    assert.match(scaffold, /w-full/, 'the drawer is the width of the phone')
    const form = sources.filter((s) => /product-form-(about|sell)\.tsx$/.test(s.file)).map((s) => s.text).join(' ')
    assert.match(form, /grid gap-4 sm:grid-cols-2|sm:grid-cols-2/, 'the sections hold their fields in one column and two on a wider screen')
  })
})
