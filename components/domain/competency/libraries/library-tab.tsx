'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit2,
  FolderTree,
  Hexagon,
  LayoutGrid,
  Plus,
  Search,
  Table as TableIcon,
  Trash2,
} from 'lucide-react'

import { apiClient } from '@/services/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  useLibraryList,
  useTaxonomy,
  useWorkFunctions,
  type MutationResult,
} from '@/hooks/use-competency-libraries'
import {
  competencyLibrariesService,
  type LibraryListParams,
  type LibraryMeta,
  type LibraryPayload,
  type LibraryRow,
} from '@/services/competency'
import { getLaravelContext, isLaravelContextReady, withLaravelParams } from '@/lib/laravel-context'
import { useAuth } from '@/hooks/use-auth'

import { type LibraryTabConfig } from './library-config'
import { ShapeGrid, SHAPE_ACTION_ICONS, type ShapeAction } from './shape-grid'
import { LibraryDetailModal } from './library-detail-modal'
import { LibraryForm } from './library-form'
import { TaxonomyManager } from './taxonomy-manager'

/** Empty, null and whitespace all render as one em dash rather than a blank cell. */
function dash(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const text = String(value).trim()
  return text === '' ? '—' : text
}

const PER_PAGE_OPTIONS = [
  { label: '25 / page', value: '25' },
  { label: '50 / page', value: '50' },
  { label: '100 / page', value: '100' },
]

const ALL = 'all'

/** The server caps per_page at 200; export walks pages at that size. */
const EXPORT_PAGE_SIZE = 200
/** Upper bound so an unfiltered export of a 90k-row table cannot run away. */
const EXPORT_MAX_ROWS = 10000

/** Windowed page list with ellipsis, so a 300-page library still has a usable pager. */
function pageWindow(current: number, last: number): (number | 'gap')[] {
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1)
  const pages: (number | 'gap')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(last - 1, current + 1)
  if (start > 2) pages.push('gap')
  for (let page = start; page <= end; page++) pages.push(page)
  if (end < last - 1) pages.push('gap')
  pages.push(last)
  return pages
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
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

interface LibraryTabProps {
  config: LibraryTabConfig
  meta: LibraryMeta
  /** False while this tab is not the active one, so background tabs stay idle. */
  active: boolean
}

/**
 * One library tab: toolbar, table or card grid, pager, detail popup, create /
 * edit form, delete confirm and (where the tab owns a taxonomy) its editor.
 *
 * All eight tabs render through this component - what differs between them is
 * declared in library-config.ts rather than duplicated per screen.
 */
/** L-06. `divergence` is null unless counting by name would differ. */
interface LibraryImpact {
  total: number
  basis: string
  breakdown: { label: string; count: number }[]
  divergence: { by_text: number; difference: number; reason: string } | null
}

