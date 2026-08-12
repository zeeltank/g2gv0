'use client'

/**
 * ROLE REQUIREMENTS — the screen that fills `jobrole_competency_map`.
 *
 * THE PROBLEM THIS EXISTS TO FIX
 *
 * Every gap, every 9-box position and every recommendation resolves against
 * `jobrole_competency_map`. It held 23 rows across the whole platform, because
 * the only writer — `POST /competency/role-map` — was reachable from the
 * Command Center quick-create menu and from nowhere else. Neither the Framework
 * screen nor the role/skill matrix could write it, so a person setting up a
 * framework produced nothing the gap engine could read.
 *
 * NO NEW WRITER. This panel calls the existing guarded endpoint.
 *
 * WHY THIS IS NOT WIRED INTO THE MATRIX
 *
 * The matrix cannot reach this table. Its rows are `s_users_skills` ids (the
 * 5,171-row flat skill library) and its columns are job role NAMES, not ids —
 * `Matrix.roles` is `string[]`. `jobrole_competency_map` needs a `jobrole_id`
 * and a `competency.id` (209 rows, the KASBA model proper). There is no
 * skill→competency resolution in the product, so wiring the matrix would mean
 * inventing one and guessing which of two populations a row belongs to.
 * The matrix keeps writing `s_user_skill_jobrole`; this panel writes the map.
 *
 * SYNC, NOT APPEND. The endpoint deletes rows absent from the payload, so this
 * panel always sends the role's complete list and reports the removal count
 * back — a silent deletion is worse than none.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import {
  roleRequirementsService,
  type RoleRequirement,
  type RoleRequirementInput,
} from '@/services/competency/role-requirements'
import { competencyDefinitionsService } from '@/services/competency/definitions'
import { competencyLibrariesService } from '@/services/competency'

/** A row being edited. `id` is null until it has been saved once. */
interface DraftRow {
  id: number | null
  competency_id: number
  competency_name: string
  required_proficiency: number
  is_mandatory: boolean
}

const LEVELS = [1, 2, 3, 4, 5]

