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
import { competencyLibraryService, competencyLibrariesService } from '@/services/competency'
import { getLaravelContext } from '@/lib/laravel-context'
import { RoleRequirementsPanel } from './role-requirements-panel'
import { TaskCompetenciesPanel } from './task-competencies-panel'
import { useAuth } from '@/hooks/use-auth'
import type {
  Framework, FrameworkPayload, MatrixCompetency, ProficiencyLevel,
} from '@/services/competency'

/* ------------------------------------------------------------------ *
 * Presentation helpers
 * ------------------------------------------------------------------ */

const TABS: { id: string; label: string }[] = [
  { id: 'framework', label: 'Framework Structure' },
  // Read-only since 2026-08-24 — see MATRIX_IS_READ_ONLY below.
  { id: 'matrix', label: 'Role Mapping Matrix (view)' },
  // Writes `jobrole_competency_map` through the existing guarded endpoint.
  // Sits beside the matrix because that is where a person looks for "what does
  // this role need" - and until now the matrix was the only thing there, and it
  // writes a different table (`s_user_skill_jobrole`, keyed by text).
  { id: 'requirements', label: 'Role Requirements' },
  /*
   * WHICH COMPETENCY EACH TASK EXERCISES.
   *
   * `TaskCompetenciesPanel` and its `CmTaskCompetencies` host have existed for
   * some time and were **never routed** — no entry in content-map-m2.ts, so no
   * menu reached them. The only way to map a task was to be creating one at the
   * time, through the inline panel in create-task-modal. That is why
   * `jobrole_task_competency_map` holds 0 rows on live.
   *
   * Mounted here rather than given its own menu: a new menu row is a schema
   * change on both databases plus a rights grant per tenant, and this belongs
   * beside role requirements anyway — same question, one level down.
   */
  { id: 'task-competencies', label: 'Task Competencies' },
  // The broken links between frameworks and roles, as rows you can act on.
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'weighting', label: 'Weighting & Configuration' },
  { id: 'proficiency', label: 'Proficiency Scale' },
  { id: 'workflow', label: 'Workflow & Review' },
]

/**
 * THE ROLE MAPPING MATRIX IS A VIEW, NOT AN AUTHORING SURFACE.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 *
 * Two panels sat on this screen writing DIFFERENT tables for the same idea —
 * "what does this role need":
 *
 *   Role Mapping Matrix  ->  s_user_skill_jobrole    keyed by role NAME + skill NAME
 *   Role Requirements    ->  jobrole_competency_map  keyed by jobrole_id + competency.id
 *
 * The second is the one the product actually resolves against: every gap, every
 * 9-box position and every recommendation reads `jobrole_competency_map`, and
 * `CompetencyGapController` reads nothing else. Under competency-as-source-of-
 * truth the matrix is no longer the requirement surface, and leaving it writable
 * meant two sources of truth drifting apart with no way to tell which was right.
 *
 * ── WHY READ-ONLY RATHER THAN DELETED ───────────────────────────────────────
 *
 * Existing tenants hold real data in `s_user_skill_jobrole`, and this is the
 * only view that shows the whole role x competency grid at once. Keeping the
 * view costs nothing once it cannot write; deleting it would throw away both.
 *
 * Its rows are also `s_users_skills` ids (the 5,171-row flat skill library) and
 * its columns are role NAMES — `Matrix.roles` is `string[]`, because the studio
 * endpoint plucks names without ids. As a read-only view that is merely
 * inelegant. As a writer it was a second, unkeyed source of truth.
 *
 * ── REVERSING THIS ──────────────────────────────────────────────────────────
 *
 * Flip this to `false` and every write path returns. Nothing was deleted, which
 * is deliberate: this is a product decision, and product decisions get revisited.
 */
