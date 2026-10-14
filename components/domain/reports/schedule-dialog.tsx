'use client'

/**
 * Scheduled/emailed report runs (Docs/reports-engine/PLAN.md, Phase 4) — an
 * admin-configured list of "send this report's CSV to these addresses on
 * this schedule" rows against one saved report. The actual sending happens
 * server-side (`reports:send-scheduled`, every 15 minutes); this dialog is
 * pure CRUD over `report_schedules`.
 */

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { reportBuilderService, type ReportSchedule, type ReportScheduleFrequency } from '@/services/reports'

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const DAY_OF_WEEK_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  .map((label, value) => ({ value: String(value), label }))

function describeSchedule(s: ReportSchedule): string {
  const time = s.time_of_day
  if (s.frequency === 'daily') return `Daily at ${time}`
  if (s.frequency === 'weekly') return `Weekly on ${DAY_OF_WEEK_OPTIONS[s.day_of_week ?? 0]?.label ?? '—'} at ${time}`
  return `Monthly on day ${s.day_of_month ?? '—'} at ${time}`
}

export function ScheduleDialog({ reportId, onClose }: { reportId: number; onClose: () => void }) {
  const context = getLaravelContext()

  const [schedules, setSchedules] = useState<ReportSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [adding, setAdding] = useState(false)
  const [frequency, setFrequency] = useState<ReportScheduleFrequency>('daily')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [timeOfDay, setTimeOfDay] = useState('07:00')
  const [recipients, setRecipients] = useState('')

  async function load() {
    if (!isLaravelContextReady(context)) {
      setError('Your ERP session is unavailable. Please sign in again.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await reportBuilderService.listSchedules(context, reportId)
      setSchedules(response.data.schedules)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load schedules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId])

  async function createSchedule() {
    const recipientList = recipients.split(/[,\n]/).map((r) => r.trim()).filter(Boolean)

    if (recipientList.length === 0) {
      setError('Add at least one recipient email address.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await reportBuilderService.createSchedule(context, reportId, {
        frequency,
        day_of_week: frequency === 'weekly' ? Number(dayOfWeek) : null,
        day_of_month: frequency === 'monthly' ? Number(dayOfMonth) : null,
        time_of_day: timeOfDay,
        recipients: recipientList,
      })
      setAdding(false)
      setRecipients('')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This schedule could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(schedule: ReportSchedule) {
    try {
      await reportBuilderService.toggleSchedule(context, reportId, schedule.id, !schedule.is_active)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This schedule could not be updated.')
    }
  }

  async function removeSchedule(schedule: ReportSchedule) {
    try {
      await reportBuilderService.deleteSchedule(context, reportId, schedule.id)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This schedule could not be removed.')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Scheduled deliveries</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              Loading…
            </div>
          )}

          {!loading && schedules.length === 0 && !adding && (
            <p className="py-6 text-center text-sm text-muted-foreground">No scheduled deliveries yet — this report is only ever run by hand.</p>
          )}

          {!loading && schedules.map((schedule) => (
            <div key={schedule.id} className="space-y-1.5 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{describeSchedule(schedule)}</span>
                <div className="flex items-center gap-2">
                  <Switch checked={schedule.is_active} onChange={() => void toggleActive(schedule)} aria-label="Active" />
                  <button type="button" onClick={() => void removeSchedule(schedule)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <p className="truncate text-xs text-muted-foreground">To: {schedule.recipients.join(', ')}</p>
              {schedule.last_sent_at && <p className="text-xs text-muted-foreground">Last sent {schedule.last_sent_at}</p>}
            </div>
          ))}

          {adding ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Frequency</Label>
                  <Select value={frequency} onChange={(v) => setFrequency(v as ReportScheduleFrequency)} options={FREQUENCY_OPTIONS} size="sm" />
                </div>
                {frequency === 'weekly' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Day</Label>
                    <Select value={dayOfWeek} onChange={setDayOfWeek} options={DAY_OF_WEEK_OPTIONS} size="sm" />
                  </div>
                )}
                {frequency === 'monthly' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Day of month</Label>
                    <Input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
                  </div>
                )}
                {frequency === 'daily' && <div />}
                <div className="space-y-1">
                  <Label className="text-xs">Time</Label>
                  <Input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Recipients (comma or newline separated)</Label>
                <textarea
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="someone@example.com, another@example.com"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={() => void createSchedule()} disabled={saving}>
                  {saving && <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />}
                  Save schedule
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" />
              Add schedule
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
