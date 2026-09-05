'use client'

/**
 * The hiring team roster — Talent → Administration → Permissions.
 *
 * That tab rendered "Module Under Construction" until now, alongside four others
 * that still do. This one is real: `talent_team_members` had 0 rows and no code
 * path anywhere, and audit F-59 had it down for deletion. It is kept instead,
 * tenant-scoped, and this is the screen that makes it worth keeping.
 *
 * The roster is not decoration. `department_id` on these rows is already read by
 * the department merge/delete engine, so a member counted here shows up as
 * "N team members" in the confirmation dialog when somebody tries to delete
 * their department.
 */

import React from 'react'
import { Plus, Search, Users, UserPlus, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  hiringTeamService,
  HIRING_TEAM_ROLES,
  type HiringTeamMember,
  type HiringTeamResponse,
  type HiringTeamRole,
} from '@/services/talent/hiring-team'

/** Each role reads differently at a glance, and consistently with the rest of Talent. */
function roleVariant(role: HiringTeamRole) {
  switch (role) {
    case 'HR Manager':
      return 'processing' as const
    case 'Recruiter':
      return 'active' as const
    default:
      return 'default' as const
  }
}

const EMPTY: HiringTeamResponse = {
  members: [],
  summary: { total: 0, active: 0, by_role: { 'HR Manager': 0, Recruiter: 0, Interviewer: 0 } },
  roles: [...HIRING_TEAM_ROLES],
  assignable: [],
  departments: [],
}

