'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Info, Copy, Download, Upload, Plus, ChevronDown, ChevronRight,
  LayoutGrid, Users, Calendar, Search, Layers, Edit2, Trash2, ListChecks, Send,
  Check, X, Folder, FileText, PieChart, Map as MapIcon,
  DownloadCloud, Loader2, MoreVertical, Settings, Filter,
} from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import { useSubmitForApproval } from '@/hooks/use-competency-approvals'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useCompetencyStudio } from '@/hooks/use-competency-studio'
import { competencyLibraryService } from '@/services/competency'
import { getLaravelContext } from '@/lib/laravel-context'
import { RoleRequirementsPanel } from './role-requirements-panel'
import { useAuth } from '@/hooks/use-auth'
import type {
  Framework, FrameworkPayload, MatrixCompetency, ProficiencyLevel,
} from '@/services/competency'

/* ------------------------------------------------------------------ *
 * Presentation helpers
 * ------------------------------------------------------------------ */

const TABS: { id: string; label: string }[] = [
  { id: 'framework', label: 'Framework Structure' },
  { id: 'matrix', label: 'Role Mapping Matrix' },
  // Writes `jobrole_competency_map` through the existing guarded endpoint.
  // Sits beside the matrix because that is where a person looks for "what does
  // this role need" - and until now the matrix was the only thing there, and it
  // writes a different table (`s_user_skill_jobrole`, keyed by text).
  { id: 'requirements', label: 'Role Requirements' },
  { id: 'weighting', label: 'Weighting & Configuration' },
  { id: 'proficiency', label: 'Proficiency Scale' },
  { id: 'workflow', label: 'Workflow & Review' },
]

/** Fixed dot colour per proficiency level (1..6). */
/**
 * The lifecycle the backend already accepts. The dialog used to hardcode
 * 'draft', so a framework could be created but never published.
 */
const FRAMEWORK_STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Active (published)', value: 'active' },
  { label: 'Archived', value: 'archived' },
]

function levelColor(level: number | null): string {
  switch (level) {
    case 1: return 'bg-destructive'
    case 2: return 'bg-warning'
    case 3: return 'bg-warning'
    case 4: return 'bg-success'
    case 5: return 'bg-primary'
    case 6: return 'bg-primary'
    default: return 'bg-muted'
  }
}

function frameworkStatusVariant(status: string) {
  if (status === 'active') return 'active'
  if (status === 'archived') return 'inactive'
  return 'pending'
}

