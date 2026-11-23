// Builds the public deck the browser renders from the checked story and the asset register.
//   node scripts/client-presentation/export-deck.mjs
// Reads  docs/client-presentation/content/scholarclone.story.json and docs/client-presentation/assets/assets.json
// Writes lib/client-presentation/generated/scholarclone.deck.json
// Left OUT on purpose (internal, never shipped to the browser): claims and their sources, visual and motion direction, owner decisions.
// An image slot gets a src only when its register row is 'authorised' and its file exists under public/.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const story = JSON.parse(readFileSync(join(root, 'docs/client-presentation/content/scholarclone.story.json'), 'utf8'))
const reg = JSON.parse(readFileSync(join(root, 'docs/client-presentation/assets/assets.json'), 'utf8'))

const assets = {}
for (const r of reg.slots) {
  const file = r.file && existsSync(join(root, 'public', r.file)) ? '/' + r.file.replace(/\\/g, '/') : null
  assets[r.slot] = {
    type: r.type,
    src: r.status === 'authorised' && file ? file : null,
    alt: r.alt_text || null,
    credit: r.status === 'authorised' ? r.credit_line || null : null,
    ai: Boolean(r.generated_by_ai),
    w: r.width || null,
    h: r.height || null,
    focus: r.focus || null,
  }
}

const deck = {
  product: story.meta.product,
  title: story.meta.title_in_my_learning,
  slides: story.slides.map((s) => ({
    n: s.n,
    id: s.id,
    section: s.section,
    badge: s.badge ?? null,
    lines: s.on_slide.map((l) => {
      const o = { role: l.role, text: l.text, kind: l.kind }
      if (l.mark) o.mark = l.mark
      if (l.badge) o.badge = l.badge
      return o
    }),
    say: s.say,
    ask: s.ask,
    transition: s.transition || '',
    slots: s.slots.map((x) => ({ id: x.id, type: x.type, brief: x.brief })),
  })),
  short: story.short_version.map((x) => ({ n: x.n, title: x.title, uses: x.uses })),
  scenarios: story.scenarios.map((x) => ({
    id: x.id, n: x.n, title: x.title, label: x.label, slide: x.slide,
    situation: x.situation, challenge: x.challenge, capability: x.capability, next_action: x.next_action, value: x.value,
  })),
  assets,
}
const body = JSON.stringify(deck, null, 1)
deck.source_sha256 = createHash('sha256').update(JSON.stringify([story.slides, story.short_version, story.scenarios])).digest('hex').slice(0, 16)
const out = join(root, 'lib/client-presentation/generated/scholarclone.deck.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(deck, null, 1) + '\n', 'utf8')
console.log('wrote', out, `(${body.length} bytes, ${deck.slides.length} slides, ${Object.values(assets).filter((a) => a.src).length}/${Object.keys(assets).length} images placed)`)