export function HiringTeamPanel() {
  const [data, setData] = React.useState<HiringTeamResponse>(EMPTY)
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [search, setSearch] = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState('all')

  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [pendingId, setPendingId] = React.useState<number | null>(null)

  const [reloadToken, setReloadToken] = React.useState(0)

  /*
   * The fetch lives in the effect and every setState happens after an await, so
   * nothing is set synchronously while the effect body runs - that is what
   * react-hooks/set-state-in-effect objects to, and it is a real cascade, not a
   * lint nicety. Refreshing after a change bumps the token from an event
   * handler, where setting state immediately is fine.
   */
  React.useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const next = await hiringTeamService.list()
        if (cancelled) return
        setData(next)
        setLoadError(null)
      } catch (error) {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : 'The hiring team could not be loaded.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const refresh = React.useCallback(() => {
    setIsLoading(true)
    setReloadToken((token) => token + 1)
  }, [])

  // Filtering client-side: the roster is a team, not a dataset, and a round trip
  // per keystroke would be slower than the list is long.
  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    return data.members.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false
      if (!term) return true
      return (
        m.name.toLowerCase().includes(term) ||
        (m.department ?? '').toLowerCase().includes(term) ||
        (m.employee_no ?? '').toLowerCase().includes(term)
      )
    })
  }, [data.members, roleFilter, search])

  const toggleActive = async (member: HiringTeamMember) => {
    setPendingId(member.id)
    try {
      await hiringTeamService.update(member.id, { active: !member.active })
      refresh()
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'That change could not be saved.')
    } finally {
      setPendingId(null)
    }
  }

  const remove = async (member: HiringTeamMember) => {
    setPendingId(member.id)
    try {
      await hiringTeamService.remove(member.id)
      refresh()
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'That person could not be removed.')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="@container/roster flex flex-col gap-6 max-w-[1400px]">
      {/* Role counts. Every role shows even at zero, so the header keeps its
          shape as people are added and removed. */}
      <div className="grid grid-cols-1 gap-4 @2xl/roster:grid-cols-4">
        <Card className="p-4 shadow-sm border-border/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">On the team</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground tabular-nums">{data.summary.total}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{data.summary.active} active</span>
          </div>
        </Card>
        {HIRING_TEAM_ROLES.map((role) => (
          <Card key={role} className="p-4 shadow-sm border-border/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{role}</span>
            <div className="mt-1 text-2xl font-bold text-foreground tabular-nums">
              {data.summary.by_role[role] ?? 0}
            </div>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm overflow-hidden border-border/60">
        <div className="p-4 border-b border-border flex flex-col gap-3 bg-surface @2xl/roster:flex-row @2xl/roster:items-center @2xl/roster:justify-between">
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-foreground">Hiring Team</h2>
            <p className="text-xs text-muted-foreground">
              Who in this institute recruits, screens and interviews.
            </p>
          </div>
          <div className="flex flex-col gap-2 @lg/roster:flex-row @lg/roster:items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, department or ID"
                className="h-9 w-full pl-8 text-xs @lg/roster:w-64"
                aria-label="Search the hiring team"
              />
            </div>
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              size="sm"
              aria-label="Filter by role"
              options={[
                { label: 'All roles', value: 'all' },
                ...HIRING_TEAM_ROLES.map((r) => ({ label: r, value: r })),
              ]}
            />
            <Button size="sm" className="h-9 gap-1.5" onClick={() => setIsAddOpen(true)}>
              <Plus className="size-4" />
              Add member
            </Button>
          </div>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{loadError}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : data.members.length === 0 ? (
          /* Honest empty state: the roster is empty, which is different from the
             module being unbuilt — which is what this tab used to claim. */
          <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
            <div className="rounded-full bg-muted/50 p-4">
              <Users className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No one on the hiring team yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add the people who run recruitment here. Their department also appears
              when somebody tries to delete or merge it.
            </p>
            <Button size="sm" className="mt-1 gap-1.5" onClick={() => setIsAddOpen(true)}>
              <UserPlus className="size-4" />
              Add the first member
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-8 py-14 text-center">
            <p className="text-sm text-muted-foreground">
              No one matches that filter. {data.members.length} {data.members.length === 1 ? 'person is' : 'people are'} on the team.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-border bg-surface hover:bg-surface">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Member</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Role</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Department</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((member) => (
                  <TableRow key={member.id} className="border-b-border/40">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-bold text-muted-foreground">
                          {member.initials}
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-semibold text-foreground">{member.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {member.employee_no ?? member.email ?? '—'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <StatusBadge variant={roleVariant(member.role)} className="text-[10px]">
                        {member.role}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-foreground">{member.department ?? '—'}</TableCell>
                    <TableCell className="py-3">
                      <StatusBadge variant={member.active ? 'active' : 'inactive'} className="text-[10px]">
                        {member.active ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={pendingId === member.id}
                          onClick={() => void toggleActive(member)}
                        >
                          {member.active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive"
                          title={`Remove ${member.name} from the hiring team`}
                          disabled={pendingId === member.id}
                          onClick={() => void remove(member)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Keyed on open, so the form starts empty every time it is opened. That
          is React's own way of resetting state - an effect that clears the
          fields on open sets state synchronously and cascades a render. */}
      <AddMemberDialog
        key={isAddOpen ? 'open' : 'closed'}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        data={data}
        onAdded={() => {
          setIsAddOpen(false)
          refresh()
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function AddMemberDialog({
  open,
  onOpenChange,
  data,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: HiringTeamResponse
  onAdded: () => void
}) {
  const [userId, setUserId] = React.useState('')
  const [role, setRole] = React.useState<HiringTeamRole>('Recruiter')
  const [departmentId, setDepartmentId] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  // Picking a person defaults the department to theirs — the common case, still
  // editable for somebody who recruits for a department other than their own.
  const onPickUser = (value: string) => {
    setUserId(value)
    const picked = data.assignable.find((a) => String(a.id) === value)
    if (picked?.department_id) setDepartmentId(String(picked.department_id))
  }

  const submit = async () => {
    if (!userId) {
      setError('Choose which employee to add.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await hiringTeamService.add({
        user_id: Number(userId),
        role,
        department_id: departmentId ? Number(departmentId) : null,
      })
      onAdded()
    } catch (err) {
      // Inside the dialog, above the fields — a validation failure belongs where
      // the fields that caused it are, not in a toast that outlives the form.
      setError(err instanceof Error ? err.message : 'That person could not be added.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to the hiring team</DialogTitle>
          <DialogDescription>
            Anyone already on the team is left out of this list.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ht-user" className="text-xs font-semibold text-foreground">Employee</label>
            <Select
              id="ht-user"
              value={userId}
              onChange={onPickUser}
              placeholder={data.assignable.length ? 'Select an employee' : 'Everyone is already on the team'}
              disabled={data.assignable.length === 0}
              options={data.assignable.map((a) => ({
                label: a.employee_no ? `${a.name} (${a.employee_no})` : a.name,
                value: String(a.id),
              }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ht-role" className="text-xs font-semibold text-foreground">Role</label>
            <Select
              id="ht-role"
              value={role}
              onChange={(value) => setRole(value as HiringTeamRole)}
              options={HIRING_TEAM_ROLES.map((r) => ({ label: r, value: r }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="ht-dept" className="text-xs font-semibold text-foreground">
              Department <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Select
              id="ht-dept"
              value={departmentId}
              onChange={setDepartmentId}
              placeholder="No department"
              options={data.departments.map((d) => ({ label: d.name, value: String(d.id) }))}
            />
            <p className="text-[11px] text-muted-foreground">
              Also shown when this department is deleted or merged.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={isSaving || !userId} className="gap-1.5">
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Add member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
