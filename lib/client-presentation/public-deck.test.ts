import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { DECKS } from './deck'
import { ATLAS } from './atlas'
import tourNotesJson from './generated/atlas-presenter.json'
import fullJson from './generated/scholarclone.deck.json'
import publicJson from './generated/scholarclone.public.json'

/*
 * The public share page (app/present) sends a stranger the same JavaScript the signed-in deck uses. These tests are what keep the
 * presenter cautions ("never click Assign Learning", "staff capability is not connected...") out of that JavaScript.
 * The built-bundle check (a grep of .next/static for these strings) is in docs/client-presentation/13-public-share-link.md.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

type Full = { slides: { n: number; say: string; ask: string; transition: string; limits: string[]; slots: { brief: string }[] }[]; appendix: { notes: string }[] }
const full = fullJson as unknown as Full

/** Every presenter-only sentence in the full deck: what must never appear in the public one. */
const notes = full.slides
  .flatMap((s) => [s.say, s.ask, s.transition, ...s.limits, ...s.slots.map((x) => x.brief)])
  .concat(full.appendix.map((a) => a.notes))
  .filter((t) => t.trim().length > 12)

test('the full deck really does carry presenter notes (so the checks below are not vacuous)', () => {
  assert.ok(notes.length >= 30, `only ${notes.length} notes found`)
  assert.ok(full.slides.some((s) => s.limits.length > 0))
})

test('the public deck carries none of them, anywhere in its text', () => {
  const text = JSON.stringify(publicJson)
  for (const n of notes) assert.equal(text.includes(n), false, `public deck contains: ${n.slice(0, 60)}`)
  for (const s of (publicJson as unknown as Full).slides) {
    assert.deepEqual([s.say, s.ask, s.transition, s.limits, s.slots], ['', '', '', [], []], `slide ${s.n}`)
  }
  assert.equal('appendix' in publicJson, false)
  assert.equal('source_sha256' in publicJson, false)
})

test('the speaker script of a product tour is in the presenter file only, never in the public deck or the public atlas data', () => {
  const scripts = Object.values(tourNotesJson as Record<string, Record<string, string>>).flatMap((tabs) => Object.values(tabs))
  assert.ok(scripts.length >= 7 && scripts.every((t) => t.length > 20), 'the control: the presenter file really holds the tab scripts')
  const publicText = JSON.stringify(publicJson) + JSON.stringify(ATLAS) + JSON.stringify(DECKS.scholarclone)
  for (const t of scripts) assert.equal(publicText.includes(t), false, `public data contains a tour script: ${t.slice(0, 50)}`)
  assert.equal('notes' in (ATLAS.products.find((p) => p.key === 'core')?.tour ?? {}), false)
})

test('what a viewer sees is identical in both: every on-slide line, scenario, short version and image', () => {
  const a = fullJson as unknown as Record<string, unknown> & { slides: { n: number; id: string; section: string; lines: unknown }[] }
  const b = publicJson as unknown as typeof a
  assert.deepEqual(b.slides.map((s) => [s.n, s.id, s.section, s.lines]), a.slides.map((s) => [s.n, s.id, s.section, s.lines]))
  for (const k of ['product', 'title', 'short', 'scenarios', 'assets']) assert.deepEqual(b[k], a[k], k)
})

test('the deck the app imports (DECKS) has no notes on any story slide', () => {
  for (const s of DECKS.scholarclone.slides.filter((x) => x.n < 200)) {
    assert.deepEqual([s.say, s.ask, s.transition, s.limits, s.slots], ['', '', '', [], []], `slide ${s.n}`)
  }
})

// ---- the import graph: nothing the public page reaches may reach the notes ----

const RESOLVE_EXT = ['', '.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts', '/index.tsx']
function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith('@/') ? join(root, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null
  if (!base) return null // a package: not our code
  for (const ext of RESOLVE_EXT) {
    const p = base + ext
    if (existsSync(p) && statSync(p).isFile()) return p
  }
  return null
}
function reachable(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    if (!/\.(tsx?|mjs|js)$/.test(file)) continue // json and css are leaves
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const target = resolveImport(m[1] ?? m[2] ?? m[3], file)
      if (target) queue.push(target)
    }
  }
  return seen
}

test('nothing under the public page can reach the full deck JSON, the presenter deck or the presenter window', () => {
  const entries = [join(root, 'app/present/[product]/page.tsx'), join(root, 'app/present/layout.tsx')]
  for (const e of entries) assert.ok(existsSync(e), `missing ${e}`)
  const seen = new Set<string>()
  for (const e of entries) for (const f of reachable(e)) seen.add(f.replace(/\\/g, '/'))
  assert.ok([...seen].some((f) => f.endsWith('lib/client-presentation/generated/scholarclone.public.json')), 'the walk did not reach the public deck: the check is blind')
  assert.ok([...seen].some((f) => f.endsWith('components/domain/lms/client-presentation/client-presentation.tsx')), 'the walk did not reach the player: the check is blind')
  for (const banned of ['generated/scholarclone.deck.json', 'generated/atlas-presenter.json', 'lib/client-presentation/presenter-deck.ts', 'presenter-view.tsx']) {
    assert.deepEqual([...seen].filter((f) => f.endsWith(banned)), [], `the public page reaches ${banned}`)
  }
})

test('control: the signed-in page DOES reach the presenter deck (the walk can see it when it is there)', () => {
  const seen = [...reachable(join(root, 'app/module/lms/learning/client-presentation/[product]/page.tsx'))].map((f) => f.replace(/\\/g, '/'))
  assert.ok(seen.some((f) => f.endsWith('lib/client-presentation/presenter-deck.ts')))
  assert.ok(seen.some((f) => f.endsWith('generated/scholarclone.deck.json')))
})

test('only presenter-deck.ts imports the full deck JSON or the tour scripts among the app files', () => {
  const offenders: string[] = []
  const scan = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) scan(p)
      else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\./.test(name) && /generated\/(scholarclone\.deck|atlas-presenter)\.json/.test(readFileSync(p, 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, ''))) offenders.push(p.replace(/\\/g, '/'))
    }
  }
  for (const d of ['app', 'components/domain/lms/client-presentation', 'lib/client-presentation']) scan(join(root, d))
  assert.deepEqual(offenders.map((f) => f.split('/').slice(-2).join('/')), ['client-presentation/presenter-deck.ts'])
})
