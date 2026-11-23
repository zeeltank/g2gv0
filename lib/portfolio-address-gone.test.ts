import { strict as assert } from 'node:assert'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * Nothing in the front end may link to the old Products and Services screens. They were merged into the Product Portfolio on 13 Nov 2026 (hp_erp docs/agentic-crm/DECISIONS.md,
 * entry 2026-11-13; slice 15, track P3-A): a product opens on `/portfolio` (the list), `/portfolio/products/{id}` (a Sub-product) or `/portfolio/{key}` (a Product). The old
 * addresses, `/module/crm/sales/products` and `/module/crm/sales/services` (with their `/{id}` and `/lines/{id}` pages), live on ONLY as the redirect pages under app/ (an Ask
 * answer, a saved quote link and any bookmark still carry them).
 *
 * This reads every source file of app, components, hooks, lib and services and fails on any mention of either address outside the allowances below. An allowance names one
 * file and, where it can, the one line that may carry the address, so a link written elsewhere in the same file is still caught. The detector is itself tested on lines that do
 * and do not name an address, so a pass means something. The second half proves the other half of "removed": no live route imports a component of the old screens.
 */

const ROOT = path.resolve(__dirname, '..')
const FOLDERS = ['app', 'components', 'hooks', 'lib', 'services']
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx'])
const SKIP_FOLDERS = new Set(['node_modules', '.next'])

/** `/module/crm/sales/products` or `/module/crm/sales/services`, not continuing into a longer word (`/products-new`), with or without a path after it. */
const ADDRESS = /\/module\/crm\/sales\/(?:products|services)(?![\w-])/

interface Allowance {
  /** Relative to the front-end root, forward slashes. */
  file: string
  /** When given, only a line that matches it may carry the address; otherwise any line of the file may. */
  line?: RegExp
  why: string
}

// The redirect pages under app/module/crm/sales need no allowance: their folders ARE the old addresses, and their text never has to spell one out.
const ALLOWED: Allowance[] = [
  // The redirect machinery and what proves it.
  { file: 'lib/portfolio-redirect.ts', why: 'the redirect helper: its comment lists every old address and where it lands' },
  { file: 'lib/portfolio-redirect.test.ts', why: 'tests the redirect pages, so it names the old addresses on purpose' },
  { file: 'lib/portfolio-redirect-screen.test.tsx', why: 'tests the record redirects, so it names an old address on purpose' },
  { file: 'lib/portfolio-address-gone.test.ts', why: 'this file: the detector and its examples' },
  { file: 'lib/portfolio-list/vocabulary.test.ts', line: /'app\/module\/crm\/sales\/(?:products|services)\/[^']*page\.tsx'/, why: 'lists the redirect pages by their file path (their folders ARE the old addresses) to scan their words' },
  // The sidebar fold: it names the two menu rows it draws as the Product Portfolio (the rows stay in the database with status 1).
  { file: 'lib/signals-nav.ts', line: /^const (?:PRODUCTS|SERVICES)_PATH = '\/module\/crm\/sales\/(?:products|services)'\s*$/, why: 'the sidebar fold names the two menu rows it draws as the Product Portfolio, and the addresses that still resolve' },
  { file: 'lib/gtg-navigation.ts', line: /^export const CRM_(?:PRODUCTS|SERVICES)_ACCESS_LINK = '\/module\/crm\/sales\/(?:products|services)'\s*$/, why: 'the identity (access_link) of the two menu rows 468 and 469, which stay in the database; old screens and the sidebar hook still resolve them' },
  { file: 'lib/portfolio-list/sidebar.test.ts', why: 'tests the sidebar fold, so it names the two menu rows on purpose' },
  { file: 'lib/product-picker/product-page-link.test.tsx', why: 'proves the product-page link no longer resolves the old Products address: it has to spell the address it forbids (a comment and one `includes` check)' },
  { file: 'lib/portfolio-list/screen-kit.ts', why: 'a fixture of the real menu, which still holds the two rows (468 and 469 keep status 1)' },
  // A saved link: the Ask chat draws a stored answer's link, and the page behind it redirects.
  { file: 'lib/ask/context.test.ts', line: /sales\/products\/12/, why: 'a sample of the addresses the Ask chat treats as internal links; a link stored before the merge still carries it and the redirect page carries it on' },
]

/** "relative/path:line: the line" for each line that names an address and is not allowed in its file. */
function violations(relative: string, text: string, allowed: Allowance[] = ALLOWED): string[] {
  const rule = allowed.find((a) => a.file === relative)
  const found: string[] = []
  text.split(/\r?\n/).forEach((line, index) => {
    if (!ADDRESS.test(line)) return
    if (rule && (!rule.line || rule.line.test(line))) return
    found.push(`${relative}:${index + 1}: ${line.trim()}`)
  })
  return found
}