/** Quote-aware CSV field parsing / serialisation for import & export. */
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(cell => cell.trim() !== ''))
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export function CmFrameworkMapping() {
  const { user } = useAuth()
  const studio = useCompetencyStudio()

  const [activeTab, setActiveTab] = useState('matrix')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[] | null>(null)
  const [structureSearch, setStructureSearch] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [selectedCompetency, setSelectedCompetency] = useState<MatrixCompetency | null>(null)
  const [showRequired, setShowRequired] = useState(true)

  const [reviewStatus, setReviewStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showLegend, setShowLegend] = useState(true)

  // Dialog state
  const [frameworkDialog, setFrameworkDialog] = useState<{ open: boolean; editing: Framework | null }>({ open: false, editing: null })
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [bulkDialog, setBulkDialog] = useState(false)
  const [bulkForm, setBulkForm] = useState<{ role: string; level: string }>({ role: '', level: '' })
  const [levelDialog, setLevelDialog] = useState<{ open: boolean; editing: ProficiencyLevel | null }>({ open: false, editing: null })
  const [levelForm, setLevelForm] = useState<{ name: string; description: string }>({ name: '', description: '' })
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    loading, error, summary, structure, proficiency, weights, frameworks, roles, retry,
    matrix, matrixLoading, loadMatrix,
    reviews, reviewCounts, reviewsLoading, loadReviews,
    saving, actionMessage, actionError, clearMessages,
    saveCell, clearCell, saveWeights, createFramework, updateFramework,
    cloneFramework, deleteFramework, approveReview, rejectReview, bulkApproveReviews, submitReview,
    createLevel, updateLevel, deleteLevel,
  } = studio

  const levels: ProficiencyLevel[] = proficiency?.levels?.length
    ? proficiency.levels
    : [1, 2, 3, 4, 5].map(n => ({ level: n, label: `Level ${n}`, name: null, description: null }))

  // Derive the effective selections during render (defaults follow the loaded
  // data) so there is no setState-in-effect. Explicit user picks win.
  const effectiveCategory = selectedCategory ?? structure[0]?.category ?? null
  const effectiveRoles = selectedRoles ?? roles.slice(0, 5).map(r => r.jobrole)

  /* -- Load matrix when its inputs change ----------------------------- */
  const rolesKey = JSON.stringify(effectiveRoles)
  useEffect(() => {
    const rolesList = JSON.parse(rolesKey) as string[]
    if (activeTab === 'matrix' && effectiveCategory && rolesList.length > 0) {
      loadMatrix(effectiveCategory, rolesList)
    }
  }, [activeTab, effectiveCategory, rolesKey, loadMatrix])

  /* -- Load reviews when the workflow tab / status changes ------------ */
  useEffect(() => {
    if (activeTab === 'workflow') {
      loadReviews(reviewStatus)
    }
  }, [activeTab, reviewStatus, loadReviews])

  /* -- Auto-dismiss action messages ----------------------------------- */
  useEffect(() => {
    if (actionMessage || actionError) {
      const t = setTimeout(clearMessages, 4000)
      return () => clearTimeout(t)
    }
  }, [actionMessage, actionError, clearMessages])

  const filteredStructure = useMemo(() => {
    const q = structureSearch.trim().toLowerCase()
    if (!q) return structure
    return structure.filter(node =>
      node.category.toLowerCase().includes(q) ||
      node.children.some(c => c.name.toLowerCase().includes(q)),
    )
  }, [structure, structureSearch])

  const refreshMatrix = () => {
    if (effectiveCategory && effectiveRoles.length > 0) loadMatrix(effectiveCategory, effectiveRoles)
  }

  /* -- Cell actions --------------------------------------------------- */
  const handleSetCell = async (role: string, skill: string, level: number) => {
    const res = await saveCell(role, skill, String(level))
    if (res.ok) refreshMatrix()
  }
  const handleClearCell = async (role: string, skill: string) => {
    const res = await clearCell(role, skill)
    if (res.ok) refreshMatrix()
  }
  // Clear every mapped cell in a competency row across the shown roles.
  const handleClearRow = async (skill: string) => {
    if (!matrix) return
    for (const role of matrix.roles) {
      if (matrix.cells[role]?.[skill]) await clearCell(role, skill)
    }
    refreshMatrix()
  }

  // "All Roles" quick filter: 'all' resets to the top set, else a single column.
  const applyRoleFilter = (value: string) => {
    setRoleFilter(value)
    setSelectedRoles(value === 'all' ? null : [value])
  }

  /* -- Bulk update levels (apply one level to a whole category/role) --- */
  const handleBulkApply = async () => {
    if (!bulkForm.role || !bulkForm.level || !matrix) return
    for (const comp of matrix.competencies) {
      await saveCell(bulkForm.role, comp.title, bulkForm.level)
    }
    refreshMatrix()
    setBulkDialog(false)
  }

  /* -- Framework dialog ----------------------------------------------- */
  const [fwForm, setFwForm] = useState<FrameworkPayload>({ name: '', description: '', status: 'draft', version: 'v1.0' })
  const { submit: submitForApproval, submitting: submittingApproval } = useSubmitForApproval()
  const [publishNote, setPublishNote] = useState<string | null>(null)

  /** Route a draft framework through the approval queue instead of self-publishing. */
  const submitFrameworkForPublish = async (framework: Framework) => {
    const result = await submitForApproval('framework', framework.id)
    setPublishNote(result.message)
    if (result.ok) retry()
  }

  // Seed the form at open time (no setState-in-effect).
  const openFrameworkDialog = (editing: Framework | null) => {
    setFwForm(editing
      ? { name: editing.name, description: editing.description ?? '', status: editing.status, version: editing.version, jobrole: editing.jobrole ?? '' }
      : { name: '', description: '', status: 'draft', version: 'v1.0' })
    setFrameworkDialog({ open: true, editing })
  }

  const submitFramework = async () => {
    if (!fwForm.name.trim()) return
    const res = frameworkDialog.editing
      ? await updateFramework(frameworkDialog.editing.id, fwForm)
      : await createFramework(fwForm)
    if (res.ok) setFrameworkDialog({ open: false, editing: null })
  }

  /* -- Add category (creates the first competency under it) ------------ */
  const [catForm, setCatForm] = useState({ category: '', competency: '' })
  const [catSaving, setCatSaving] = useState(false)
  const [catError, setCatError] = useState<string | null>(null)
  const submitCategory = async () => {
    if (!catForm.category.trim() || !catForm.competency.trim()) return
    setCatSaving(true)
    setCatError(null)
    try {
      await competencyLibraryService.create(getLaravelContext(user), {
        name: catForm.competency.trim(),
        category: catForm.category.trim(),
        status: 'Approved',
      })
      setCategoryDialog(false)
      setCatForm({ category: '', competency: '' })
      retry()
    } catch (e) {
      setCatError(e instanceof Error ? e.message : 'Failed to add category.')
    } finally {
      setCatSaving(false)
    }
  }

  /* -- Proficiency scale level dialog --------------------------------- */
  const openLevelDialog = (editing: ProficiencyLevel | null) => {
    setLevelForm(editing ? { name: editing.name ?? '', description: editing.description ?? '' } : { name: '', description: '' })
    setLevelDialog({ open: true, editing })
  }
  const submitLevel = async () => {
    if (!levelForm.name.trim()) return
    const res = levelDialog.editing?.id
      ? await updateLevel(levelDialog.editing.id, { name: levelForm.name, description: levelForm.description })
      : await createLevel({ name: levelForm.name, description: levelForm.description })
    if (res.ok) setLevelDialog({ open: false, editing: null })
  }

  /* -- Weighting editor ----------------------------------------------- */
  // Overrides layer over the loaded weights; no setState-in-effect sync.
  const [weightEdits, setWeightEdits] = useState<Record<string, number>>({})
  const weightValue = (category: string) =>
    weightEdits[category] ?? (weights.find(w => w.category === category)?.weight ?? 0)
  const weightTotal = weights.reduce((s, w) => s + (Number(weightValue(w.category)) || 0), 0)
  const handleSaveWeights = () => {
    saveWeights(weights.map(w => ({ category: w.category, weight: Number(weightValue(w.category)) || 0 })))
  }

  /* -- CSV export / import -------------------------------------------- */
  const exportMatrix = () => {
    if (!matrix) return
    const header = ['Competency', ...matrix.roles]
    const lines = [header.map(csvEscape).join(',')]
    for (const comp of matrix.competencies) {
      const cells = matrix.roles.map(r => {
        const cell = matrix.cells[r]?.[comp.title]
        return cell?.level != null ? String(cell.level) : ''
      })
      lines.push([comp.title, ...cells].map(csvEscape).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `role-mapping-${effectiveCategory ?? 'matrix'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importMatrix = async (file: File) => {
    setImporting(true)
    try {
      const rows = parseCsv(await file.text())
      if (rows.length < 2) return
      const header = rows[0]
      const roleCols = header.slice(1)
      let applied = 0
      for (let r = 1; r < rows.length; r++) {
        const skill = rows[r][0]?.trim()
        if (!skill) continue
        for (let c = 0; c < roleCols.length; c++) {
          const raw = (rows[r][c + 1] ?? '').trim()
          if (raw === '' || !/^\d+$/.test(raw)) continue
          const res = await saveCell(roleCols[c].trim(), skill, raw)
          if (res.ok) applied++
        }
      }
      refreshMatrix()
      retry()
      window.alert(`Imported ${applied} mapping${applied === 1 ? '' : 's'}.`)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /* -- Role column toggle --------------------------------------------- */
  const toggleRole = (jobrole: string) => {
    setSelectedRoles(prev => {
      const base = prev ?? roles.slice(0, 5).map(r => r.jobrole)
      return base.includes(jobrole) ? base.filter(r => r !== jobrole) : [...base, jobrole]
    })
  }

  const handleSubmitForReview = async () => {
    const role = effectiveRoles[0]
    if (!role || !matrix) return
    const changes = Object.keys(matrix.cells[role] ?? {}).length
    await submitReview({
      jobrole: role,
      framework_id: summary?.active_framework?.id,
      changes_count: changes,
      changes: `Reviewed ${changes} competency mapping${changes === 1 ? '' : 's'} for "${role}".`,
    })
  }

  /* ================================================================== */

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState title="Couldn't load the studio" description={error} retry={retry} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max">
      {/* Action message banner */}
      {(actionMessage || actionError) && (
        <div className={`fixed top-4 right-4 z-[60] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${actionError ? 'bg-destructive text-white' : 'bg-success text-white'}`}>
          {actionError || actionMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Competency Framework Studio <Info className="w-5 h-5 text-muted-foreground" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Design competency frameworks, set proficiency requirements and map them to job roles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={!summary?.active_framework || saving}
            onClick={() => summary?.active_framework && cloneFramework(summary.active_framework.id)}
            className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2"
          >
            <Copy className="w-4 h-4" /> Clone Framework
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) importMatrix(f) }}
          />
          <Button
            variant="outline"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import
          </Button>
          <Button
            variant="outline"
            disabled={!matrix}
            onClick={exportMatrix}
            className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2"
          >
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button onClick={() => openFrameworkDialog(null)} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-10 px-4 shadow-md shadow-primary/20 flex items-center gap-2">
            <Plus className="w-4 h-4 stroke-[3]" /> Create Framework
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="w-10 h-10 p-0 rounded-xl bg-background border border-border flex items-center justify-center hover:bg-accent hover:text-accent-foreground outline-none transition-colors">
              <ChevronDown className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => openFrameworkDialog(null)}>New Empty Framework</DropdownMenuItem>
              <DropdownMenuItem
                disabled={!summary?.active_framework}
                onClick={() => summary?.active_framework && cloneFramework(summary.active_framework.id)}
              >
                From Active (Clone)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Active Framework */}
        <div className="bg-card border border-primary/10 rounded-2xl p-4 flex flex-col gap-2 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Framework</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{summary?.active_framework?.name ?? 'No active framework'}</p>
                <div className="flex items-center gap-2 mt-1">
                  {summary?.active_framework && (
                    <StatusBadge variant={frameworkStatusVariant(summary.active_framework.status)} label={summary.active_framework.status === 'active' ? 'Published' : summary.active_framework.status} size="sm" />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="outline-none">
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-auto">
                      {frameworks.length === 0 && <DropdownMenuItem disabled>No frameworks</DropdownMenuItem>}
                      {frameworks.map(fw => (
                        <div key={fw.id} className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-muted rounded-md">
                          <span className="text-sm truncate flex-1">{fw.name}</span>
                          <StatusBadge status={fw.status} label={fw.status} size="sm" />
                          {/* Only a draft has anywhere to go: publishing is what
                              the approval queue decides. */}
                          {fw.status === 'draft' && (
                            <button
                              onClick={() => submitFrameworkForPublish(fw)}
                              disabled={submittingApproval}
                              title="Submit for publish"
                              aria-label={`Submit ${fw.name} for publish`}
                              className="text-muted-foreground hover:text-primary disabled:opacity-40"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => openFrameworkDialog(fw)} aria-label={`Edit ${fw.name}`} className="text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteFramework(fw.id)} aria-label={`Delete ${fw.name}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </div>

        <StatCard label="Total Competencies" value={summary?.total_competencies ?? 0} icon={<LayoutGrid className="w-4 h-4" />} />
        <div className="bg-card border border-primary/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job Roles Mapped</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-2xl font-bold text-foreground">{summary?.roles_mapped ?? 0} <span className="text-sm font-semibold text-muted-foreground">/ {summary?.total_roles ?? 0}</span></p>
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground"><Users className="w-4 h-4" /></div>
          </div>
        </div>
        <div className="bg-card border border-primary/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mapping Coverage</p>
          <div className="mt-2">
            <p className="text-2xl font-bold text-foreground">{summary?.coverage_percent ?? 0}%</p>
            <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${summary?.coverage_percent ?? 0}%` }} />
            </div>
          </div>
        </div>
        <div className="bg-card border border-primary/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Published</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-lg font-bold text-foreground">{summary?.last_published ?? '—'}</p>
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground"><Calendar className="w-4 h-4" /></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-border px-2 overflow-x-auto">
        {TABS.map(tab => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
              {isActive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
            </button>
          )
        })}
      </div>

      {/* ---- Framework Structure ---- */}
      {activeTab === 'framework' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          <div className="lg:w-96 shrink-0 flex flex-col gap-4 bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-4 shadow-sm">
            <h2 className="text-base font-bold text-foreground">Framework Structure</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search categories..." value={structureSearch} onChange={e => setStructureSearch(e.target.value)} className="h-9 pl-8 bg-background border-border" />
            </div>
            <div className="flex-1 overflow-y-auto g2g-scrollbar pr-2 flex flex-col gap-1 max-h-[420px]">
              {filteredStructure.length === 0 && <p className="text-sm text-muted-foreground p-2">No categories found.</p>}
              {filteredStructure.map(node => {
                const isOpen = expandedCategory === node.category
                const isSelected = effectiveCategory === node.category
                return (
                  <div key={node.category} className="flex flex-col gap-1">
                    <div
                      onClick={() => { setSelectedCategory(node.category); setExpandedCategory(isOpen ? null : node.category) }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                        <span className="text-sm font-semibold truncate">{node.index}. {node.category}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-background text-primary' : 'bg-muted-foreground/10'}`}>{node.count}</span>
                    </div>
                    {isOpen && node.children.length > 0 && (
                      <div className="flex flex-col pl-6 border-l border-border ml-3 gap-1 py-1">
                        {node.children.slice(0, 40).map(child => (
                          <div key={child.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
                            <div className="flex items-center gap-2 min-w-0">
                              <Folder className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-sm font-medium truncate">{child.name}</span>
                            </div>
                            <span className="text-xs font-medium">{child.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <Button onClick={() => setCategoryDialog(true)} variant="outline" className="w-full border-dashed border-2 border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 gap-2 h-10 rounded-xl">
              <Plus className="w-4 h-4" /> Add Category
            </Button>
          </div>
          <div className="flex-1 bg-card/20 border border-primary/10 rounded-2xl p-6">
            {effectiveCategory ? (
              <div>
                <h3 className="text-lg font-bold text-foreground">{effectiveCategory}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {structure.find(n => n.category === effectiveCategory)?.count ?? 0} competencies across{' '}
                  {structure.find(n => n.category === effectiveCategory)?.children.length ?? 0} sub-categories.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                  {(structure.find(n => n.category === effectiveCategory)?.children ?? []).map(child => (
                    <div key={child.name} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background">
                      <span className="text-sm font-medium text-foreground truncate">{child.name}</span>
                      <StatusBadge variant="processing" label={`${child.count}`} size="sm" />
                    </div>
                  ))}
                </div>
                <Button onClick={() => setActiveTab('matrix')} className="mt-6 gap-2"><MapIcon className="w-4 h-4" /> Map this category to roles</Button>
              </div>
            ) : (
              <EmptyState icon={<FileText className="w-10 h-10" />} title="Select a category" description="Choose a category on the left to view its structure." />
            )}
          </div>
        </div>
      )}

      {/* ---- Role Requirements — writes jobrole_competency_map ---- */}
      {activeTab === 'requirements' && (
        <div className="w-full flex-1 bg-card/90 border border-primary/10 rounded-2xl shadow-sm p-4">
          <RoleRequirementsPanel />
        </div>
      )}

      {/* ---- Role Mapping Matrix ---- */}
      {activeTab === 'matrix' && (
        <div className="w-full flex-1 flex flex-col bg-card/90 border border-primary/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-primary/10 flex items-center justify-between gap-3 flex-wrap bg-card">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">Selected Category:</span>
              <span className="text-sm font-bold text-primary">{effectiveCategory ?? '—'}</span>
            </div>
            <div className="flex items-center gap-3">
              {/* All Roles quick filter */}
              <div className="w-44">
                <Select
                  value={roleFilter}
                  onChange={applyRoleFilter}
                  options={[{ label: 'All Roles', value: 'all' }, ...roles.map(r => ({ label: r.jobrole, value: r.jobrole }))]}
                  placeholder="All Roles"
                  className="h-9 bg-background"
                />
              </div>
              {/* Filters: multi-select which roles are columns */}
              <DropdownMenu>
                <DropdownMenuTrigger className="h-9 px-3 gap-2 bg-background border border-border rounded-lg text-sm flex items-center hover:bg-muted outline-none">
                  <Filter className="w-3.5 h-3.5" /> Filters ({effectiveRoles.length})
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-auto">
                  <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Top roles by mapping count</p>
                  <DropdownMenuSeparator />
                  {roles.map(r => (
                    <div key={r.jobrole} onClick={() => toggleRole(r.jobrole)} className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-muted rounded-md cursor-pointer">
                      <span className="text-sm truncate flex-1">{r.jobrole}</span>
                      <span className="text-xs text-muted-foreground">{r.mapped_count}</span>
                      {effectiveRoles.includes(r.jobrole) && <Check className="w-4 h-4 text-primary" />}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* View settings */}
              <DropdownMenu>
                <DropdownMenuTrigger className="h-9 px-3 gap-2 bg-background border border-border rounded-lg text-sm flex items-center hover:bg-muted outline-none">
                  <Settings className="w-3.5 h-3.5" /> View Settings
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-sm">Show Required Level</span>
                    <Switch size="sm" checked={showRequired} onChange={e => setShowRequired(e.target.checked)} />
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-sm">Show Legend</span>
                    <Switch size="sm" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex-1 overflow-auto g2g-scrollbar relative min-h-[300px]">
            {matrixLoading ? (
              <div className="p-6 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !matrix || matrix.competencies.length === 0 ? (
              <EmptyState className="m-6" icon={<LayoutGrid className="w-10 h-10" />} title="No competencies" description="No competencies in this category, or no roles selected." />
            ) : (
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/30 border-b border-primary/10 sticky top-0 z-20">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-64 px-4 py-3 font-bold text-foreground">Competency</TableHead>
                    {matrix.roles.map(role => (
                      <TableHead key={role} className="px-4 py-3 text-center min-w-[120px]">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-foreground text-xs">{role}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Required Level</span>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="w-16 px-4 py-3 text-center font-bold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-primary/5">
                  {matrix.competencies.map(comp => (
                    <TableRow key={comp.id} className="hover:bg-muted/30">
                      <TableCell className="px-4 py-3 font-medium text-foreground">
                        <button onClick={() => setSelectedCompetency(comp)} className="text-left hover:text-primary truncate max-w-[220px] block">{comp.title}</button>
                      </TableCell>
                      {matrix.roles.map(role => {
                        const cell = matrix.cells[role]?.[comp.title]
                        return (
                          <TableCell key={role} className="px-4 py-3">
                            <div className="flex items-center justify-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-lg w-16 justify-between cursor-pointer hover:bg-muted transition-colors outline-none">
                                  <span className="font-bold text-foreground">{cell?.level != null && showRequired ? cell.level : '—'}</span>
                                  <div className={`w-2 h-2 rounded-full ${levelColor(cell?.level ?? null)}`} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center">
                                  {levels.map(lvl => (
                                    <DropdownMenuItem key={lvl.level} onClick={() => handleSetCell(role, comp.title, lvl.level)}>
                                      <span className={`w-2 h-2 rounded-full mr-2 ${levelColor(lvl.level)}`} /> {lvl.level} - {lvl.name ?? lvl.label}
                                    </DropdownMenuItem>
                                  ))}
                                  {cell && <DropdownMenuSeparator />}
                                  {cell && <DropdownMenuItem onClick={() => handleClearCell(role, comp.title)}>Clear mapping</DropdownMenuItem>}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        )
                      })}
                      <TableCell className="px-4 py-3 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none mx-auto">
                            <MoreVertical className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedCompetency(comp)}>View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleClearRow(comp.title)}>Clear Row Mapping</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Legend + footer */}
          <div className="p-4 border-t border-primary/10 bg-card flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              {showLegend && (
                <>
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Proficiency</span>
                  <div className="flex items-center gap-3 text-xs font-medium text-foreground flex-wrap">
                    {levels.map(lvl => (
                      <div key={lvl.level} className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${levelColor(lvl.level)}`} /> {lvl.level}-{lvl.name ?? lvl.label}</div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" disabled={saving || !effectiveRoles.length} onClick={() => { setBulkForm({ role: effectiveRoles[0] ?? '', level: '' }); setBulkDialog(true) }} className="gap-2">
                <Copy className="w-4 h-4" /> Bulk Update Levels
              </Button>
              <Button variant="outline" disabled={saving || !effectiveRoles.length} onClick={handleSubmitForReview} className="gap-2">
                <ListChecks className="w-4 h-4" /> Submit for Review
              </Button>
            </div>
          </div>

          {/* Competency Details */}
          {selectedCompetency && (
            <div className="p-5 border-t border-primary/10 bg-muted/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Competency Details</h3>
                <button onClick={() => setSelectedCompetency(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Competency Name</p>
                  <p className="text-sm font-bold text-foreground">{selectedCompetency.title}</p>
                  <p className="text-xs text-muted-foreground font-semibold mb-1 mt-4">Description</p>
                  <p className="text-xs text-foreground leading-relaxed">{selectedCompetency.description || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Category</p>
                  <p className="text-sm font-bold text-foreground">{selectedCompetency.category || '—'}</p>
                  <p className="text-xs text-muted-foreground font-semibold mb-1 mt-4">Type</p>
                  <p className="text-sm font-bold text-foreground">{selectedCompetency.competency_type || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Sub-category</p>
                  <p className="text-sm font-bold text-foreground">{selectedCompetency.sub_category || '—'}</p>
                  <p className="text-xs text-muted-foreground font-semibold mb-1 mt-4">Catalog Proficiency</p>
                  <p className="text-sm font-bold text-foreground">{selectedCompetency.proficiency_level || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Behavioural Indicators (Level 4)</p>
                  <ul className="text-xs text-foreground leading-relaxed list-disc pl-4 space-y-1 mt-1">
                    {(proficiency?.kasa.behaviour.find(k => k.level === 4)?.indicators ?? '')
                      .split(';').map(s => s.trim()).filter(Boolean).slice(0, 4)
                      .map((ind, i) => <li key={i}>{ind}</li>)}
                    {!proficiency?.kasa.behaviour.find(k => k.level === 4)?.indicators && <li className="list-none text-muted-foreground">No indicators defined.</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Weighting & Configuration ---- */}
      {activeTab === 'weighting' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          <div className="lg:w-96 shrink-0 flex flex-col gap-4">
            {/* Mapping summary donut */}
            <div className="bg-card/50 border border-primary/10 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4">Mapping Summary</h3>
              <div className="flex items-center gap-4">
                <DonutRing
                  total={summary?.mapping_summary.total_roles ?? 0}
                  segments={[
                    { pct: summary?.mapping_summary.fully_pct ?? 0, cls: 'stroke-primary' },
                    { pct: summary?.mapping_summary.partial_pct ?? 0, cls: 'stroke-warning' },
                    { pct: summary?.mapping_summary.not_pct ?? 0, cls: 'stroke-destructive' },
                  ]}
                />
                <div className="flex flex-col gap-2">
                  <LegendRow color="bg-primary" label="Fully Mapped" count={summary?.mapping_summary.fully_mapped ?? 0} pct={summary?.mapping_summary.fully_pct ?? 0} />
                  <LegendRow color="bg-warning" label="Partially Mapped" count={summary?.mapping_summary.partially_mapped ?? 0} pct={summary?.mapping_summary.partial_pct ?? 0} />
                  <LegendRow color="bg-destructive" label="Not Mapped" count={summary?.mapping_summary.not_mapped ?? 0} pct={summary?.mapping_summary.not_pct ?? 0} />
                </div>
              </div>
            </div>
            {/* Quick actions */}
            <div className="bg-card/50 border border-primary/10 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                <Button variant="ghost" onClick={() => setCategoryDialog(true)} className="justify-start gap-3 p-2 text-sm font-medium text-foreground"><Plus className="w-4 h-4 text-primary" /> Add Competency</Button>
                <Button variant="ghost" onClick={() => setActiveTab('matrix')} className="justify-start gap-3 p-2 text-sm font-medium text-foreground"><MapIcon className="w-4 h-4 text-primary" /> Map to Role</Button>
                <Button variant="ghost" onClick={() => { setActiveTab('matrix'); setBulkForm({ role: effectiveRoles[0] ?? '', level: '' }); setBulkDialog(true) }} className="justify-start gap-3 p-2 text-sm font-medium text-foreground"><Copy className="w-4 h-4 text-primary" /> Bulk Update Levels</Button>
                <Button variant="ghost" disabled={!matrix} onClick={exportMatrix} className="justify-start gap-3 p-2 text-sm font-medium text-foreground"><DownloadCloud className="w-4 h-4 text-primary" /> Download Mapping Template</Button>
              </div>
            </div>
          </div>
          {/* Weighting editor */}
          <div className="flex-1 bg-card/90 border border-primary/10 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-foreground">Category Weighting</h2>
                <p className="text-sm text-muted-foreground mt-1">Relative weight of each competency category in scoring.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${Math.round(weightTotal) === 100 ? 'text-success' : 'text-warning'}`}>Total: {weightTotal}%</span>
                <Button onClick={handleSaveWeights} disabled={saving} className="gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save</Button>
              </div>
            </div>
            {weights.length === 0 ? (
              <EmptyState icon={<PieChart className="w-10 h-10" />} title="No categories" description="Add competencies to define weighting." />
            ) : (
              <div className="flex flex-col gap-3">
                {weights.map(w => (
                  <div key={w.category} className="flex items-center gap-4">
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{w.category}</span>
                    <div className="w-40 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(Number(weightValue(w.category)) || 0, 100)}%` }} /></div>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={weightValue(w.category)}
                      onChange={e => setWeightEdits(prev => ({ ...prev, [w.category]: Number(e.target.value) }))}
                      className="w-20 h-9 text-center"
                    />
                    <span className="text-sm text-muted-foreground w-4">%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Proficiency Scale ---- */}
      {activeTab === 'proficiency' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          <div className="lg:w-80 shrink-0 bg-card/50 border border-primary/10 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-foreground">Proficiency Scales</h2>
            </div>
            <Button onClick={() => openLevelDialog(null)} className="w-full gap-2 mb-3"><Plus className="w-4 h-4" /> Create New Scale</Button>
            <div className="p-3 border border-primary text-primary bg-primary/10 rounded-xl">
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-sm">Global Proficiency Scale</span>
                <span className="text-xs bg-background px-2 py-0.5 rounded-md font-semibold">Default</span>
              </div>
              <p className="text-xs text-primary/70">{levels.length}-level tenant scale</p>
            </div>
          </div>
          <div className="flex-1 bg-card/90 border border-primary/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-primary/10 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">Global Proficiency Scale</h2>
                <p className="text-sm text-muted-foreground mt-1">Standard proficiency levels for all competencies.</p>
              </div>
              <Button variant="outline" onClick={() => openLevelDialog(null)} className="gap-2"><Edit2 className="w-4 h-4" /> Edit Scale</Button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {levels.map(lvl => (
                <div key={lvl.level} className="flex gap-6 p-4 rounded-xl border border-border bg-background group">
                  <div className="flex flex-col items-center gap-2 shrink-0 w-24">
                    <div className={`w-12 h-12 rounded-full ${levelColor(lvl.level)} flex items-center justify-center text-white font-bold text-xl shadow-md`}>{lvl.level}</div>
                    <span className="font-bold text-sm text-foreground text-center">{lvl.name ?? lvl.label}</span>
                  </div>
                  <div className="flex-1 border-l border-border pl-6 flex flex-col justify-center">
                    <p className="text-sm text-muted-foreground leading-relaxed">{lvl.description || 'No description.'}</p>
                  </div>
                  {lvl.id && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => openLevelDialog(lvl)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-primary" title="Edit level"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => { if (lvl.id && window.confirm(`Delete "${lvl.name ?? lvl.label}"?`)) deleteLevel(lvl.id) }} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete level"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- Workflow & Review ---- */}
      {activeTab === 'workflow' && (
        <div className="flex-1 flex flex-col bg-card/90 border border-primary/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-primary/10 flex items-center justify-between gap-3 flex-wrap bg-card">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">Review &amp; Approvals</h2>
              <div className="flex bg-muted p-1 rounded-lg">
                {(['pending', 'approved', 'rejected'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setReviewStatus(s)}
                    className={`px-4 py-1.5 text-sm font-bold rounded-md capitalize ${reviewStatus === s ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                  >
                    {s} ({reviewCounts[s]})
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" disabled={saving || reviewCounts.pending === 0} onClick={async () => { const r = await bulkApproveReviews(); if (r.ok) loadReviews(reviewStatus) }} className="gap-2">
              <ListChecks className="w-4 h-4" /> Bulk Approve
            </Button>
          </div>
          <div className="flex-1 overflow-auto g2g-scrollbar p-6 min-h-[300px]">
            {reviewsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
            ) : reviews.length === 0 ? (
              <EmptyState icon={<ListChecks className="w-10 h-10" />} title={`No ${reviewStatus} reviews`} description="Mapping changes submitted for review will appear here." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reviews.map(item => (
                  <div key={item.id} className="bg-background border border-border rounded-xl p-5 shadow-sm flex flex-col">
                    <div className="flex justify-between items-start mb-4 gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground text-base truncate">{item.jobrole}</h3>
                        <p className="text-xs text-muted-foreground truncate">{item.department || '—'}</p>
                      </div>
                      <StatusBadge status={item.status} size="sm" />
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 mb-4 flex-1 space-y-2">
                      <RowKV k="Mapped By" v={item.submitted_by_name || 'System'} />
                      <RowKV k="Submitted" v={item.submitted_at || '—'} />
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Modifications</span>
                        <span className="font-bold text-primary">{item.changes_count} competencies</span>
                      </div>
                      {item.note && <p className="text-xs text-muted-foreground italic pt-1">“{item.note}”</p>}
                    </div>
                    {item.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button variant="outline" disabled={saving} onClick={async () => { const r = await approveReview(item.id); if (r.ok) loadReviews(reviewStatus) }} className="flex-1 bg-success/10 text-success border-success/20 hover:bg-success/20">
                          <Check className="w-4 h-4 mr-2" /> Approve
                        </Button>
                        <Button variant="outline" disabled={saving} onClick={async () => { const r = await rejectReview(item.id); if (r.ok) loadReviews(reviewStatus) }} className="flex-1 bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
                          <X className="w-4 h-4 mr-2" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Framework Dialog */}
      <Dialog open={frameworkDialog.open} onOpenChange={open => setFrameworkDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
            <DialogTitle className="text-xl font-bold text-foreground">{frameworkDialog.editing ? 'Edit Framework' : 'Create Framework'}</DialogTitle>
          </DialogHeader>
          <div className="p-6 flex flex-col gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Framework Name</label>
              <Input placeholder="Enter framework name" value={fwForm.name} onChange={e => setFwForm(p => ({ ...p, name: e.target.value }))} className="bg-background border-border" />
            </div>
         
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Version</label>
                <Input placeholder="v1.0" value={fwForm.version ?? ''} onChange={e => setFwForm(p => ({ ...p, version: e.target.value }))} className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Status</label>
                {/* Was hardcoded to draft, so a framework could never be
                    published. Active is reachable directly here or through the
                    approval queue via Submit for Publish. */}
                <Select
                  value={fwForm.status ?? 'draft'}
                  onChange={value => setFwForm(p => ({ ...p, status: value }))}
                  options={FRAMEWORK_STATUS_OPTIONS}
                  className="bg-background border-border h-9"
                  aria-label="Framework status"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Description</label>
              <textarea value={fwForm.description ?? ''} onChange={e => setFwForm(p => ({ ...p, description: e.target.value }))} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[90px] resize-none" placeholder="Enter description..." />
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
            <Button variant="outline" onClick={() => setFrameworkDialog({ open: false, editing: null })} className="h-9 px-6 rounded-lg font-bold border-border bg-background">Cancel</Button>
            <Button onClick={submitFramework} disabled={saving || !fwForm.name.trim()} className="h-9 px-6 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (frameworkDialog.editing ? 'Save' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
            <DialogTitle className="text-xl font-bold text-foreground">Add Category</DialogTitle>
          </DialogHeader>
          <div className="p-6 flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">A category is created by adding its first competency.</p>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Category Name</label>
              <Input placeholder="e.g. Digital & Data Skills" value={catForm.category} onChange={e => setCatForm(p => ({ ...p, category: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">First Competency</label>
              <Input placeholder="e.g. Data Governance" value={catForm.competency} onChange={e => setCatForm(p => ({ ...p, competency: e.target.value }))} className="bg-background border-border" />
            </div>
            {catError && <p className="text-xs text-destructive">{catError}</p>}
          </div>
          <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
            <Button variant="outline" onClick={() => setCategoryDialog(false)} className="h-9 px-6 rounded-lg font-bold border-border bg-background">Cancel</Button>
            <Button onClick={submitCategory} disabled={catSaving || !catForm.category.trim() || !catForm.competency.trim()} className="h-9 px-6 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90">
              {catSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Levels Dialog */}
      <Dialog open={bulkDialog} onOpenChange={setBulkDialog}>
        <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
            <DialogTitle className="text-xl font-bold text-foreground">Bulk Update Levels</DialogTitle>
          </DialogHeader>
          <div className="p-6 flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">Sets the required level for every competency in <span className="font-semibold text-foreground">{effectiveCategory ?? 'the current category'}</span> for the chosen role.</p>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Job Role</label>
              <Select
                value={bulkForm.role}
                onChange={v => setBulkForm(p => ({ ...p, role: v }))}
                options={roles.map(r => ({ label: r.jobrole, value: r.jobrole }))}
                placeholder="Select a role"
                className="h-9 bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Required Level</label>
              <Select
                value={bulkForm.level}
                onChange={v => setBulkForm(p => ({ ...p, level: v }))}
                options={levels.map(l => ({ label: `${l.level} - ${l.name ?? l.label}`, value: String(l.level) }))}
                placeholder="Select a level"
                className="h-9 bg-background"
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
            <Button variant="outline" onClick={() => setBulkDialog(false)} className="h-9 px-6 rounded-lg font-bold border-border bg-background">Cancel</Button>
            <Button onClick={handleBulkApply} disabled={saving || !bulkForm.role || !bulkForm.level} className="h-9 px-6 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply to all'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proficiency Level Dialog */}
      <Dialog open={levelDialog.open} onOpenChange={open => setLevelDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-primary/10 m-0">
            <DialogTitle className="text-xl font-bold text-foreground">{levelDialog.editing ? `Edit ${levelDialog.editing.label}` : 'Add Proficiency Level'}</DialogTitle>
          </DialogHeader>
          <div className="p-6 flex flex-col gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Level Name</label>
              <Input placeholder="e.g. Advanced Practice" value={levelForm.name} onChange={e => setLevelForm(p => ({ ...p, name: e.target.value }))} className="bg-background border-border" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Description</label>
              <textarea value={levelForm.description} onChange={e => setLevelForm(p => ({ ...p, description: e.target.value }))} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[90px] resize-none" placeholder="What this level means..." />
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t border-primary/5 bg-muted/10 m-0">
            <Button variant="outline" onClick={() => setLevelDialog({ open: false, editing: null })} className="h-9 px-6 rounded-lg font-bold border-border bg-background">Cancel</Button>
            <Button onClick={submitLevel} disabled={saving || !levelForm.name.trim()} className="h-9 px-6 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (levelDialog.editing ? 'Save' : 'Add Level')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Small presentational helpers
 * ------------------------------------------------------------------ */

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="bg-card border border-primary/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">{icon}</div>
      </div>
    </div>
  )
}

/** A proportional donut ring; segments are drawn as stroked arcs (pct 0..100). */
function DonutRing({ total, segments }: { total: number; segments: { pct: number; cls: string }[] }) {
  const r = 40
  const c = 2 * Math.PI * r
  // Pure prefix sums (no post-render mutation) for each segment's start offset.
  const priorPct = segments.map((_, i) => segments.slice(0, i).reduce((a, s) => a + s.pct, 0))
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-muted" />
        {segments.map((s, i) => {
          const len = (c * Math.max(0, Math.min(s.pct, 100))) / 100
          const dash = `${len} ${c - len}`
          const offset = -(c * priorPct[i]) / 100
          return (
            <circle
              key={i}
              cx="50" cy="50" r={r}
              fill="none" strokeWidth="12" strokeLinecap="butt"
              className={s.cls}
              strokeDasharray={dash}
              strokeDashoffset={offset}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold text-foreground leading-none">{total}</span>
        <span className="text-[9px] uppercase font-bold text-muted-foreground mt-0.5">Total Roles</span>
      </div>
    </div>
  )
}

function LegendRow({ color, label, count, pct }: { color: string; label: string; count: number; pct: number }) {
  return (
    <div className="flex items-start gap-1.5">
      <div className={`w-2 h-2 rounded-sm mt-1 shrink-0 ${color}`} />
      <div className="text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground block">({count}) {pct}%</span>
      </div>
    </div>
  )
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold text-foreground truncate max-w-[60%]">{v}</span>
    </div>
  )
}
