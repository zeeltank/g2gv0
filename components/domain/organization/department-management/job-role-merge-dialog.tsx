'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Briefcase, Search, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService, type DepartmentJobRole, type JobRoleMergeImpact } from '@/services/organization'

/**
 * Merging one job role into another.
 *
 * ONE DEPARTMENT AT A TIME, ALWAYS. `roles` is the list this department already
 * shows, so a cross-department merge is not something the user can express
 * here. That is not the safeguard though - the server enforces it too, because
 * a role's name is not unique to a department (90 role names on live exist in
 * more than one) and merging across one would rewrite rows that afterwards no
 * department could claim.
 *
 * WHY THIS SHOWS MORE THAN A ROW COUNT. A department merge preview only has to
 * answer "how much moves". A job role merge also DECIDES things: when both
 * roles require the same competency at different levels the survivor keeps the
 * higher one, and when both hold the same task or skill the duplicate is
 * folded. Those are the parts someone would want to stop, so they are on screen
 * before the button, not in the result message afterwards.
 */

type Mode = 'existing' | 'new'
type ImpactState = 'idle' | 'loading' | 'error'

export function JobRoleMergeDialog({
  role,
  roles,
  departmentName,
  context,
  isSaving,
  onCancel,
  onMerge,
}: {
  /** The role being retired, or null when the dialog is closed. */
  role: DepartmentJobRole | null
  /** Every role in THIS department - the only legal targets. */
  roles: DepartmentJobRole[]
  departmentName: string
  context: LaravelContext
  isSaving: boolean
  onCancel: () => void
  onMerge: (payload: { targetJobRoleId?: string; newJobRoleName?: string; sourceJobRoleIds?: string[] }) => void
}) {
  const [mode, setMode] = useState<Mode>('existing')
  const [target, setTarget] = useState('')
  const [newName, setNewName] = useState('')
  const [extraSources, setExtraSources] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [impact, setImpact] = useState<JobRoleMergeImpact | null>(null)
  const [impactState, setImpactState] = useState<ImpactState>('idle')

  const isOpen = Boolean(role)

  useEffect(() => {
    if (!isOpen) {
      setMode('existing'); setTarget(''); setNewName(''); setExtraSources([])
      setSearch(''); setImpact(null); setImpactState('idle')
    }
  }, [isOpen])

  /*
   * The preview is fetched per TARGET, because the answer depends on it: the
   * level raises and the duplicate folds are both properties of the pair, not
   * of the role being retired.
   */
  useEffect(() => {
    if (!role || !target) { setImpact(null); setImpactState('idle'); return }
    let active = true
    setImpactState('loading')
    organizationService
      .getJobRoleMergeImpact(context, String(role.id), target)
      .then((response) => {
        if (!active) return
        if (response?.data) { setImpact(response.data); setImpactState('idle') }
        else { setImpact(null); setImpactState('error') }
      })
      .catch(() => { if (active) { setImpact(null); setImpactState('error') } })
    return () => { active = false }
  }, [role, target, context])

  const candidates = useMemo(() => {
    if (!role) return []
    const query = search.trim().toLowerCase()
    return roles
      .filter((item) => item.id !== role.id)
      .filter((item) => !query || item.jobrole?.toLowerCase().includes(query))
      .sort((a, b) => (a.jobrole ?? '').localeCompare(b.jobrole ?? ''))
  }, [roles, role, search])

  const targetRole = roles.find((item) => String(item.id) === target)

  const canConfirm = mode === 'existing'
    ? Boolean(target) && impactState !== 'loading'
    : newName.trim().length > 0 && extraSources.length > 0

  function confirm() {
    if (!role) return
    if (mode === 'existing') { onMerge({ targetJobRoleId: target }); return }
    onMerge({ newJobRoleName: newName.trim(), sourceJobRoleIds: extraSources })
  }

  if (!role) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="size-4" aria-hidden="true" />
            Merge &ldquo;{role.jobrole}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Everything on this role — its employees, tasks, skills, competency requirements and
            plans — moves to the role you choose. Only roles in <strong>{departmentName}</strong> can
            be chosen; job roles never merge across departments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <ModeCard
              active={mode === 'existing'}
              title="Into an existing role"
              detail="One of this department's roles survives and keeps its name."
              onSelect={() => setMode('existing')}
            />
            <ModeCard
              active={mode === 'new'}
              title="Into a new role"
              detail="Name a new role. Every role you pick is merged into it and then retired."
              onSelect={() => setMode('new')}
            />
          </div>

          {mode === 'new' && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">New role name</span>
                <Input value={newName} onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. Full Stack Engineer" className="h-9" />
              </label>
              <div>
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Also merge in ({extraSources.length} selected)
                </span>
                <p className="mb-2 text-xs text-muted-foreground">
                  &ldquo;{role.jobrole}&rdquo; is always included. Pick at least one more.
                </p>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                  {candidates.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm last:border-b-0">
                      <input
                        type="checkbox"
                        checked={extraSources.includes(String(item.id))}
                        onChange={(event) => setExtraSources((current) => event.target.checked
                          ? [...current, String(item.id)]
                          : current.filter((value) => value !== String(item.id)))}
                      />
                      {item.jobrole}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === 'existing' && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search roles in ${departmentName}...`} className="h-9 pl-9" />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                {candidates.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">
                    {departmentName} has no other job role to merge into.
                  </p>
                )}
                {candidates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTarget(String(item.id))}
                    className={cn(
                      'flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted',
                      target === String(item.id) && 'bg-primary/10 text-primary',
                    )}
                  >
                    <span className="truncate">{item.jobrole}</span>
                    {item.jobrole_category && (
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{item.jobrole_category}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'existing' && target && (
            <div className="rounded-md border border-border p-3 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <span className="truncate">{role.jobrole}</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{targetRole?.jobrole}</span>
              </div>

              {impactState === 'loading' && <p className="text-muted-foreground">Checking what will move…</p>}

              {/* A failed fetch must never render as a confident zero. */}
              {impactState === 'error' && (
                <p className="flex items-start gap-2 text-warning">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  The preview could not be loaded. This is a connection problem, not a count of zero —
                  merging without it means merging blind.
                </p>
              )}

              {impactState === 'idle' && impact && (
                <div className="space-y-2 text-muted-foreground">
                  <p>
                    <strong className="text-foreground">{impact.total}</strong> record(s) move.
                    {impact.breakdown.length > 0 && (
                      <> {impact.breakdown.map((row) => `${row.count} ${row.label}`).join(', ')}.</>
                    )}
                  </p>

                  {(impact.duplicates.tasks > 0 || impact.duplicates.skills > 0) && (
                    <p>
                      {impact.duplicates.tasks} task(s) and {impact.duplicates.skills} skill(s) are
                      identical on both roles and will be folded into one. Anything that differs is kept.
                    </p>
                  )}

                  {/* The merge DECIDES this. It belongs before the button. */}
                  {impact.level_raises.length > 0 && (
                    <div className="rounded border border-warning/40 bg-warning/5 p-2">
                      <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                        <TrendingUp className="size-3.5" aria-hidden="true" />
                        {impact.level_raises.length} requirement(s) will be raised
                      </p>
                      <ul className="space-y-0.5 text-xs">
                        {impact.level_raises.slice(0, 6).map((raise, index) => (
                          <li key={`${raise.kind}-${raise.name}-${index}`}>
                            {raise.name}: {String(raise.from ?? '—')} → <strong>{String(raise.to ?? '—')}</strong>
                          </li>
                        ))}
                        {impact.level_raises.length > 6 && <li>…and {impact.level_raises.length - 6} more.</li>}
                      </ul>
                      <p className="mt-1 text-xs">
                        The merged role does both jobs, so it keeps the stricter requirement.
                      </p>
                    </div>
                  )}

                  {/* Rows nobody can safely attribute. Said plainly. */}
                  {impact.ambiguous.length > 0 && (
                    <div className="rounded border border-warning/40 bg-warning/5 p-2 text-xs">
                      <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        Some rows will be left as they are
                      </p>
                      <p>
                        &ldquo;{role.jobrole}&rdquo; is also the name of a role in another department, and these
                        rows record only the name. They cannot be told apart, so they are left alone
                        rather than guessed at:
                      </p>
                      <ul className="mt-1">
                        {impact.ambiguous.map((row) => (
                          <li key={row.table}>{row.count} {row.table}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            The retired role is deactivated, not destroyed, and the whole merge is one step — it
            either completes or nothing changes. It cannot be undone automatically.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
          <Button type="button" onClick={confirm} disabled={!canConfirm || isSaving}>
            {isSaving
              ? 'Merging…'
              : mode === 'new'
                ? `Merge ${extraSources.length + 1} roles into a new role`
                : targetRole ? `Merge into ${targetRole.jobrole}` : 'Choose a role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeCard({ active, title, detail, onSelect }: {
  active: boolean; title: string; detail: string; onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-md border border-border p-3 text-left transition',
        active ? 'border-primary bg-primary/5' : 'hover:bg-muted',
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </button>
  )
}
