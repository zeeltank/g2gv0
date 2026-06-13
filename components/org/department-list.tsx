'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  Plus,
  Download,
  Pencil,
  Trash2,
  UserPlus,
  ChevronUp,
  ChevronDown,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  SectionCard,
  StatusBadge,
  SelectInput,
  Badge,
  EmptyState,
  AccessDenied,
} from './gtg-ui'
import { DEPARTMENTS, type Department } from '@/lib/gtg-org-data'
import { getAccess, roleLabel, type Role } from '@/lib/gtg-roles'

type SortKey = 'name' | 'parent' | 'hod' | 'employees' | 'status' | 'created'

const PAGE_SIZE = 8

export function DepartmentList({ role }: { role: Role }) {
  const access = getAccess('department-list', role)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [hodFilter, setHodFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)

  // Department Head sees only their own department (scoped).
  const scopedDepts = useMemo(() => {
    if (access === 'scoped') {
      // Dept Head scope: own department + its sub-departments.
      return DEPARTMENTS.filter(
        (d) => d.name === 'Engineering' || d.parent === 'Engineering',
      )
    }
    return DEPARTMENTS
  }, [access])

  const hods = useMemo(
    () => Array.from(new Set(scopedDepts.map((d) => d.hod).filter(Boolean))) as string[],
    [scopedDepts],
  )

  const filtered = useMemo(() => {
    const rows = scopedDepts.filter((d) => {
      const q = query.trim().toLowerCase()
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.parent ?? '').toLowerCase().includes(q) ||
        (d.hod ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || d.status === statusFilter
      const matchesHod = hodFilter === 'all' || d.hod === hodFilter
      return matchesQuery && matchesStatus && matchesHod
    })

    rows.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sortKey) {
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
        default:
          av = a[sortKey] as string
          bv = b[sortKey] as string
      }
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
    return rows
  }, [scopedDepts, query, statusFilter, hodFilter, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const canManage = access === 'full'

  if (access === 'none') {
    return <AccessDenied role={roleLabel(role)} />
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  function SortHeader({ label, k, className }: { label: string; k: SortKey; className?: string }) {
    const isActive = sortKey === k
    return (
      <th className={cn('px-4 py-3 text-left', className)}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          {label}
          {isActive ? (
            sortAsc ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )
          ) : null}
        </button>
      </th>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="navy">{filtered.length} Departments</Badge>
          {access === 'scoped' && <Badge tone="outline">Own Department Only</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download aria-hidden="true" />
            Export
          </Button>
          {canManage && (
            <Button>
              <Plus aria-hidden="true" />
              Add Department
            </Button>
          )}
        </div>
      </div>

      <SectionCard className="overflow-hidden">
        {/* Filter bar */}
        <div className="flex flex-col gap-3 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex w-full max-w-sm items-center">
            <Search
              className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search departments"
              placeholder="Search by department, parent or HOD…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              className="h-10 w-full rounded-md border border-input bg-surface pl-9 pr-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-44">
              <SelectInput
                value={hodFilter}
                onChange={(v) => {
                  setHodFilter(v)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'All HODs' },
                  ...hods.map((h) => ({ value: h, label: h })),
                ]}
              />
            </div>
            <div className="w-40">
              <SelectInput
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v)
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' },
                  { value: 'Draft', label: 'Draft' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {pageRows.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-6" />}
            title="No departments found"
            description="Adjust your search or filters to see results."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-border bg-surface-muted">
                  <SortHeader label="Department Name" k="name" />
                  <SortHeader label="Parent Department" k="parent" />
                  <SortHeader label="HOD" k="hod" />
                  <SortHeader label="Employees" k="employees" />
                  <SortHeader label="Status" k="status" />
                  <SortHeader label="Created Date" k="created" />
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((d: Department) => (
                  <tr
                    key={d.id}
                    className="border-b border-border transition-colors duration-200 hover:bg-secondary/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex size-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground"
                          aria-hidden="true"
                        >
                          <Building2 className="size-4" />
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {d.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {d.parent ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {d.hod ?? (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {d.employees}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(d.created).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canManage ? (
                          <>
                            <IconAction label="Assign HOD" icon={<UserPlus className="size-4" />} />
                            <IconAction label="Edit" icon={<Pencil className="size-4" />} />
                            <IconAction
                              label="Delete"
                              icon={<Trash2 className="size-4" />}
                              danger
                            />
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pageRows.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 pt-5 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Showing{' '}
              <span className="font-medium text-foreground">
                {(current - 1) * PAGE_SIZE + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium text-foreground">
                {Math.min(current * PAGE_SIZE, filtered.length)}
              </span>{' '}
              of <span className="font-medium text-foreground">{filtered.length}</span>{' '}
              departments
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={current <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i + 1)}
                  aria-current={current === i + 1 ? 'page' : undefined}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-md text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    current === i + 1
                      ? 'g2g-brand-gradient text-brand-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-secondary hover:text-secondary-foreground',
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={current >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function IconAction({
  label,
  icon,
  danger,
}: {
  label: string
  icon: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        danger
          ? 'hover:bg-danger/10 hover:text-danger'
          : 'hover:bg-secondary hover:text-secondary-foreground',
      )}
    >
      {icon}
    </button>
  )
}
