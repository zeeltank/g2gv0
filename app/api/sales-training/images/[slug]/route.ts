import { resolveApiBaseUrl } from '@/lib/api-config'

/**
 * A picture of the G2G sales presentation. The pictures are stored in the backend's sales_training_images table
 * and served by GET /api/sales-training/images/{slug}; this route passes them through, so the browser only ever
 * talks to this app (no cross-origin request, and the backend address is not exposed to the page).
 */
export const runtime = 'nodejs'

const SLUG = /^[a-z0-9-]{1,80}$/

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  if (!SLUG.test(slug)) return new Response('Not found', { status: 404 })

  const headers: Record<string, string> = {}
  const etag = request.headers.get('if-none-match')
  if (etag) headers['If-None-Match'] = etag

  let upstream: Response
  try {
    upstream = await fetch(`${resolveApiBaseUrl()}/sales-training/images/${slug}`, { headers, cache: 'no-store' })
  } catch {
    return new Response('The picture service is not reachable.', { status: 502 })
  }
  if (upstream.status === 304) return new Response(null, { status: 304 })
  if (!upstream.ok) return new Response('Not found', { status: upstream.status === 404 ? 404 : 502 })

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      ...(upstream.headers.get('etag') ? { ETag: upstream.headers.get('etag') as string } : {}),
    },
  })
}