const MATRIX_IS_READ_ONLY = true

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
  // Framework ids now, not skill-category names. The Structure tab lists the
  // competency taxonomy (frameworks); it used to list s_users_skills categories.
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<number | null>(null)
  const [structureSearch, setStructureSearch] = useState('')
  const [expandedFrameworkId, setExpandedFrameworkId] = useState<number | null>(null)
  const [openBundleId, setOpenBundleId] = useState<number | null>(null)
  const [requirementsDepartment, setRequirementsDepartment] = useState('')
  const [selectedCompetency, setSelectedCompetency] = useState<MatrixCompetency | null>(null)
  const [showRequired, setShowRequired] = useState(true)

  const [reviewStatus, setReviewStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')
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
    loading, error, summary, structure, structureMeta, proficiency, weights, frameworks, roles, retry,
    reconciliation, reconciliationMeta, reconciliationLoading, reconciliationError, loadReconciliation,
    requirements, requirementsMeta, requirementsLoading, requirementsError, loadRequirements,
    matrix, matrixLoading, loadMatrix,
    reviews, reviewCounts, reviewsLoading, loadReviews,
    saving, actionMessage, actionError, clearMessages,
    // `clearCell` and `submitReview` are deliberately NOT destructured: their
    // callers went when the Matrix tab became a view. They remain on the hook
    // for the skill matrix and the review workflow that still use them.
    saveCell, saveWeights, createFramework, updateFramework,
    cloneFramework, deleteFramework, approveReview, rejectReview, bulkApproveReviews,
    createLevel, updateLevel, deleteLevel,
  } = studio

  const levels: ProficiencyLevel[] = proficiency?.levels?.length
    ? proficiency.levels
    : [1, 2, 3, 4, 5].map(n => ({ level: n, label: `Level ${n}`, name: null, description: null }))

  // Derive the effective selections during render (defaults follow the loaded
  // data) so there is no setState-in-effect. Explicit user picks win.
  const effectiveFrameworkId = selectedFrameworkId ?? structure[0]?.framework_id ?? null
  const effectiveFramework = structure.find(n => n.framework_id === effectiveFrameworkId) ?? null
  /*
   * The SKILL matrix's columns — the first five roles, always.
   *
   * This was `selectedRoles ?? roles.slice(0, 5)`, but nothing has set
   * `selectedRoles` since the column toggle went with the Matrix rebuild, so
   * the left-hand side was permanently null. Written out as what it is, rather
   * than left looking like a user choice that no longer exists.
   *
   * The COMPETENCY grid does not use this: it narrows by department, by id.
   */
  const effectiveRoles = roles.slice(0, 5).map(r => r.jobrole)

  /* -- Load matrix when its inputs change ----------------------------- */
  const rolesKey = JSON.stringify(effectiveRoles)
  useEffect(() => {
    const rolesList = JSON.parse(rolesKey) as string[]
    /*
     * DECOUPLED FROM THE STRUCTURE TAB.
     *
     * This used to pass `effectiveCategory` - a SKILL category - because the
     * Structure tab supplied one. Structure now lists frameworks, which are the
     * competency taxonomy and mean nothing to a skill-keyed matrix, so passing
     * it would have been a category error dressed as a filter.
     *
     * `category` is optional on the endpoint (RoleMappingController:118 falls
     * back to all approved), so the matrix loads unfiltered until it is itself
     * rebuilt on competencies.
     */
    if (activeTab === 'matrix' && rolesList.length > 0) {
      loadMatrix(null, rolesList)
    }
  }, [activeTab, rolesKey, loadMatrix])

  /* -- The competency requirements grid, on demand -------------------- */
  useEffect(() => {
    if (activeTab === 'matrix') {
      loadRequirements(requirementsDepartment ? { department: requirementsDepartment } : {})
    }
  }, [activeTab, requirementsDepartment, loadRequirements])


  /* -- Load reviews when the workflow tab / status changes ------------ */
  useEffect(() => {
    if (activeTab === 'workflow') {
      loadReviews(reviewStatus)
    }
  }, [activeTab, reviewStatus, loadReviews])

  /* -- Reconciliation, on demand -------------------------------------- */
  useEffect(() => {
    if (activeTab === 'reconciliation') {
      loadReconciliation()
    }
  }, [activeTab, loadReconciliation])

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
    // A competency match keeps its framework visible - searching for a
    // competency should show you where it lives, not hide it.
    return structure.filter(node =>
      node.name.toLowerCase().includes(q) ||
      node.competencies.some(c => c.name.toLowerCase().includes(q)),
    )
  }, [structure, structureSearch])

  const refreshMatrix = () => {
    if (effectiveRoles.length > 0) loadMatrix(null, effectiveRoles)
  }

  /* -- Cell actions ----------------------------------------------------
   *
   * REMOVED 2026-08-24: handleSetCell, handleClearCell, handleClearRow and
   * applyRoleFilter. When the Matrix tab was rebuilt on competencies it became
   * a read-only view with an "Edit in Role Requirements" action, so these four
   * lost their last caller and each was left referenced only by its own
   * declaration - the kind of rot that makes the next reader believe this
   * screen still writes cells.
   *
   * The write path they used is unchanged and still the only one: requirements
   * are authored in Role Requirements, through the guarded POST
   * /competency/role-map.
   * ------------------------------------------------------------------- */

  /* -- Bulk update levels (apply one level to a whole category/role) --- */
  const handleBulkApply = async () => {
    if (MATRIX_IS_READ_ONLY) return
    if (!bulkForm.role || !bulkForm.level || !matrix) return
    for (const comp of matrix.competencies) {
      await saveCell(bulkForm.role, comp.title, bulkForm.level)
    }
    refreshMatrix()
    setBulkDialog(false)
  }

  /* -- Framework dialog ----------------------------------------------- */
  const [fwForm, setFwForm] = useState<FrameworkPayload>({ name: '', description: '', status: 'draft', version: 'v1.0' })

  /**
   * ROLES THAT CARRY THEIR ID — a different source from `roles` above.
   *
   * `roles` comes from the studio endpoint, which does `pluck('jobrole')` and
   * returns NAMES ONLY (StudioController:204). That is fine for the matrix,
   * which is a read-only view, but a framework's link to a role has to be an id
   * or renaming the role silently unhooks it.
   *
   * So this reads `jobroles_by_department` from the libraries meta — the same
   * source RoleRequirementsPanel uses, for the same reason.
   */
  const [roleOptions, setRoleOptions] = useState<{ id: number; jobrole: string; department: string }[]>([])

  /* Departments come from the FULL role list (library meta), not from the
     requirements grid's own roles - those are capped at 40, so deriving the
     filter from them would hide the very departments you need to narrow it. */
  const departmentOptions = useMemo(
    () => Array.from(new Set(roleOptions.map(r => r.department).filter(Boolean))).sort(),
    [roleOptions],
  )

  useEffect(() => {
    const ctx = getLaravelContext(user)
    competencyLibrariesService.meta(ctx).then((res) => {
      const byDept = res?.data?.jobroles_by_department ?? {}
      const flat: { id: number; jobrole: string; department: string }[] = []
      for (const [department, list] of Object.entries(byDept)) {
        for (const r of list) flat.push({ id: r.id, jobrole: r.jobrole, department })
      }
      flat.sort((a, b) => a.department.localeCompare(b.department) || a.jobrole.localeCompare(b.jobrole))
      setRoleOptions(flat)
    }).catch(() => setRoleOptions([]))
  }, [user])
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
      ? { name: editing.name, description: editing.description ?? '', status: editing.status, version: editing.version, jobrole: editing.jobrole ?? '', jobrole_id: editing.jobrole_id ?? null }
      : { name: '', description: '', status: 'draft', version: 'v1.0', jobrole: '', jobrole_id: null })
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
    a.download = 'role-mapping-matrix.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importMatrix = async (file: File) => {
    // CSV import is a write path like any other. Export stays — reading the grid
    // out is exactly what a read-only view is for.
    if (MATRIX_IS_READ_ONLY) return
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

  /*
   * REMOVED 2026-08-24: toggleRole and handleSubmitForReview.
   *
   * `toggleRole` chose which NAME-keyed role columns the old skill matrix
   * showed; the competency grid narrows by department instead, and by id.
   *
   * `handleSubmitForReview` submitted the matrix's pending edits for review -
   * a workflow that ended when the tab stopped accepting edits. It counted
   * `matrix.cells[role]` for a role NAME, which the rebuilt grid no longer
   * keys by, so it would have thrown had anything still called it.
   */

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
          {/* Import writes the matrix; Export below only reads it, so Export stays. */}
          {!MATRIX_IS_READ_ONLY && (
            <Button
              variant="outline"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import
            </Button>
          )}
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
              <Input placeholder="Search frameworks or competencies..." value={structureSearch} onChange={e => setStructureSearch(e.target.value)} className="h-9 pl-8 bg-background border-border" />
            </div>
            <div className="flex-1 overflow-y-auto g2g-scrollbar pr-2 flex flex-col gap-1 max-h-[420px]">
              {filteredStructure.length === 0 && <p className="text-sm text-muted-foreground p-2">No frameworks found.</p>}
              {filteredStructure.map(node => {
                const isOpen = expandedFrameworkId === node.framework_id
                const isSelected = effectiveFrameworkId === node.framework_id
                return (
                  <div key={node.framework_id} className="flex flex-col gap-1">
                    <div
                      onClick={() => { setSelectedFrameworkId(node.framework_id); setExpandedFrameworkId(isOpen ? null : node.framework_id) }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                        <span className="text-sm font-semibold truncate">{node.index}. {node.name}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isSelected ? 'bg-background text-primary' : 'bg-muted-foreground/10'}`}>{node.count}</span>
                    </div>
                    {isOpen && node.competencies.length > 0 && (
                      <div className="flex flex-col pl-6 border-l border-border ml-3 gap-1 py-1">
                        {node.competencies.map(c => (
                          <div key={c.competency_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                            <div className="flex items-center gap-2 min-w-0">
                              <Folder className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-sm font-medium truncate">{c.name}</span>
                            </div>
                            <span className="text-xs font-medium">{c.items.length}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Frameworks ARE the competency taxonomy, so this creates one. It
                used to create a skill category, which is a large part of why
                this screen felt like a different product from the library. */}
            <Button onClick={() => openFrameworkDialog(null)} variant="outline" className="w-full border-dashed border-2 border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 gap-2 h-10 rounded-xl">
              <Plus className="w-4 h-4" /> Add Framework
            </Button>
          </div>
          <div className="flex-1 bg-card/20 border border-primary/10 rounded-2xl p-6 overflow-y-auto g2g-scrollbar">
            {/* WHAT THE TREE DOES NOT CONTAIN, said out loud. Both are broken
                links; a structure view that omitted them would show a tidy tree
                while most of the library sat outside it. */}
            {(structureMeta?.unfiled_count ?? 0) > 0 && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-500" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">{structureMeta?.unfiled_count} competencies are filed under no framework</span>{' '}
                  and so appear nowhere in this tree. Open each in the Competency Library and pick its framework.
                </p>
              </div>
            )}
            {(structureMeta?.orphan_targets ?? 0) > 0 && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">{structureMeta?.orphan_targets} target levels point at a framework their competency does not claim.</span>{' '}
                  They are reported rather than applied &mdash; the competency&rsquo;s own framework is what counts.
                </p>
              </div>
            )}

            {effectiveFramework ? (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-foreground">{effectiveFramework.name}</h3>
                  <StatusBadge variant={effectiveFramework.status === 'active' ? 'success' : 'processing'} label={effectiveFramework.status} size="sm" />
                  {effectiveFramework.version && <span className="text-xs font-medium text-muted-foreground">{effectiveFramework.version}</span>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {effectiveFramework.count} {effectiveFramework.count === 1 ? 'competency' : 'competencies'}, each bundling KASBA atoms.
                </p>

                <div className="flex flex-col gap-3 mt-6">
                  {effectiveFramework.competencies.length === 0 && (
                    <p className="text-sm text-muted-foreground">No competencies filed under this framework yet.</p>
                  )}
                  {effectiveFramework.competencies.map(c => {
                    const open = openBundleId === c.competency_id
                    return (
                      <div key={c.competency_id} className="rounded-xl border border-border bg-background">
                        <div
                          onClick={() => setOpenBundleId(open ? null : c.competency_id)}
                          className="flex items-center justify-between gap-3 p-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {open ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                            <span className="text-sm font-semibold text-foreground truncate">{c.name}</span>
                            {c.code && <span className="text-xs text-muted-foreground shrink-0">{c.code}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* The framework DEFAULT. A role may override it. */}
                            <StatusBadge
                              variant={c.framework_target ? 'processing' : 'default'}
                              label={c.framework_target ? `Target L${c.framework_target}` : 'No target set'}
                              size="sm"
                            />
                            <span className="text-xs font-medium text-muted-foreground">{c.items.length} KASBA</span>
                          </div>
                        </div>
                        {open && (
                          <div className="border-t border-border px-3 py-2 flex flex-col gap-1.5">
                            {c.items.length === 0 && (
                              <p className="text-xs text-muted-foreground py-1">Nothing bundled yet &mdash; this competency cannot be measured until it has KASBA items.</p>
                            )}
                            {c.items.map((it, i) => (
                              <div key={`${c.competency_id}-${i}`} className="flex items-center justify-between gap-3 py-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground w-16 shrink-0">{it.kasba_type}</span>
                                  {/* An id that resolves to nothing is a real
                                      condition, not an empty cell to hide. */}
                                  <span className={`text-sm truncate ${it.title_missing ? 'italic text-destructive' : 'text-foreground'}`}>
                                    {it.title_missing ? 'Library item missing' : it.title}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-muted-foreground shrink-0" title="Weight in the proficiency roll-up">w{it.weight}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <Button onClick={() => setActiveTab('requirements')} className="mt-6 gap-2"><MapIcon className="w-4 h-4" /> Set role requirements</Button>
              </div>
            ) : (
              <EmptyState icon={<FileText className="w-10 h-10" />} title="Select a framework" description="Choose a framework on the left to see its competencies and their KASBA bundles." />
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
      {/* ---- Role Mapping Matrix — COMPETENCIES x JOB ROLES ----
           Rows are the `competency` table, columns are job roles BY ID and
           scoped to a department. It used to be s_users_skills x role NAMES,
           which is why this tab never showed a competency and why its columns
           neither filtered by department nor survived a rename. */}
      {activeTab === 'matrix' && (
        <div className="w-full flex-1 flex flex-col bg-card/90 border border-primary/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-primary/10 flex items-center justify-between gap-3 flex-wrap bg-card">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">Department:</span>
              <div className="w-56">
                <Select
                  value={requirementsDepartment}
                  onChange={setRequirementsDepartment}
                  options={[{ label: 'All departments', value: '' }, ...departmentOptions.map(d => ({ label: d, value: d }))]}
                  placeholder="All departments"
                  className="h-9 bg-background"
                  aria-label="Filter roles by department"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {requirementsMeta ? `${requirementsMeta.competencies} competencies × ${requirementsMeta.roles_shown} roles` : ''}
              </span>
              <Button variant="outline" disabled={requirementsLoading} onClick={() => loadRequirements(requirementsDepartment ? { department: requirementsDepartment } : {})} className="gap-2">
                {requirementsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} Refresh
              </Button>
            </div>
          </div>

          {/* COLUMNS WERE DROPPED — say so. A grid that silently truncates reads
              as "these roles have no requirements", which is the most dangerous
              thing a requirements screen can claim. */}
          {requirementsMeta?.roles_truncated && (
            <div className="px-4 py-2.5 border-b border-primary/10 bg-amber-500/5 flex items-start gap-2.5">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-500" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Showing <span className="font-semibold text-foreground">{requirementsMeta.roles_shown} of {requirementsMeta.role_total}</span> roles.
                The rest are not displayed — pick a department above to narrow the grid rather than assuming those roles have no requirements.
              </p>
            </div>
          )}

          <div className="flex-1 overflow-auto g2g-scrollbar">
            {requirementsLoading ? (
              <div className="space-y-3 p-6">
                {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
              </div>
            ) : requirementsError ? (
              <ErrorState title="Couldn't load the requirements grid" description={requirementsError} retry={() => loadRequirements()} className="m-6" />
            ) : !requirements || requirements.competencies.length === 0 ? (
              <EmptyState
                icon={<LayoutGrid className="w-10 h-10" />}
                title="No competencies yet"
                description="Create competencies in the Competency Library and file them under a framework, then set what each role needs here."
                className="m-6"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="px-4 py-3 sticky left-0 bg-card z-10 min-w-[240px]">Competency</TableHead>
                    {requirements.roles.map(role => (
                      <TableHead key={role.id} className="px-3 py-3 text-center min-w-[110px]">
                        <span className="text-xs font-semibold text-foreground block truncate max-w-[110px]" title={role.jobrole}>{role.jobrole}</span>
                        {role.department && <span className="text-[10px] text-muted-foreground block truncate max-w-[110px]">{role.department}</span>}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-primary/5">
                  {requirements.competencies.map(comp => (
                    <TableRow key={comp.id} className="hover:bg-muted/30">
                      <TableCell className="px-4 py-3 sticky left-0 bg-card z-10">
                        <span className="font-medium text-foreground block truncate max-w-[240px]" title={comp.name}>{comp.name}</span>
                        {comp.framework_name && (
                          <span className="text-[10px] text-muted-foreground block truncate max-w-[240px]">{comp.framework_name}</span>
                        )}
                      </TableCell>
                      {requirements.roles.map(role => {
                        const cell = requirements.cells?.[String(role.id)]?.[String(comp.id)]
                        return (
                          <TableCell key={`${role.id}-${comp.id}`} className="px-3 py-3">
                            <div className="flex items-center justify-center">
                              {!cell ? (
                                <span className="text-muted-foreground text-sm">—</span>
                              ) : (
                                /* SOURCE IS VISIBLE. A level inherited from the
                                   framework must not look like one somebody
                                   chose for this role - outlined vs solid. */
                                <span
                                  title={cell.source === 'framework'
                                    ? 'Inherited from this role\u2019s framework — not set for the role itself'
                                    : `Set for this role${cell.is_mandatory ? ' · mandatory' : ''}`}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-bold ${
                                    cell.source === 'role'
                                      ? 'bg-primary/10 text-primary border border-primary/20'
                                      : 'border border-dashed border-border text-muted-foreground'
                                  }`}
                                >
                                  L{cell.level}
                                  {cell.is_mandatory && <span className="text-[10px] font-bold" title="Mandatory">*</span>}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="p-4 border-t border-primary/10 bg-card flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 h-4 rounded bg-primary/10 border border-primary/20" /> set for the role
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-6 h-4 rounded border border-dashed border-border" /> inherited from its framework
              </span>
              <span>* mandatory</span>
            </div>
            {/* ONE WRITER. Requirements are authored in Role Requirements, which
                writes jobrole_competency_map through the guarded endpoint. This
                grid reads the same table - it is the wide view, not a second
                way to change it. */}
            <Button variant="outline" onClick={() => setActiveTab('requirements')} className="gap-2">
              <ListChecks className="w-4 h-4" /> Edit in Role Requirements
            </Button>
          </div>
        </div>
      )}

      {/* ---- Task Competencies — which competency each task exercises ----
           Prop-less and self-contained, so it mounts here unchanged. The map
           carries NO level by design: the task says which competencies it
           exercises, the ROLE says at what level. A level here would be a third
           place a target could disagree. */}
      {activeTab === 'task-competencies' && (
        <div className="w-full flex-1 bg-card/90 border border-primary/10 rounded-2xl shadow-sm p-4 overflow-y-auto g2g-scrollbar">
          <TaskCompetenciesPanel />
        </div>
      )}

      {/* ---- Reconciliation — the framework/role broken links, as ROWS ----
           A count tells you something is wrong; a list tells you what to fix.
           Each row carries enough identity to act on without a second lookup. */}
      {activeTab === 'reconciliation' && (
        <div className="w-full flex-1 bg-card/90 border border-primary/10 rounded-2xl shadow-sm p-4 overflow-y-auto g2g-scrollbar">
          {reconciliationLoading ? (
            <div className="space-y-3 p-2">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
          ) : reconciliationError ? (
            <ErrorState title="Couldn't load reconciliation" description={reconciliationError} retry={loadReconciliation} className="m-6" />
          ) : reconciliationMeta?.clean ? (
            <EmptyState
              icon={<Check className="w-10 h-10" />}
              title="Frameworks and roles agree"
              description="Every framework competency is required by the role it applies to, every role requirement is backed by a framework, and no targets contradict each other."
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  ['Not applied', reconciliationMeta?.not_applied ?? 0, 'The framework expects it; the role does not require it'],
                  ['No framework', reconciliationMeta?.no_framework ?? 0, 'A role target no standard backs'],
                  ['Contradicts', reconciliationMeta?.contradicts ?? 0, 'Role target differs from the framework default'],
                  ['Orphan targets', reconciliationMeta?.orphan_targets ?? 0, 'Target rows the competency does not claim'],
                ] as [string, number, string][]).map(([label, count, hint]) => (
                  <div key={label} className="rounded-xl border border-border bg-background p-3" title={hint}>
                    <p className="text-2xl font-bold text-foreground">{count}</p>
                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {(reconciliation?.not_applied?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-2">Framework expects it, the role does not require it</h3>
                  <p className="text-xs text-muted-foreground mb-3">Gap analysis will never test for these, so the role looks compliant when it is not.</p>
                  <div className="flex flex-col gap-1.5">
                    {reconciliation!.not_applied.slice(0, 50).map((r, i) => (
                      <div key={`na-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                        <span className="text-sm text-foreground truncate">
                          <span className="font-semibold">{r.jobrole ?? `Role #${r.jobrole_id}`}</span>
                          <span className="text-muted-foreground"> needs </span>
                          <span className="font-semibold">{r.competency_name ?? `Competency #${r.competency_id}`}</span>
                        </span>
                        <StatusBadge variant="warning" label={r.framework_target ? `Framework L${r.framework_target}` : 'No target'} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(reconciliation?.contradicts?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-2">Role target contradicts its framework</h3>
                  <p className="text-xs text-muted-foreground mb-3">Legitimate as a deliberate override — but it should be a choice somebody made, not a divergence nobody noticed.</p>
                  <div className="flex flex-col gap-1.5">
                    {reconciliation!.contradicts.slice(0, 50).map((r, i) => (
                      <div key={`co-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                        <span className="text-sm text-foreground truncate">
                          <span className="font-semibold">{r.jobrole ?? `Role #${r.jobrole_id}`}</span>
                          <span className="text-muted-foreground"> · </span>
                          <span className="font-semibold">{r.competency_name ?? `Competency #${r.competency_id}`}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <StatusBadge variant="default" label={`Framework L${r.framework_target}`} size="sm" />
                          <StatusBadge variant="processing" label={`Role L${r.role_target}`} size="sm" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(reconciliation?.no_framework?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-2">Role requirement with no framework behind it</h3>
                  <p className="text-xs text-muted-foreground mb-3">A target nobody can trace to a standard. File the competency under a framework, or accept it as role-specific.</p>
                  <div className="flex flex-col gap-1.5">
                    {reconciliation!.no_framework.slice(0, 50).map((r, i) => (
                      <div key={`nf-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                        <span className="text-sm text-foreground truncate">
                          <span className="font-semibold">{r.jobrole ?? `Role #${r.jobrole_id}`}</span>
                          <span className="text-muted-foreground"> needs </span>
                          <span className="font-semibold">{r.competency_name ?? `Competency #${r.competency_id}`}</span>
                        </span>
                        <StatusBadge variant="processing" label={r.role_target ? `L${r.role_target}` : 'No level'} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(reconciliation?.orphan_targets?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-2">Target rows the competency does not claim</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    A competency belongs to exactly one framework — the one on the competency itself. These target rows name a different framework, so they are read but never applied.
                    Rows marked <span className="font-semibold text-destructive">missing</span> point at a competency that no longer exists at all, which is a different repair.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {reconciliation!.orphan_targets.slice(0, 50).map((r, i) => (
                      <div key={`ot-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                        <span className="text-sm text-foreground truncate">
                          <span className="font-semibold">{r.framework_name ?? `Framework #${r.framework_id}`}</span>
                          <span className="text-muted-foreground"> claims </span>
                          <span className="font-semibold">{r.competency_name ?? `Competency #${r.competency_id}`}</span>
                        </span>
                        {r.competency_missing ? (
                          <StatusBadge variant="error" label="Competency missing" size="sm" />
                        ) : (
                          <StatusBadge variant="warning" label={r.competency_filed_under ? `Filed under #${r.competency_filed_under}` : 'Filed under nothing'} size="sm" />
                        )}
                      </div>
                    ))}
                  </div>
                  {reconciliation!.orphan_targets.length > 50 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Showing 50 of {reconciliation!.orphan_targets.length}. The rest are the same shape.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                {/* Points at Role Requirements, not the Matrix: that is the tab
                    that writes `jobrole_competency_map`, which is what a gap or a
                    9-box position is actually calculated from. */}
                <Button variant="ghost" onClick={() => setActiveTab(MATRIX_IS_READ_ONLY ? 'requirements' : 'matrix')} className="justify-start gap-3 p-2 text-sm font-medium text-foreground"><MapIcon className="w-4 h-4 text-primary" /> Map to Role</Button>
                {!MATRIX_IS_READ_ONLY && (
                  <Button variant="ghost" onClick={() => { setActiveTab('matrix'); setBulkForm({ role: effectiveRoles[0] ?? '', level: '' }); setBulkDialog(true) }} className="justify-start gap-3 p-2 text-sm font-medium text-foreground"><Copy className="w-4 h-4 text-primary" /> Bulk Update Levels</Button>
                )}
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

            {/* JOB ROLE — the field this dialog never had.
                `s_competency_frameworks.jobrole` was populated by imports and
                legacy data but was not editable here, so a framework created in
                the product could not be scoped to a role at all. The option
                VALUE is the id, and the name is sent beside it only as a label. */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                Job Role <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Select
                value={fwForm.jobrole_id != null ? String(fwForm.jobrole_id) : ''}
                onChange={value => {
                  const id = value === '' ? null : Number(value)
                  setFwForm(p => ({
                    ...p,
                    jobrole_id: id,
                    jobrole: id === null ? '' : (roleOptions.find(r => r.id === id)?.jobrole ?? ''),
                  }))
                }}
                options={[
                  { label: 'Not role-specific', value: '' },
                  ...roleOptions.map(r => ({
                    label: r.department ? `${r.department} — ${r.jobrole}` : r.jobrole,
                    value: String(r.id),
                  })),
                ]}
                placeholder={roleOptions.length ? 'Select a job role' : 'No job roles yet'}
                className="bg-background border-border h-9"
                aria-label="Framework job role"
              />
              {/* The 2 frameworks whose name matched more than one role were left
                  unkeyed by the backfill rather than guessed. This is where that
                  gets corrected, and it says so instead of looking like a blank. */}
              {fwForm.jobrole_id == null && (fwForm.jobrole ?? '') !== '' && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Currently stored as the name &ldquo;{fwForm.jobrole}&rdquo;, which matches more than one role —
                  pick the intended one above to link it properly.
                </p>
              )}
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
            <p className="text-xs text-muted-foreground">Sets the required level for every competency shown in the matrix, for the chosen role.</p>
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
