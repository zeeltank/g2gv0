/**
 * A flat "folded-corner page + colored label band" file glyph — the generic
 * icon-pack convention (not any one app's actual logo/trademark) used by
 * every reference the document library's icons were modeled on: a white
 * page, a folded top-right corner, and a solid-color band carrying the
 * extension as bold text. One shared shape, recolored and relabeled per
 * extension, so the whole library reads as one icon family rather than a
 * mix of unrelated glyphs.
 */

export interface FileTypeMeta {
  /** Short text baked into the colored band — usually the extension, 3-4 chars so it still fits at small sizes. */
  label: string
  color: string
}

const PDF: FileTypeMeta = { label: 'PDF', color: '#E53935' }
const DOC: FileTypeMeta = { label: 'DOC', color: '#2B579A' }
const XLS: FileTypeMeta = { label: 'XLS', color: '#1D6F42' }
const CSV: FileTypeMeta = { label: 'CSV', color: '#1D6F42' }
const PPT: FileTypeMeta = { label: 'PPT', color: '#D24726' }
const TXT: FileTypeMeta = { label: 'TXT', color: '#64748B' }
const IMG_COLOR = '#7C3AED'
const GENERIC_COLOR = '#64748B'

/** Same mime/extension matching `iconFor()` used before this, just resolved to a {label, color} pair instead of a lucide icon + tint class. */
export function getFileTypeMeta(mimeType: string | null, fileName: string | null): FileTypeMeta {
  const mime = (mimeType ?? '').toLowerCase()
  const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? ''

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
    return { label: ext ? ext.slice(0, 4).toUpperCase() : 'IMG', color: IMG_COLOR }
  }
  if (mime === 'application/pdf' || ext === 'pdf') return PDF
  if (ext === 'csv') return CSV
  if (['xls', 'xlsx'].includes(ext)) return XLS
  if (['ppt', 'pptx'].includes(ext)) return PPT
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return DOC
  if (ext === 'txt') return TXT

  return { label: ext ? ext.slice(0, 4).toUpperCase() : 'FILE', color: GENERIC_COLOR }
}

export function FileTypeIcon({
  mimeType,
  fileName,
  className,
}: {
  mimeType: string | null
  fileName: string | null
  className?: string
}) {
  const { label, color } = getFileTypeMeta(mimeType, fileName)

  return (
    // Solid flat shape, no stroke/outline — same flat-silhouette language
    // as FolderIcon3D's own resting state (a solid fill plus one darker
    // shade for the folded-over bit), not an outlined page icon.
    <svg viewBox="0 0 60 76" className={className} aria-hidden="true">
      <path d="M10 2 H36 L50 16 V70 Q50 74 46 74 H10 Q6 74 6 70 V6 Q6 2 10 2 Z" fill={color} />
      <path d="M36 2 L50 16 H40 Q36 16 36 12 Z" fill="black" fillOpacity="0.18" />
      <text
        x="28"
        y="60"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="white"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.02em"
      >
        {label}
      </text>
    </svg>
  )
}
