import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { PosterArt } from './poster-art'
import { POSTER_FORMATS, fetchPosterContent, type PosterContent, type PosterFormat } from '@/lib/poster'

/**
 * Renders the hiring poster as a PNG.
 *
 * ── WHY THIS IS A SERVER ROUTE AND NOT A CANVAS IN THE BROWSER ──────────────
 *
 * Rasterising the DOM client-side was the obvious approach and it is blocked
 * three ways in this app: Tailwind v4 emits `oklch()` colours that DOM
 * rasterisers cannot parse; no webfont is actually loaded, so the poster would
 * render in whatever font the viewer's OS supplies and look different on every
 * machine; and the organisation logo is served from DigitalOcean Spaces with no
 * `Access-Control-Allow-Origin` header, which taints a canvas and makes
 * toBlob() throw.
 *
 * Server-side rendering answers all three: the fonts are committed and loaded
 * explicitly, the logo is fetched by PHP and arrives as a data URI, and the
 * output is identical on every machine.
 */

export const runtime = 'nodejs'          // resvg + reading font files
export const dynamic = 'force-dynamic'   // a tenant's poster is never cached

/**
 * Loaded once per process, not per request.
 *
 * DejaVu Sans is committed to public/fonts rather than fetched, so a render
 * never depends on the network. It is also the face dompdf uses for the A4
 * PDF, which is what keeps the PDF and the PNG looking like the same poster -
 * and unlike the Geist that next/og bundles, it contains U+2713 ✓, the tick
 * that every bullet on this poster uses.
 */
const FONTS = (async () => {
  const dir = join(process.cwd(), 'public', 'fonts')
  const [regular, bold] = await Promise.all([
    readFile(join(dir, 'DejaVuSans.ttf')),
    readFile(join(dir, 'DejaVuSans-Bold.ttf')),
  ])

  return [
    { name: 'DejaVu Sans', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'DejaVu Sans', data: bold, weight: 700 as const, style: 'normal' as const },
  ]
})()

function fail(message: string, status: number) {
  return Response.json({ status: 0, message }, { status })
}

function parseIds(raw: string | null): number[] {
  return Array.from(
    new Set(
      (raw ?? '')
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  )
}

async function render(content: PosterContent, filename: string, dropped: number) {
  const image = new ImageResponse(<PosterArt content={content} />, {
    width: content.format.width,
    height: content.format.height,
    fonts: await FONTS,
    /*
     * No emoji resolver. Satori's default fetches twemoji from a CDN, once per
     * glyph, inside the render and with no timeout - so a single emoji in a job
     * description would make this endpoint depend on a third party. Emoji is
     * stripped in PHP before it reaches here.
     */
    emoji: 'noto',
  })

  /*
   * ImageResponse is a STREAM: the response object exists before Satori has
   * drawn anything, so a render failure becomes a truncated 200 with a corrupt
   * PNG rather than an error. Buffering it here is what turns that into a
   * catchable exception and an honest 500.
   */
  const bytes = await image.arrayBuffer()

  return new Response(bytes, {
    headers: {
      'content-type': 'image/png',
      'content-disposition': `attachment; filename="${filename}"`,
      'content-length': String(bytes.byteLength),
      ...(dropped > 0 ? { 'x-poster-dropped': String(dropped) } : {}),
    },
  })
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const slug = (params.get('slug') ?? '').trim()
  const format = (params.get('format') ?? 'portrait') as PosterFormat
  const ids = parseIds(params.get('ids'))

  if (!slug) return fail('No organisation was given for the poster.', 422)
  if (!POSTER_FORMATS.includes(format) || format === 'a4') {
    // A4 is a PDF and is produced by Laravel; this route only draws images.
    return fail('That poster format is not an image.', 422)
  }
  if (ids.length === 0) return fail('No role was chosen for the poster.', 422)

  try {
    const payload = await fetchPosterContent(slug, ids, format)
    const filename = filenameFor(payload.data, 'png')

    return await render(payload.data, filename, payload.dropped?.length ?? 0)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The poster could not be produced.'

    // Deliberately a JSON error rather than a placeholder image: a poster that
    // silently renders "something" is worse than one that says it failed.
    return fail(message, 502)
  }
}

function filenameFor(content: PosterContent, extension: string): string {
  const base =
    content.roles.length === 1
      ? content.roles[0].title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      : 'open-roles'

  return `hiring-${base || 'poster'}-${content.format.name}.${extension}`
}
