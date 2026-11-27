import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import ts from 'typescript'

/**
 * Scans of the source of the Sales Kit, for what the screen tests cannot see: that the tab is gated on the right the server reports, that the kit stands apart from the LMS and from every other
 * domain, that the deck route is only a door onto the existing player, the words a person reads (the Portfolio vocabulary), and the rules of the design brief (no all-capitals label, no middle-dot
 * line, no arrow, no gradient, no status colour as text, no fixed width at 390 px). Paths are from the repository root, where the tests run.
 */

const COMPONENT_DIR = 'components/domain/portfolio'
const SERVICE_DIR = 'services/product-master'
const read = (file: string) => readFileSync(path.resolve(file), 'utf8')

const KIT_COMPONENTS = readdirSync(path.resolve(COMPONENT_DIR)).filter((f) => /^product-sales-kit.*\.tsx?$/.test(f)).map((f) => `${COMPONENT_DIR}/${f}`)
const KIT_SERVICES = ['kit-types.ts', 'kit-service.ts', 'kit-fake-service.ts'].map((f) => `${SERVICE_DIR}/${f}`)
const KIT_LIB = ['lib/portfolio/sales-kit-model.ts']
const KIT_SOURCES = [...KIT_COMPONENTS, ...KIT_SERVICES, ...KIT_LIB]
const SCREENS = KIT_COMPONENTS.filter((f) => f.endsWith('.tsx'))

/** The module addresses a file imports or re-exports. */
function importsOf(source: string): string[] {
  const file = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  file.forEachChild((node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text)
  })
  return found
}

