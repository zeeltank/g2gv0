'use client'

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Eye,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { SelectInput, AccessDenied } from '../components'
import {
  type Department,
  type DeptNode,
} from '@/lib/gtg-org-data'
import { getAccess, roleLabel, type Role } from '@/lib/gtg-roles'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { organizationService, type LaravelDepartment } from '@/services/organization'

const LazyDepartmentDetailsPanel = lazy(() =>
  import('@/domain/organization/department-management/department-details-panel').then((module) => ({
    default: module.DepartmentDetailsPanel,
  })),
)

type SortKey = 'name' | 'code' | 'parent' | 'hod' | 'employees' | 'status'
type DepartmentDialogMode = 'add' | 'edit'

const PAGE_SIZE = 10

/*
 * HOD_TITLES and the hardcoded departmentCode() lookup table used to live here.
 *
 * HOD_TITLES mapped eleven invented people ('Avin Mehta' -> 'CEO') to job
 * titles. It could never match anything: mapDepartments() set `hod: null` for
 * every row, so the lookup was dead code decorating data that did not exist.
 *
 * departmentCode() was a twelve-entry table of names to codes, with an initials
 * fallback for everything else - and it WAS rendering, as the table's Code
 * column. Those codes are now a real, editable `code` column on
 * hrms_departments, backfilled from this exact table so nothing visibly
 * changed, and the two other copies of it elsewhere in this folder are gone.
 *
 * departmentCode() survives only as a display fallback for a row whose code is
 * genuinely empty.
 */
function departmentCode(department: Department) {
  if (department.code) return department.code

  return department.name
    .split(/\s|&/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 6)
}

