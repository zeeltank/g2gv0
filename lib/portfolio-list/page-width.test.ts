import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it } from 'node:test'

/**
 * Every page of the Product Portfolio and of Market Signals is as wide as the list (owner, 23 Nov 2026, from screenshots: the Product page, its "not found" page and the
 * Signals page were centred in a 1152 px column while the list and the other modules use the full width). The width is measured in a real browser (1440, 1920 and 390 px:
 * `Docs/agentic-crm/_evidence/s15/design-2026-11-23/`); this test keeps it from coming back: no page frame of these areas may centre itself with `mx-auto` inside a
 * `max-w-*` column. A dialog's own `max-w-*` (no `mx-auto`) is a dialog, not a page.
 */
const ROOT = join(__dirname, '..', '..')
const FRAMES = [
  'components/domain/portfolio',
  'components/domain/signals/signals-frame.tsx',
  'components/domain/signals/scholar-signals-view.tsx',
  'components/domain/signals/premium-page.tsx',
  'app/portfolio',
  'app/signals',
]

function files(path: string): string[] {
  const full = join(ROOT, path)
  if (statSync(full).isFile()) return [full]
  return readdirSync(full).flatMap((name) => {
    const child = join(full, name)
    return statSync(child).isDirectory() ? files(join(path, name)) : /\.tsx?$/.test(name) ? [child] : []
  })
}

/** A class string that centres a column of a fixed maximum width: `mx-auto` and `max-w-...` in the same quoted string. */
const CENTRED_COLUMN = /(["'`])(?=[^"'`]*\bmx-auto\b)(?=[^"'`]*\bmax-w-(?:xl|[2-7]xl|screen-\w+|\[[^\]]+\]|prose)(?![\w-]))[^"'`]*\1/g

describe('every page of the Product Portfolio and of Market Signals is full width', () => {
  const all = FRAMES.flatMap(files)

  it('scans the page frames (a rename that hides one from this scan fails here)', () => {
    const names = all.map((f) => relative(ROOT, f).replace(/\\/g, '/'))
    for (const must of ['components/domain/portfolio/product-detail-view.tsx', 'components/domain/portfolio/portfolio-list.tsx', 'components/domain/portfolio/sub-product-page.tsx', 'components/domain/signals/signals-frame.tsx', 'app/portfolio/page.tsx']) {
      assert.ok(names.includes(must), `${must} is scanned`)
    }
  })

  it('has no page frame that centres itself in a fixed-width column (mx-auto with max-w-*)', () => {
    const found = all.flatMap((file) => {
      const hits = readFileSync(file, 'utf8').match(CENTRED_COLUMN) ?? []
      return hits.map((hit) => `${relative(ROOT, file).replace(/\\/g, '/')}: ${hit}`)
    })
    assert.deepEqual(found, [], 'a page frame is centred in a fixed-width column; use the full width like the list')
  })

  it('knows what it is looking for: the old frames, written back, would be found', () => {
    for (const old of ['"@container mx-auto max-w-6xl space-y-5 p-4 @xl:p-6"', '"mx-auto max-w-5xl space-y-6 p-4"', "'mx-auto max-w-7xl p-6'", '"max-w-[1100px] mx-auto"']) {
      assert.equal((old.match(CENTRED_COLUMN) ?? []).length, 1, `${old} is a centred column`)
    }
    for (const fine of ['"w-full space-y-5 p-4 @xl:p-6"', '"max-w-2xl max-h-[85vh] overflow-y-auto"', '"size-6 mx-auto text-primary"']) {
      assert.equal((fine.match(CENTRED_COLUMN) ?? []).length, 0, `${fine} is not`)
    }
  })
})
