'use client'

import * as React from 'react'
import { Clock, MoonStar, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import { Switch } from '@/components/ui/switch'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { shiftService, type Shift, type ShiftInput } from '@/services/organization/shifts'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#475569']

type FormState = {
  name: string
  code: string
  start_time: string
  end_time: string
  break_minutes: string
  grace_minutes: string
  color: string
  description: string
  active: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  code: '',
  start_time: '09:00',
  end_time: '18:00',
  break_minutes: '60',
  grace_minutes: '0',
  color: COLORS[0],
  description: '',
  active: true,
}

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Paid length of the shift: end minus start (over midnight if need be), minus the break. */
function workedMinutes(start: string, end: string, breakMinutes: number) {
  let span = toMinutes(end) - toMinutes(start)
  if (span <= 0) span += 24 * 60
  return Math.max(span - breakMinutes, 0)
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/**
 * Shift Master: HR adds, edits and deletes the organisation's named shifts.
 * Which shift an employee is on is set on their profile (Personal Details).
 */
export function ShiftMaster() {
  const context = React.useMemo(() => getLaravelContext(), [])

  const [shifts, setShifts] = React.useState<Shift[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const [editing, setEditing] = React.useState<Shift | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState('')

  const [deleting, setDeleting] = React.useState<Shift | null>(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await shiftService.list(context)
      setShifts(response?.data ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load shifts.')
      setShifts([])
    } finally {
      setLoading(false)
    }
  }, [context])

  React.useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setDialogOpen(true)
  }

  function openEdit(shift: Shift) {
    setEditing(shift)
    setForm({
      name: shift.name,
      code: shift.code ?? '',
      start_time: shift.start_time,
      end_time: shift.end_time,
      break_minutes: String(shift.break_minutes ?? 0),
      grace_minutes: String(shift.grace_minutes ?? 0),
      color: shift.color || COLORS[0],
      description: shift.description ?? '',
      active: Number(shift.status) === 1,
    })
    setFormError('')
    setDialogOpen(true)
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')

    if (!form.name.trim()) return setFormError('Give the shift a name.')
    if (!form.start_time || !form.end_time) return setFormError('Set both a start and an end time.')

    const breakMinutes = Number(form.break_minutes || 0)
    const graceMinutes = Number(form.grace_minutes || 0)
    if (workedMinutes(form.start_time, form.end_time, 0) <= breakMinutes) {
      return setFormError('The break has to be shorter than the shift.')
    }

    const payload: ShiftInput = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      start_time: form.start_time,
      end_time: form.end_time,
      break_minutes: breakMinutes,
      grace_minutes: graceMinutes,
      color: form.color,
      description: form.description.trim() || undefined,
      status: form.active ? 1 : 0,
    }

    setSaving(true)
    try {
      const response = editing
        ? await shiftService.update(context, editing.id, payload)
        : await shiftService.create(context, payload)
      setDialogOpen(false)
      await load()
      setNotice(response?.message || 'Saved.')
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save the shift.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      const response = await shiftService.remove(context, deleting.id)
      setDeleting(null)
      await load()
      setNotice(response?.message || 'Shift deleted.')
    } catch (cause) {
      // E.g. "3 employees are on this shift..." - shown, and the dialog closes
      // so the message is not hidden behind it.
      setDeleting(null)
      setNotice(cause instanceof Error ? cause.message : 'Could not delete the shift.')
    } finally {
      setDeleteBusy(false)
    }
  }

  const columns: Column<Shift>[] = [
    {
      id: 'name',
      header: 'Shift',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: row.color || COLORS[0] }} />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{row.name}</span>
            {row.code && <span className="text-xs text-muted-foreground">{row.code}</span>}
          </div>
        </div>
      ),
    },
    {
      id: 'start_time',
      header: 'Timing',
      render: (_, row) => (
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="size-4 text-muted-foreground" />
          {row.start_time} – {row.end_time}
          {Boolean(row.is_overnight) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              <MoonStar className="size-3" /> Overnight
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'break_minutes',
      header: 'Working Hours',
      render: (_, row) => (
        <div className="flex flex-col text-sm">
          <span className="font-medium">{formatDuration(workedMinutes(row.start_time, row.end_time, row.break_minutes))}</span>
          <span className="text-xs text-muted-foreground">
            {row.break_minutes ? `${row.break_minutes} min break` : 'No break'}
            {row.grace_minutes ? ` · ${row.grace_minutes} min grace` : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'employee_count',
      header: 'Employees',
      render: (_, row) => <span className="text-sm font-medium">{row.employee_count ?? 0}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => {
        const active = Number(row.status) === 1
        return <StatusBadge status={active ? 'Active' : 'Inactive'} variant={active ? 'active' : 'inactive'} />
      },
    },
    {
      id: 'id',
      header: 'Action',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`} className="cursor-pointer">
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleting(row)}
            aria-label={`Delete ${row.name}`}
            className="cursor-pointer text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  const preview = workedMinutes(form.start_time || '00:00', form.end_time || '00:00', Number(form.break_minutes || 0))
  const previewOvernight = !!form.start_time && !!form.end_time && form.end_time <= form.start_time

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 ease-out">
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border/50 bg-card/50 p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Shift Master</h2>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Loading...' : `${shifts.length} shift${shifts.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} className="cursor-pointer">
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} /> Refresh
          </Button>
          <Button size="sm" onClick={openCreate} className="cursor-pointer rounded-md px-5 shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add Shift
          </Button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div>
      )}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      <Card className="rounded-2xl border-border/50 bg-card/50 shadow-xs">
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={shifts}
            isLoading={loading}
            getRowId={(row) => String(row.id)}
            emptyState={
              error ? null : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <p>No shifts yet. Add the shifts your organisation runs, e.g. General 09:00 – 18:00.</p>
                  <Button size="sm" className="mt-3" onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add the first shift
                  </Button>
                </div>
              )
            }
            className="overflow-visible rounded-none border-0 [&_th]:bg-transparent [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_td]:py-4"
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
            <DialogDescription>
              Employees are put on a shift from their profile. An end time earlier than the start runs past midnight.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <Label>Shift Name</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. General Shift" maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. GS" maxLength={20} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Break (minutes)</Label>
                <Input type="number" min={0} max={600} value={form.break_minutes} onChange={(e) => set('break_minutes', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Grace for late arrival (minutes)</Label>
                <Input type="number" min={0} max={240} value={form.grace_minutes} onChange={(e) => set('grace_minutes', e.target.value)} />
              </div>
            </div>

            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {formatDuration(preview)} of working time{previewOvernight ? ' · runs past midnight' : ''}
            </p>

            <div className="space-y-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => set('color', color)}
                    aria-label={`Colour ${color}`}
                    aria-pressed={form.color === color}
                    className={cn(
                      'size-7 cursor-pointer rounded-full border-2 transition-transform hover:scale-110',
                      form.color === color ? 'border-foreground' : 'border-transparent',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional" maxLength={1000} />
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <Switch checked={form.active} onChange={(e) => set('active', e.target.checked)} />
              <span>
                Active
                <span className="block text-xs text-muted-foreground">
                  Inactive shifts cannot be given to anyone new; people already on it keep it.
                </span>
              </span>
            </label>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Shift'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && !deleteBusy && setDeleting(null)}
        title={`Delete "${deleting?.name ?? ''}"?`}
        description={
          deleting && (deleting.employee_count ?? 0) > 0
            ? `${deleting.employee_count} employee${deleting.employee_count === 1 ? ' is' : 's are'} on this shift, so it cannot be deleted. Move them to another shift first, or set it to Inactive.`
            : 'This removes the shift from the list. It cannot be undone.'
        }
        confirmLabel="Delete"
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
