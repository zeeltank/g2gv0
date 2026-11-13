import { strict as assert } from 'node:assert'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

/**
 * Nothing in the front end may link to the retired Signal Review screen. It was merged into Company Opportunities on 13 Nov 2026 (hp_erp docs/agentic-crm/DECISIONS.md,
 * entry 2026-11-13; track S15-P1B): a signal opens on `/signals?status=all&q=<title>`. The two old addresses, `/signal-review` and `/module/crm/signal-review`, live on ONLY
 * as the two redirect pages under app/ (an Ask answer or an agent run saved before the merge, and any bookmark, still carries them).
 *
 * This reads every source file of app, components, hooks, lib and services and fails on any mention of either address outside the allowances below. It matches the ADDRESS
 * as a path, not the substring: `@/services/signal-review/types`, `./signal-review-drawer` and `data-signal-review-link` are the Review screen's own files and names, which the
 * caller deletes or moves later, and are not links. An allowance names one file and, where it can, the one line that may carry the address, so a link written elsewhere in the
 * same file is still caught. The detector is itself tested on lines that do and do not name the address, so a pass means something.
 */

const ROOT = path.resolve(__dirname, '..')
const FOLDERS = ['app', 'components', 'hooks', 'lib', 'services']
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx'])
const SKIP_FOLDERS = new Set(['node_modules', '.next'])

/** `/signal-review` that does not continue into a longer word or file name and is not part of a folder path, or `/module/crm/signal-review` (which ends in a word character). */
const ADDRESS = /(?:(?<![\w.-])|(?<=\/module\/crm))\/signal-review(?![\w-])/

interface Allowance {
  /** Relative to the front-end root, forward slashes. */
  file: string
  /** When given, only a line that matches it may carry the address; otherwise any line of the file may. */
  line?: RegExp
  why: string
}

// The two redirect pages under app/ need no allowance: their folders ARE the old addresses, and their text never has to spell one out.
const ALLOWED: Allowance[] = [
  { file: 'lib/signals-nav.ts', line: /^\s*const SIGNAL_REVIEW_PATHS = \['\/signal-review', '\/module\/crm\/signal-review'\] as const\s*$/, why: 'the sidebar fold names the menu row it hides, and the paths whose visit highlights Market Signals' },
  { file: 'lib/leads/screen-kit.ts', line: /access_link: '\/signal-review'/, why: 'a fixture of the real menu, which still holds the retired row (506 keeps status 1)' },
  { file: 'lib/signals/router-harness.ts', line: /pathname = '\/signal-review'/, why: 'a default pathname of a test router; it goes with the Review screens (step 1.7) and nothing links to it' },
  { file: 'lib/signal-review-redirect.test.ts', why: 'tests the redirect pages, so it names the old addresses on purpose' },
  { file: 'lib/signals-nav-review.test.ts', why: 'tests the sidebar fold, so it names the old addresses on purpose' },
  { file: 'lib/signal-review-address-gone.test.ts', why: 'this file: the detector and its examples' },
]

/** "relative/path:line: the line" for each line that names the address and is not allowed in its file. */
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

describe('nothing in the front end links to the retired Signal Review screen', () => {
  it('names neither old address anywhere outside the allowances (the redirect pages do not even need one)', () => {
    const found = scan(ROOT, FOLDERS)
    assert.deepEqual(found, [], `These lines name the retired Signal Review address. A signal now opens on /signals?status=all&q=<title>:\n  ${found.join('\n  ')}`)
  })

  it('reads the files that used to make the link, and enough of the application', () => {
    const files = sourceFiles(ROOT, FOLDERS)
    for (const expected of ['lib/org-accounts/links.ts', 'components/domain/crm/lead-evidence-tab.tsx', 'components/domain/crm/org-account-360-parts.tsx', 'hooks/content-map-crm.ts', 'hooks/use-sidebar-navigation.ts', 'lib/ask/fixtures.ts', 'lib/agent/fixtures.ts', 'app/signal-review/page.tsx', 'app/module/crm/signal-review/page.tsx']) {
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
        assert.deepEqual(outside, [], `${rule.file} names the address on a line its allowance does not cover`)
      }
    }
  })

  it('sees both old addresses and ignores the Review screen\'s own file names and import paths', () => {
    for (const line of [
      "const to = '/signal-review'",
      "href={`/signal-review?status=all&q=${encodeURIComponent(title)}`}",
      "{ accessLink: '/module/crm/signal-review', component: SignalReviewView }",
      'fetch("/module/crm/signal-review?x=1")',
      "router.push('/signal-review/')",
      "owners['/signal-review']",
    ]) assert.ok(ADDRESS.test(line), `should be seen: ${line}`)

    for (const line of [
      "import type { SignalRow } from '@/services/signal-review/signal-types'",
      "import { x } from '../../services/signal-review/decision-error'",
      "import { SignalReviewDrawer } from './signal-review-drawer'",
      "const { SignalReviewView } = await import('../../components/domain/crm/signal-review-view')",
      '<a data-signal-review-link>',
      "const ID_PREFIX = 'signal-review'",
      "'[role=\"tabpanel\"]#signal-review-panel-signals'",
      "router.push('/signals?status=all&q=x')",
      "const a = '/module/crm/signals'",
      "href='/signal-reviews'",
    ]) assert.ok(!ADDRESS.test(line), `should be ignored: ${line}`)
  })

  it('allows a line of a file only as far as its allowance goes', () => {
    const nav = "lib/signals-nav.ts"
    const constant = "const SIGNAL_REVIEW_PATHS = ['/signal-review', '/module/crm/signal-review'] as const"
    assert.deepEqual(violations(nav, constant), [], 'the fold\'s constant is allowed')
    assert.equal(violations(nav, `${constant}\nconst link = '/signal-review?status=all'`).length, 1, 'a link written elsewhere in the same file is caught')
    assert.equal(violations('lib/org-accounts/links.ts', constant).length, 1, 'the same line in another file is caught')
    assert.equal(violations('app/signal-review/page.tsx', "redirect('/signal-review')").length, 1, 'a redirect page is held to the same rule: it sends people to /signals, never back')
    assert.equal(violations('components/domain/crm/lead-evidence-tab.tsx', "<Link href='/signal-review'>").length, 1, 'a component may not')
  })

  it('does see a file that names the old address when it is read from disk', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'signal-review-gone-'))
    try {
      mkdirSync(path.join(dir, 'components'), { recursive: true })
      mkdirSync(path.join(dir, 'lib/node_modules/pkg'), { recursive: true })
      writeFileSync(path.join(dir, 'components/Bad.tsx'), "export const to = '/module/crm/signal-review?status=all'\n")
      writeFileSync(path.join(dir, 'components/Good.tsx'), "export const to = '/signals?status=all'\nimport x from '@/services/signal-review/types'\n")
      writeFileSync(path.join(dir, 'lib/node_modules/pkg/index.js'), "module.exports = '/signal-review'\n")
      const found = scan(dir, ['components', 'lib'])
      assert.equal(found.length, 1, found.join('\n'))
      assert.match(found[0], /^components\/Bad\.tsx:1: /)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
