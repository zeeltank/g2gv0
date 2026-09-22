'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { saveBlob } from '@/components/domain/hrms/hrit/payroll-management/shared/payroll-shell'
import { useCareersSlug } from '@/hooks/use-careers-slug'
import { POSTER_FORMATS, POSTER_FORMAT_LABELS, posterPdfUrl, type PosterFormat } from '@/lib/poster'

export type PosterNotice = { ok: boolean; message: string }

/**
 * Download a hiring poster. No UI — just the work.
 *
 * ── WHY A HOOK AS WELL AS A COMPONENT ───────────────────────────────────────
 *
 * The poster is offered in two shapes: a self-contained dropdown in the job
 * drawer, and plain items inside the job row's existing "..." menu. The second
 * cannot be a nested dropdown, because DropdownMenuSubTrigger and
 * DropdownMenuSubContent are not exported by components/ui and that directory
 * is off limits.
 *
 * Both call this, so the fetch, the filename, the dropped-role reporting and
 * the error wording exist once rather than twice.
 */
export function usePosterDownload(onNotice?: (notice: PosterNotice) => void) {
  const { slug } = useCareersSlug()
  const [busy, setBusy] = useState<PosterFormat | null>(null)

  async function download(ids: number[], format: PosterFormat) {
    if (!slug || ids.length === 0) return

    setBusy(format)
    try {
      /*
       * Two renderers, because neither can do the other's job: dompdf cannot
       * rasterise and Satori cannot emit PDF. Invisible from here — both
       * return a file and both go through the same save path.
       */
      const url =
        format === 'a4'
          ? posterPdfUrl(slug, ids)
          : `/api/talent/poster?${new URLSearchParams({ slug, ids: ids.join(','), format })}`

      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message ?? 'The poster could not be produced.')
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const named = /filename="([^"]+)"/.exec(disposition)?.[1]

      saveBlob(named ?? `hiring-poster.${format === 'a4' ? 'pdf' : 'png'}`, blob)

      /*
       * A role can close between being chosen and the button being pressed.
       * The file is still correct without it, but the person has to be told
       * which one is missing — and told AFTER the download, because they asked
       * for a file and blocking that to report it would be worse.
       */
      const dropped = Number(response.headers.get('x-poster-dropped') ?? 0)

      onNotice?.({
        ok: true,
        message: dropped
          ? `Poster downloaded with ${ids.length - dropped} of ${ids.length} roles. ${dropped} closed before it was built.`
          : 'Hiring poster downloaded.',
      })
    } catch (error) {
      onNotice?.({
        ok: false,
        message: error instanceof Error ? error.message : 'The poster could not be produced.',
      })
    } finally {
      setBusy(null)
    }
  }

  return { slug, busy, download }
}

/**
 * "Hiring poster" — one click, one file.
 *
 * ── WHY THERE IS NO PREVIEW ─────────────────────────────────────────────────
 *
 * By choice: the point was to replace an afternoon in Canva with a button.
 * That decision is exactly why the SERVER side is careful — every cap,
 * truncation and fallback is decided in PHP, because nobody sees the poster
 * before the public does.
 *
 * ── WHEN THIS RENDERS NOTHING ───────────────────────────────────────────────
 *
 * A poster's only actionable element is the Apply link, so it needs a public
 * careers page to point at. Two cases where that does not exist:
 *
 *   no careers slug   the organisation has no careers page at all — 7 of 12
 *                     tenants on live. The control is HIDDEN rather than
 *                     disabled: a disabled button with no explanation is a
 *                     support ticket.
 *   unpublished role  a draft or closed posting has no public page, so its
 *                     poster would carry a link to "This role is not
 *                     available". Disabled WITH a reason, because this one the
 *                     person can fix by publishing.
 */
export function PosterMenu({
  ids,
  published,
  label = 'Hiring poster',
  align = 'end',
  onNotice,
}: {
  /** One id for a single-role poster, up to three for a combined one. */
  ids: number[]
  published: boolean
  label?: string
  align?: 'start' | 'end'
  onNotice?: (notice: PosterNotice) => void
}) {
  const { slug, busy, download } = usePosterDownload(onNotice)

  if (!slug || ids.length === 0) return null

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        disabled={!published || busy !== null}
        title={
          published
            ? 'Download a poster for social media'
            : 'Publish this role first — a poster carries an Apply link, and it has to work'
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        {label}
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground">
          {ids.length > 1 ? `${ids.length} roles on one poster` : 'Choose a size'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {POSTER_FORMATS.map((format) => (
          <DropdownMenuItem
            key={format}
            disabled={busy !== null}
            onSelect={(event) => {
              // Without this the menu closes before the fetch starts and the
              // spinner on the trigger is never seen.
              event.preventDefault()
              void download(ids, format)
            }}
          >
            {POSTER_FORMAT_LABELS[format]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
