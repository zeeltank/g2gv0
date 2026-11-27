// An outside check on the tour pictures: reads every registered image (assets/tour-art.json) with an OCR engine and reports the words it finds.
//   node scripts/client-presentation/ocr-tour-art.mjs [--family learn]
// WHY: all words on a slide are live text. A generated or downloaded cartoon or sketch must carry NO text of its own (a stray word in a picture cannot be
// checked against the claims, and generated text is often wrong). A photograph may show incidental text (a sticky note, a book spine); those are listed so a
// person can confirm none is a name, a school, a logo or personal data. Exit code 1 if a cartoon or sketch contains 3 or more letters in a row that OCR reads
// with confidence above 60 (a few stray marks are normal for a chalk drawing, so the rule counts words, not marks).
// LIMIT: it reads horizontal text; text tilted by 15 degrees or more is missed (control run 27 Nov 2026: horizontal words burnt into a cartoon were found,
// the tilted printed words of the exam photo were not). So it never replaces a person looking at every picture, which is also done and recorded in the register.
// Needs tesseract.js (installed outside the repo: D:/client-presentation-assets/_ocr; the first run downloads the English language data once).
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1] }
const family = arg('family', null)
const { createWorker } = createRequire('D:/client-presentation-assets/_ocr/')('tesseract.js')
const sharp = createRequire(join(root, 'package.json'))('sharp')
const register = JSON.parse(readFileSync(join(root, 'docs/client-presentation/assets/tour-art.json'), 'utf8')).images.filter((x) => !family || x.family === family)
// the language data is cached next to the OCR install, never in the repository (a first version dropped a 5 MB eng.traineddata into the working directory)
const worker = await createWorker('eng', 1, { cachePath: 'D:/client-presentation-assets/_ocr' })
let bad = 0
for (const im of register) {
  const file = join(root, 'public/client-presentation/tour', im.family, im.file)
  // flatten alpha onto white and enlarge small pictures, which is how a person would see them on the page
  const png = await sharp(file).flatten({ background: '#ffffff' }).resize({ width: 1600, withoutEnlargement: false }).png().toBuffer()
  const { data } = await worker.recognize(png)
  const words = data.words.filter((w) => w.confidence > 60 && /[A-Za-z]{3,}/.test(w.text)).map((w) => w.text.replace(/[^A-Za-z0-9]/g, '')).filter((t) => t.length >= 3)
  const verdict = im.kind === 'photo' ? (words.length ? `incidental text, to be reviewed by a person: ${words.slice(0, 12).join(' ')}` : 'no readable text') : (words.length >= 3 ? `FAIL: text inside a ${im.kind}: ${words.slice(0, 12).join(' ')}` : words.length ? `ok (stray: ${words.join(' ')})` : 'no text')
  if (verdict.startsWith('FAIL')) bad++
  console.log(`${im.id.padEnd(40)} ${im.kind.padEnd(8)} ${verdict}`)
}
await worker.terminate()
console.log(bad ? `${bad} picture(s) carry text of their own` : `${register.length} pictures read: no cartoon or sketch carries text`)
process.exit(bad ? 1 : 0)
