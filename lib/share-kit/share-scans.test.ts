import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { pathToFileURL } from 'node:url'
import { NextRequest } from 'next/server'
import ts from 'typescript'
import { proxy } from '../../proxy'
import { TOKEN } from './shared-kit-fixtures'

/**
 * What the screen tests of the public page cannot see: that the page and what it reaches know nothing of sign-in, the person's browser or any authenticated API; that it says "noindex" in its own
 * metadata; that the headers of /share are the very headers of /present, word for word; and that /share, like /present, gets through `proxy.ts` without the sign-in cookie while the pages that
 * are protected still are. Paths are from the repository root, where the tests run.
 */

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')

const PAGE = 'app/share/kit/[token]/page.tsx'
const PAGE_LOGIC = 'app/share/kit/[token]/shared-kit-page.tsx'
const PAGE_VIEW = 'app/share/kit/[token]/shared-kit-view.tsx'
const LAYOUT = 'app/share/layout.tsx'
const LIB = 'lib/share-kit/shared-item.ts'
const PUBLIC_FILES = [PAGE, PAGE_LOGIC, PAGE_VIEW, LAYOUT, LIB]

function importsOf(source: string): string[] {
  const file = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  file.forEachChild((node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text)
  })
  return found
}

describe('the public page knows nothing of sign-in, storage or an authenticated API', () => {
  it('finds every file it scans', () => {
    for (const file of PUBLIC_FILES) assert.ok(existsSync(join(root, file)), file)
  })

  it('imports only what it needs, file by file', () => {
    const allowed: Record<string, string[]> = {
      [PAGE]: ['next', './shared-kit-page'],
      [PAGE_LOGIC]: ['next/navigation', '@/lib/api-config', '@/lib/share-kit/shared-item', './shared-kit-view'],
      [PAGE_VIEW]: ['react', '@/components/domain/lms/client-presentation/public-player', '@/lib/share-kit/shared-item'],
      [LAYOUT]: ['next', 'react', '@/app/module/lms/learning/client-presentation/layout'],
      [LIB]: ['@/lib/api-config', '@/lib/client-presentation/link'],
    }
    for (const [file, list] of Object.entries(allowed)) assert.deepEqual(importsOf(read(file)).sort(), [...list].sort(), file)
  })

  it('reads nothing from the visitor\'s browser, sets nothing, keeps no state, and sends no credential', () => {
    for (const file of PUBLIC_FILES) {
      const source = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|next\/headers|cookies\(|headers\(\)/, file)
      assert.doesNotMatch(source, /'use client'|\buse(State|Effect|Layout|Router|Context)\b/, `${file} is a server file with no script of its own`)
      assert.doesNotMatch(source, /Authorization|Bearer|getLaravelContext|readLaravelSession|[?&]token=/, file)
    }
    assert.match(read(LIB), /credentials: 'omit'/)
    assert.match(read(LIB), /cache: 'no-store'/)
    assert.match(read(LIB), /redirect: 'error'/)
  })

  it('says noindex in its own metadata, never caches, and asks the server again on every request', () => {
    assert.match(read(PAGE), /robots: 'noindex, nofollow/)
    assert.match(read(PAGE), /referrer: 'no-referrer'/)
    assert.match(read(PAGE), /export const dynamic = 'force-dynamic'/)
    assert.match(read(LAYOUT), /robots: 'noindex, nofollow/)
    assert.match(read(LAYOUT), /referrer: 'no-referrer'/)
  })

  it('calls no font loader in its own layout: that stays in the original layout module', () => {
    assert.doesNotMatch(read(LAYOUT), /\blocalFont\(|next\/font/)
    assert.match(read('app/module/lms/learning/client-presentation/layout.tsx'), /localFont\(/)
  })
})

// ---- the import graph: nothing the public page reaches may reach sign-in, the presenter notes or the person's browser ----

const RESOLVE_EXT = ['', '.ts', '.tsx', '.js', '.mjs', '.json', '/index.ts', '/index.tsx']
function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith('@/') ? join(root, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null
  if (!base) return null
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
    if (!/\.(tsx?|mjs|js)$/.test(file)) continue
    for (const m of readFileSync(file, 'utf8').matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const target = resolveImport(m[1] ?? m[2] ?? m[3], file)
      if (target) queue.push(target)
    }
  }
  return seen
}
const rel = (file: string) => file.split('\\').join('/').replace(`${root.split('\\').join('/')}/`, '')

describe('everything the public page reaches', () => {
  const seen = new Set<string>()
  for (const entry of [PAGE, LAYOUT]) for (const file of reachable(join(root, entry))) seen.add(rel(file))
  const code = [...seen].filter((f) => /\.(tsx?|mjs|js)$/.test(f))

  it('reaches the public player and the deck data (so the checks below are not blind)', () => {
    assert.ok(code.includes('components/domain/lms/client-presentation/public-player.tsx'))
    assert.ok(code.includes('components/domain/lms/client-presentation/client-presentation.tsx'))
    assert.ok(seen.has('lib/client-presentation/generated/scholarclone.public.json'))
  })

  it('does not reach the full deck, the presenter notes or the presenter window', () => {
    for (const banned of ['generated/scholarclone.deck.json', 'generated/atlas-presenter.json', 'lib/client-presentation/presenter-deck.ts', 'presenter-view.tsx']) {
      assert.deepEqual([...seen].filter((f) => f.endsWith(banned)), [], banned)
    }
  })

  it('does not reach sign-in, the session, the authenticated API client, any service or any hook', () => {
    const offenders = code.filter((f) => /^(components\/auth|services|hooks)\//.test(f) || /laravel-session|laravel-context|gtg-auth|protected-layout|api-client/.test(f))
    assert.deepEqual(offenders, [])
  })

  it('does not reach a line that reads the visitor\'s storage or cookies', () => {
    const offenders = code.filter((f) => /localStorage|sessionStorage|document\.cookie/.test(readFileSync(join(root, f), 'utf8')))
    assert.deepEqual(offenders, [])
  })

  it('control: the walk does see sign-in and services where they are reached (the signed-in Sales Kit panel)', () => {
    const panel = [...reachable(join(root, 'components/domain/portfolio/product-sales-kit.tsx'))].map(rel)
    assert.ok(panel.some((f) => f.startsWith('services/')), 'the walk is not blind to services')
  })
})

// ---- the headers: /share is /present, word for word ----

const EXPECTED_HEADERS = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
]

async function configuredHeaders() {
  const config = (await import(pathToFileURL(join(root, 'next.config.mjs')).href)).default as { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> }
  return config.headers()
}

describe('the headers of /share', () => {
  it('are exactly these, for everything under /share, the plain 404 of a refused link included', async () => {
    const block = (await configuredHeaders()).filter((b) => b.source === '/share/:path*')
    assert.equal(block.length, 1, 'one block for /share')
    assert.deepEqual(block[0].headers, EXPECTED_HEADERS)
  })

  it('are the headers of /present, which are unchanged', async () => {
    const all = await configuredHeaders()
    const present = all.find((b) => b.source === '/present/:path*')
    const share = all.find((b) => b.source === '/share/:path*')
    assert.deepEqual(present?.headers, EXPECTED_HEADERS, '/present still gets every header it had')
    assert.deepEqual(share?.headers, present?.headers)
  })

  it('never index, never cache, never pass on a referrer, never allow a frame, never sniff', async () => {
    const share = (await configuredHeaders()).find((b) => b.source === '/share/:path*')!
    const value = (key: string) => share.headers.find((h) => h.key === key)?.value ?? ''
    assert.match(value('X-Robots-Tag'), /noindex/)
    assert.match(value('X-Robots-Tag'), /nofollow/)
    assert.match(value('Cache-Control'), /no-store/)
    assert.equal(value('Referrer-Policy'), 'no-referrer')
    assert.equal(value('X-Frame-Options'), 'DENY')
    assert.equal(value('Content-Security-Policy'), "frame-ancestors 'none'")
    assert.equal(value('X-Content-Type-Options'), 'nosniff')
  })

  it('leave every other block of the config as it was (the simulation runtime and the learning sites)', async () => {
    const sources = (await configuredHeaders()).map((b) => b.source)
    assert.deepEqual(sources, ['/sim-runtime/:path*', '/sim-runtime/assets/:path*', '/sim-runtime/index.html', '/present/:path*', '/share/:path*', '/learning/product-learning/:path*'])
  })
})

// ---- proxy.ts ----

describe('proxy.ts', () => {
  const call = (path: string, cookie = false) => proxy(new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie: 'gtg-session=1' } } : {}))
  const passes = (response: Response) => response.headers.get('x-middleware-next') === '1' && response.status === 200

  it('lets /share/kit/<token> through without the sign-in cookie, as it does /present', () => {
    assert.ok(passes(call(`/share/kit/${TOKEN}`)), '/share')
    assert.ok(passes(call('/present/scholarclone?k=signed')), '/present')
    assert.equal(call(`/share/kit/${TOKEN}`).headers.get('set-cookie'), null, 'and sets no cookie')
  })

  it('still sends a signed-out visitor to the sign-in page for a protected one (the control: the check is not blind)', () => {
    for (const path of ['/dashboard', '/profile', '/module/crm/leads']) {
      const response = call(path)
      assert.equal(response.status, 307, path)
      assert.match(response.headers.get('location') ?? '', /\/login\?redirect=/, path)
      assert.ok(passes(call(path, true)), `${path} with the cookie`)
    }
  })

  it('does not list /share or /present among the protected routes', () => {
    const source = read('proxy.ts')
    const list = /const protectedRoutes = \[([^\]]*)\]/.exec(source)?.[1] ?? ''
    assert.ok(list.includes("'/dashboard'"), 'the control: the list was read')
    assert.doesNotMatch(list, /share|present/)
  })
})
