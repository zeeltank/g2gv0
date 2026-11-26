// A tiny static server for the film studio page. Usage: node server.mjs [port]   (default 3320)
//   /                 this folder (index.html, src/)
//   /vendor/three/    node_modules/three          /vendor/gsap/   node_modules/gsap
//   /assets/          FILM_ASSETS (CC0 models, HDRIs, textures; see fetch-assets.mjs)
//   /photos/          the deck's registered photographs and logo    /fonts/   the deck's self-hosted Fraunces and Manrope
//   /data/film.json   the film's text (generated from docs/client-presentation/content/film.json)
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const assets = process.env.FILM_ASSETS || 'D:/client-presentation-assets/film3d/assets'
const MOUNTS = [
  ['/vendor/three/', join(here, 'node_modules/three')],
  ['/vendor/gsap/', join(here, 'node_modules/gsap')],
  ['/assets/', assets],
  ['/photos/', join(repo, 'public/client-presentation/scholarclone')],
  ['/fonts/', join(repo, 'components/domain/lms/client-presentation/fonts')],
  ['/data/', join(repo, 'lib/client-presentation/generated')],
  ['/screens/', join(repo, 'public/client-presentation/atlas')],   // the masked K12 screens (the Scholar Core film)
  ['/', here],
]
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.hdr': 'application/octet-stream', '.woff2': 'font/woff2', '.css': 'text/css' }

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  for (const [prefix, dir] of MOUNTS) {
    if (!url.startsWith(prefix)) continue
    let rel = url.slice(prefix.length) || 'index.html'
    if (rel.endsWith('/')) rel += 'index.html'
    const file = normalize(join(dir, rel))
    if (!file.startsWith(normalize(dir))) break
    if (existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' })
      return createReadStream(file).pipe(res)
    }
  }
  res.writeHead(404); res.end('not found: ' + url)
}).listen(Number(process.argv[2] || 3320), '127.0.0.1', () => console.log('film studio on http://127.0.0.1:' + (process.argv[2] || 3320)))
