'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Building2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Badge, StatusBadge, SelectInput, AccessDenied } from './gtg-ui'
import {
  DEPARTMENTS,
  ORG_PROFILE,
  buildHierarchy,
  type Department,
  type DeptNode,
} from '@/lib/gtg-org-data'
import { getAccess, roleLabel, type Role } from '@/lib/gtg-roles'

type SortKey = 'name' | 'code' | 'parent' | 'hod' | 'employees' | 'status'

const PAGE_SIZE = 10

const HOD_TITLES: Record<string, string> = {
  'Avin Mehta': 'CEO',
  'Priya Nair': 'CHRO',
  'Rahul Verma': 'TA Manager',
  'Sanjay Kapoor': 'CTO',
  'Meera Iyer': 'Platform Head',
  'Arjun Rao': 'QA Manager',
  'Neha Gupta': 'Product Lead',
  'Vikram Singh': 'Growth Head',
  'Anita Desai': 'Success Lead',
  'Rohit Sharma': 'CFO',
  'Kabir Khan': 'Security Lead',
}

function departmentCode(department: Department) {
  const explicit: Record<string, string> = {
    'Executive Office': 'EXO',
    'Human Resources': 'HR',
    'Talent Acquisition': 'HR-TA',
    Engineering: 'ENG',
    'Platform Engineering': 'ENG-PLT',
    'Quality Assurance': 'ENG-QA',
    'Product Management': 'PRD',
    'Sales & Marketing': 'SM',
    'Customer Success': 'CS',
    'Finance & Accounts': 'FIN',
    'Legal & Compliance': 'LGL',
    'Information Security': 'SEC',
  }

  if (explicit[department.name]) return explicit[department.name]

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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function descendantCount(node: DeptNode): number {
  return node.children.reduce((total, child) => total + 1 + descendantCount(child), 0)
}

export function DepartmentList({ role }: { role: Role }) {
  const access = getAccess('department-list', role)
  const [query, setQuery] = useState('')
  const [treeQuery, setTreeQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [parentFilter, setParentFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string>('d4')

  const scopedDepts = useMemo(() => {
    if (access === 'scoped') {
      return DEPARTMENTS.filter(
        (d) => d.name === 'Engineering' || d.parent === 'Engineering',
      )
    }
    return DEPARTMENTS
  }, [access])

  const tree = useMemo(() => buildHierarchy(scopedDepts), [scopedDepts])
  const parents = useMemo(
    () => Array.from(new Set(scopedDepts.map((d) => d.parent).filter(Boolean))) as string[],
    [scopedDepts],
  )

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

      return matchesQuery && matchesStatus && matchesParent
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
  }, [scopedDepts, query, statusFilter, parentFilter, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const selected = scopedDepts.find((d) => d.id === selectedId) ?? scopedDepts[0]
  const canManage = access === 'full'

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

  return (
    <div className="flex flex-col gap-4 text-[#071446]">
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
            <Button size="lg" className="h-10 px-4">
              <Plus className="size-4" aria-hidden="true" />
              Add Department
            </Button>
          )}
          <Button variant="outline" size="lg" className="h-10 px-4">
            <Download className="size-4" aria-hidden="true" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid min-h-[680px] gap-3 xl:grid-cols-[310px_minmax(620px,1fr)_360px]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <PanelHeader title="Department Hierarchy" />
          <div className="border-b border-border px-4 pb-4">
            <SearchField
              value={treeQuery}
              onChange={setTreeQuery}
              placeholder="Search department..."
            />
          </div>
          <div className="g2g-scrollbar flex-1 overflow-auto px-3 py-3">
            <HierarchyTree
              nodes={tree}
              selectedId={selected?.id}
              query={treeQuery}
              onSelect={setSelectedId}
            />
          </div>
          <div className="grid grid-cols-4 border-t border-border p-4">
            <FooterIcon label="Add department" icon={<Plus className="size-4" />} />
            <FooterIcon label="Move up" icon={<ChevronDown className="size-4 rotate-180" />} />
            <FooterIcon label="Move down" icon={<ChevronDown className="size-4" />} />
            <FooterIcon label="Hierarchy settings" icon={<ChevronsUpDown className="size-4" />} />
          </div>
        </section>

        <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <PanelHeader title={`Department List (${scopedDepts.length})`} />
          <div className="flex flex-col gap-3 border-b border-border px-4 pb-4 lg:flex-row lg:items-center">
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Search department..."
              className="lg:max-w-[280px]"
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-1">
              <SelectInput
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'Status: All' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' },
                  { value: 'Draft', label: 'Draft' },
                ]}
              />
              <SelectInput
                value={parentFilter}
                onChange={(value) => {
                  setParentFilter(value)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'Parent Department: All' },
                  { value: 'Root', label: 'Root Departments' },
                  ...parents.map((parent) => ({ value: parent, label: parent })),
                ]}
              />
            </div>
            <Button variant="outline" className="h-10">
              <Filter className="size-4" aria-hidden="true" />
              Filters
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10">
              <RefreshCw className="size-4" aria-hidden="true" />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-surface-muted">
                <TableRow className="hover:bg-surface-muted">
                  <SortHead label="Department Name" sortKey="name" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortHead label="Department Code" sortKey="code" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortHead label="Parent Department" sortKey="parent" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortHead label="Department Head" sortKey="hod" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortHead label="Employees" sortKey="employees" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} className="text-center" />
                  <SortHead label="Status" sortKey="status" activeKey={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <TableHead className="text-center normal-case">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((department) => {
                  const isSelected = department.id === selected?.id

                  return (
                    <TableRow
                      key={department.id}
                      onClick={() => setSelectedId(department.id)}
                      className={cn(
                        'cursor-pointer',
                        isSelected && 'bg-primary/10 hover:bg-primary/10',
                      )}
                    >
                      <TableCell className="min-w-[170px] font-medium text-foreground">
                        {department.name}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {departmentCode(department)}
                      </TableCell>
                      <TableCell className="min-w-[155px] text-muted-foreground">
                        {department.parent ?? '-'}
                      </TableCell>
                      <TableCell className="min-w-[190px]">
                        <Person name={department.hod} />
                      </TableCell>
                      <TableCell className="text-center font-medium text-foreground">
                        {department.employees}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={department.status} size="sm" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <IconAction label="View details" icon={<Eye className="size-4" />} />
                          {canManage && (
                            <>
                              <IconAction label="Edit department" icon={<Pencil className="size-4" />} />
                              <IconAction label="Assign HOD" icon={<UserPlus className="size-4" />} />
                              <RowMenu />
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

        {selected && <DepartmentDetails department={selected} canManage={canManage} />}
      </div>
    </div>
  )
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
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

function HierarchyTree({
  nodes,
  selectedId,
  query,
  onSelect,
}: {
  nodes: DeptNode[]
  selectedId?: string
  query: string
  onSelect: (id: string) => void
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
}: {
  node: DeptNode
  depth: number
  selectedId?: string
  query: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0
  const count = Math.max(node.employees, descendantCount(node))
  const q = query.trim().toLowerCase()
  const visible =
    !q ||
    node.name.toLowerCase().includes(q) ||
    node.children.some((child) => child.name.toLowerCase().includes(q))

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
        </button>
        <Badge tone="muted" className="rounded-md px-2">
          {count}
        </Badge>
        {selectedId === node.id && <MoreVertical className="size-4 shrink-0 text-foreground" />}
      </div>
      {hasChildren && open && (
        <ul className="ml-5 space-y-1 border-l border-dotted border-primary/30 py-1">
          {node.children.map((child) => (
            <HierarchyNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              query={query}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
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
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f3c7a5] text-xs font-semibold text-[#3f220f]">
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

function RowMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Department actions"
        className="flex size-8 items-center justify-center rounded-md text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px] rounded-lg">
        <DropdownMenuItem>
          <Eye className="size-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Pencil className="size-4" />
          Edit Department
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Plus className="size-4" />
          Add Sub Department
        </DropdownMenuItem>
        <DropdownMenuItem>
          <UserPlus className="size-4" />
          Assign / Change HOD
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-4" />
          Remove Department
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DepartmentDetails({
  department,
  canManage,
}: {
  department: Department
  canManage: boolean
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">Department Details</h2>
        <Button variant="ghost" size="icon-sm">
          <X className="size-4" />
          <span className="sr-only">Close details</span>
        </Button>
      </div>

      <div className="g2g-scrollbar flex-1 overflow-auto p-4">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Building2 className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold leading-tight text-foreground">
                {department.name}
              </h3>
              <StatusBadge status={department.status} size="sm" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {departmentCode(department)} <span className="mx-1">-</span>{' '}
              {department.parent ?? ORG_PROFILE.name}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-9 justify-center text-primary">
              <Pencil className="size-4" />
              Edit Department
            </Button>
            <Button variant="outline" className="h-9 justify-center text-primary">
              <Plus className="size-4" />
              Add Sub Department
            </Button>
            <Button variant="outline" className="col-span-2 h-9 justify-center border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="size-4" />
              Remove Department
            </Button>
          </div>
        )}

        <div className="my-5 h-px bg-border" />

        <div className="space-y-5">
          <DetailItem
            icon={<Users className="size-4" />}
            label="Department Head"
            value={department.hod ?? 'Unassigned'}
            action="Change HOD"
          />
          <DetailItem
            icon={<Folder className="size-4" />}
            label="Parent Department"
            value={department.parent ?? ORG_PROFILE.name}
            action="Change Parent"
          />
          <DetailItem
            icon={<Users className="size-4" />}
            label="Total Employees"
            value={String(department.employees)}
          />
          <DetailItem
            icon={<FileText className="size-4" />}
            label="Open Positions"
            value={String(Math.max(2, Math.round(department.employees / 12)))}
          />
          <DetailItem
            icon={<CalendarDays className="size-4" />}
            label="Created On"
            value={formatDate(department.created)}
          />
          <DetailItem
            icon={<RefreshCw className="size-4" />}
            label="Last Updated"
            value="30 May 2025"
          />
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-foreground">Description</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Handles {department.name.toLowerCase()} functions including planning,
            operations, governance, and team support across {ORG_PROFILE.name}.
          </p>
        </div>
      </div>
    </aside>
  )
}

function DetailItem({
  icon,
  label,
  value,
  action,
}: {
  icon: ReactNode
  label: string
  value: string
  action?: string
}) {
  return (
    <div className="grid grid-cols-[24px_1fr_auto] gap-3">
      <div className="pt-1 text-foreground">{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      </div>
      {action && (
        <button type="button" className="pt-7 text-xs font-semibold text-primary">
          {action}
        </button>
      )}
    </div>
  )
}

function IconAction({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {icon}
    </button>
  )
}

function FooterIcon({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
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
