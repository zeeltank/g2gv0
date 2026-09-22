/**
 * Render every poster variant so a human can look at them.
 *
 * ── WHY THIS SCRIPT EXISTS ──────────────────────────────────────────────────
 *
 * The poster downloads on one click with no preview, so there is no moment in
 * the product where anybody sees it before the public does. This is the
 * substitute: a contact sheet rendered from real content, looked at once before
 * a change ships.
 *
 * It is deliberately NOT a CI gate. Pixel-diffing a Satori render against a
 * dompdf render is a losing game, and a test that fails on a one-pixel shift
 * gets disabled within a month. This is for eyes.
 *
 * Usage:
 *   node scripts/poster-proof.mjs <dir-of-content-json> [out-dir]
 *
 * The JSON files are what GET /careers/{slug}/poster-content returns - capture
 * them from the live API, so the proof runs against real job adverts rather
 * than fixtures that quietly stop resembling them.
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { ImageResponse } from 'next/og'
import { PosterArt } from '../app/api/talent/poster/poster-art.tsx'

const inputDir = process.argv[2]
const outDir = process.argv[3] ?? join(inputDir, 'png')

if (!inputDir) {
  console.error('usage: node scripts/poster-proof.mjs <dir-of-content-json> [out-dir]')
  process.exit(1)
}

const fontDir = join(process.cwd(), 'public', 'fonts')
const [regular, bold] = await Promise.all([
  readFile(join(fontDir, 'DejaVuSans.ttf')),
  readFile(join(fontDir, 'DejaVuSans-Bold.ttf')),
])

const fonts = [
  { name: 'DejaVu Sans', data: regular, weight: 400, style: 'normal' },
  { name: 'DejaVu Sans', data: bold, weight: 700, style: 'normal' },
]

await mkdir(outDir, { recursive: true })

const files = (await readdir(inputDir)).filter((f) => extname(f) === '.json')

if (files.length === 0) {
  console.error(`no .json content files in ${inputDir}`)
  process.exit(1)
}

let failures = 0

for (const file of files) {
  const name = basename(file, '.json')
  const content = JSON.parse(await readFile(join(inputDir, file), 'utf8'))

  try {
    const image = new ImageResponse(PosterArt({ content }), {
      width: content.format.width,
      height: content.format.height,
      fonts,
      emoji: 'noto',
    })

    // Buffer, so a Satori failure is an exception rather than a truncated file.
    const bytes = Buffer.from(await image.arrayBuffer())
    await writeFile(join(outDir, `${name}.png`), bytes)

    console.log(
      `  ok    ${name.padEnd(24)} ${String(content.format.width).padStart(4)}x${String(content.format.height).padEnd(5)} ` +
        `${content.layout.padEnd(13)} ${(bytes.length / 1024).toFixed(0).padStart(4)}KB`,
    )
  } catch (error) {
    failures++
    console.log(`  FAIL  ${name.padEnd(24)} ${error.message}`)
  }
}

console.log(`\n${files.length - failures} of ${files.length} rendered into ${outDir}`)
process.exit(failures ? 1 : 0)