/** Relative path (forward slashes) of every source file under the given folders of `root`. */
function sourceFiles(root: string, folders: string[]): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_FOLDERS.has(entry.name)) walk(`${dir}/${entry.name}`)
      } else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        out.push(`${dir}/${entry.name}`)
      }
    }
  }
  for (const folder of folders) {
    try {
      walk(folder)
    } catch {
      // A folder that is not there has nothing to scan; the coverage test below fails if one of ours went missing.
    }
  }
  return out.sort()
}

const scan = (root: string, folders: string[]) => sourceFiles(root, folders).flatMap((file) => violations(file, readFileSync(path.join(root, file), 'utf8')))

describe('nothing in the front end links to the old Products and Services screens', () => {
  it('names neither old address anywhere outside the allowances (the redirect pages do not even need one)', () => {
    const found = scan(ROOT, FOLDERS)
    assert.deepEqual(found, [], `These lines name an old Products or Services address. A product opens on /portfolio, /portfolio/products/{id} or /portfolio/{key}:\n  ${found.join('\n  ')}`)
  })

  it('reads the files that used to make the link, and enough of the application', () => {
    const files = sourceFiles(ROOT, FOLDERS)
    for (const expected of [
      'hooks/content-map-crm.ts', 'hooks/use-sidebar-navigation.ts', 'lib/signals-nav.ts', 'lib/gtg-navigation.ts', 'components/domain/crm/ticket-detail-page.tsx',
      'components/domain/crm/asset-detail-page.tsx', 'components/domain/portfolio/portfolio-list.tsx', 'app/module/crm/sales/products/page.tsx', 'app/module/crm/sales/services/page.tsx',
      'app/module/crm/sales/products/[id]/page.tsx', 'app/module/crm/sales/services/[id]/page.tsx', 'app/module/crm/sales/products/lines/[id]/page.tsx', 'app/portfolio/page.tsx',
    ]) {
      assert.ok(files.includes(expected), `${expected} is not scanned`)
    }
    for (const folder of FOLDERS) assert.ok(files.some((file) => file.startsWith(`${folder}/`)), `${folder} was not walked`)
    assert.ok(files.length > 1000, `a folder was only partly walked (${files.length} files; about 1,700 at the time of writing)`)
  })

  it('lets every allowance do exactly what it says: one file, and one line where it names one', (t) => {
    for (const rule of ALLOWED) {
      const text = readFileSync(path.join(ROOT, rule.file), 'utf8')
      const lines = text.split(/\r?\n/).filter((line) => ADDRESS.test(line))
      if (lines.length === 0) {
        t.diagnostic(`the allowance for ${rule.file} is no longer needed (${rule.why}); remove it from the list`)
        continue
      }
      if (rule.line) {
        const outside = lines.filter((line) => !rule.line!.test(line))
        assert.deepEqual(outside, [], `${rule.file} names an address on a line its allowance does not cover`)
      }
    }
  })

  it('sees both old addresses, with or without an id after them, and ignores the new ones and other words', () => {
    for (const line of [
      "const to = '/module/crm/sales/products'",
      "router.push(`/module/crm/sales/services/${id}`)",
      "{ accessLink: '/module/crm/sales/products', component: ProductListView }",
      'fetch("/module/crm/sales/products/lines/9?tab=signals")',
      "href='/module/crm/sales/products/'",
      "owners['/module/crm/sales/services']",
    ]) assert.ok(ADDRESS.test(line), `should be seen: ${line}`)

    for (const line of [
      "router.push('/portfolio')",
      "href={`/portfolio/products/${id}`}",
      "const a = '/module/crm/sales/quotes/12'",
      "const b = '/module/crm/sales/price-books'",
      "const c = '/module/crm/sales/products-new'",
      "const d = '/module/crm/sales/servicesx'",
      "import { ProductListView } from '@/domain/crm/product-list-view'",
      "const e = '/module/crm/marketing/products'",
    ]) assert.ok(!ADDRESS.test(line), `should be ignored: ${line}`)
  })

  it('allows a line of a file only as far as its allowance goes', () => {
    const nav = 'lib/signals-nav.ts'
    const constant = "const PRODUCTS_PATH = '/module/crm/sales/products'"
    assert.deepEqual(violations(nav, constant), [], 'the fold\'s constant is allowed')
    assert.equal(violations(nav, `${constant}\nconst link = '/module/crm/sales/products?x=1'`).length, 1, 'a link written elsewhere in the same file is caught')
    assert.equal(violations('lib/org-accounts/links.ts', constant).length, 1, 'the same line in another file is caught')
    assert.equal(violations('app/module/crm/sales/products/page.tsx', "redirect('/module/crm/sales/products')").length, 1, 'a redirect page is held to the same rule: it sends people to /portfolio, never back')
    assert.equal(violations('components/domain/crm/quote-detail-page.tsx', "<Link href='/module/crm/sales/products/5'>").length, 1, 'a component may not')
    assert.equal(violations('lib/ask/context.test.ts', "const internal = ['/module/crm/sales/products/12']").length, 0, 'the one sample line an allowance names is allowed')
    assert.equal(violations('lib/ask/context.test.ts', "router.push('/module/crm/sales/services/4')").length, 1, 'any other line of that file is not')
  })

  it('does see a file that names an old address when it is read from disk', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'portfolio-gone-'))
    try {
      mkdirSync(path.join(dir, 'components'), { recursive: true })
      mkdirSync(path.join(dir, 'lib/node_modules/pkg'), { recursive: true })
      writeFileSync(path.join(dir, 'components/Bad.tsx'), "export const to = '/module/crm/sales/products/5?tab=history'\n")
      writeFileSync(path.join(dir, 'components/Good.tsx'), "export const to = '/portfolio/products/5?tab=history'\n")
      writeFileSync(path.join(dir, 'lib/node_modules/pkg/index.js'), "module.exports = '/module/crm/sales/services'\n")
      const found = scan(dir, ['components', 'lib'])
      assert.equal(found.length, 1, found.join('\n'))
      assert.match(found[0], /^components\/Bad\.tsx:1: /)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ---------------------------------------------------------------------------------------------------------------------------- the old components

/** The components and models of the old Products and Services screens. They were deleted at P4 (slice 15, WPD); nothing may import them or bring them back. */
const OLD_SCREEN_FILES = [
  'product-catalog-list-view', 'product-list-view', 'service-list-view', 'product-detail-page', 'product-lines-view', 'product-line-record-page', 'create-product-modal',
  'product-lines-model', 'product-master-model', 'product-line-columns', 'product-links-panels', 'product-signals-icp-tab', 'product-scope-switch', 'product-master-form', 'product-master-parts', 'product-offer-about',
  'product-usage-tab',
]

/** An import or a dynamic import of one of those files, by any spelling of the path (`@/domain/crm/...`, `@/components/domain/crm/...`, `./...`, `../...`). */
function importsOldScreen(text: string): string[] {
  const hits: string[] = []
  const pattern = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g
  for (const match of text.matchAll(pattern)) {
    const base = match[1].split('/').pop() ?? ''
    if (OLD_SCREEN_FILES.includes(base)) hits.push(match[1])
  }
  return hits
}

describe('the old Products and Services components are gone, and no live route imports one', () => {
  it('has none of the old components, models or test kits on disk (a file brought back under an old name would be a second Products screen)', () => {
    const names = [...OLD_SCREEN_FILES, 'lines-fixtures', 'screen-kit']
    const back = ['components/domain/crm', 'lib/product-master'].flatMap((dir) => readdirSync(path.join(ROOT, dir)).filter((file) => names.includes(file.replace(/\.(tsx?|jsx?)$/, ''))).map((file) => `${dir}/${file}`))
    assert.deepEqual(back, [], 'a file of the old Products or Services screens is back; the Product Portfolio replaced it')
  })

  // A live route is a page under app/ or an entry of a content map under hooks/ (the shell draws whatever those import). The screens of this track are scanned too.
  const live = () => [
    ...sourceFiles(ROOT, ['app', 'hooks']),
    ...sourceFiles(ROOT, ['components/domain/portfolio']).filter((f) => /\/(portfolio-list|portfolio-more-menu|portfolio-matches|portfolio-redirect)/.test(f)),
    ...sourceFiles(ROOT, ['lib/portfolio-list']).filter((f) => !/\.test\./.test(f)),
  ]

  it('finds none in the pages, the content maps, or the new list, menu, review and redirect', () => {
    const offences = live().flatMap((file) => importsOldScreen(readFileSync(path.join(ROOT, file), 'utf8')).map((spec) => `${file} imports ${spec}`))
    assert.deepEqual(offences, [], 'a live route draws a component of an old screen that was replaced by the Product Portfolio')
  })

  it('scans the files that matter, and sees an import in each spelling', () => {
    const files = live()
    for (const expected of ['app/portfolio/page.tsx', 'hooks/content-map-crm.ts', 'components/domain/portfolio/portfolio-list.tsx', 'components/domain/portfolio/portfolio-redirect.tsx', 'app/module/crm/sales/products/[id]/page.tsx']) {
      assert.ok(files.includes(expected), `${expected} is not scanned`)
    }
    for (const line of [
      "import { ProductListView } from '@/domain/crm/product-list-view'",
      "import { ProductDetailPage } from '@/components/domain/crm/product-detail-page'",
      "const X = createLazyComponent(() => import('@/domain/crm/service-list-view').then((m) => ({ default: m.ServiceListView })))",
      "import { linesScopeHref } from './product-lines-model'",
      "const m = require('../crm/create-product-modal')",
    ]) assert.equal(importsOldScreen(line).length, 1, `should be seen: ${line}`)
    for (const line of ["import { PortfolioList } from '@/components/domain/portfolio/portfolio-list'", "import { x } from '@/lib/portfolio-redirect'", '// product-list-view is gone']) {
      assert.equal(importsOldScreen(line).length, 0, `should be ignored: ${line}`)
    }
  })
})
