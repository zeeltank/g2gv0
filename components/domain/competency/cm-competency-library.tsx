'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  BookOpen,
  Upload,
  Download,
  FileDown,
  Copy,
  Archive,
  ArchiveRestore,
  Users,
  Save,
  Trash2,
  FolderTree,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useCompetencyLibrary, useCompetencyDetail } from '@/hooks/use-competency-library'
import { useLibraryMeta, useTaxonomy } from '@/hooks/use-competency-libraries'
import { useApprovalTrail, useSubmitForApproval } from '@/hooks/use-competency-approvals'
import { competencyLibraryService } from '@/services/competency'
import { getLaravelContext } from '@/lib/laravel-context'
import { useAuth } from '@/hooks/use-auth'
import { SKILL_LIBRARY_CONFIG } from './libraries/library-config'
import { TaxonomyManager } from './libraries/taxonomy-manager'
import type { ApprovalTrailEntry } from '@/services/competency'
import type {
  CompetencyLibraryItem,
  CompetencyLibraryPayload,
  CompetencySortField,
  CompetencyDetail,
  CompetencyImportRow,
  CompetencyImportResult,
} from '@/services/competency'

/* ------------------------------------------------------------------ *
 * Static option maps (Type = KASA; Status = approve_status)
 * ------------------------------------------------------------------ */

const TYPE_VALUES = ['Behavior', 'Skill', 'Ability', 'Attitude', 'Knowledge'] as const

const TYPE_FILTER_OPTIONS = [
  { label: 'All Types', value: 'all' },
  ...TYPE_VALUES.map((t) => ({ label: t, value: t })),
]

const TYPE_FORM_OPTIONS = [
  { label: 'Select type', value: '' },
  ...TYPE_VALUES.map((t) => ({ label: t, value: t })),
]

// 'Rejected' is a real stored state: a rejected subject is moved there so it is
// neither pending nor approved and can be revised and resubmitted.
const STATUS_VALUES = ['Approved', 'Pending', 'Rejected', 'Cancelled'] as const

/**
 * approve_status is stored as 'Cancelled' but the screen calls that state
 * Archived everywhere (the action, the confirm dialog, the saved view), so the
 * stored value is mapped to the shown label rather than leaking two names for
 * one thing. The raw value still travels to the API and to StatusBadge, which
 * keys its colour off 'Cancelled'.
 */
const STATUS_DISPLAY: Record<string, string> = { Cancelled: 'Archived' }

function statusDisplay(value: string | null | undefined): string {
  const raw = (value ?? '').trim() || 'Pending'
  return STATUS_DISPLAY[raw] ?? raw
}

const STATUS_FILTER_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  ...STATUS_VALUES.map((s) => ({ label: statusDisplay(s), value: s })),
]


const PER_PAGE_OPTIONS = [
  { label: '10 / page', value: '10' },
  { label: '25 / page', value: '25' },
  { label: '50 / page', value: '50' },
]

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function dash(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? '—' : trimmed
}

function statusLabel(item: CompetencyLibraryItem): string {
  return item.approve_status?.trim() || 'Pending'
}

/**
 * Archived == approve_status 'Cancelled'. Archiving is a status change, not a
 * delete: the competency stays referenced by role mappings, framework items,
 * assessments, plans and certifications, so removing the row would orphan them.
 */
function isArchived(item: CompetencyLibraryItem): boolean {
  return statusLabel(item) === 'Cancelled'
}

/* ------------------------------------------------------------------ *
 * CSV import / export
 * ------------------------------------------------------------------ */

/** Column order shared by the export file and the import template. */
const CSV_COLUMNS = [
  'Name',
  'Description',
  'Category',
  'Sub Category',
  'Type (KASA)',
  'Proficiency Scale',
  'Status',
  'Owner',
  'Created On',
] as const

/** Header -> import payload key. Anything else in the file is ignored. */
const IMPORT_HEADER_MAP: Record<string, keyof CompetencyImportRow> = {
  name: 'name',
  'competency name': 'name',
  competency: 'name',
  title: 'name',
  description: 'description',
  category: 'category',
  'sub category': 'sub_category',
  sub_category: 'sub_category',
  'sub-category': 'sub_category',
  type: 'competency_type',
  'type (kasa)': 'competency_type',
  competency_type: 'competency_type',
  kasa: 'competency_type',
  'proficiency scale': 'proficiency_level',
  proficiency: 'proficiency_level',
  proficiency_level: 'proficiency_level',
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(filename: string, header: readonly string[], rows: (string | null | undefined)[][]) {
  const body = rows.map((row) => row.map(csvCell).join(','))
  // BOM so Excel opens UTF-8 names correctly.
  const blob = new Blob(['﻿' + [header.join(','), ...body].join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Minimal RFC-4180 CSV reader: handles quoted fields, escaped quotes and
 * newlines inside quotes. Written inline rather than pulling in a parser
 * dependency for one screen.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      // Swallow the \n of a \r\n pair.
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += char
    }
  }

  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)

  return rows
}

/** Map a parsed CSV into import rows, ignoring unknown columns. */
function csvToImportRows(text: string): { rows: CompetencyImportRow[]; error: string | null } {
  const table = parseCsv(text)
  if (table.length < 2) {
    return { rows: [], error: 'The file needs a header row and at least one skill.' }
  }

  const headers = table[0].map((h) => h.trim().toLowerCase().replace(/^﻿/, ''))
  const keys = headers.map((h) => IMPORT_HEADER_MAP[h] ?? null)

  if (!keys.includes('name')) {
    return { rows: [], error: 'No "Name" column found. Download the template to see the expected columns.' }
  }

  const rows = table.slice(1).map((cells) => {
    const row: CompetencyImportRow = { name: '' }
    keys.forEach((key, index) => {
      if (!key) return
      const value = (cells[index] ?? '').trim()
      if (value !== '') row[key] = value
    })
    return row
  })

  return { rows, error: null }
}

/* ------------------------------------------------------------------ *
 * Saved views (per-browser; no server-side view store exists)
 * ------------------------------------------------------------------ */

interface SavedView {
  name: string
  search: string
  category: string
  type: string
  status: string
}

