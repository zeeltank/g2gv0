// Joins the five 16:9 explainer clips into one "See it work" reel with half-second cross-fades (for the Motion PowerPoint, slide 16).
//   node scripts/client-presentation/make-reel.mjs [--out D:/client-presentation-assets/slides-motion] [--width 1600] [--cover <png>]
// Order: Core, Learn, CCB, Insight, Compass (the order of the "See it work" slide). Each clip ends on its own product-name card.
// Writes s16-reel.mp4 and s16-poster.jpg (the cover: the given image, else the first clip's finished frame).
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const out = arg('out', 'D:/client-presentation-assets/slides-motion'); mkdirSync(out, { recursive: true })
const W = Number(arg('width', 1600)); const H = Math.round((W * 9) / 16)
const ffmpeg = createRequire('D:/client-presentation-assets/_video/')('ffmpeg-static')
const ids = ['core', 'learn', 'ccb', 'insight', 'compass']
const clips = ids.map((id) => join(root, 'public/client-presentation/clips', `${id}-h-hidden.mp4`))
for (const c of clips) if (!existsSync(c)) throw new Error('missing ' + c)

const FADE = 0.5; const LEN = 15
const inputs = clips.flatMap((c) => ['-i', c])
let graph = ''; let prev = '[0:v]'
for (let i = 1; i < clips.length; i++) {
  const offset = (LEN - FADE) * i
  graph += `${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset}[x${i}];`
  prev = `[x${i}]`
}
graph += `${prev}scale=${W}:${H}:flags=lanczos,format=yuv420p[v]`
const file = join(out, 's16-reel.mp4')
execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-r', '30', '-movflags', '+faststart', '-an', file])
const cover = arg('cover', null)
if (cover) copyFileSync(cover, join(out, 's16-poster.jpg'))
else copyFileSync(join(root, 'public/client-presentation/clips', 'core-h-hidden-poster.jpg'), join(out, 's16-poster.jpg'))
console.log('wrote', file, `${(statSync(file).size / 1048576).toFixed(2)} MB`, `${((LEN - FADE) * (clips.length - 1) + LEN).toFixed(1)} s`)