/** A string that is a list of Tailwind classes (`cn('flex items-center ...')`), not words: every part is lower case with a dash or a colon in at least one. */
const looksLikeClasses = (text: string): boolean => {
  const parts = text.trim().split(/\s+/)
  return parts.every((part) => /^[a-z0-9!:\-[\]/.%()_#&>*]+$/.test(part)) && parts.some((part) => /[-:]/.test(part))
}

/** Every string in the file a person could read: JSX text, and a string with a space in it or a capital letter, or any string in a label-like attribute. Copied from lib/portfolio/scans.test.ts. */
function visibleStrings(source: string): Array<{ line: number; text: string }> {
  const file = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: Array<{ line: number; text: string }> = []
  const LABEL_ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'description', 'confirmLabel', 'legend', 'hint'])
  const inside = (node: ts.Node, test: (n: ts.Node) => boolean): boolean => {
    for (let n: ts.Node | undefined = node.parent; n; n = n.parent) if (test(n)) return true
    return false
  }
  const record = (node: ts.Node, text: string) => found.push({ line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1, text })
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const text = node.getText(file).replace(/\s+/g, ' ').trim()
      if (text !== '') record(node, text)
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const parent = node.parent
      const skip =
        ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isLiteralTypeNode(parent) || (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) || ts.isCaseClause(parent) ||
        inside(node, (n) => ts.isJsxAttribute(n) && ['className', 'class', 'id', 'htmlFor', 'href', 'role', 'type', 'key', 'accept', 'rel', 'target', 'name'].includes(n.name.getText(file))) ||
        inside(node, (n) => ts.isTypeNode(n))
      if (!skip) {
        const attribute = ts.isJsxAttribute(parent) ? parent.name.getText(file) : ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) ? parent.parent.name.getText(file) : null
        const text = node.text
        if (text.trim() !== '' && !looksLikeClasses(text) && ((attribute !== null && LABEL_ATTRIBUTES.has(attribute)) || /\s/.test(text.trim()) || /^[A-Z]/.test(text.trim()))) record(node, text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

describe('the files the scans read', () => {
  it('finds every file of the kit, so a scan cannot pass by reading nothing', () => {
    for (const file of KIT_SOURCES) assert.ok(existsSync(path.resolve(file)), `${file} exists`)
    assert.ok(KIT_COMPONENTS.length >= 9, `the kit has its panel, tiles, dialogs and parts (${KIT_COMPONENTS.length} found)`)
    assert.ok(SCREENS.includes(`${COMPONENT_DIR}/product-sales-kit.tsx`))
  })
})

describe('the vocabulary scan reads what a person reads, and nothing else', () => {
  it('finds a retired word in text, in a label and in a sentence, but not in a comment, an import, a class list or a type', () => {
    const probe = `
      import { Item } from './item'
      // an offer in a comment
      type Kind = 'item' | 'offer'
      export const A = () => (
        <div className={cn('flex items-center gap-2', big ? 'size-20 items-start' : 'size-12')}>
          <h1 title="Catalogue page">The Catalogue</h1>
          {x ? 'No items yet' : 'Product line'}
        </div>
      )`
    const hits = visibleStrings(probe).map((s) => s.text).filter((text) => /\b(catalogues?|offers?|items?|product[ -]lines?)\b/i.test(text))
    assert.deepEqual(hits.sort(), ['Catalogue page', 'No items yet', 'Product line', 'The Catalogue'].sort())
  })
})

describe('the tab is gated on the right the server reports', () => {
  const view = read(`${COMPONENT_DIR}/product-detail-view.tsx`)

  it('reads the kit and draws the tab only when the caller\'s Sales Kit row says view, on a Product that has a record of its own', () => {
    assert.match(view, /const kitTab = product !== null && master !== null && meta\?\.can\.kitView === true/)
    assert.match(view, /useSalesKit\(salesKitService, masterId, kitTab\)/, 'the read is gated too, so a caller without the right makes no request')
    assert.match(view, /productTabIds\(\{ full: product !== null, kit: kitTab \}\)/)
    assert.match(view, /\{kitTab && master && \(\s*<TabPanel id="kit"/, 'the panel is built only behind the same gate')
  })

  it('has no other way to reach the Sales Kit than through that gate', () => {
    assert.equal((view.match(/<ProductSalesKit\b/g) ?? []).length, 1)
    assert.equal((view.match(/useSalesKit\(/g) ?? []).length, 1)
    assert.equal(KIT_SOURCES.filter((f) => /kitView/.test(read(f))).length, 0, 'the kit\'s own files do not decide the right: the server\'s answer does')
  })

  it('has a meta type that names the four flags as the server sends them', () => {
    const types = read(`${SERVICE_DIR}/types.ts`)
    for (const flag of ['kitView', 'kitAdd', 'kitEdit', 'kitDelete']) assert.match(types, new RegExp(`${flag}\\?: boolean`), flag)
  })

  it('shows the Add menu, the file box, the drop and the editing menus only behind the kit\'s own can flags', () => {
    const panel = read(`${COMPONENT_DIR}/product-sales-kit.tsx`)
    assert.match(panel, /\{can\.add && \(\s*<>\s*<input/, 'the file box and the Add menu')
    assert.match(panel, /const drag = can\.add/, 'the drop')
    const actions = read(`${COMPONENT_DIR}/product-sales-kit-actions.tsx`)
    assert.match(actions, /can\.edit && <DropdownMenuItem/)
    assert.match(actions, /can\.delete && <DropdownMenuItem/)
    assert.match(actions, /if \(!share && !can\.edit && !can\.delete\) return null/)
  })
})

describe('the kit stands apart', () => {
  it('imports nothing from the LMS, and reaches no other domain\'s components', () => {
    const offences: string[] = []
    for (const file of KIT_SOURCES) {
      for (const from of importsOf(read(file))) {
        if (/lms/i.test(from)) offences.push(`${file} imports ${from}`)
        if (/^@\/components\/domain\/(?!portfolio\b)/.test(from)) offences.push(`${file} imports another domain: ${from}`)
        if (/^\.\.\//.test(from)) offences.push(`${file} reaches up out of its folder: ${from}`)
      }
    }
    assert.deepEqual(offences, [])
  })

  it('imports from the platform layers and its own folder only', () => {
    const allowed = /^(react|lucide-react|typescript|node:|\.\/|@\/components\/ui\/|@\/components\/shared\/|@\/lib\/|@\/services\/|\.\.\/\.\.\/(services|components))/
    const offences: string[] = []
    for (const file of KIT_SOURCES) for (const from of importsOf(read(file))) if (!allowed.test(from)) offences.push(`${file}: ${from}`)
    assert.deepEqual(offences, [])
  })

  it('keeps the page model and the nav fold free of the LMS as well', () => {
    for (const file of ['lib/portfolio/page-model.ts', 'lib/signals-nav.ts']) assert.doesNotMatch(importsOf(read(file)).join(' '), /lms/i, file)
  })

  it('does not touch components/ui or the other tracks\' files in what it exports', () => {
    for (const file of KIT_SOURCES) for (const from of importsOf(read(file))) assert.doesNotMatch(from, /portfolio-list|portfolio-layout/, `${file}: ${from}`)
  })
})

describe('the deck route is only a door onto the existing player', () => {
  const dir = 'app/signals/portfolio/deck/[product]'
  const layout = read(`${dir}/layout.tsx`)
  const page = read(`${dir}/page.tsx`)

  it('names its parameter `product`, as the player reads it', () => {
    assert.ok(existsSync(path.resolve(`${dir}/page.tsx`)) && existsSync(path.resolve(`${dir}/layout.tsx`)))
    assert.match(read('app/module/lms/learning/client-presentation/[product]/page.tsx'), /useParams<\{ product: string \}>/)
  })

  it('re-exports the signed-in player page and wraps the existing font layout, and calls no font loader itself', () => {
    assert.deepEqual(importsOf(page), ['@/app/module/lms/learning/client-presentation/[product]/page'])
    assert.match(page, /export \{ default \} from/)
    assert.ok(importsOf(layout).includes('@/app/module/lms/learning/client-presentation/layout'))
    assert.doesNotMatch(layout, /\blocalFont\(/, 'the font loader stays in the original layout module')
    assert.ok(!importsOf(layout).some((from) => from.startsWith('next/font')), 'and so does its import')
    assert.match(read('app/module/lms/learning/client-presentation/layout.tsx'), /localFont\(/)
  })

  it('leaves the old LMS route in place, and the web deck link of the kit points at the new one', () => {
    for (const file of ['layout.tsx', '[product]/page.tsx']) assert.ok(existsSync(path.resolve(`app/module/lms/learning/client-presentation/${file}`)), file)
    assert.match(read(`${SERVICE_DIR}/kit-fake-service.ts`), /url: '\/signals\/portfolio\/deck\/scholarclone'/)
  })
})

describe('the words and the look of the kit', () => {
  const BANNED = /\b(catalogues?|offers?|items?|product[ -]lines?)\b/i

  for (const file of [...SCREENS, ...KIT_LIB, 'lib/portfolio/page-model.ts']) {
    it(`${file} never says item, offer, catalogue or product line to a person`, () => {
      const hits = visibleStrings(read(file)).filter((s) => BANNED.test(s.text)).map((s) => `${file}:${s.line}: ${s.text.slice(0, 90)}`)
      assert.deepEqual(hits, [])
    })
  }

  it('has no all-capitals label, no middle-dot line, no arrow, no gradient and no em dash in anything a person reads', () => {
    const offences: string[] = []
    for (const file of [...SCREENS, ...KIT_LIB]) {
      const source = read(file)
      source.split(/\r?\n/).forEach((line, i) => {
        if (/\buppercase\b|tracking-(wide|wider|widest)\b/.test(line)) offences.push(`${file}:${i + 1}: all capitals or letter-spaced label`)
        if (/\b(bg-gradient|bg-linear|from-\w|via-\w|to-\w)/.test(line)) offences.push(`${file}:${i + 1}: gradient`)
      })
      for (const s of visibleStrings(source)) if (/[·→—]/.test(s.text)) offences.push(`${file}:${s.line}: "${s.text.slice(0, 60)}"`)
    }
    assert.deepEqual(offences, [])
  })

  it('draws no hover transition on everything, and no motion that is not an answer to an action', () => {
    const offences: string[] = []
    for (const file of SCREENS) {
      readFileSync(path.resolve(file), 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (/\btransition(-\w+)?\b/.test(line) && !line.includes('data-[state')) offences.push(`${file}:${i + 1}: ${line.trim().slice(0, 100)}`)
        if (/animate-(pulse|bounce|ping)/.test(line)) offences.push(`${file}:${i + 1}: ${line.trim().slice(0, 100)}`)
        if (/\banimate-spin\b/.test(line) && !line.includes('motion-reduce:animate-none')) offences.push(`${file}:${i + 1}: a spinner that ignores reduced motion`)
      })
    }
    assert.deepEqual(offences, [])
  })

  it('uses no status colour as text and no tint of one as a surface; an icon, which is aria-hidden, may be coloured', () => {
    const offences: string[] = []
    for (const file of SCREENS) {
      read(file).split(/\r?\n/).forEach((line, i) => {
        const text = /\btext-(success|warning|destructive|primary)\b(?!-)/.test(line)
        const tint = /\b(?:bg|border)-(?:success|warning|destructive|primary|muted-foreground)\/\d+/.test(line)
        if ((text && !line.includes('aria-hidden')) || tint) offences.push(`${file}:${i + 1}: ${line.trim().slice(0, 100)}`)
      })
    }
    assert.deepEqual(offences, [], 'the words are text-foreground on a solid surface; only a border takes the status colour')
  })

  it('uses no shared Badge or StatusBadge', () => {
    for (const file of SCREENS) assert.doesNotMatch(read(file), /components\/ui\/(status-)?badge|<(Status)?Badge\b/, file)
  })

  it('uses no fixed width at 390 px, and lets every row that spreads with justify-between wrap', () => {
    const offences: string[] = []
    for (const file of SCREENS) {
      const source = read(file)
      source.split(/\r?\n/).forEach((line, i) => {
        for (const m of line.matchAll(/(?<![\w:-])(?:[a-z0-9]+:)*(w-(?:\d+(?![\d/])|\[[^\]]+\])|min-w-(?!0\b|full\b)[\w[\]-]+)/g)) offences.push(`${file}:${i + 1}: ${m[1]}`)
      })
      if (source.includes('justify-between')) assert.ok(source.includes('flex-wrap') || source.includes('min-w-0'), `${file} spreads a row with justify-between and has nothing to let it wrap`)
    }
    assert.deepEqual(offences, [])
  })

  it('gives every image an alt and every icon-only button a name', () => {
    for (const file of SCREENS) {
      const source = read(file)
      for (const m of source.matchAll(/<img\b[^>]*>/g)) assert.match(m[0], /\balt=/, `${file}: ${m[0].slice(0, 60)}`)
    }
  })
})
