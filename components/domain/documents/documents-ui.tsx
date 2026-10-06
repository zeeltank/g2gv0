import type { ReactNode } from 'react'
import { AlertTriangle, File, FileImage, FileSpreadsheet, FileText, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentTypeChoices } from '@/services/account'

/** Icon + tint for a document's type, by mime/extension - shared by the card grid and the table view so the two never drift apart. */
export function iconFor(mimeType: string | null, fileName: string | null) {
  const mime = (mimeType ?? '').toLowerCase()
  const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? ''

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    return { Icon: FileImage, tint: 'text-violet-500 bg-violet-500/10' }
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return { Icon: FileText, tint: 'text-rose-500 bg-rose-500/10' }
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { Icon: FileSpreadsheet, tint: 'text-emerald-500 bg-emerald-500/10' }
  }
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
    return { Icon: FileText, tint: 'text-sky-500 bg-sky-500/10' }
  }

  return { Icon: File, tint: 'text-muted-foreground bg-muted' }
}

export function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatFileDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * `document_type` options from both buckets, deduped by key.
 *
 * `config/documents.php` gives both `personnel` and `organization` their
 * own `'other' => 'Other'` entry - two distinct config keys, but the SAME
 * document_type VALUE either way. Every options list built from both
 * buckets must dedupe on that value: a searchable combobox keys its
 * options by value (see `components/ui/searchable-select.tsx`), so two
 * entries sharing one key is a real React duplicate-key bug (confirmed
 * live - the dropdown rendered "Other" three times, not a harmless
 * cosmetic repeat), not just a redundant-looking list.
 */
export function documentTypeOptions(types: DocumentTypeChoices): Array<{ value: string; label: string; hint?: string }> {
  const seen = new Set<string>()
  const options: Array<{ value: string; label: string; hint?: string }> = []

  for (const [value, label] of Object.entries(types.personnel)) {
    seen.add(value)
    options.push({ value, label, hint: 'Personal' })
  }

  for (const [value, label] of Object.entries(types.organization)) {
    if (seen.has(value)) continue
    seen.add(value)
    options.push({ value, label, hint: 'Organisation' })
  }

  return options
}

/*
 * Document Library-scoped layout primitives, following the same rule the
 * Signals views (`signals-ui.tsx`) settled on and explicitly keep local to
 * their own feature:
 *
 *   Page (bg-background)  ->  Surface (one bordered card)  ->  content
 *
 * ONE bordered container per level; anything nested inside a Surface
 * separates by whitespace or a soft fill, never a second border. Widths
 * respond to the container this page sits in (the shell's content area,
 * which narrows when the sidebar or an agent panel is open), not the
 * viewport - hence `@container` rather than `lg:`/`xl:` throughout this
 * feature's components.
 */

export function DocumentsPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('@container space-y-6 p-4 @xl:p-6', className)}>{children}</div>
}

export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm', className)}>
      {children}
    </div>
  )
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-64">
        <h3 className="text-lg font-semibold leading-tight tracking-tight text-foreground">{title}</h3>
        {description && <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

const NOTICE_TONES = {
  info: 'bg-muted text-foreground',
  warning: 'bg-warning/10 text-foreground',
  error: 'bg-destructive/10 text-foreground',
} as const

/** Inline banner, since this product has no toast library. */
export function Notice({
  tone = 'info',
  children,
  action,
}: {
  tone?: keyof typeof NOTICE_TONES
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      role={tone === 'info' ? 'status' : 'alert'}
      className={cn('flex flex-wrap items-start gap-x-3 gap-y-2 rounded-lg px-4 py-3 text-sm leading-relaxed', NOTICE_TONES[tone])}
    >
      {tone === 'info' ? (
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      ) : (
        <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', tone === 'error' ? 'text-destructive' : 'text-warning')} />
      )}
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>}
    </label>
  )
}