/*
 * VOCABULARY: this screen manages SKILL LIBRARY entries.
 *
 * It reads and writes `s_users_skills` through /competency/competencies (aliased
 * in routes/api.php as SkillLibraryCrudController). It has always created a flat
 * skill row - the labels said "Competency", which is G-RBAC-02b: a name promising
 * a capability that was never built.
 *
 * A competency in Q-A2's sense - a named bundle of KASBA items - lives in
 * `competency` + `competency_kasba_item` and is composed in
 * cm-competency-composer.tsx.
 *
 * LABELS ONLY were changed. No identifier, storage key, endpoint, type name or
 * behaviour moved: renaming SAVED_VIEWS_KEY would silently discard every saved
 * view a user already has.
 */
const SAVED_VIEWS_KEY = 'cm-competency-library:saved-views'

function readSavedViews(): SavedView[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY)
    const parsed = raw ? (JSON.parse(raw) as SavedView[]) : []
    return Array.isArray(parsed) ? parsed.filter((view) => typeof view?.name === 'string') : []
  } catch {
    return []
  }
}

/** Windowed page list with ellipsis for the pager. */
function pageWindow(current: number, last: number): (number | 'gap')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const pages: (number | 'gap')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(last - 1, current + 1)
  if (start > 2) pages.push('gap')
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < last - 1) pages.push('gap')
  pages.push(last)
  return pages
}

/* ------------------------------------------------------------------ *
 * Create / Edit form dialog
 * ------------------------------------------------------------------ */

interface CompetencyFormProps {
  initial: CompetencyLibraryItem | null
  saving: boolean
  /** Categories from the skill taxonomy, so the form and the tree agree. */
  categories: string[]
  subCategoriesOf: (category: string) => string[]
  departments: string[]
  onSubmit: (payload: CompetencyLibraryPayload) => Promise<{ ok: boolean; message: string }>
  onCancel: () => void
  onSaved: () => void
}

/** Free text that is long enough to want its own row in the form grid. */
const DETAIL_FIELDS: { key: keyof CompetencyLibraryPayload; label: string; help?: string; placeholder?: string }[] = [
  { key: 'bussiness_links', label: 'Business Link', placeholder: 'https://…' },
  { key: 'learning_resources', label: 'Learning Resources', placeholder: 'Courses, guides, internal material' },
  { key: 'assesment_method', label: 'Assessment Method', placeholder: 'e.g. Observation + MCQ' },
  { key: 'certification_qualifications', label: 'Certifications / Qualifications' },
  { key: 'experience_project', label: 'Experience / Projects' },
  { key: 'sop_practice_link', label: 'SOP / Practice Link' },
  { key: 'related_skills', label: 'Related Competencies', help: 'Comma separated.' },
  { key: 'custom_tags', label: 'Tags', help: 'Comma separated.' },
]

/**
 * Create / edit a competency.
 *
 * Carries the full column set. The five "Evidence & Resources" fields are what
 * the detail drawer's Attachments tab is built from - while they were only
 * editable on a separate screen, that tab could never show anything for a
 * competency created here.
 */
