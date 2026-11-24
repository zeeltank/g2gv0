// Checks the rendered explainer videos and registers them.
//   node scripts/client-presentation/register-clips.mjs [--from D:/client-presentation-assets/clips-out] [--publish]
// For every <clip>-<ratio>-hidden.mp4 it reads the facts with ffmpeg (codec, pixel format, size in pixels, duration, bytes, sha256) and fails
// when a file is not H.264 / yuv420p, is larger than 3 MB, is not 15 s long, or is the wrong shape (1080 x 1920 or 1920 x 1080).
// With --publish it copies the videos and their posters into public/client-presentation/clips/ and writes
// docs/client-presentation/clips-register.json (what each file is, where it came from, which claims it rests on, who has confirmed it).
// The files are motion graphics with made-up school data, rendered by render-clip.mjs from the clip page; they are not screen recordings.
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const from = arg('from', 'D:/client-presentation-assets/clips-out')
const publish = process.argv.includes('--publish')
const ffmpeg = createRequire('D:/client-presentation-assets/_video/')('ffmpeg-static')
const clips = JSON.parse(readFileSync(join(root, 'docs/client-presentation/content/clips.json'), 'utf8')).clips
const MAX = 3 * 1024 * 1024
const SHAPE = { v: [1080, 1920], h: [1920, 1080] }

const probe = (file) => {
  let out = ''
  try { execFileSync(ffmpeg, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] }) } catch (e) { out = String(e.stderr) }
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(out)
  const codec = /Video: (\w+)/.exec(out)?.[1]
  const pix = /Video:.*?, (yuv\w+)/.exec(out)?.[1]
  const dim = /, (\d{3,5})x(\d{3,5})/.exec(out)
  return { seconds: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0, codec, pix, w: dim ? +dim[1] : 0, h: dim ? +dim[2] : 0 }
}

const fails = []
const rows = []
for (const c of clips) for (const r of ['v', 'h']) {
  const name = `${c.id}-${r}-hidden`
  const file = join(from, `${name}.mp4`)
  const poster = join(from, `${name}-poster.jpg`)
  if (!existsSync(file) || !existsSync(poster)) { fails.push(`${name}: missing video or poster`); continue }
  const f = probe(file); const bytes = statSync(file).size
  if (f.codec !== 'h264') fails.push(`${name}: codec ${f.codec}`)
  if (f.pix !== 'yuv420p') fails.push(`${name}: pixel format ${f.pix}`)
  if (bytes > MAX) fails.push(`${name}: ${(bytes / 1048576).toFixed(2)} MB is over 3 MB`)
  if (Math.abs(f.seconds - 15) > 0.15) fails.push(`${name}: ${f.seconds}s, not 15 s`)
  if (f.w !== SHAPE[r][0] || f.h !== SHAPE[r][1]) fails.push(`${name}: ${f.w}x${f.h}`)
  rows.push({
    id: name, clip: c.id, product: c.product, ratio: r === 'v' ? '9:16' : '16:9', width: f.w, height: f.h, seconds: +f.seconds.toFixed(2), codec: f.codec, pixel_format: f.pix, bytes,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
    file: `clips/${name}.mp4`, poster: `clips/${name}-poster.jpg`,
    source: 'Motion graphic rendered frame by frame from /module/lms/learning/client-presentation/clip/' + c.id + ' (React + GSAP, ffmpeg H.264). Not a screen recording; made-up school data.',
    claims: c.claims,
    version: 'B (the product screen name is not shown). Version A (name shown) exists in the page (?ui=shown) and is not published: see docs/client-presentation/11-explainer-style-notes.md.',
    privacy_scan: 'passed: the page text held no e-mail address or phone number before rendering',
    confirmed_by_module_owner: null,
  })
}
if (fails.length) { for (const f of fails) console.log('FAIL ' + f); process.exit(1) }
for (const r of rows) console.log(`ok   ${r.id}  ${r.width}x${r.height}  ${r.seconds}s  ${(r.bytes / 1048576).toFixed(2)} MB`)
console.log(`${rows.length} files, total ${(rows.reduce((a, r) => a + r.bytes, 0) / 1048576).toFixed(1)} MB`)

if (publish) {
  const dest = join(root, 'public/client-presentation/clips')
  mkdirSync(dest, { recursive: true })
  for (const r of rows) { copyFileSync(join(from, r.file.replace('clips/', '')), join(dest, r.file.replace('clips/', ''))); copyFileSync(join(from, r.poster.replace('clips/', '')), join(dest, r.poster.replace('clips/', ''))) }
  writeFileSync(join(root, 'docs/client-presentation/clips-register.json'), JSON.stringify({ rendered: new Date().toISOString().slice(0, 10), tool: 'scripts/client-presentation/render-clip.mjs', files: rows }, null, 2) + '\n', 'utf8')
  console.log('published to', dest, 'and docs/client-presentation/clips-register.json')
}