export function RoleRequirementsPanel() {
  const { user } = useAuth()

  const [roles, setRoles] = useState<{ id: number; jobrole: string; department: string }[]>([])
  const [competencies, setCompetencies] = useState<{ id: number; name: string }[]>([])
  const [roleId, setRoleId] = useState<number | null>(null)

  const [rows, setRows] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [addId, setAddId] = useState<string>('')

  /* -- Sources. Roles carry ids; competencies come from the `competency`
        table, never from the flat skill library. ------------------------- */
  useEffect(() => {
    const ctx = getLaravelContext(user)
    if (!isLaravelContextReady(ctx)) return

    competencyLibrariesService.meta(ctx).then((res) => {
      const byDept = res?.data?.jobroles_by_department ?? {}
      const flat: { id: number; jobrole: string; department: string }[] = []
      for (const [department, list] of Object.entries(byDept)) {
        for (const r of list) flat.push({ id: r.id, jobrole: r.jobrole, department })
      }
      flat.sort((a, b) => a.department.localeCompare(b.department) || a.jobrole.localeCompare(b.jobrole))
      setRoles(flat)
    }).catch(() => setRoles([]))

    competencyDefinitionsService.list(ctx).then((res) => {
      setCompetencies((res?.data ?? []).map((c) => ({ id: c.id, name: c.name })))
    }).catch(() => setCompetencies([]))
  }, [user])

  /* -- Load one role's current list -------------------------------------- */
  const load = useCallback(async (id: number) => {
    const ctx = getLaravelContext(user)
    if (!isLaravelContextReady(ctx)) return
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const res = await roleRequirementsService.list(ctx, id)
      setRows((res?.data ?? []).map((r: RoleRequirement) => ({
        id: r.id,
        competency_id: r.competency_id,
        competency_name: r.competency_name,
        required_proficiency: r.required_proficiency,
        is_mandatory: r.is_mandatory,
      })))
    } catch {
      setError('Could not load this role’s requirements.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { if (roleId !== null) load(roleId) }, [roleId, load])

  /* -- Competencies not already on this role ----------------------------- */
  const available = useMemo(() => {
    const used = new Set(rows.map((r) => r.competency_id))
    return competencies.filter((c) => !used.has(c.id))
  }, [competencies, rows])

  const addRow = () => {
    const id = Number(addId)
    const comp = competencies.find((c) => c.id === id)
    if (!comp) return
    setRows((p) => [...p, { id: null, competency_id: comp.id, competency_name: comp.name, required_proficiency: 3, is_mandatory: false }])
    setAddId('')
    setNotice(null)
  }

  const save = async () => {
    const ctx = getLaravelContext(user)
    if (roleId === null || !isLaravelContextReady(ctx)) return
    // The server refuses an empty list (min:1). Clearing a role entirely is a
    // per-row delete, not a save — so this is stopped here with a reason
    // rather than sent to collect a 422.
    if (rows.length === 0) {
      setError('A role needs at least one requirement. Remove rows individually to clear it.')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const items: RoleRequirementInput[] = rows.map((r) => ({
        competency_id: r.competency_id,
        required_proficiency: r.required_proficiency,
        is_mandatory: r.is_mandatory,
      }))
      const res = await roleRequirementsService.save(ctx, roleId, items)
      // `removed` is reported, never swallowed: this endpoint SYNCS, and a user
      // who dropped a row should be told the row is gone.
      const written = res.data?.written ?? 0
      const removed = res.data?.removed ?? 0
      setNotice(
        removed > 0
          ? `${written} requirement(s) saved. ${removed} removed from this role.`
          : `${written} requirement(s) saved.`,
      )
      await load(roleId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const selectedRole = roles.find((r) => r.id === roleId)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What a role requires</p>
            <p className="mt-1">
              Gap analysis, 9-box placement and learning recommendations all read this list.
              A role with nothing here produces no gaps for anyone holding it.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px]">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Job role</label>
          <Select
            value={roleId === null ? '' : String(roleId)}
            placeholder="Select a job role…"
            onChange={(v) => setRoleId(v ? Number(v) : null)}
            options={roles.map((r) => ({
              value: String(r.id),
              label: r.department ? `${r.department} — ${r.jobrole}` : r.jobrole,
            }))}
          />
        </div>

        {roleId !== null && (
          <>
            <div className="min-w-[260px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Add a competency</label>
              <Select
                value={addId}
                onChange={setAddId}
                disabled={available.length === 0}
                placeholder={available.length === 0 ? 'No competencies left to add' : 'Select a competency…'}
                options={available.map((c) => ({ value: String(c.id), label: c.name }))}
              />
            </div>
            <Button variant="outline" onClick={addRow} disabled={!addId} className="gap-2">
              <Plus className="w-4 h-4" /> Add
            </Button>
            <Button onClick={save} disabled={saving || loading} className="gap-2 ml-auto">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save requirements
            </Button>
          </>
        )}
      </div>

      {competencies.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No competencies are defined in this organisation yet, so there is nothing to require.
        </p>
      )}

      {error && <p className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</p>}
      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-500">{notice}</p>}

      {roleId === null ? (
        <EmptyState title="Select a job role" description="Pick a role to see and edit what it requires." />
      ) : loading ? (
        <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No requirements yet"
          description={`Nothing is required for ${selectedRole?.jobrole ?? 'this role'}, so nobody holding it will show a gap. Add a competency above.`}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left font-medium px-4 py-2">Competency</th>
                <th className="text-left font-medium px-4 py-2 w-44">Required level</th>
                <th className="text-left font-medium px-4 py-2 w-32">Mandatory</th>
                <th className="w-16 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.competency_id} className="border-t border-border">
                  <td className="px-4 py-2">{r.competency_name}</td>
                  <td className="px-4 py-2">
                    <Select
                      aria-label={`Required level for ${r.competency_name}`}
                      value={String(r.required_proficiency)}
                      onChange={(v) => setRows((p) => p.map((x, j) => j === i ? { ...x, required_proficiency: Number(v) } : x))}
                      options={LEVELS.map((l) => ({ value: String(l), label: `Level ${l}` }))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={r.is_mandatory}
                      onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, is_mandatory: e.target.checked } : x))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                      aria-label={`Remove ${r.competency_name}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
            Saving replaces this role’s whole list. Rows you remove here are deleted when you save.
          </p>
        </div>
      )}
    </div>
  )
}
