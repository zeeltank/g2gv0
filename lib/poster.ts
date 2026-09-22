import { resolveApiBaseUrl } from '@/lib/api-config'

/**
 * The hiring poster's data contract.
 *
 * ── THIS FILE HOLDS NO RULES ────────────────────────────────────────────────
 *
 * Every content decision - how the description is parsed, how many bullets fit
 * a format, where a line is truncated, what happens when a panel is empty, what
 * the facts strip says when salary is null - is made once, in PHP, by
 * PosterContentService.
 *
 * The reason is not tidiness. The A4 PDF is drawn by dompdf in Laravel and the
 * PNGs are drawn by Satori here, because neither renderer can do the other's
 * job. If both sides decided content, the PDF and the PNG would eventually
 * disagree about what the role requires - two different adverts for one job,
 * and nobody would notice because the two are never seen side by side.
 *
 * So these types mirror the PHP payload exactly, and the renderer turns
 * finished strings into pixels. If you find yourself adding a .slice() or a
 * fallback here, it belongs in PosterContentService instead.
 */

export const POSTER_FORMATS = ['portrait', 'square', 'landscape', 'a4'] as const
export type PosterFormat = (typeof POSTER_FORMATS)[number]

export const POSTER_FORMAT_LABELS: Record<PosterFormat, string> = {
  portrait: 'Portrait · 1080×1350',
  square: 'Square · 1080×1080',
  landscape: 'Landscape · 1200×630',
  a4: 'A4 print · PDF',
}

/** Which arrangement to draw. Chosen in PHP so both renderers agree. */
export type PosterLayout = 'standard' | 'single-panel' | 'hero' | 'multi'

export type PosterPanel = {
  heading: string
  style: 'primary' | 'secondary'
  /** `chips` is the skills fallback; `list` gets ticks. */
  kind: 'list' | 'chips'
  items: string[]
}

export type PosterFact = { label: string; value: string }

export type PosterRole = {
  id: number
  title: string
  /** Already stepped down for the title's length. */
  title_size: number
  department: string | null
  panels: PosterPanel[]
  facts: PosterFact[]
}

export type PosterPalette = {
  navy: string
  blue: string
  blue_soft: string
  green: string
  green_soft: string
  ink: string
  muted: string
  line: string
  paper: string
}

export type PosterContent = {
  format: {
    name: PosterFormat
    label: string
    width: number
    height: number
    headline_size: number
  }
  brand: {
    name: string
    initials: string
    website: string | null
    /** A data URI - fetched server-side, so no CORS and no remote load. */
    logo: string | null
    logo_width: number | null
    logo_height: number | null
  }
  copy: Record<string, string>
  palette: PosterPalette
  roles: PosterRole[]
  apply_url: string
  layout: PosterLayout
}

export type PosterDropped = { id: number; reason: string }

export type PosterContentResponse = {
  status: number
  data: PosterContent
  dropped: PosterDropped[]
  message?: string
}

/**
 * Fetch the finished poster content.
 *
 * Unauthenticated on purpose: a poster advertises a job that is already public,
 * and the Sanctum token lives in localStorage where server code cannot read it.
 * An authenticated route would have to carry the token in a URL, and
 * next.config.mjs logs full fetch URLs.
 */
export async function fetchPosterContent(
  slug: string,
  ids: number[],
  format: PosterFormat,
): Promise<PosterContentResponse> {
  const query = new URLSearchParams({ ids: ids.join(','), format })
  const url = `${resolveApiBaseUrl()}/careers/${encodeURIComponent(slug)}/poster-content?${query}`

  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
  const payload = (await response.json().catch(() => null)) as PosterContentResponse | null

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message ?? 'The poster could not be prepared.')
  }

  return payload
}

/** The A4 PDF is produced by Laravel; the browser fetches it directly. */
export function posterPdfUrl(slug: string, ids: number[]): string {
  const query = new URLSearchParams({ ids: ids.join(',') })

  return `${resolveApiBaseUrl()}/careers/${encodeURIComponent(slug)}/poster.pdf?${query}`
}

export function posterFilename(content: PosterContent, extension: string): string {
  const base =
    content.roles.length === 1
      ? content.roles[0].title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      : 'open-roles'

  return `hiring-${base || 'poster'}.${extension}`
}