function CompetencyForm({
  initial,
  saving,
  categories,
  subCategoriesOf,
  departments,
  onSubmit,
  onCancel,
  onSaved,
}: CompetencyFormProps) {
  const editing = Boolean(initial)

  const [values, setValues] = useState<Record<string, string>>(() => ({
    name: initial?.name ?? '',
    category: initial?.category ?? '',
    sub_category: initial?.sub_category ?? '',
    competency_type: initial?.competency_type ?? '',
    department: initial?.department ?? '',
    proficiency_level: initial?.proficiency_level ?? '',
    status: initial?.approve_status?.trim() || 'Approved',
    description: initial?.description ?? '',
    ...Object.fromEntries(DETAIL_FIELDS.map((f) => [f.key, (initial?.[f.key as keyof CompetencyLibraryItem] as string) ?? ''])),
  }))
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: string, value: string) =>
    setValues((current) => {
      const next = { ...current, [key]: value }
      // A sub-category only means something under its parent.
      if (key === 'category') next.sub_category = ''
      return next
    })

  const withCurrent = (list: string[], current: string) =>
    current && !list.includes(current) ? [current, ...list] : list

  const categoryOptions = [
    { label: 'Select category', value: '' },
    ...withCurrent(categories, values.category).map((c) => ({ label: c, value: c })),
  ]
  const subCategoryOptions = [
    { label: values.category ? 'Select sub category' : 'Pick a category first', value: '' },
    ...withCurrent(values.category ? subCategoriesOf(values.category) : [], values.sub_category).map((c) => ({
      label: c,
      value: c,
    })),
  ]
  const departmentOptions = [
    { label: 'Select department', value: '' },
    ...withCurrent(departments, values.department).map((d) => ({ label: d, value: d })),
  ]

  const handleSubmit = async () => {
    if (!values.name.trim()) {
      setError('Skill name is required.')
      return
    }
    setError(null)

    const text = (key: string) => values[key]?.trim() ?? ''
    const optional = (key: string) => (text(key) ? { [key]: text(key) } : {})

    const payload: CompetencyLibraryPayload = {
      name: values.name.trim(),
      ...optional('category'),
      ...optional('sub_category'),
      ...optional('department'),
      ...(values.competency_type ? { competency_type: values.competency_type } : {}),
      ...optional('description'),
      ...optional('proficiency_level'),
      // G-COMP-01: `status` is no longer sent. approve_status is server-owned -
      // the API ignores it, and sending a field the server discards is the
      // silent-data-loss pattern this audit exists to remove. Approval moves
      // through "Submit for Approval" and the approval queue.
      ...Object.fromEntries(
        DETAIL_FIELDS.map((f) => [f.key, text(f.key as string)]).filter(([, value]) => {
          // On edit send blanks too, so a field can be cleared.
          return editing || value !== ''
        }),
      ),
    }

    const result = await onSubmit(payload)
    if (result.ok) onSaved()
    else setError(result.message)
  }

  return (
    <>
      <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
        <DialogTitle className="text-xl font-bold text-foreground">
          {initial ? 'Edit Skill' : 'Create Skill'}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {initial
            ? 'Update this skill. Evidence & resources feed the Attachments tab.'
            : 'Add a skill to the library. Evidence & resources feed its Attachments tab.'}
        </DialogDescription>
      </DialogHeader>

      <div className="p-6 flex flex-col gap-5 max-h-[65vh] overflow-y-auto g2g-scrollbar">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Skill Name<span className="text-destructive"> *</span></label>
          <Input value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="Enter name" className="bg-background border-border" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Category</label>
            <Select value={values.category} onChange={(v) => set('category', v)} options={categoryOptions} placeholder="Select category" className="bg-background border-border h-9" aria-label="Category" />
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground">No categories yet — add one from Taxonomy.</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Sub Category</label>
            <Select value={values.sub_category} onChange={(v) => set('sub_category', v)} options={subCategoryOptions} disabled={!values.category} className="bg-background border-border h-9" aria-label="Sub Category" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Type (KASA)</label>
            <Select value={values.competency_type} onChange={(v) => set('competency_type', v)} options={TYPE_FORM_OPTIONS} placeholder="Select type" className="bg-background border-border h-9" aria-label="Type" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Department</label>
            <Select value={values.department} onChange={(v) => set('department', v)} options={departmentOptions} placeholder="Select department" className="bg-background border-border h-9" aria-label="Department" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Proficiency Scale</label>
            <Input value={values.proficiency_level} onChange={(e) => set('proficiency_level', e.target.value)} placeholder="e.g. 1-5 Level Scale" className="bg-background border-border" />
          </div>
          {/*
            G-COMP-01: the Status dropdown was removed. It wrote straight to
            approve_status with no reviewer, which bypassed the whole approval
            workflow from an edit form. The server now owns that field, so
            leaving the control would show a dropdown that silently does
            nothing. Approval moves through Submit for Approval and the
            approval queue.
          */}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Description</label>
          <textarea
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary min-h-[90px] resize-none"
            placeholder="Enter description..."
          />
        </div>

        {/* Collapsed by default: eight optional fields would otherwise bury the
            five that identify the competency. */}
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            aria-expanded={showDetails}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-foreground">Evidence &amp; Resources</span>
              <span className="block text-xs text-muted-foreground">
                Learning material, assessment method, certifications — these fill the Attachments tab.
              </span>
            </span>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', showDetails && 'rotate-180')} />
          </button>

          {showDetails && (
            <div className="grid grid-cols-1 gap-4 border-t border-border p-4 md:grid-cols-2">
              {DETAIL_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{field.label}</label>
                  <Input
                    value={values[field.key as string] ?? ''}
                    onChange={(e) => set(field.key as string, e.target.value)}
                    placeholder={field.placeholder}
                    className="bg-background border-border"
                  />
                  {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
        <Button variant="outline" onClick={onCancel} disabled={saving} className="h-9 px-6 rounded-lg font-bold border-border bg-background">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="h-9 px-6 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create'}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Sortable table header cell
 * ------------------------------------------------------------------ */

function SortableHead({
  label,
  field,
  activeField,
  direction,
  onSort,
  className,
}: {
  label: string
  field: CompetencySortField
  activeField: CompetencySortField | null
  direction: 'asc' | 'desc'
  onSort: (field: CompetencySortField) => void
  className?: string
}) {
  const active = activeField === field
  return (
    <TableHead className={cn('px-6 py-4', className)}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors uppercase tracking-wider"
      >
        {label}
        {active ? (
          direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  )
}

/* ------------------------------------------------------------------ *
 * Competency Library
 * ------------------------------------------------------------------ */

export function CmCompetencyLibrary() {
  // Filters / query state
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<CompetencySortField | null>(null)
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  // Debounce the search box into the query param.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const params = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(category !== 'all' ? { category } : {}),
      ...(type !== 'all' ? { competency_type: type } : {}),
      ...(status !== 'all' ? { status } : {}),
      ...(sort ? { sort, direction } : {}),
      page,
      per_page: perPage,
    }),
    [search, category, type, status, sort, direction, page, perPage],
  )

  const {
    loading, error, items, pagination, saving,
    // `remove` (soft delete) stays on the hook and its endpoint is untouched,
    // but this screen archives instead - see isArchived().
    actionMessage, actionError, retry, create, update,
    archive, clone, importRows, exportRows, exporting, importing, clearMessages,
  } = useCompetencyLibrary(params)

  // Dialog / panel state
  const [selectedItem, setSelectedItem] = useState<CompetencyLibraryItem | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'proficiency' | 'associations' | 'attachments' | 'history'>('overview')
  const { detail, loading: detailLoading } = useCompetencyDetail(selectedItem?.id ?? null)
  const [formOpen, setFormOpen] = useState(false)
  const [formInitial, setFormInitial] = useState<CompetencyLibraryItem | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [taxonomyOpen, setTaxonomyOpen] = useState(false)
  const [approvalNote, setApprovalNote] = useState<string | null>(null)

  const router = useRouter()
  const { user } = useAuth()
  // Categories come from the skill taxonomy so the form, the filters and the
  // Skill Taxonomy tree all describe the same tree.
  const taxonomy = useTaxonomy('skill')
  const { meta } = useLibraryMeta()
  const { submit: submitForApproval, submitting } = useSubmitForApproval()
  const approvalTrail = useApprovalTrail('competency', selectedItem?.id ?? null)
  const [archiveTarget, setArchiveTarget] = useState<CompetencyLibraryItem | null>(null)
  const [importResult, setImportResult] = useState<CompetencyImportResult | null>(null)
  // Parse failures happen before the request, so they need their own surface.
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Saved views live in this browser: the backend has no view store, and a
  // saved filter set is a personal preference rather than tenant data.
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [saveViewOpen, setSaveViewOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState('')

  // Read after mount so server and client markup match before hydration.
  useEffect(() => {
    // Deferred so the read lands after this render rather than cascading out
    // of the effect body.
    queueMicrotask(() => {
      setSavedViews(readSavedViews())
    })
  }, [])

  const persistViews = (views: SavedView[]) => {
    setSavedViews(views)
    try {
      window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views))
    } catch {
      // A full or blocked localStorage must not break the screen.
    }
  }

  // The taxonomy is the full category set; the loaded rows are a fallback for a
  // tenant whose tree has not been built yet. The current selection is always
  // included so an active filter never vanishes from its own dropdown.
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(taxonomy.categories.filter(Boolean))
    if (set.size === 0) {
      items.forEach((it) => { if (it.category?.trim()) set.add(it.category.trim()) })
    }
    if (category !== 'all') set.add(category)
    return [
      { label: 'All Categories', value: 'all' },
      ...Array.from(set).sort().map((c) => ({ label: c, value: c })),
    ]
  }, [taxonomy.categories, items, category])

  const changeFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  const handleSort = (field: CompetencySortField) => {
    if (sort === field) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setDirection('asc')
    }
    setPage(1)
  }

  const clearAll = () => {
    setSearchInput('')
    setSearch('')
    setCategory('all')
    setType('all')
    setStatus('all')
    setSort(null)
    setDirection('desc')
    setPage(1)
  }

  const hasFilters = Boolean(search) || category !== 'all' || type !== 'all' || status !== 'all'

  const applyView = (view: SavedView) => {
    setSearchInput(view.search)
    setSearch(view.search)
    setCategory(view.category)
    setType(view.type)
    setStatus(view.status)
    setPage(1)
  }

  const saveCurrentView = () => {
    const name = saveViewName.trim()
    if (!name) return

    const view: SavedView = { name, search, category, type, status }
    // Same name overwrites rather than creating a second entry.
    persistViews([...savedViews.filter((candidate) => candidate.name !== name), view])
    setSaveViewOpen(false)
    setSaveViewName('')
  }

  const openCreate = () => { clearMessages(); setFormInitial(null); setFormOpen(true) }

  /**
   * The list payload omits the long detail columns, so editing fetches the full
   * record first. Without it, saving an edit would post blanks for every field
   * the list never carried and wipe them.
   */
  const openEdit = async (item: CompetencyLibraryItem) => {
    clearMessages()
    setSelectedItem(null)
    setFormInitial(item)
    setFormLoading(true)
    setFormOpen(true)
    try {
      const response = await competencyLibraryService.get(getLaravelContext(user), item.id)
      setFormInitial(response.data)
    } catch {
      // Fall back to the list row: the core fields are all present on it.
    } finally {
      setFormLoading(false)
    }
  }

  /**
   * Open another M2 screen focused on this competency.
   *
   * The competency id rides along as a query param so the target can preselect
   * it; screens that do not read it yet simply open unfiltered rather than
   * leaving the user on a dead number.
   */
  const openInSubmodule = (submenuId: string, item: CompetencyLibraryItem) => {
    const params = new URLSearchParams({ competency_id: String(item.id), competency: item.name })
    router.push(`/module/m2/${submenuId}/${submenuId}?${params.toString()}`)
  }

  /** Move a competency into the approval queue. */
  const handleSubmitForApproval = async (item: CompetencyLibraryItem) => {
    clearMessages()
    const result = await submitForApproval('competency', item.id)
    setApprovalNote(result.message)
    if (result.ok) {
      setSelectedItem(null)
      retry()
    }
  }

  const submitForm = (payload: CompetencyLibraryPayload) =>
    formInitial ? update(formInitial.id, payload) : create(payload)

  const confirmArchive = async () => {
    if (!archiveTarget) return
    const restoring = isArchived(archiveTarget)
    const result = await archive(archiveTarget.id, restoring)
    if (result.ok) {
      // Keep the panel open and reflect the new state rather than closing it -
      // archiving is reversible, so the user may well want to undo it.
      setSelectedItem((current) =>
        current && current.id === archiveTarget.id
          // Restore returns the item to Pending, not Approved (G-COMP-01):
          // housekeeping must never grant approval. Mirror the server exactly,
          // or the panel shows a state the database does not hold.
          ? { ...current, approve_status: restoring ? 'Pending' : 'Cancelled' }
          : current,
      )
      setArchiveTarget(null)
    }
  }

  const handleClone = async (item: CompetencyLibraryItem) => {
    clearMessages()
    await clone(item.id)
  }

  /* ---------------------------- export ---------------------------- */

  const handleExportLibrary = async () => {
    clearMessages()
    const rows = await exportRows()
    if (!rows.length) return

    downloadCsv(
      `competency-library-${new Date().toISOString().slice(0, 10)}.csv`,
      CSV_COLUMNS,
      rows.map((row) => [
        row.name,
        row.description,
        row.category,
        row.sub_category,
        row.competency_type,
        row.proficiency_level,
        row.approve_status,
        row.owner,
        formatDate(row.created_at),
      ]),
    )
  }

  /** The panel's Export action - this competency plus its associations. */
  const handleExportOne = (item: CompetencyLibraryItem, competencyDetail: CompetencyDetail | null) => {
    const rows: (string | null | undefined)[][] = [[
      item.name,
      item.description,
      item.category,
      item.sub_category,
      item.competency_type,
      item.proficiency_level,
      item.approve_status,
      item.owner,
      formatDate(item.created_at),
    ]]

    const header = [...CSV_COLUMNS, 'Mapped Roles', 'Frameworks']
    rows[0].push(
      (competencyDetail?.associations.roles ?? []).map((role) => role.jobrole).join(' | '),
      (competencyDetail?.associations.frameworks ?? []).map((framework) => framework.name).join(' | '),
    )

    downloadCsv(`competency-${item.id}-${item.name.replace(/[^\w-]+/g, '-').toLowerCase()}.csv`, header, rows)
  }

  const handleDownloadTemplate = () => {
    downloadCsv(
      'competency-import-template.csv',
      ['Name', 'Description', 'Category', 'Sub Category', 'Type (KASA)', 'Proficiency Scale'],
      [['Stakeholder Management', 'Builds and maintains stakeholder relationships.', 'Soft Skills', 'Interpersonal', 'Skill', 'Level 1-6']],
    )
  }

  /* ---------------------------- import ---------------------------- */

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset immediately so re-picking the same file fires change again.
    event.target.value = ''
    if (!file) return

    clearMessages()
    setImportResult(null)

    const { rows, error: parseError } = csvToImportRows(await file.text())
    if (parseError) {
      setImportError(parseError)
      return
    }
    if (!rows.length) {
      setImportError('No competencies found in that file.')
      return
    }

    const result = await importRows(rows)
    if (result.result) setImportResult(result.result)
  }

  const total = pagination?.total ?? 0
  const lastPage = pagination?.last_page ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1
  const rangeEnd = Math.min(page * perPage, total)

  return (
    <div className="flex h-full flex-col gap-6 p-6 overflow-y-auto g2g-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Skill Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Create, manage and maintain organizational competencies.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setTaxonomyOpen(true)}
            className="h-10 gap-2 rounded-xl font-semibold"
          >
            <FolderTree className="w-4 h-4" /> Taxonomy
          </Button>
          <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-10 px-4 shadow-md shadow-primary/20 flex items-center gap-2">
            <Plus className="w-4 h-4 stroke-[3]" /> Create Skill
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="w-10 h-10 p-0 rounded-xl bg-background border border-border flex items-center justify-center hover:bg-accent hover:text-accent-foreground outline-none transition-colors">
              <ChevronDown className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {importing ? 'Importing…' : 'Import Competencies'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadTemplate} className="flex items-center gap-2">
                <FileDown className="w-4 h-4" /> Download Import Template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleExportLibrary}
                disabled={exporting}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Exporting…' : 'Export Library'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hidden picker driven by the Import menu item. */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {/* Action feedback (mutations + client-side import parse errors) */}
      {(actionMessage || actionError || importError || approvalNote) && (
        <div
          className={cn(
            'rounded-xl border px-4 py-2.5 text-sm font-medium flex items-center justify-between',
            actionError || importError
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
          )}
        >
          <span>{importError || actionError || actionMessage || approvalNote}</span>
          <button
            onClick={() => { clearMessages(); setImportError(null); setApprovalNote(null) }}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="relative z-20 flex items-center justify-between bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col gap-4 flex-1">
          {/* Row 1: search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by competency name, category, type..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-10 pl-9 pr-4 rounded-xl border-input bg-background/50 text-sm focus-visible:ring-primary/50 w-full"
              />
            </div>
          </div>

          {/* Row 2: status + category + type + clear */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-44">
              <Select value={status} onChange={changeFilter(setStatus)} options={STATUS_FILTER_OPTIONS} placeholder="All Statuses" className="bg-background/50 border-border h-9 rounded-lg" />
            </div>
            <div className="w-48">
              <Select value={category} onChange={changeFilter(setCategory)} options={categoryOptions} placeholder="All Categories" className="bg-background/50 border-border h-9 rounded-lg" />
            </div>
            <div className="w-40">
              <Select value={type} onChange={changeFilter(setType)} options={TYPE_FILTER_OPTIONS} placeholder="All Types" className="bg-background/50 border-border h-9 rounded-lg" />
            </div>
            {hasFilters && (
              <button onClick={clearAll} className="text-sm font-medium text-primary hover:underline ml-1">Clear All</button>
            )}
          </div>
        </div>

        {/* Saved Views */}
        <div className="flex items-center gap-3 self-start">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 border border-border bg-background/50 rounded-xl px-4 h-10 text-sm font-semibold cursor-pointer hover:bg-background transition-colors outline-none">
              Saved Views <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onClick={clearAll}>Default View</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setStatus('Approved'); setPage(1) }}>Approved Competencies</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setStatus('Cancelled'); setPage(1) }}>Archived Competencies</DropdownMenuItem>

              {savedViews.length > 0 && <DropdownMenuSeparator />}
              {savedViews.map((view) => (
                <DropdownMenuItem
                  key={view.name}
                  onClick={() => applyView(view)}
                  className="flex items-center justify-between gap-2 group"
                >
                  <span className="truncate">{view.name}</span>
                  <button
                    type="button"
                    aria-label={`Delete view ${view.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      persistViews(savedViews.filter((candidate) => candidate.name !== view.name))
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => { setSaveViewName(''); setSaveViewOpen(true) }}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Current View…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="relative z-10 bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm flex flex-col">
        {error ? (
          <ErrorState title="Couldn't load competencies" description={error} retry={retry} className="m-6" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/30 border-b border-primary/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <TableRow className="hover:bg-transparent">
                    <SortableHead label="Skill Name" field="title" activeField={sort} direction={direction} onSort={handleSort} className="rounded-tl-2xl" />
                    <SortableHead label="Category" field="category" activeField={sort} direction={direction} onSort={handleSort} />
                    <SortableHead label="Type" field="competency_type" activeField={sort} direction={direction} onSort={handleSort} />
                    <TableHead className="px-6 py-4">Proficiency Scale</TableHead>
                    <SortableHead label="Status" field="approve_status" activeField={sort} direction={direction} onSort={handleSort} />
                    <TableHead className="px-6 py-4">Owner</TableHead>
                    <SortableHead label="Last Updated" field="updated_at" activeField={sort} direction={direction} onSort={handleSort} className="rounded-tr-2xl" />
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-primary/5">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                        {Array.from({ length: 7 }).map((__, j) => (
                          <TableCell key={j} className="px-6 py-4"><Skeleton className="h-4 w-full max-w-[140px]" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : items.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState
                          icon={<BookOpen className="w-6 h-6" />}
                          title={hasFilters ? 'No competencies match your filters' : 'No competencies yet'}
                          description={hasFilters ? 'Try adjusting or clearing the filters.' : 'Create your first competency to get started.'}
                          className="border-0 m-6"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((comp) => (
                      <TableRow
                        key={comp.id}
                        onClick={() => { setActiveTab('overview'); setSelectedItem(comp) }}
                        className="group hover:bg-primary/[0.02] transition-colors cursor-pointer"
                      >
                        <TableCell className="px-6 py-4 font-semibold text-primary">{comp.name}</TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground font-medium">{dash(comp.category)}</TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground">{dash(comp.competency_type)}</TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground">{dash(comp.proficiency_level)}</TableCell>
                        <TableCell className="px-6 py-4">
                          <StatusBadge status={statusLabel(comp)}>{statusDisplay(statusLabel(comp))}</StatusBadge>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground">{dash(comp.owner)}</TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground">{formatDate(comp.updated_at || comp.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-primary/5 bg-muted/10">
              <span className="text-sm text-muted-foreground font-medium">
                {total === 0 ? 'No entries' : `Showing ${rangeStart} to ${rangeEnd} of ${total} entries`}
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <Button
                    variant="outline" disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="w-9 h-9 p-0 rounded-l-lg rounded-r-none border-border bg-background"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {pageWindow(page, lastPage).map((p, idx) =>
                    p === 'gap' ? (
                      <Button key={`gap-${idx}`} variant="outline" disabled className="w-9 h-9 p-0 rounded-none border-y-border border-x-0 bg-background text-muted-foreground">…</Button>
                    ) : (
                      <Button
                        key={p}
                        variant="outline"
                        onClick={() => setPage(p)}
                        className={cn(
                          'w-9 h-9 p-0 rounded-none border-border bg-background',
                          p === page && 'bg-primary/10 text-primary font-bold',
                        )}
                      >
                        {p}
                      </Button>
                    ),
                  )}
                  <Button
                    variant="outline" disabled={page >= lastPage || loading}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                    className="w-9 h-9 p-0 rounded-r-lg rounded-l-none border-border bg-background"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="w-32">
                  <Select
                    value={String(perPage)}
                    onChange={(v) => { setPerPage(Number(v)); setPage(1) }}
                    options={PER_PAGE_OPTIONS}
                    className="bg-background border-border h-9"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details Side Panel */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right" className="w-full sm:w-[600px] lg:w-[800px] xl:w-[900px] sm:max-w-none p-0 bg-card border-l border-primary/10 flex flex-col shadow-2xl [&>button]:hidden">
          {selectedItem && (
            <>
              {/* Sheet Header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b border-primary/5">
                <div className="flex items-center gap-4">
                  <SheetTitle className="text-2xl font-bold text-foreground">{selectedItem.name}</SheetTitle>
                  <StatusBadge status={statusLabel(selectedItem)}>{statusDisplay(statusLabel(selectedItem))}</StatusBadge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => openEdit(selectedItem)} className="h-9 px-4 gap-2 border-border font-semibold rounded-lg bg-background hover:bg-muted">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleClone(selectedItem)}
                    disabled={saving}
                    className="h-9 px-4 gap-2 border-border font-semibold rounded-lg bg-background hover:bg-muted"
                  >
                    <Copy className="w-3.5 h-3.5" /> Clone
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExportOne(selectedItem, detail)}
                    className="h-9 px-4 gap-2 border-border font-semibold rounded-lg bg-background hover:bg-muted"
                  >
                    <Download className="w-3.5 h-3.5" /> Export
                  </Button>
                  {/* Approved competencies can be sent back through review;
                      Pending ones are already in the queue. */}
                  {statusLabel(selectedItem) !== 'Pending' && !isArchived(selectedItem) && (
                    <Button
                      variant="outline"
                      onClick={() => handleSubmitForApproval(selectedItem)}
                      disabled={submitting}
                      className="h-9 px-4 gap-2 border-border font-semibold rounded-lg bg-background hover:bg-muted"
                      title="Move this competency into the approval queue"
                    >
                      <Send className="w-3.5 h-3.5" /> {submitting ? 'Submitting…' : 'Submit for Approval'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setArchiveTarget(selectedItem)}
                    disabled={saving}
                    className={cn(
                      'h-9 px-4 gap-2 font-semibold rounded-lg bg-background',
                      isArchived(selectedItem)
                        ? 'border-border hover:bg-muted'
                        : 'border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive',
                    )}
                  >
                    {isArchived(selectedItem) ? (
                      <><ArchiveRestore className="w-3.5 h-3.5" /> Restore</>
                    ) : (
                      <><Archive className="w-3.5 h-3.5" /> Archive</>
                    )}
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedItem(null)} className="w-9 h-9 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Sheet Tabs */}
              <div className="border-b overflow-x-auto scrollbar-hide px-6 bg-surface-muted/30">
                <div className="flex w-full space-x-1 py-2 min-w-[500px]">
                  {(['overview', 'proficiency', 'associations', 'attachments', 'history'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95 capitalize text-center',
                        activeTab === tab
                          ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {tab === 'proficiency' ? 'Proficiency Levels' : tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sheet Body */}
              <div className="flex-1 overflow-y-auto g2g-scrollbar p-6 flex flex-col gap-8">
                {activeTab === 'overview' ? (
                  <>
                    {/* Summary - what this competency is and where it is in use */}
                    <div className="flex flex-col gap-4">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Summary</h3>
                      <p className="text-sm text-foreground leading-relaxed">
                        {dash(selectedItem.description)}
                      </p>
                      {/* Each tile goes somewhere: the two association counts
                          switch tabs, the rest open the submodule that owns the
                          record. A count with no destination is a dead end. */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Mapped Roles', value: detail?.summary.role_count, tab: 'associations' as const, go: null },
                          { label: 'Frameworks', value: detail?.summary.framework_count, tab: 'associations' as const, go: null },
                          { label: 'Employees Rated', value: detail?.summary.rated_employees, tab: null, go: 'cm-employee-profiles' },
                          { label: 'Development Plans', value: detail?.summary.plan_count, tab: null, go: 'cm-development-career' },
                          { label: 'Certifications', value: detail?.summary.certification_count, tab: null, go: 'cm-certifications' },
                          { label: 'Learning Assigned', value: detail?.summary.learning_count, tab: null, go: 'cm-development-career' },
                        ].map((stat) => {
                          const count = stat.value ?? 0
                          // Nothing to drill into when the count is zero.
                          const target = count > 0 ? (stat.tab ?? stat.go) : null

                          return (
                            <button
                              key={stat.label}
                              type="button"
                              disabled={!target}
                              onClick={() => {
                                if (stat.tab) setActiveTab(stat.tab)
                                else if (stat.go) openInSubmodule(stat.go, selectedItem)
                              }}
                              className={cn(
                                'rounded-xl border border-primary/10 bg-background/40 px-4 py-3 text-left transition-colors',
                                target
                                  ? 'hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                                  : 'cursor-default',
                              )}
                              title={
                                target
                                  ? stat.tab
                                    ? 'Show in Associations'
                                    : `Open in ${stat.go === 'cm-employee-profiles' ? 'Employee Profiles' : stat.go === 'cm-certifications' ? 'Certifications' : 'Development & Career'}`
                                  : undefined
                              }
                            >
                              <p className="text-lg font-bold text-foreground leading-none">
                                {detailLoading ? '…' : count}
                              </p>
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-1.5">
                                {stat.label}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Top Associated Roles */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                          Top Associated Roles
                        </h3>
                        {(detail?.associations.role_count ?? 0) > 5 && (
                          <button
                            onClick={() => setActiveTab('associations')}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            View all {detail?.associations.role_count} →
                          </button>
                        )}
                      </div>

                      {detailLoading ? (
                        <div className="flex flex-col gap-2">
                          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                        </div>
                      ) : (detail?.top_roles.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border px-4 py-6 text-center">
                          This competency isn&apos;t mapped to any job role yet.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {detail?.top_roles.map((role) => (
                            <div
                              key={role.jobrole}
                              className="flex items-center justify-between gap-3 rounded-xl border border-primary/10 bg-background/40 px-4 py-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <Users className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{role.jobrole}</p>
                                  <p className="text-xs text-muted-foreground truncate">{dash(role.department)}</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-foreground bg-muted rounded-lg px-2.5 py-1 shrink-0">
                                {role.proficiency_level ? `Level ${role.proficiency_level}` : '—'}
                              </span>
                            </div>
                          ))}
                          {/* Ranked by required level because there is no
                              employee-to-role edge on this tenant to count. */}
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Ranked by the proficiency level each role requires.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-4">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Basic Information</h3>
                      <div className="grid grid-cols-[140px_1fr] gap-y-4 text-sm">
                        <span className="text-muted-foreground font-medium">Skill Name</span>
                        <span className="text-foreground font-semibold">{selectedItem.name}</span>

                        <span className="text-muted-foreground font-medium">Category</span>
                        <span className="text-foreground">{dash(selectedItem.category)}</span>

                        <span className="text-muted-foreground font-medium">Type (KASA)</span>
                        <span className="text-foreground">{dash(selectedItem.competency_type)}</span>

                        <span className="text-muted-foreground font-medium">Proficiency Scale</span>
                        <span className="text-foreground">{dash(selectedItem.proficiency_level)}</span>

                        <span className="text-muted-foreground font-medium">Description</span>
                        <span className="text-foreground leading-relaxed pr-4">{dash(selectedItem.description)}</span>

                        <span className="text-muted-foreground font-medium">Owner</span>
                        <span className="text-foreground">{dash(selectedItem.owner)}</span>

                        <span className="text-muted-foreground font-medium">Status</span>
                        <div><StatusBadge status={statusLabel(selectedItem)}>{statusDisplay(statusLabel(selectedItem))}</StatusBadge></div>

                        <span className="text-muted-foreground font-medium">Created On</span>
                        <span className="text-foreground">{formatDate(selectedItem.created_at)}</span>

                        <span className="text-muted-foreground font-medium">Last Updated</span>
                        <span className="text-foreground">{formatDate(selectedItem.updated_at || selectedItem.created_at)}</span>
                      </div>
                    </div>

                  </>
                ) : detailLoading ? (
                  <div className="flex flex-col gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
                ) : activeTab === 'proficiency' ? (
                  <ProficiencyTab detail={detail} />
                ) : activeTab === 'associations' ? (
                  <AssociationsTab detail={detail} />
                ) : activeTab === 'attachments' ? (
                  <AttachmentsTab detail={detail} />
                ) : (
                  <HistoryTab detail={detail} trail={approvalTrail} />
                )}
              </div>

              {/* Sheet Footer */}
              <div className="p-6 border-t border-primary/5 flex items-center justify-between bg-muted/10 mt-auto">
                <Button
                  variant="ghost"
                  onClick={() => setArchiveTarget(selectedItem)}
                  disabled={saving}
                  className={cn(
                    'font-semibold text-sm h-9 px-4',
                    isArchived(selectedItem)
                      ? 'text-foreground hover:bg-muted'
                      : 'text-destructive hover:bg-destructive/10 hover:text-destructive',
                  )}
                >
                  {isArchived(selectedItem) ? (
                    <><ArchiveRestore className="w-4 h-4 mr-2" /> Restore Skill</>
                  ) : (
                    <><Archive className="w-4 h-4 mr-2" /> Archive Skill</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setSelectedItem(null)} className="h-9 px-6 rounded-lg font-bold border-border bg-background">
                  Close
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden">
          {formOpen && (
            // Remounted once the full record arrives, so the detail fields
            // populate instead of initialising blank.
            <CompetencyForm
              key={formLoading ? 'loading' : (formInitial?.id ?? 'new')}
              initial={formInitial}
              saving={saving || formLoading}
              categories={taxonomy.categories}
              subCategoriesOf={taxonomy.subCategoriesOf}
              departments={meta.departments}
              onSubmit={submitForm}
              onCancel={() => setFormOpen(false)}
              onSaved={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Skill taxonomy editor - the category tree this library and the Skill
          Taxonomy screen both read. */}
      <Sheet open={taxonomyOpen} onOpenChange={setTaxonomyOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-l border-primary/10 bg-card p-0 shadow-2xl sm:w-[560px] sm:max-w-none"
        >
          <TaxonomyManager
            config={SKILL_LIBRARY_CONFIG}
            taxonomy={taxonomy}
            onClose={() => {
              setTaxonomyOpen(false)
              // A rename can leave the category filter pointing at a name that
              // no longer exists, which would read as an empty library.
              if (category !== 'all' && !taxonomy.categories.includes(category)) {
                setCategory('all')
                setPage(1)
              }
              retry()
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Archive / Restore Confirmation */}
      <Dialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              {archiveTarget && isArchived(archiveTarget) ? 'Restore competency' : 'Archive competency'}
            </DialogTitle>
            <DialogDescription>
              {archiveTarget && isArchived(archiveTarget) ? (
                <>
                  Restore <span className="font-semibold text-foreground">{archiveTarget?.name}</span> to the
                  active library? It will appear in pickers and reports again.
                </>
              ) : (
                <>
                  Archive <span className="font-semibold text-foreground">{archiveTarget?.name}</span>? It will be
                  hidden from active use but keeps every existing role mapping, framework entry and assessment
                  intact. You can restore it at any time.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)} disabled={saving}>Cancel</Button>
            <Button
              onClick={confirmArchive}
              disabled={saving}
              className={cn(
                archiveTarget && isArchived(archiveTarget)
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              )}
            >
              {saving
                ? 'Working…'
                : archiveTarget && isArchived(archiveTarget)
                  ? 'Restore'
                  : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Current View */}
      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>
              Saves the active search and filters under a name you can pick from the Saved Views menu.
              Views are kept in this browser.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <Input
              autoFocus
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentView() }}
              placeholder="e.g. Soft skills awaiting review"
              className="bg-background border-border"
            />
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>Search: <span className="text-foreground font-medium">{search || 'none'}</span></span>
              <span>Category: <span className="text-foreground font-medium">{category === 'all' ? 'all' : category}</span></span>
              <span>Type: <span className="text-foreground font-medium">{type === 'all' ? 'all' : type}</span></span>
              <span>Status: <span className="text-foreground font-medium">{status === 'all' ? 'all' : status}</span></span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewOpen(false)}>Cancel</Button>
            <Button onClick={saveCurrentView} disabled={!saveViewName.trim()}>Save view</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import result - only shown when rows were skipped */}
      <Dialog
        open={Boolean(importResult && importResult.skipped > 0)}
        onOpenChange={(open) => !open && setImportResult(null)}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Import finished</DialogTitle>
            <DialogDescription>
              {importResult?.imported ?? 0} imported, {importResult?.skipped ?? 0} skipped. Skipped rows were
              left untouched - nothing existing was overwritten.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[320px] overflow-y-auto g2g-scrollbar rounded-xl border border-border">
            <Table className="text-sm">
              <TableHeader className="bg-muted/30 sticky top-0">
                <TableRow>
                  <TableHead className="px-4 py-2 w-16">Row</TableHead>
                  <TableHead className="px-4 py-2">Name</TableHead>
                  <TableHead className="px-4 py-2">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importResult?.details.map((skip) => (
                  <TableRow key={`${skip.row}-${skip.name}`}>
                    <TableCell className="px-4 py-2 text-muted-foreground">{skip.row}</TableCell>
                    <TableCell className="px-4 py-2 text-foreground">{skip.name || '—'}</TableCell>
                    <TableCell className="px-4 py-2 text-muted-foreground">{skip.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setImportResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Detail-panel tab bodies (backed by /skill_library/competency/{id}/detail)
 * ------------------------------------------------------------------ */

function levelDot(level: number): string {
  switch (level) {
    case 1: return 'bg-destructive'
    case 2: return 'bg-warning'
    case 3: return 'bg-warning'
    case 4: return 'bg-success'
    case 5: return 'bg-primary'
    default: return 'bg-primary'
  }
}

function ProficiencyTab({ detail }: { detail: CompetencyDetail | null }) {
  const levels = detail?.proficiency.levels ?? []
  if (levels.length === 0) {
    return <EmptyState icon={<BookOpen className="w-6 h-6" />} title="No proficiency levels" description="No scale is defined for this competency." className="border-0" />
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground font-medium">Scale:</span>
        <span className="font-semibold text-foreground">{dash(detail?.proficiency.scale_label)}</span>
        <StatusBadge status="processing" size="sm">{detail?.proficiency.scope === 'competency' ? 'Competency-specific' : 'Global scale'}</StatusBadge>
      </div>
      {levels.map((lvl) => (
        <div key={lvl.level} className="flex gap-4 p-4 rounded-xl border border-border bg-background">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0', levelDot(lvl.level))}>{lvl.level}</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{lvl.name ?? lvl.label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">{lvl.description || 'No description.'}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function AssociationsTab({ detail }: { detail: CompetencyDetail | null }) {
  const roles = detail?.associations.roles ?? []
  const frameworks = detail?.associations.frameworks ?? []
  if (roles.length === 0 && frameworks.length === 0) {
    return <EmptyState icon={<BookOpen className="w-6 h-6" />} title="No associations" description="This competency isn't mapped to any role or framework yet." className="border-0" />
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Job Roles Requiring This ({roles.length})</h3>
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles require this competency.</p>
        ) : (
          <div className="flex flex-col divide-y divide-primary/5 border border-border rounded-xl overflow-hidden">
            {roles.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-background">
                <span className="text-sm text-foreground truncate pr-4">{r.jobrole}</span>
                {r.proficiency_level && <StatusBadge status="processing" size="sm">Level {r.proficiency_level}</StatusBadge>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">In Frameworks ({frameworks.length})</h3>
        {frameworks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not part of any framework.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {frameworks.map((f) => (
              <div key={f.id} className="flex items-center justify-between px-4 py-3 border border-border rounded-xl bg-background">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{f.status}</p>
                </div>
                {f.required_proficiency && <StatusBadge status="processing" size="sm">{f.required_proficiency}</StatusBadge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AttachmentsTab({ detail }: { detail: CompetencyDetail | null }) {
  const attachments = detail?.attachments ?? []
  if (attachments.length === 0) {
    return <EmptyState icon={<BookOpen className="w-6 h-6" />} title="No attachments" description="No learning resources or evidence are linked to this competency." className="border-0" />
  }
  return (
    <div className="flex flex-col gap-3">
      {attachments.map((a, i) => (
        <div key={i} className="flex flex-col gap-1 p-4 border border-border rounded-xl bg-background">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{a.type}</p>
          <p className="text-sm text-foreground leading-relaxed break-words whitespace-pre-wrap">{a.value}</p>
        </div>
      ))}
    </div>
  )
}

function HistoryTab({ detail, trail }: { detail: CompetencyDetail | null; trail: ApprovalTrailEntry[] }) {
  const history = detail?.history ?? []
  if (history.length === 0 && trail.length === 0) {
    return <EmptyState icon={<BookOpen className="w-6 h-6" />} title="No history" description="No change history recorded for this competency." className="border-0" />
  }
  return (
    <div className="flex flex-col gap-6">
      {/* Approval decisions first: a rejection note is the thing a submitter
          opens this tab to find. */}
      {trail.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Approvals</h4>
          {trail.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge status={entry.status} label={entry.status} size="sm" />
                <span className="text-xs text-muted-foreground">{entry.reviewed_at || entry.submitted_at || '—'}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Submitted by {entry.submitted_by_name || 'System'}
                {entry.reviewer_name ? ` · reviewed by ${entry.reviewer_name}` : ''}
              </p>
              {entry.note && <p className="mt-1 text-sm text-foreground italic">“{entry.note}”</p>}
            </div>
          ))}
        </div>
      )}

    <div className="relative flex flex-col gap-0 pl-2">
      <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />
      {history.map((h, i) => (
        <div key={i} className="flex items-start gap-4 relative pl-8 pb-5">
          <div className={cn('absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-background', i === 0 ? 'bg-primary' : 'bg-muted-foreground/40')} />
          <div className="flex-1 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{h.action}</p>
              <p className="text-xs text-muted-foreground">by {h.by}</p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{h.date || '—'}</span>
          </div>
        </div>
      ))}
    </div>
    </div>
  )
}
