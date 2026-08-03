'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Layers,
  Maximize2,
  Minimize2,
  Search,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { useLibraryMeta, useSkillTaxonomy } from '@/hooks/use-competency-libraries'

const ALL = 'all'

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Layers }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-card/60 p-4 shadow-sm backdrop-blur-xl">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  )
}

/**
 * Skill Taxonomy.
 *
 * The category → sub-category → skill hierarchy, rendered from the tenant's own
 * data. The legacy screen embedded a third-party viewer in an iframe and passed
 * it the tenant id in the URL, which shipped organisation data to another host
 * and could not be searched, filtered or linked back to the library.
 */
export function CmSkillTaxonomy() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL)
  const [department, setDepartment] = useState(ALL)

  /**
   * Open/closed state is an override map over a default, rather than a snapshot
   * of every node: the tree can hold thousands of nodes, and a search narrows it
   * to a handful that should already be open.
   *
   * `allOpen` is null while the default follows the search (open when searching,
   * closed otherwise) and true/false once Expand All / Collapse All has spoken.
   */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [allOpen, setAllOpen] = useState<boolean | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const params = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(category !== ALL ? { category } : {}),
      ...(department !== ALL ? { department } : {}),
    }),
    [search, category, department],
  )

  const { taxonomy, loading, error, retry } = useSkillTaxonomy(params)
  const { meta } = useLibraryMeta()

  // A new search means a new result set, so per-node choices from the previous
  // one no longer apply. Adjusted during render rather than in an effect, which
  // would cost an extra pass over a tree this size.
  const [lastSearch, setLastSearch] = useState(search)
  if (lastSearch !== search) {
    setLastSearch(search)
    setOverrides({})
    setAllOpen(null)
  }

  // Searching narrows the tree to a handful of nodes, so they open by default;
  // the unfiltered tree stays collapsed.
  const defaultOpen = allOpen ?? Boolean(search)
  const isOpen = (key: string) => overrides[key] ?? defaultOpen

  const categoryOptions = useMemo(() => {
    const set = new Set((taxonomy?.categories ?? []).map((node) => node.name))
    if (category !== ALL) set.add(category)
    return [
      { label: 'All Categories', value: ALL },
      ...Array.from(set).sort().map((value) => ({ label: value, value })),
    ]
  }, [taxonomy, category])

  const departmentOptions = useMemo(
    () => [
      { label: 'All Departments', value: ALL },
      ...meta.departments.map((value) => ({ label: value, value })),
    ],
    [meta.departments],
  )

  const toggle = (key: string) =>
    setOverrides((current) => ({ ...current, [key]: !(current[key] ?? defaultOpen) }))

  const setAll = (open: boolean) => {
    setAllOpen(open)
    setOverrides({})
  }

  const hasFilters = Boolean(search) || category !== ALL || department !== ALL

  return (
    <div className="g2g-scrollbar flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Skill Taxonomy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How every skill in the library is classified, from category down to the individual skill.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Categories" value={(taxonomy?.total_categories ?? 0).toLocaleString()} icon={FolderTree} />
        <StatCard
          label="Sub Categories"
          value={(taxonomy?.categories.reduce((sum, node) => sum + node.children.length, 0) ?? 0).toLocaleString()}
          icon={Layers}
        />
        <StatCard label="Skills" value={(taxonomy?.total_skills ?? 0).toLocaleString()} icon={Sparkles} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/10 bg-card/50 p-4 shadow-sm backdrop-blur-xl">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills, categories…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="h-10 w-full rounded-xl border-input bg-background/50 pl-9 text-sm focus-visible:ring-primary/50"
            aria-label="Search the taxonomy"
          />
        </div>

        <div className="w-56">
          <Select
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            className="h-10 rounded-xl border-border bg-background/50"
            aria-label="Category"
          />
        </div>

        <div className="w-56">
          <Select
            value={department}
            onChange={setDepartment}
            options={departmentOptions}
            className="h-10 rounded-xl border-border bg-background/50"
            aria-label="Department"
          />
        </div>

        <Button variant="outline" onClick={() => setAll(true)} className="h-10 gap-2 rounded-xl font-semibold">
          <Maximize2 className="h-4 w-4" /> Expand All
        </Button>
        <Button variant="outline" onClick={() => setAll(false)} className="h-10 gap-2 rounded-xl font-semibold">
          <Minimize2 className="h-4 w-4" /> Collapse All
        </Button>

        {hasFilters && (
          <button
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setCategory(ALL)
              setDepartment(ALL)
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {taxonomy?.truncated && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm font-medium text-warning">
          Showing the first 5,000 skills. Narrow the search or filter by category to see the rest.
        </div>
      )}

      {/* Tree */}
      <div className="rounded-2xl border border-primary/10 bg-card/90 p-4 shadow-sm backdrop-blur-2xl">
        {error ? (
          <ErrorState title="Couldn't load the taxonomy" description={error} retry={retry} />
        ) : loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : (taxonomy?.categories.length ?? 0) === 0 ? (
          <EmptyState
            className="border-0"
            icon={<FolderTree className="h-10 w-10" />}
            title={hasFilters ? 'Nothing matches those filters' : 'No skills classified yet'}
            description={
              hasFilters
                ? 'Try a different search term or clear the filters.'
                : 'Add skills with a category in Libraries & Taxonomy and they will appear here.'
            }
          />
        ) : (
          <div className="space-y-2">
            {taxonomy!.categories.map((root) => {
              const rootOpen = isOpen(root.name)

              return (
                <div key={root.name} className="rounded-xl border border-border bg-background/40">
                  <button
                    type="button"
                    onClick={() => toggle(root.name)}
                    aria-expanded={rootOpen}
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/40"
                  >
                    {rootOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FolderTree className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">{root.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {root.children.length} sub {root.children.length === 1 ? 'category' : 'categories'} ·{' '}
                        {root.total} {root.total === 1 ? 'skill' : 'skills'}
                      </span>
                    </span>
                  </button>

                  {rootOpen && (
                    <div className="space-y-1.5 border-t border-border p-3 pl-10">
                      {root.children.map((branch) => {
                        const key = `${root.name}::${branch.name}`
                        const branchOpen = isOpen(key)

                        return (
                          <div key={key} className="rounded-lg border border-border/60 bg-card/40">
                            <button
                              type="button"
                              onClick={() => toggle(key)}
                              aria-expanded={branchOpen}
                              className="flex w-full items-center gap-2 p-2.5 text-left transition-colors hover:bg-accent/30"
                            >
                              {branchOpen ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                                {branch.name}
                              </span>
                              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
                                {branch.total}
                              </span>
                            </button>

                            {branchOpen && (
                              <ul className="space-y-1 border-t border-border/60 p-2.5 pl-8">
                                {branch.children.map((leaf) => (
                                  <li
                                    key={leaf.id}
                                    className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/30"
                                  >
                                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                                    <span className="min-w-0 flex-1 break-words text-foreground">{leaf.name}</span>
                                    {leaf.department && (
                                      <span className="shrink-0 text-xs text-muted-foreground">{leaf.department}</span>
                                    )}
                                    {leaf.proficiency_level && (
                                      <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                        L{leaf.proficiency_level}
                                      </span>
                                    )}
                                    {leaf.approve_status && (
                                      <StatusBadge status={leaf.approve_status} label={leaf.approve_status} size="sm" />
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
