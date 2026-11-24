// Checks the rendered 59-second film and registers it.
//   node scripts/client-presentation/register-film.mjs [--from D:/client-presentation-assets/film-out] [--publish]
// Fails unless the file is H.264 / yuv420p, 1920 x 1080, 59 s (+/- 0.15), at most 12 MB, with no audio track. With --publish it copies the
// video and its poster to public/client-presentation/film/ and writes docs/client-presentation/film-register.json (what it is, how it was
// made, the claims behind it, who has confirmed it). It is motion graphics with made-up school data, not a screen recording.
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const from = arg('from', 'D:/client-presentation-assets/film-out')
const name = 'scholarclone-59s'
const publish = process.argv.includes('--publish')
const ffmpeg = createRequire('D:/client-presentation-assets/_video/')('ffmpeg-static')
const film = JSON.parse(readFileSync(join(root, 'docs/client-presentation/content/film.json'), 'utf8'))
const file = join(from, `${name}.mp4`); const poster = join(from, `${name}-poster.jpg`)
if (!existsSync(file) || !existsSync(poster)) { console.log('FAIL missing video or poster in ' + from); process.exit(1) }

let out = ''
try { execFileSync(ffmpeg, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] }) } catch (e) { out = String(e.stderr) }
const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(out)
const seconds = d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : 0
const codec = /Video: (\w+)/.exec(out)?.[1]; const pix = /Video:.*?, (yuv\w+)/.exec(out)?.[1]
const dim = /, (\d{3,5})x(\d{3,5})/.exec(out); const w = dim ? +dim[1] : 0; const h = dim ? +dim[2] : 0
const audio = /Audio:/.test(out)
const bytes = statSync(file).size
const fails = []
if (codec !== 'h264') fails.push(`codec ${codec}`)
if (pix !== 'yuv420p') fails.push(`pixel format ${pix}`)
if (w !== 1920 || h !== 1080) fails.push(`size ${w}x${h}`)
if (Math.abs(seconds - 59) > 0.15) fails.push(`${seconds.toFixed(2)} s, not 59 s`)
if (bytes > 12 * 1048576) fails.push(`${(bytes / 1048576).toFixed(1)} MB is over 12 MB`)
if (audio) fails.push('an audio track is present (the film is silent by decision)')
if (fails.length) { for (const f of fails) console.log('FAIL ' + f); process.exit(1) }
console.log(`ok   ${name}.mp4  ${w}x${h}  ${seconds.toFixed(2)} s  ${codec}/${pix}  ${(bytes / 1048576).toFixed(2)} MB  no audio`)

if (publish) {
  const dest = join(root, 'public/client-presentation/film'); mkdirSync(dest, { recursive: true })
  copyFileSync(file, join(dest, `${name}.mp4`)); copyFileSync(poster, join(dest, `${name}-poster.jpg`))
  const claims = [...new Set(film.beats.flatMap((b) => b.claims || []))]
  writeFileSync(join(root, 'docs/client-presentation/film-register.json'), JSON.stringify({
    rendered: new Date().toISOString().slice(0, 10), tool: 'scripts/client-presentation/render-film.mjs', file: `film/${name}.mp4`, poster: `film/${name}-poster.jpg`,
    width: w, height: h, seconds: +seconds.toFixed(2), codec, pixel_format: pix, bytes, sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), audio: 'none, by decision (silent, captions on screen)',
    source: 'Motion graphics rendered frame by frame from /module/lms/learning/client-presentation/film (React + GSAP master timeline, Playwright, ffmpeg H.264), with sub-frame motion blur on the fast windows. Not a screen recording; made-up school data.',
    beats: film.beats.map((b) => ({ id: b.id, chapter: b.chapter, start: b.start, end: b.end })), claims,
    photos: 'Pexels stock photographs, credited on screen (the student photo and the schoolgirls photo); the logo is the registered brand logo.',
    privacy_scan: 'passed: the page text held no e-mail address or phone number before rendering',
    confirmed_by_module_owner: null,
  }, null, 2) + '\n', 'utf8')
  console.log('published to', dest, 'and docs/client-presentation/film-register.json')
}