export function LibraryTab({ config, meta, active }: LibraryTabProps) {
  const { user } = useAuth()

  /* ---------------------------- query state ---------------------------- */
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL)
  const [subCategory, setSubCategory] = useState(ALL)
  const [department, setDepartment] = useState(ALL)
  const [jobrole, setJobrole] = useState(ALL)
  const [workFunction, setWorkFunction] = useState(ALL)
  const [proficiency, setProficiency] = useState(ALL)
  const [approveStatus, setApproveStatus] = useState(ALL)
  const [sort, setSort] = useState(config.sortOptions[0]?.value ?? '')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  // Three views, not two: the shape view is how each library was recognised
  // in the previous app, and it defaults on because that is what people
  // expect to land on. Table stays for anyone who wants the columns.
  const [view, setView] = useState<'shape' | 'table' | 'grid'>('shape')

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const params = useMemo<LibraryListParams>(
    () => ({
      ...(search ? { search } : {}),
      ...(category !== ALL ? { category } : {}),
      ...(subCategory !== ALL ? { sub_category: subCategory } : {}),
      ...(department !== ALL ? { department } : {}),
      ...(jobrole !== ALL ? { jobrole } : {}),
      ...(workFunction !== ALL ? { critical_work_function: workFunction } : {}),
      ...(proficiency !== ALL ? { proficiency_level: proficiency } : {}),
      ...(approveStatus !== ALL ? { approve_status: approveStatus } : {}),
      ...(sort ? { sort, direction } : {}),
      page,
      per_page: perPage,
    }),
    [
      search, category, subCategory, department, jobrole, workFunction,
      proficiency, approveStatus, sort, direction, page, perPage,
    ],
  )

  const {
    loading,
    error,
    items,
    pagination,
    saving,
    actionMessage,
    actionError,
    retry,
    create,
    update,
    remove,
    clearMessages,
  } = useLibraryList(config.id, params, active)

  // Deleting the last row of the last page (or tightening a filter) can leave
  // `page` past the end, which reads as "no results" rather than "you are off
  // the end". Adjusted during render, the pattern React documents for this.
  if (pagination && page > pagination.last_page) {
    setPage(pagination.last_page)
  }

  // The taxonomy feeds both the category filters and the form's dropdowns, so
  // it loads for any tab that has one - not only when the editor is open.
  const taxonomy = useTaxonomy(config.id, active && config.hasTaxonomy)

  /* ------------------------------ ui state ----------------------------- */
  // Every tab opens the popup. An earlier design gave the non-competency tabs
  // a side panel instead, but nothing ever put a row into its state, so it was
  // unreachable on all eight tabs and has been removed.
  const [richDetail, setRichDetail] = useState<LibraryRow | null>(null)
  // Which popup section to land on. Set by the tile actions so "usage
  // insights" opens on roles rather than making the user hunt for it.
  const [richDetailSection, setRichDetailSection] = useState<string | undefined>(undefined)
  const [formOpen, setFormOpen] = useState(false)
  const [formInitial, setFormInitial] = useState<LibraryRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LibraryRow | null>(null)
  // L-06. The dialog used to admit that orphans would be created and never say
  // how many. This is the number, and it is computed BY KEY (G-LIB-09): the same
  // count by title over-reports by 1.6% inside a tenant and by SIX TIMES without
  // a tenant condition.
  const [impact, setImpact] = useState<LibraryImpact | null>(null)
  const [impactState, setImpactState] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    if (!deleteTarget) { setImpact(null); setImpactState('idle'); return }
    const context = getLaravelContext()
    if (!isLaravelContextReady(context)) { setImpactState('error'); return }
    let cancelled = false
    setImpactState('loading')

    apiClient
      .get<{ status: number; data: LibraryImpact }>('/competency/library/dependants',
        withLaravelParams(context, { kind: config.id, id: String(deleteTarget.id) }))
      .then((res) => { if (!cancelled) { setImpact(res.data); setImpactState('idle') } })
      // A COUNT THAT FAILED TO LOAD IS NOT A COUNT OF ZERO. Saying "0 records
      // depend on this" because the request failed is the dead-bell lie applied
      // to a deletion, which is a worse place for it.
      .catch(() => { if (!cancelled) setImpactState('error') })

    return () => { cancelled = true }
  }, [deleteTarget, config.id])
  const [taxonomyOpen, setTaxonomyOpen] = useState(false)
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState<string | null>(null)

  /* ------------------------------ options ------------------------------ */

  const categoryOptions = useMemo(() => {
    // Prefer the taxonomy (the full set); fall back to what the page returned
    // so the filter still works for a tab without an editable taxonomy.
    const source = config.hasTaxonomy
      ? taxonomy.categories
      : config.id === 'invisible'
        ? meta.invisible_types
        : []

    const set = new Set(source.filter(Boolean))
    if (!set.size && config.categoryKey) {
      items.forEach((row) => {
        const value = row[config.categoryKey!]
        if (typeof value === 'string' && value.trim()) set.add(value.trim())
      })
    }
    if (category !== ALL) set.add(category)

    return [
      { label: `All ${config.categoryLabel}`, value: ALL },
      ...Array.from(set).sort().map((value) => ({ label: value, value })),
    ]
  }, [config, taxonomy.categories, meta.invisible_types, items, category])

  const subCategoryOptions = useMemo(() => {
    if (!config.subCategoryKey) return []
    const list = category !== ALL ? taxonomy.subCategoriesOf(category) : []
    const set = new Set(list.filter(Boolean))
    if (subCategory !== ALL) set.add(subCategory)
    return [
      { label: 'All Sub Categories', value: ALL },
      ...Array.from(set).sort().map((value) => ({ label: value, value })),
    ]
  }, [config.subCategoryKey, category, subCategory, taxonomy])

  const departmentOptions = useMemo(() => {
    const set = new Set<string>(meta.departments.filter(Boolean))
    Object.keys(meta.jobroles_by_department).forEach((name) => set.add(name))
    if (department !== ALL) set.add(department)
    return [
      { label: 'All Departments', value: ALL },
      ...Array.from(set).sort().map((value) => ({ label: value, value })),
    ]
  }, [meta, department])

  const jobroleOptions = useMemo(() => {
    const roles =
      department !== ALL
        ? (meta.jobroles_by_department[department] ?? [])
        : Object.values(meta.jobroles_by_department).flat()

    const set = new Set(roles.map((role) => role.jobrole).filter(Boolean))
    if (jobrole !== ALL) set.add(jobrole)

    return [
      { label: 'All Job Roles', value: ALL },
      ...Array.from(set).sort().map((value) => ({ label: value, value })),
    ]
  }, [meta.jobroles_by_department, department, jobrole])

  const showDepartmentFilter = config.id === 'skill' || config.id === 'jobrole'
  const showJobroleFilter = config.id === 'skill' || config.id === 'jobrole-task'
  const showWorkFunctionFilter = config.id === 'jobrole-task'
  const showSkillFilters = config.id === 'skill'

  const proficiencyOptions = useMemo(() => {
    const set = new Set(meta.proficiency_levels.filter(Boolean))
    if (proficiency !== ALL) set.add(proficiency)
    return [
      { label: 'All Proficiency', value: ALL },
      ...Array.from(set)
        // Numeric where possible, so 10 sorts after 9 rather than after 1.
        .sort((a, b) => (Number(a) - Number(b)) || a.localeCompare(b))
        .map((value) => ({ label: `Level ${value}`, value })),
    ]
  }, [meta.proficiency_levels, proficiency])

  const statusOptions = [
    { label: 'All Statuses', value: ALL },
    { label: 'Approved', value: 'Approved' },
    { label: 'Pending', value: 'Pending' },
    { label: 'Cancelled', value: 'Cancelled' },
  ]

  // Scoped to the selected role, so the two dropdowns always agree.
  const workFunctionValues = useWorkFunctions(
    jobrole === ALL ? null : jobrole,
    active && showWorkFunctionFilter,
  )

  const workFunctionOptions = useMemo(() => {
    const set = new Set(workFunctionValues.filter(Boolean))
    if (workFunction !== ALL) set.add(workFunction)
    return [
      { label: 'All Work Functions', value: ALL },
      ...Array.from(set).sort().map((value) => ({ label: value, value })),
    ]
  }, [workFunctionValues, workFunction])

  const hasFilters =
    Boolean(search) ||
    category !== ALL ||
    subCategory !== ALL ||
    department !== ALL ||
    jobrole !== ALL ||
    workFunction !== ALL ||
    proficiency !== ALL ||
    approveStatus !== ALL

  const clearAll = () => {
    setSearchInput('')
    setSearch('')
    setCategory(ALL)
    setSubCategory(ALL)
    setDepartment(ALL)
    setJobrole(ALL)
    setWorkFunction(ALL)
    setProficiency(ALL)
    setApproveStatus(ALL)
    setPage(1)
  }

  const changeCategory = (value: string) => {
    setCategory(value)
    setSubCategory(ALL)
    setPage(1)
  }

  const changeDepartment = (value: string) => {
    setDepartment(value)
    // The role list is scoped to the department, so an old pick would filter
    // to nothing rather than simply widening.
    setJobrole(ALL)
    setPage(1)
  }

  const toggleSort = (field: string) => {
    if (sort === field) setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(field)
      setDirection('asc')
    }
    setPage(1)
  }

  /* ------------------------------ actions ------------------------------ */

  const columns = useMemo(() => config.fields.filter((field) => field.column), [config])

  /**
   * The card's second line. Most tabs have a description; Job Role Task does
   * not, so it falls back to the first column after the title.
   */
  const summaryKey = useMemo(() => {
    if (config.fields.some((field) => field.key === 'description')) return 'description'
    return columns.find((field) => field.key !== config.titleKey)?.key ?? config.titleKey
  }, [config, columns])

  /** Shared (platform-owned) rows have no sub_institute_id and are read-only. */
  const canEditRow = (row: LibraryRow) =>
    config.id !== 'invisible' || row.sub_institute_id !== null

  const openCreate = () => {
    clearMessages()
    setFormInitial(null)
    setFormOpen(true)
  }

  const openEdit = (row: LibraryRow) => {
    clearMessages()
    setFormInitial(row)
    setFormOpen(true)
  }

  const submitForm = (payload: LibraryPayload): Promise<MutationResult> =>
    formInitial ? update(formInitial.id, payload) : create(payload)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const result = await remove(deleteTarget.id)
    if (result.ok) {
      setDeleteTarget(null)
    }
  }

  const handleClone = async (row: LibraryRow) => {
    setCloning(true)
    setCloneError(null)
    try {
      await competencyLibrariesService.cloneInvisible(getLaravelContext(user), row.id)
      retry()
    } catch (error) {
      setCloneError(error instanceof Error ? error.message : 'Failed to copy the entry.')
    } finally {
      setCloning(false)
    }
  }

  /**
   * Exports everything matching the current filters, not just the visible page
   * - "Export" that silently drops rows 26 onward is worse than no export. The
   * server caps per_page at 200, so this walks the pages up to EXPORT_MAX_ROWS
   * and says so if it had to stop.
   */
  /**
   * Competencies open the full popup; the other libraries have no
   * proficiency levels or course context, so they keep the side panel.
   */
  const openRow = (row: LibraryRow) => {
    setRichDetail(row)
  }

  /**
   * The controls that sit on each tile. Edit and Delete reuse the same
   * handlers the table rows use, so there is one code path per action rather
   * than a second one that can drift.
   *
   * Usage insights and Link to task open the detail popup on the section that
   * answers them, rather than being dead icons that look available.
   */
  const tileActions: ShapeAction[] = [
    {
      id: 'edit',
      label: 'Edit',
      icon: SHAPE_ACTION_ICONS.edit,
      onSelect: openEdit,
    },
    {
      id: 'insights',
      label: 'Usage insights',
      icon: SHAPE_ACTION_ICONS.insights,
      onSelect: (row) => {
        setRichDetailSection('jobroles')
        setRichDetail(row)
      },
    },
    {
      id: 'link',
      label: 'Linked items',
      icon: SHAPE_ACTION_ICONS.link,
      onSelect: (row) => {
        setRichDetailSection('levels')
        setRichDetail(row)
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: SHAPE_ACTION_ICONS.delete,
      danger: true,
      onSelect: (row) => setDeleteTarget(row),
    },
  ]

  const handleExport = async () => {
    if (items.length === 0 || exporting) return

    setExporting(true)
    setExportNote(null)

    try {
      const context = getLaravelContext(user)
      const rows: LibraryRow[] = []
      let exportPage = 1
      let lastExportPage = 1

      do {
        const response = await competencyLibrariesService.list(context, config.id, {
          ...params,
          page: exportPage,
          per_page: EXPORT_PAGE_SIZE,
        })
        rows.push(...(response.data ?? []))
        lastExportPage = response.pagination?.last_page ?? 1
        exportPage += 1
      } while (exportPage <= lastExportPage && rows.length < EXPORT_MAX_ROWS)

      if (rows.length === 0) return

      const truncated = rows.length >= EXPORT_MAX_ROWS && exportPage <= lastExportPage
      downloadCsv(
        `${config.id}-library-${new Date().toISOString().slice(0, 10)}.csv`,
        config.fields.map((field) => field.label),
        rows.map((row) => config.fields.map((field) => row[field.key])),
      )
      setExportNote(
        truncated
          ? `Exported the first ${rows.length.toLocaleString()} rows. Narrow the filters to export the rest.`
          : `Exported ${rows.length.toLocaleString()} ${rows.length === 1 ? 'row' : 'rows'}.`,
      )
    } catch (exportError) {
      setExportNote(exportError instanceof Error ? exportError.message : 'Failed to export this library.')
    } finally {
      setExporting(false)
    }
  }

  /* ------------------------------- render ------------------------------ */

  const total = pagination?.total ?? 0
  const lastPage = pagination?.last_page ?? 1
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1
  const rangeEnd = Math.min(page * perPage, total)

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="relative z-20 flex flex-col gap-4 rounded-2xl border border-primary/10 bg-card/50 p-4 shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${config.plural.toLowerCase()}…`}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-10 w-full rounded-xl border-input bg-background/50 pl-9 pr-4 text-sm focus-visible:ring-primary/50"
              aria-label={`Search ${config.plural}`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setView('table')}
                className={cn(
                  'flex h-10 w-10 items-center justify-center transition-colors',
                  view === 'table' ? 'bg-primary/10 text-primary' : 'bg-background text-muted-foreground hover:bg-accent',
                )}
                title="Table view"
                aria-label="Table view"
                aria-pressed={view === 'table'}
              >
                <TableIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('shape')}
                className={cn(
                  'flex h-10 w-10 items-center justify-center border-l border-border transition-colors',
                  view === 'shape' ? 'bg-primary/10 text-primary' : 'bg-background text-muted-foreground hover:bg-accent',
                )}
                title={`${config.plural} as ${config.shape}s`}
                aria-label={`${config.shape} view`}
                aria-pressed={view === 'shape'}
              >
                <Hexagon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('grid')}
                className={cn(
                  'flex h-10 w-10 items-center justify-center border-l border-border transition-colors',
                  view === 'grid' ? 'bg-primary/10 text-primary' : 'bg-background text-muted-foreground hover:bg-accent',
                )}
                title="Card view"
                aria-label="Card view"
                aria-pressed={view === 'grid'}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            <Button
              variant="outline"
              onClick={handleExport}
              disabled={items.length === 0 || exporting}
              className="h-10 gap-2 rounded-xl font-semibold"
              title="Download every row matching the current filters"
            >
              <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export'}
            </Button>

            {config.hasTaxonomy && (
              <Button
                variant="outline"
                onClick={() => setTaxonomyOpen(true)}
                className="h-10 gap-2 rounded-xl font-semibold"
              >
                <FolderTree className="h-4 w-4" /> Taxonomy
              </Button>
            )}

            <Button
              onClick={openCreate}
              className="h-10 gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 stroke-[3]" /> Add {config.singular}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-52">
            <Select
              value={category}
              onChange={changeCategory}
              options={categoryOptions}
              className="h-9 rounded-lg border-border bg-background/50"
              aria-label={config.categoryLabel}
            />
          </div>

          {config.subCategoryKey && (
            <div className="w-52">
              <Select
                value={subCategory}
                onChange={(value) => {
                  setSubCategory(value)
                  setPage(1)
                }}
                options={subCategoryOptions}
                disabled={category === ALL}
                className="h-9 rounded-lg border-border bg-background/50"
                aria-label={config.subCategoryLabel ?? 'Sub Category'}
              />
            </div>
          )}

          {showDepartmentFilter && (
            <div className="w-52">
              <Select
                value={department}
                onChange={changeDepartment}
                options={departmentOptions}
                className="h-9 rounded-lg border-border bg-background/50"
                aria-label="Department"
              />
            </div>
          )}

          {showJobroleFilter && (
            <div className="w-56">
              <Select
                value={jobrole}
                onChange={(value) => {
                  setJobrole(value)
                  // Work functions are role-specific, so an old pick would
                  // filter to nothing instead of simply widening.
                  setWorkFunction(ALL)
                  setPage(1)
                }}
                options={jobroleOptions}
                className="h-9 rounded-lg border-border bg-background/50"
                aria-label="Job Role"
              />
            </div>
          )}

          {showWorkFunctionFilter && (
            <div className="w-60">
              <Select
                value={workFunction}
                onChange={(value) => {
                  setWorkFunction(value)
                  setPage(1)
                }}
                options={workFunctionOptions}
                className="h-9 rounded-lg border-border bg-background/50"
                aria-label="Critical Work Function"
              />
            </div>
          )}

          {showSkillFilters && (
            <>
              <div className="w-40">
                <Select
                  value={proficiency}
                  onChange={(value) => {
                    setProficiency(value)
                    setPage(1)
                  }}
                  options={proficiencyOptions}
                  className="h-9 rounded-lg border-border bg-background/50"
                  aria-label="Proficiency level"
                />
              </div>
              <div className="w-40">
                <Select
                  value={approveStatus}
                  onChange={(value) => {
                    setApproveStatus(value)
                    setPage(1)
                  }}
                  options={statusOptions}
                  className="h-9 rounded-lg border-border bg-background/50"
                  aria-label="Status"
                />
              </div>
            </>
          )}

          <div className="w-44">
            <Select
              value={sort}
              onChange={(value) => {
                setSort(value)
                setPage(1)
              }}
              options={config.sortOptions.map((option) => ({ label: `Sort: ${option.label}`, value: option.value }))}
              className="h-9 rounded-lg border-border bg-background/50"
              aria-label="Sort by"
            />
          </div>

          <button
            type="button"
            onClick={() => setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background/50 px-3 text-sm font-medium hover:bg-accent"
            title={direction === 'asc' ? 'Ascending' : 'Descending'}
          >
            {direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            {direction === 'asc' ? 'A–Z' : 'Z–A'}
          </button>

          {hasFilters && (
            <button onClick={clearAll} className="ml-1 text-sm font-medium text-primary hover:underline">
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Action feedback */}
      {(actionMessage || actionError || cloneError || exportNote) && (
        <div
          className={cn(
            'flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-medium',
            actionError || cloneError
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600',
          )}
        >
          <span>{cloneError || actionError || actionMessage || exportNote}</span>
          <button
            onClick={() => {
              clearMessages()
              setCloneError(null)
              setExportNote(null)
            }}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col rounded-2xl border border-primary/10 bg-card/90 shadow-sm backdrop-blur-2xl">
        {error ? (
          <ErrorState title={`Couldn't load ${config.plural.toLowerCase()}`} description={error} retry={retry} className="m-6" />
        ) : loading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            className="m-6 border-0"
            icon={<config.icon className="h-10 w-10" />}
            title={hasFilters ? `No ${config.plural.toLowerCase()} match those filters` : `No ${config.plural.toLowerCase()} yet`}
            description={
              hasFilters
                ? 'Try widening the search or clearing the filters.'
                : `Add your first entry to start building the ${config.plural.toLowerCase()} library.`
            }
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearAll} className="font-semibold">
                  Clear filters
                </Button>
              ) : (
                <Button onClick={openCreate} className="gap-2 font-bold">
                  <Plus className="h-4 w-4" /> Add {config.singular}
                </Button>
              )
            }
          />
        ) : view === 'table' ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {columns.map((field) => (
                    <TableHead key={field.key} className={cn('px-4 py-3 text-xs', field.width)}>
                      <button
                        type="button"
                        onClick={() => toggleSort(field.key)}
                        className="inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground"
                      >
                        {field.label}
                        {sort === field.key &&
                          (direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="w-28 px-4 py-3 text-right text-xs uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={() => openRow(row)}
                    className="cursor-pointer border-border transition-colors hover:bg-accent/40"
                  >
                    {columns.map((field) => {
                      const value = row[field.key]
                      const isTitle = field.key === config.titleKey
                      const isStatus = field.key === 'approve_status' || field.key === 'status'

                      return (
                        <TableCell key={field.key} className={cn('px-4 py-3 align-top text-sm', field.width)}>
                          {isStatus && value ? (
                            <StatusBadge status={String(value)} label={String(value)} />
                          ) : (
                            <span
                              className={cn(
                                isTitle ? 'font-semibold text-foreground' : 'text-muted-foreground',
                                'line-clamp-2 break-words',
                              )}
                            >
                              {dash(value)}
                            </span>
                          )}
                        </TableCell>
                      )
                    })}
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEditRow(row) ? (
                          <>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                openEdit(row)
                              }}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              aria-label={`Edit ${String(row[config.titleKey] ?? '')}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setDeleteTarget(row)
                              }}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Delete ${String(row[config.titleKey] ?? '')}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleClone(row)
                            }}
                            disabled={cloning}
                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                            title="Shared entry — duplicate it to edit your own copy"
                            aria-label={`Duplicate ${String(row[config.titleKey] ?? '')}`}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : view === 'shape' ? (
          <div className="p-5">
            <ShapeGrid
              shape={config.shape}
              rows={items}
              titleKey={config.titleKey}
              subtitleKey="description"
              onOpen={openRow}
              actions={tileActions}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((row) => {
              const status = (row.approve_status ?? row.status) as string | undefined
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => openRow(row)}
                  className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-background/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <config.icon className="h-4 w-4" />
                    </span>
                    <p className="line-clamp-2 flex-1 text-sm font-bold text-foreground">
                      {dash(row[config.titleKey])}
                    </p>
                  </div>

                  <p className="line-clamp-3 flex-1 text-xs text-muted-foreground">
                    {dash(row[summaryKey])}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {config.categoryKey && row[config.categoryKey] ? (
                      <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {String(row[config.categoryKey])}
                      </span>
                    ) : null}
                    {status ? <StatusBadge status={status} label={status} size="sm" /> : null}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Pager */}
        {!loading && !error && items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{rangeStart}</span>–
              <span className="font-semibold text-foreground">{rangeEnd}</span> of{' '}
              <span className="font-semibold text-foreground">{total}</span>
            </p>

            <div className="flex items-center gap-2">
              <div className="w-32">
                <Select
                  value={String(perPage)}
                  onChange={(value) => {
                    setPerPage(Number(value))
                    setPage(1)
                  }}
                  options={PER_PAGE_OPTIONS}
                  className="h-9 rounded-lg border-border bg-background"
                  aria-label="Rows per page"
                />
              </div>

              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {pageWindow(page, lastPage).map((entry, index) =>
                entry === 'gap' ? (
                  <span key={`gap-${index}`} className="px-1 text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setPage(entry)}
                    aria-current={entry === page ? 'page' : undefined}
                    className={cn(
                      'h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold transition-colors',
                      entry === page
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {entry}
                  </button>
                ),
              )}

              <button
                type="button"
                onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
                disabled={page >= lastPage}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {richDetail && (
        <LibraryDetailModal
          config={config}
          row={richDetail}
          initialSection={richDetailSection}
          onEdit={() => {
            const row = richDetail
            setRichDetail(null)
            openEdit(row)
          }}
          onDelete={() => {
            const row = richDetail
            setRichDetail(null)
            setDeleteTarget(row)
          }}
          onClose={() => {
            setRichDetail(null)
            setRichDetailSection(undefined)
          }}
        />
      )}

      {/* Taxonomy editor */}
      {config.hasTaxonomy && (
        <Sheet open={taxonomyOpen} onOpenChange={setTaxonomyOpen}>
          <SheetContent
            side="right"
            className="flex w-full flex-col border-l border-primary/10 bg-card p-0 shadow-2xl sm:w-[560px] sm:max-w-none"
          >
            <TaxonomyManager
              config={config}
              taxonomy={taxonomy}
              onClose={() => {
                setTaxonomyOpen(false)
                // A rename or delete can leave the filters pointing at a name
                // that no longer exists, which would read as an empty library.
                if (category !== ALL && !taxonomy.categories.includes(category)) {
                  setCategory(ALL)
                  setSubCategory(ALL)
                  setPage(1)
                } else if (
                  subCategory !== ALL &&
                  category !== ALL &&
                  !taxonomy.subCategoriesOf(category).includes(subCategory)
                ) {
                  setSubCategory(ALL)
                  setPage(1)
                }
                retry()
              }}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Create / edit */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && setFormOpen(false)}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-[760px]">
          {formOpen && (
            <LibraryForm
              config={config}
              initial={formInitial}
              saving={saving}
              categories={taxonomy.categories}
              subCategoriesOf={taxonomy.subCategoriesOf}
              meta={meta}
              onSubmit={submitForm}
              onCancel={() => setFormOpen(false)}
              onSaved={() => setFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Delete this {config.singular.toLowerCase()}?</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">
                {dash(deleteTarget?.[config.titleKey])}
              </span>{' '}
              will be removed from the {config.plural.toLowerCase()} library.
              {impactState === 'loading' && <span className="block pt-2">Checking what depends on it…</span>}
              {impactState === 'error' && (
                <span className="block pt-2">
                  What depends on it could not be checked. This is a connection problem, not a count of zero.
                </span>
              )}
              {impactState === 'idle' && impact && (
                <span className="block pt-2">
                  {impact.total === 0 ? (
                    <span className="font-semibold text-foreground">Nothing depends on it.</span>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">
                        {impact.total} record{impact.total === 1 ? '' : 's'} depend on it
                      </span>{' '}
                      ({impact.breakdown.filter((b) => b.count > 0).map((b) => `${b.count} ${b.label}`).join(', ')}).
                      Those records keep their own row and lose what they pointed at.
                      {/* Named basis, because the product still joins by name in
                          twelve places and a bare number would hide which one
                          this is. */}
                      <span className="block pt-1 text-xs">Counted by key.</span>
                      {impact.divergence && (
                        <span className="block text-xs">
                          Counting by name gives {impact.divergence.by_text} — {impact.divergence.reason}
                        </span>
                      )}
                    </>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving} className="font-bold">
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={saving}
              className="bg-destructive font-bold text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