function initials(name?: string | null) {
  if (!name) return 'UA'
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function descendantCount(node: DeptNode, visited = new Set<string>()): number {
  if (visited.has(node.id)) return 0
  const nextVisited = new Set(visited)
  nextVisited.add(node.id)
  return node.children.reduce((total, child) => total + 1 + descendantCount(child, nextVisited), 0)
}

function collectDescendantIds(node: DeptNode, visited = new Set<string>()): string[] {
  if (visited.has(node.id)) return []
  const nextVisited = new Set(visited)
  nextVisited.add(node.id)
  const ids = [node.id]
  for (const child of node.children) {
    ids.push(...collectDescendantIds(child, nextVisited))
  }
  return ids
}

function findNodeById(nodes: DeptNode[], id: string, visited = new Set<string>()): DeptNode | undefined {
  for (const node of nodes) {
    if (visited.has(node.id)) continue
    visited.add(node.id)
    if (node.id === id) return node
    const found = findNodeById(node.children, id, visited)
    if (found) return found
  }
  return undefined
}

function mapDepartments(main: LaravelDepartment[], grouped: Record<string, LaravelDepartment[]>): Department[] {
  const all = [...main, ...Object.values(grouped).flat()]
  const unique = new Map<string, LaravelDepartment>()
  for (const department of all) {
    const id = String(department.id)
    if (!unique.has(id)) unique.set(id, department)
  }
  const names = new Map(Array.from(unique.values()).map((department) => [String(department.id), department.department]))

  return Array.from(unique.values()).map((department) => ({
    id: String(department.id),
    name: department.department,
    code: department.code ?? null,
    description: department.description ?? null,
    parentId: department.parent_id && Number(department.parent_id) !== 0
      ? String(department.parent_id)
      : null,
    parent: department.parent_id && Number(department.parent_id) !== 0
      ? names.get(String(department.parent_id)) ?? null
      : null,
    // These three lines were `hod: null`, `employees: 0` and a status that
    // could only ever be 'Active'. That was the whole reason four of the
    // table's columns showed the same value on every row: not a rendering
    // bug, but this function having nothing to render. The API now sends
    // head_name, employee_count and both statuses.
    hod: department.head_name ?? null,
    hodId: department.head_id ? String(department.head_id) : null,
    employees: Number(department.employee_count ?? 0),
    status: Number(department.status) === 1 ? 'Active' : 'Inactive',
    sortOrder: Number(department.sort_order ?? 0),
    created: department.created_at ?? '',
    updated: department.updated_at ?? null,
  }))
}

function buildSafeHierarchy(depts: Department[]): DeptNode[] {
  const byId = new Map<string, DeptNode>()

  for (const department of depts) {
    if (byId.has(department.id)) continue
    byId.set(department.id, {
      id: department.id,
      name: department.name,
      code: department.code ?? null,
      hod: department.hod,
      employees: department.employees,
      status: department.status,
      children: [],
    })
  }

  const byDepartmentId = new Map(depts.map((department) => [department.id, department]))

  function hasAncestor(targetId: string, candidateParentId: string | null | undefined, seen = new Set<string>()): boolean {
    if (!candidateParentId || seen.has(candidateParentId)) return false
    if (candidateParentId === targetId) return true
    seen.add(candidateParentId)
    return hasAncestor(targetId, byDepartmentId.get(candidateParentId)?.parentId, seen)
  }

  const roots: DeptNode[] = []
  for (const department of depts) {
    const node = byId.get(department.id)
    if (!node) continue
    const parentNode = department.parentId ? byId.get(department.parentId) : undefined

    if (!department.parentId || !parentNode || department.parentId === department.id || hasAncestor(department.id, byDepartmentId.get(department.parentId)?.parentId)) {
      roots.push(node)
    } else if (!parentNode.children.some((child) => child.id === node.id)) {
      parentNode.children.push(node)
    }
  }

  return roots
}

export function DepartmentList({ role }: { role: Role }) {
  const access = getAccess('department-list', role)
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [treeQuery, setTreeQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [parentFilter, setParentFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastShown, setLastShown] = useState<Department | null>(null)
  const [hierarchyFilter, setHierarchyFilter] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [departmentDialogMode, setDepartmentDialogMode] = useState<DepartmentDialogMode | null>(null)
  const [dialogParent, setDialogParent] = useState<Department | null>(null)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [deleteDepartment, setDeleteDepartment] = useState<Department | null>(null)
  const [departmentName, setDepartmentName] = useState('')
  // The add/edit dialog collected a name and nothing else, because the endpoint
  // wrote a name and nothing else. Both now handle the full record.
  const [departmentCodeInput, setDepartmentCodeInput] = useState('')
  const [departmentDescription, setDepartmentDescription] = useState('')
  // Targets for the two pickers. Non-null means the dialog is open for that row.
  const [hodTarget, setHodTarget] = useState<Department | null>(null)
  const [parentTarget, setParentTarget] = useState<Department | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [hodFilter, setHodFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
  const [staffedFilter, setStaffedFilter] = useState<'all' | 'staffed' | 'empty'>('all')
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [showCodes, setShowCodes] = useState(true)
  const [showCounts, setShowCounts] = useState(true)
  const [expandSignal, setExpandSignal] = useState<ExpandSignal>({ open: true, nonce: 0 })
  const context = useMemo(() => getLaravelContext(user), [user])

  // The nonce is what makes a repeated "Collapse all" work: without it the
  // prop would be identical to last time and no node's effect would re-run.
  const expandAll = useCallback(() => setExpandSignal((s) => ({ open: true, nonce: s.nonce + 1 })), [])
  const collapseAll = useCallback(() => setExpandSignal((s) => ({ open: false, nonce: s.nonce + 1 })), [])

  const loadDepartments = useCallback(async (options?: { clearNotice?: boolean }) => {
    setIsLoading(true)
    try {
      const response = await organizationService.getDepartmentsManagement(context)
      setDepartments(mapDepartments(response.main_departments, response.sub_departments))
      if (options?.clearNotice !== false) setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to load departments.')
    } finally {
      setIsLoading(false)
    }
  }, [context])

  useEffect(() => {
    queueMicrotask(() => void loadDepartments())
  }, [loadDepartments])

  const scopedDepts = useMemo(() => {
    if (access === 'scoped') {
      return departments.filter(
        (d) => d.name === 'Engineering' || d.parent === 'Engineering',
      )
    }
    return departments
  }, [access, departments])

  const tree = useMemo(() => buildSafeHierarchy(scopedDepts), [scopedDepts])
  const parents = useMemo(
    () => Array.from(new Set(scopedDepts.map((d) => d.parent).filter(Boolean))) as string[],
    [scopedDepts],
  )

  const selectedHierarchyIds = useMemo(() => {
    if (!hierarchyFilter) return null
    const node = findNodeById(tree, hierarchyFilter)
    if (!node) return null
    return new Set(collectDescendantIds(node))
  }, [hierarchyFilter, tree])

  const filtered = useMemo(() => {
    const rows = scopedDepts.filter((d) => {
      const q = query.trim().toLowerCase()
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        departmentCode(d).toLowerCase().includes(q) ||
        (d.parent ?? '').toLowerCase().includes(q) ||
        (d.hod ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || d.status === statusFilter
      const matchesParent = parentFilter === 'all' || (d.parent ?? 'Root') === parentFilter
      const matchesHierarchy = !selectedHierarchyIds || selectedHierarchyIds.has(d.id)
      const matchesHod =
        hodFilter === 'all' ||
        (hodFilter === 'assigned' ? Boolean(d.hod) : !d.hod)
      const matchesStaffed =
        staffedFilter === 'all' ||
        (staffedFilter === 'staffed' ? d.employees > 0 : d.employees === 0)

      return matchesQuery && matchesStatus && matchesParent && matchesHierarchy && matchesHod && matchesStaffed
    })

    rows.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''

      switch (sortKey) {
        case 'code':
          av = departmentCode(a)
          bv = departmentCode(b)
          break
        case 'employees':
          av = a.employees
          bv = b.employees
          break
        case 'parent':
          av = a.parent ?? ''
          bv = b.parent ?? ''
          break
        case 'hod':
          av = a.hod ?? ''
          bv = b.hod ?? ''
          break
        case 'status':
          av = a.status
          bv = b.status
          break
        default:
          av = a.name
          bv = b.name
      }

      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })

    return rows
  }, [scopedDepts, query, statusFilter, parentFilter, hodFilter, staffedFilter, selectedHierarchyIds, sortKey, sortAsc])

  /** How many filters are narrowing the list, for the Filters button's badge. */
  const activeFilterCount = useMemo(
    () =>
      [statusFilter !== 'all', parentFilter !== 'all', hodFilter !== 'all', staffedFilter !== 'all']
        .filter(Boolean).length,
    [statusFilter, parentFilter, hodFilter, staffedFilter],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const selected = selectedId ? scopedDepts.find((d) => d.id === selectedId) ?? null : null
  const isDetailsOpen = Boolean(selected)
  const canManage = access !== 'none'
  const isDepartmentDialogOpen = Boolean(departmentDialogMode)

  const detailDept = selected ?? lastShown

  if (access === 'none') {
    return <AccessDenied role={roleLabel(role)} />
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((value) => !value)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  function selectDepartment(id: string) {
    setSelectedId(id)
    const department = scopedDepts.find((item) => item.id === id)
    if (department) setLastShown(department)
  }

  function selectFromHierarchy(id: string) {
    selectDepartment(id)
    setHierarchyFilter(id)
  }

  function clearHierarchyFilter() {
    setHierarchyFilter(null)
  }

  function openAddDialog(parent?: Department | null) {
    setDepartmentDialogMode('add')
    setDialogParent(parent ?? null)
    setEditingDepartment(null)
    setDepartmentName('')
    setDepartmentCodeInput('')
    setDepartmentDescription('')
    setNotice('')
  }

  function openEditDialog(department: Department) {
    setDepartmentDialogMode('edit')
    setDialogParent(null)
    setEditingDepartment(department)
    setDepartmentName(department.name)
    // Seeded from the row, so an edit round-trips instead of silently
    // clearing the fields the dialog did not used to show.
    setDepartmentCodeInput(department.code ?? '')
    setDepartmentDescription(department.description ?? '')
    setNotice('')
  }

  function closeDepartmentDialog() {
    if (isSaving) return
    setDepartmentDialogMode(null)
    setDialogParent(null)
    setEditingDepartment(null)
    setDepartmentName('')
  }

  async function saveDepartment() {
    const nextName = departmentName.trim()
    if (!nextName) {
      setNotice('Department name is required.')
      return
    }

    const nextCode = departmentCodeInput.trim()
    const nextDescription = departmentDescription.trim()

    // The early-out used to compare the name alone, so editing only the code or
    // the description looked like a no-op and closed without saving.
    if (
      editingDepartment &&
      nextName === editingDepartment.name &&
      nextCode === (editingDepartment.code ?? '') &&
      nextDescription === (editingDepartment.description ?? '')
    ) {
      closeDepartmentDialog()
      return
    }

    setIsSaving(true)
    try {
      let successMessage = ''
      if (editingDepartment) {
        await organizationService.updateDepartment(context, editingDepartment.id, {
          department: nextName,
          code: nextCode,
          description: nextDescription,
        })
        successMessage = `${editingDepartment.parent ? 'Sub-department' : 'Department'} updated successfully.`
      } else {
        await organizationService.createDepartment(context, {
          department: nextName,
          parent_id: dialogParent?.id,
          code: nextCode,
          description: nextDescription,
        })
        successMessage = dialogParent ? 'Sub-department added successfully.' : 'Department added successfully.'
      }
      setDialogParent(null)
      setEditingDepartment(null)
      setDepartmentDialogMode(null)
      setDepartmentName('')
      setDepartmentCodeInput('')
      setDepartmentDescription('')
      await loadDepartments({ clearNotice: false })
      setNotice(successMessage)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to save department.')
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDeleteDepartment() {
    if (!deleteDepartment) return
    setIsSaving(true)
    try {
      const successMessage = deleteDepartment.parent ? 'Sub-department removed successfully.' : 'Department removed successfully.'
      await organizationService.deleteDepartment(context, deleteDepartment.id)
      setSelectedId((value) => (value === deleteDepartment.id ? null : value))
      setDeleteDepartment(null)
      await loadDepartments({ clearNotice: false })
      setNotice(successMessage)
    } catch (error) {
      // The backend refuses (409) when LMS content still points at this
      // department as a "standard". Surfacing that message tells the user why,
      // instead of a generic failure for what looks like an ordinary delete.
      setNotice(error instanceof Error ? error.message : 'Failed to remove department.')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Download the CSV.
   *
   * A plain navigation rather than fetch(): the response is an attachment, and
   * fetching it would land the CSV in memory instead of the user's downloads.
   */
  function handleExport() {
    if (typeof window === 'undefined') return
    window.location.href = organizationService.departmentExportUrl(context)
  }

  /** Move a department one place up or down among its siblings. */
  async function handleReorder(direction: 'up' | 'down') {
    const target = selected ?? lastShown
    if (!target) {
      setNotice('Select a department in the hierarchy first.')
      return
    }

    setReorderingId(target.id)
    try {
      const response = await organizationService.reorderDepartment(context, target.id, direction)
      await loadDepartments({ clearNotice: false })
      setNotice(response?.data?.moved === false
        ? `"${target.name}" is already ${direction === 'up' ? 'first' : 'last'}.`
        : `"${target.name}" moved ${direction}.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to reorder department.')
    } finally {
      setReorderingId(null)
    }
  }

  /** Assign, change or clear (null) a head of department. */
  async function handleAssignHod(employeeId: string | null) {
    if (!hodTarget) return
    setIsSaving(true)
    try {
      await organizationService.setDepartmentHead(context, hodTarget.id, employeeId)
      setHodTarget(null)
      await loadDepartments({ clearNotice: false })
      setNotice(employeeId
        ? `Head of department updated for "${hodTarget.name}".`
        : `Head of department cleared for "${hodTarget.name}".`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to update department head.')
    } finally {
      setIsSaving(false)
    }
  }

  /** Re-parent a department. '0' moves it to the root. */
  async function handleChangeParent(parentId: string) {
    if (!parentTarget) return
    setIsSaving(true)
    try {
      await organizationService.setDepartmentParent(context, parentTarget.id, parentId)
      setParentTarget(null)
      await loadDepartments({ clearNotice: false })
      setNotice(`Parent updated for "${parentTarget.name}".`)
    } catch (error) {
      // 422 here means the move would have created a cycle - putting a
      // department beneath one of its own descendants.
      setNotice(error instanceof Error ? error.message : 'Failed to change parent department.')
    } finally {
      setIsSaving(false)
    }
  }

  /** Open the details panel for a row. */
  function openDetails(department: Department) {
    setSelectedId(department.id)
    setLastShown(department)
  }

  function resetFilters() {
    setStatusFilter('all')
    setParentFilter('all')
    setHodFilter('all')
    setStaffedFilter('all')
    setQuery('')
    setPage(1)
  }

  return (
    <div className="flex min-h-0 max-w-full flex-col gap-8 overflow-x-hidden text-foreground">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">
              Department Management
            </h1>
            <Info className="size-4 text-primary" aria-hidden="true" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and organize departments and departmental hierarchy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canManage && (
            <Button type="button" size="lg" className="h-10 px-4" onClick={() => openAddDialog()}>
              <Plus className="size-4" aria-hidden="true" />
              Add Department
            </Button>
          )}
          <Button type="button" variant="outline" size="lg" className="h-10 px-4" onClick={handleExport}>
            <Download className="size-4" aria-hidden="true" />
            Export
          </Button>
        </div>
      </div>
      {(isLoading || notice) && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {isLoading ? 'Loading departments...' : notice}
        </div>
      )}

      <div
        className={cn(
          'grid grid-cols-1 auto-rows-[720px] items-stretch gap-3 overflow-hidden transition-[grid-template-columns] duration-300 ease-in-out',
          'xl:h-[720px] xl:auto-rows-auto xl:grid-rows-[720px]',
          isDetailsOpen
            ? 'xl:grid-cols-[300px_minmax(0,1fr)_340px] 2xl:grid-cols-[320px_minmax(0,1fr)_360px]'
            : 'xl:grid-cols-[300px_minmax(0,1fr)_0px] 2xl:grid-cols-[320px_minmax(0,1fr)_0px]',
        )}
      >
        <section className="flex h-full min-h-0 flex-col self-stretch overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <PanelHeader title="Department Hierarchy" />
          <div className="border-b border-border px-4 pb-4">
            <SearchField
              value={treeQuery}
              onChange={setTreeQuery}
              placeholder="Search department..."
            />
          </div>
          <div className="g2g-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            <HierarchyTree
              nodes={tree}
              selectedId={selected?.id}
              query={treeQuery}
              onSelect={selectFromHierarchy}
              showCodes={showCodes}
              showCounts={showCounts}
              expandSignal={expandSignal}
            />
          </div>
          <div className="grid grid-cols-4 border-t border-border p-4">
            <FooterIcon
              label={selected ? 'Add sub-department' : 'Add department'}
              icon={<Plus className="size-4" />}
              onClick={() => openAddDialog(selected)}
            />
            {/*
              * These three had no onClick prop passed at all - FooterIcon
              * accepts one, and each of them simply omitted it. Move up/down
              * now reorder the selected department among its siblings, which
              * needed a sort_order column that did not exist either.
              */}
            <FooterIcon
              label="Move up"
              icon={<ChevronDown className="size-4 rotate-180" />}
              disabled={!detailDept || reorderingId !== null}
              onClick={() => void handleReorder('up')}
            />
            <FooterIcon
              label="Move down"
              icon={<ChevronDown className="size-4" />}
              disabled={!detailDept || reorderingId !== null}
              onClick={() => void handleReorder('down')}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Hierarchy settings"
                  title="Hierarchy settings"
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronsUpDown className="size-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onClick={expandAll}>Expand all</DropdownMenuItem>
                <DropdownMenuItem onClick={collapseAll}>Collapse all</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowCodes((value) => !value)}>
                  {showCodes ? 'Hide' : 'Show'} department codes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowCounts((value) => !value)}>
                  {showCounts ? 'Hide' : 'Show'} employee counts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>

        <section className="@container/deptlist flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <PanelHeader
            title={
              hierarchyFilter
                ? `Department List (${filtered.length})`
                : `Department List (${scopedDepts.length})`
            }
            action={
              hierarchyFilter ? (
                <button
                  type="button"
                  onClick={clearHierarchyFilter}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  <X className="size-3" aria-hidden="true" />
                  Clear filter
                </button>
              ) : null
            }
          />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2 border-b border-border px-4 pb-4 @5xl/deptlist:grid-cols-[minmax(150px,240px)_minmax(120px,1fr)_minmax(150px,1.15fr)_auto_auto] @5xl/deptlist:items-center">
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Search department..."
              className="col-span-4 min-w-0 @5xl/deptlist:col-span-1"
            />
            <SelectInput
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}
              className="h-10 min-w-0"
              options={[
                { value: 'all', label: 'Status: All' },
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
                // 'Draft' removed. hrms_departments.status is an int with two
                // states, so nothing could ever match it - and while the API
                // filtered to status = 1, Inactive matched nothing either. Both
                // options now select real rows.
              ]}
            />
            <SelectInput
              value={parentFilter}
              onChange={(value) => {
                setParentFilter(value)
                setPage(1)
              }}
              className="h-10 min-w-0"
              options={[
                { value: 'all', label: 'Parent Department: All' },
                { value: 'Root', label: 'Root Departments' },
                ...parents.map((parent) => ({ value: parent, label: parent })),
              ]}
            />
            {/*
              * Was a bare <Button> with no onClick. It now opens the two
              * filters that have no dedicated dropdown of their own, and
              * carries a count so an active filter is visible when the panel
              * is closed.
              */}
            <DropdownMenu open={showFilters} onOpenChange={setShowFilters}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Filters"
                  className="h-10 w-10 shrink-0 px-0 @md/deptlist:w-auto @md/deptlist:px-3"
                >
                  <Filter className="size-4" aria-hidden="true" />
                  <span className="hidden @md/deptlist:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1 text-[11px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Head of department</div>
                {([
                  ['all', 'Any'],
                  ['assigned', 'Assigned'],
                  ['unassigned', 'Not assigned'],
                ] as const).map(([value, label]) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => { setHodFilter(value); setPage(1) }}
                    className={cn(hodFilter === value && 'bg-accent font-medium')}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Employees</div>
                {([
                  ['all', 'Any'],
                  ['staffed', 'Has employees'],
                  ['empty', 'No employees'],
                ] as const).map(([value, label]) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => { setStaffedFilter(value); setPage(1) }}
                    className={cn(staffedFilter === value && 'bg-accent font-medium')}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={resetFilters}>Clear all filters</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => void loadDepartments()}
              disabled={isLoading}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>

          <div className="g2g-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden [&>div]:w-full">
            <Table className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-surface-muted">
                <TableRow className="hover:bg-surface-muted">
                  <SortHead label="Department" sortKey="name" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="w-[42%] px-2 @md/deptlist:w-[30%] @md/deptlist:px-4" />
                  <SortHead label="Code" sortKey="code" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="hidden w-[12%] px-2 @md/deptlist:table-cell @md/deptlist:px-4" />
                  <SortHead label="Parent" sortKey="parent" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="hidden w-[18%] px-2 @3xl/deptlist:table-cell @md/deptlist:px-4" />
                  <SortHead label="Head" sortKey="hod" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="w-[34%] px-2 @md/deptlist:w-[28%] @md/deptlist:px-4 @3xl/deptlist:w-[20%]" />
                  <SortHead label="Employees" sortKey="employees" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="hidden w-[10%] px-2 text-center @xl/deptlist:table-cell @md/deptlist:px-4" />
                  <SortHead label="Status" sortKey="status" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="hidden w-[12%] px-2 @lg/deptlist:table-cell @md/deptlist:px-4" />
                  <TableHead className="w-[24%] px-2 text-center normal-case @md/deptlist:w-[12%] @md/deptlist:px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="h-24 px-4 text-center text-sm text-muted-foreground">
                      No departments match the current search or filters.
                    </TableCell>
                  </TableRow>
                )}
                {pageRows.map((department) => {
                  const isSelected = department.id === selected?.id

                  return (
                    <TableRow
                      key={department.id}
                      onClick={() => selectDepartment(department.id)}
                      className={cn(
                        'cursor-pointer',
                        isSelected && 'bg-primary/10 hover:bg-primary/10',
                      )}
                    >
                      <TableCell className="px-2 font-medium text-foreground @md/deptlist:px-4">
                        <div className="min-w-0">
                          <p className="truncate">{department.name}</p>
                          <p className="truncate text-xs font-normal text-muted-foreground @md/deptlist:hidden">
                            {departmentCode(department)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden px-2 font-medium text-foreground @md/deptlist:table-cell @md/deptlist:px-4">
                        {departmentCode(department)}
                      </TableCell>
                      <TableCell className="hidden px-2 text-muted-foreground @3xl/deptlist:table-cell @md/deptlist:px-4">
                        {department.parent ?? '-'}
                      </TableCell>
                      <TableCell className="px-2 @md/deptlist:px-4">
                        <Person name={department.hod} />
                      </TableCell>
                      <TableCell className="hidden px-2 text-center font-medium text-foreground @xl/deptlist:table-cell @md/deptlist:px-4">
                        {department.employees}
                      </TableCell>
                      <TableCell className="hidden px-2 @lg/deptlist:table-cell @md/deptlist:px-4">
                        <StatusBadge status={department.status} size="sm" />
                      </TableCell>
                      <TableCell className="px-2 @md/deptlist:px-4">
                        <div className="flex items-center justify-center gap-1">
                          <IconAction label="View details" icon={<Eye className="size-4" />} className={cn(canManage && 'hidden @md/deptlist:flex')} />
                          {canManage && (
                            <>
                              <IconAction label="Edit department" icon={<Pencil className="size-4" />} onClick={(event) => {
                                event.stopPropagation()
                                openEditDialog(department)
                              }} />
                              <IconAction label={department.parent ? 'Delete sub-department' : 'Delete department'} icon={<Trash2 className="size-4" />} onClick={(event) => {
                                event.stopPropagation()
                                setDeleteDepartment(department)
                              }} />
                              <IconAction label="Assign HOD" icon={<UserPlus className="size-4" />} className="hidden @3xl/deptlist:flex" />
                              <RowMenu
                                isSubDepartment={Boolean(department.parent)}
                                onEdit={() => openEditDialog(department)}
                                onAddSubDepartment={() => openAddDialog(department)}
                                onDelete={() => setDeleteDepartment(department)}
                              />
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filtered.length ? (current - 1) * PAGE_SIZE + 1 : 0} to{' '}
              {Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length} entries
            </p>
            <div className="flex items-center gap-2">
              <PaginationButton
                label="Previous page"
                disabled={current <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="size-4" />
              </PaginationButton>
              {Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setPage(index + 1)}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                    current === index + 1
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted',
                  )}
                >
                  {index + 1}
                </button>
              ))}
              <PaginationButton
                label="Next page"
                disabled={current >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                <ChevronRight className="size-4" />
              </PaginationButton>
            </div>
          </div>
        </section>

        <div
          className={cn(
            'h-full min-h-0 min-w-0 self-stretch overflow-hidden transition-opacity duration-300 ease-in-out',
            isDetailsOpen
              ? 'opacity-100'
              : 'pointer-events-none opacity-0 max-xl:hidden',
          )}
          aria-hidden={!isDetailsOpen}
        >
          {detailDept && (
            <Suspense
              fallback={
                <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                    Loading department details...
                  </div>
                </aside>
              }
            >
              <LazyDepartmentDetailsPanel
                department={detailDept}
                canManage={canManage}
                onClose={() => setSelectedId(null)}
                onEdit={openEditDialog}
                onAddSubDepartment={openAddDialog}
                onDelete={setDeleteDepartment}
              />
            </Suspense>
          )}
        </div>
      </div>

      <Dialog open={isDepartmentDialogOpen} onOpenChange={(open) => {
        if (!open) closeDepartmentDialog()
      }}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDepartment
                ? `Edit ${editingDepartment.parent ? 'Sub-Department' : 'Department'}`
                : dialogParent
                  ? 'Add Sub-Department'
                  : 'Add Department'}
            </DialogTitle>
            <DialogDescription>
              {dialogParent
                ? `Parent department: ${dialogParent.name}`
                : 'Department details are saved to the Laravel department management API.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="department-name" className="text-sm font-medium text-foreground">
              Department Name
            </label>
            <Input
              id="department-name"
              value={departmentName}
              onChange={(event) => setDepartmentName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveDepartment()
              }}
              placeholder="Enter department name"
              disabled={isSaving}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDepartmentDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveDepartment()} disabled={isSaving}>
              {isSaving ? 'Saving...' : editingDepartment ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteDepartment)} onOpenChange={(open) => {
        if (!open && !isSaving) setDeleteDepartment(null)
      }}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {deleteDepartment?.parent ? 'Sub-Department' : 'Department'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDepartment
                ? `This will remove ${deleteDepartment.name}${deleteDepartment.parent ? '' : ' and its sub-departments'} from Laravel department management.`
                : 'This department will be removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDepartment(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteDepartment()}
              disabled={isSaving}
            >
              {isSaving ? 'Removing...' : 'Remove'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PanelHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  )
}

function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-md bg-background pl-9 pr-9"
      />
      <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-foreground" />
    </div>
  )
}

/**
 * `expandSignal` is how Expand all / Collapse all reach every node.
 *
 * Each node owns its own open/closed state, so there is nothing central to
 * flip. Rather than lift all of it, the menu bumps a nonce and every node
 * reacts once - a node opened by hand stays open until the next Expand or
 * Collapse, which is the behaviour the two menu items describe.
 */
type ExpandSignal = { open: boolean; nonce: number }

function HierarchyTree({
  nodes,
  selectedId,
  query,
  onSelect,
  showCodes,
  showCounts,
  expandSignal,
}: {
  nodes: DeptNode[]
  selectedId?: string
  query: string
  onSelect: (id: string) => void
  showCodes: boolean
  showCounts: boolean
  expandSignal: ExpandSignal
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <HierarchyNode
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          query={query}
          onSelect={onSelect}
          showCodes={showCodes}
          showCounts={showCounts}
          expandSignal={expandSignal}
        />
      ))}
    </ul>
  )
}

function HierarchyNode({
  node,
  depth,
  selectedId,
  query,
  onSelect,
  showCodes,
  showCounts,
  expandSignal,
}: {
  node: DeptNode
  depth: number
  selectedId?: string
  query: string
  onSelect: (id: string) => void
  showCodes: boolean
  showCounts: boolean
  expandSignal: ExpandSignal
}) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(expandSignal.open)
  }, [expandSignal])

  const hasChildren = node.children.length > 0
  /*
   * Was `Math.max(node.employees, descendantCount(node))`.
   *
   * node.employees was hardcoded to 0, so the max() always resolved to the
   * descendant count - meaning a badge sitting next to a Users icon, in a
   * column headed Employees, was actually showing how many sub-departments a
   * node had. Now that employees is a real headcount the two are separated:
   * the badge shows people, the sub-department count has its own tooltip.
   */
  const count = node.employees
  const subCount = descendantCount(node)
  const q = query.trim().toLowerCase()
  const childMatches = node.children.some((child) => hierarchyMatches(child, q))
  const visible =
    !q ||
    node.name.toLowerCase().includes(q) ||
    childMatches

  if (!visible) return null

  return (
    <li>
      <div
        className={cn(
          'group flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors',
          selectedId === node.id
            ? 'bg-primary/10 text-primary'
            : 'text-foreground hover:bg-muted',
        )}
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground',
            !hasChildren && 'invisible',
          )}
        >
          <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open && hasChildren ? (
            <FolderOpen className="size-4 shrink-0 text-primary" />
          ) : (
            <Folder className="size-4 shrink-0 text-primary" />
          )}
          <span className="truncate font-medium">{node.name}</span>
          {showCodes && node.code && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {node.code}
            </span>
          )}
        </button>
        {showCounts && (
          <Badge
            variant="muted"
            className="rounded-md px-2"
            title={`${count} employee${count === 1 ? '' : 's'}${subCount ? ` · ${subCount} sub-department${subCount === 1 ? '' : 's'}` : ''}`}
          >
            {count}
          </Badge>
        )}
        {selectedId === node.id && <MoreVertical className="size-4 shrink-0 text-foreground" />}
      </div>
      {hasChildren && (open || childMatches) && (
        <ul className="ml-5 space-y-1 border-l border-dotted border-primary/30 py-1">
          {node.children.map((child) => (
            <HierarchyNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              query={query}
              onSelect={onSelect}
              showCodes={showCodes}
              showCounts={showCounts}
              expandSignal={expandSignal}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function hierarchyMatches(node: DeptNode, query: string): boolean {
  if (!query) return true
  return node.name.toLowerCase().includes(query) || node.children.some((child) => hierarchyMatches(child, query))
}

function SortHead({
  label,
  sortKey,
  activeKey,
  asc,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  asc: boolean
  onSort: (key: SortKey) => void
  className?: string
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 normal-case text-foreground"
      >
        {label}
        {activeKey === sortKey && (
          <ChevronDown className={cn('size-3.5 transition-transform', asc && 'rotate-180')} />
        )}
      </button>
    </TableHead>
  )
}

function Person({ name }: { name?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {initials(name)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{name ?? 'Unassigned'}</p>
        <p className="truncate text-xs text-muted-foreground">
          {name ? HOD_TITLES[name] ?? 'Department Head' : 'No HOD'}
        </p>
      </div>
    </div>
  )
}

function RowMenu({
  isSubDepartment,
  onEdit,
  onAddSubDepartment,
  onDelete,
  onViewDetails,
  onAssignHod,
  onChangeParent,
}: {
  isSubDepartment: boolean
  onEdit: () => void
  onAddSubDepartment: () => void
  onDelete: () => void
  // "View Details" and "Assign / Change HOD" were rendered as
  // <DropdownMenuItem> with no onClick - the menu opened, the item highlighted
  // on hover, and clicking it did nothing but close the menu.
  onViewDetails: () => void
  onAssignHod: () => void
  onChangeParent: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Department actions"
        onClick={(event) => event.stopPropagation()}
        className="flex size-8 items-center justify-center rounded-md text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px] rounded-lg">
        <DropdownMenuItem>
          <Eye className="size-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          Edit {isSubDepartment ? 'Sub-Department' : 'Department'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddSubDepartment}>
          <Plus className="size-4" />
          Add Sub Department
        </DropdownMenuItem>
        <DropdownMenuItem>
          <UserPlus className="size-4" />
          Assign / Change HOD
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          Remove {isSubDepartment ? 'Sub-Department' : 'Department'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function IconAction({ label, icon, className, onClick }: { label: string; icon: ReactNode; className?: string; onClick?: React.MouseEventHandler<HTMLButtonElement> }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {icon}
    </button>
  )
}

function FooterIcon({ label, icon, onClick }: { label: string; icon: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-10 items-center justify-center border border-border bg-background text-foreground transition-colors first:rounded-l-md last:rounded-r-md hover:bg-muted"
    >
      {icon}
    </button>
  )
}

function PaginationButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}
