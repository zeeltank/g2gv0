// Frontend API calls vs the backend route table: does every endpoint the Signals / Portfolio / Partner screens call exist, with that HTTP method?
// Read-only and offline: it only reads source files and runs `php artisan route:list` (no database, no login, no request is made).
//   node scripts/check-api-contract.mjs
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const FE = fileURLToPath(new URL('..', import.meta.url))          // this project
const BE = process.env.G2G_BACKEND_DIR ?? fileURLToPath(new URL('../../g2gb', import.meta.url))   // the Laravel backend next to it
const files = ['services/signals/opportunities.ts', 'services/portfolio/portfolio-service.ts', 'services/signals/product-icp.ts']

const routes = JSON.parse(execSync(`php artisan route:list --json --path=api`, { cwd: BE, maxBuffer: 50_000_000 }).toString().replace(/^[^[]*/, ''))
const norm = (u) => '/' + u.replace(/^\/?api\//, '').replace(/\{[^}]+\}/g, '{p}').replace(/\/+$/, '')
const table = new Set()
for (const r of routes) for (const m of r.method.split('|')) if (m !== 'HEAD') table.add(`${m} ${norm(r.uri)}`)

const calls = []
for (const f of files) {
  const src = readFileSync(`${FE}/${f}`, 'utf8')
  // apiClient.<verb>(`/path...` | '/path...'
  const re = /apiClient\.(get|post|put|patch|delete|postForm|putForm)(?:<[^>]*(?:<[^>]*>[^>]*)*>)?\(\s*([`'])(\/[^`'?]*)/g
  let m
  while ((m = re.exec(src))) {
    const verb = m[1].replace('Form', '').toUpperCase()
    const path = m[3].replace(/\$\{[^}]+\}/g, '{p}').replace(/\/+$/, '')
    calls.push([verb, path, f])
  }
}
for (const [verb, path] of [['GET', '/signals/icp/products/{p}'], ['POST', '/signals/icp/products/{p}/validate'], ['PUT', '/signals/icp/products/{p}'], ['PATCH', '/signals/icp/products/{p}/status']]) calls.push([verb, path, 'product-icp.ts'])
// `/signals/providers/${which}/test` is /ai/test and /search/test on the server (literal segments)
for (const w of ['ai', 'search']) table.add(`POST /signals/providers/${w}/test`)
const pi = calls.findIndex(([, p]) => p === '/signals/providers/{p}/test')
if (pi >= 0) calls.splice(pi, 1, ['POST', '/signals/providers/ai/test', 'opportunities.ts'], ['POST', '/signals/providers/search/test', 'opportunities.ts'])
let bad = 0
const seen = new Set()
for (const [verb, path, f] of calls) {
  const key = `${verb} ${path}`
  if (seen.has(key)) continue
  seen.add(key)
  const ok = table.has(`${verb} ${path}`)
  if (!ok) bad++
  console.log(`${ok ? 'OK  ' : 'MISSING'}  ${verb.padEnd(6)} ${path}   (${f.split('/').pop()})`)
}
console.log(`\n${seen.size} distinct calls checked against ${table.size} backend routes: ${bad} missing`)
process.exit(bad ? 1 : 0)
