'use client'

import { useMemo, useState } from 'react'
import { Plus, MoreHorizontal, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/ui/date-picker'
import { Textarea } from '@/components/ui/textarea'
import { useHolidays } from '@/hooks/use-leave'
import { toDateInput } from '@/domain/hrms/hrit/leave-management/services/leave-mappers'
import type { LeaveHolidayRow, LeaveWeekday } from '@/services/hrms'

const currentYear = new Date().getFullYear()

/** Year filter, derived from today rather than hardcoded. */
const yearOptions = [currentYear - 1, currentYear, currentYear + 1].map((year) => ({
  label: String(year),
  value: String(year),
}))

const dayTypeOptions = [
  { label: 'Full Day', value: 'full' },
  { label: 'Half Day', value: 'half' },
]

const weekdayTypeOptions = [
  { label: 'Full Working Day', value: 'full' },
  { label: 'Half Working Day', value: 'half' },
  { label: 'Weekly Off', value: 'weekend' },
]

interface HolidayFormState {
  name: string
  date: Date | undefined
  dayType: 'full' | 'half'
  description: string
}

const emptyForm: HolidayFormState = {
  name: '',
  date: undefined,
  dayType: 'full',
  description: '',
}

/** DatePicker can emit a Date or a date string; normalise to a Date. */
function asDate(value?: Date | string): Date | undefined {
  if (!value) return undefined
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export default function HolidayCalendarTab({ isLoading }: { isLoading: boolean }) {
  const [calendarYear, setCalendarYear] = useState(String(currentYear))

  const {
    loading,
    processing,
    error,
    actionMessage,
    holidays,
    weekdays,
    retry,
    clearMessages,
    save,
    remove,
    saveWeekdays,
  } = useHolidays(calendarYear)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [holidayToDelete, setHolidayToDelete] = useState<number | null>(null)
  const [editing, setEditing] = useState<LeaveHolidayRow | null>(null)
  const [form, setForm] = useState<HolidayFormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [weekdayDraft, setWeekdayDraft] = useState<Record<string, string>>({})
  const [syncedWeekdays, setSyncedWeekdays] = useState<LeaveWeekday[]>([])

  // Adjust the editable draft during render when the server payload changes,
  // rather than in an effect - see https://react.dev/learn/you-might-not-need-an-effect
  if (weekdays !== syncedWeekdays) {
    setSyncedWeekdays(weekdays)
    setWeekdayDraft(
      weekdays.reduce<Record<string, string>>((draft, weekday) => {
        draft[weekday.day] = weekday.day_type
        return draft
      }, {}),
    )
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setForm(emptyForm)
    setEditing(null)
    setFormError(null)
  }

  const weekdaysDirty = useMemo(
    () => weekdays.some((weekday: LeaveWeekday) => weekdayDraft[weekday.day] !== weekday.day_type),
    [weekdays, weekdayDraft],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  const openEdit = (holiday: LeaveHolidayRow) => {
    setEditing(holiday)
    setForm({
      name: holiday.holiday_name,
      date: holiday.from_date ? new Date(`${holiday.from_date}T00:00:00`) : undefined,
      dayType: holiday.day_type === 'half' ? 'half' : 'full',
      description: holiday.description ?? '',
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setFormError(null)

    if (!form.name.trim()) {
      setFormError('Holiday name is required')
      return
    }

    if (!form.date) {
      setFormError('Holiday date is required')
      return
    }

    const result = await save(
      {
        holidayName: form.name.trim(),
        description: form.description.trim() || undefined,
        fromDate: toDateInput(form.date),
        dayType: form.dayType,
      },
      editing?.id,
    )

    if (result.ok) {
      closeDialog()
    } else {
      setFormError(result.message)
    }
  }

  const handleDelete = async () => {
    if (!holidayToDelete) return
    await remove(holidayToDelete)
    setHolidayToDelete(null)
    setIsDeleteDialogOpen(false)
  }

  const columns: Column<LeaveHolidayRow>[] = [
    {
      id: 'holiday_name',
      header: 'Holiday Name',
      render: (value) => <span className="text-sm font-medium text-foreground">{String(value)}</span>,
    },
    {
      id: 'from_date',
      header: 'Holiday Date',
      render: (value) => <span className="text-sm text-muted-foreground">{String(value ?? '—')}</span>,
    },
    {
      id: 'day',
      header: 'Day',
      render: (value) => <span className="text-sm text-muted-foreground">{String(value ?? '—')}</span>,
    },
    {
      id: 'applicable_year',
      header: 'Applicable Year',
      render: (value) => <span className="text-sm text-muted-foreground">{String(value ?? '—')}</span>,
    },
    {
      id: 'department_names' as keyof LeaveHolidayRow,
      header: 'Departments',
      render: (_, row) => (
        <span className="text-sm text-muted-foreground">
          {row.department_names.length > 0 ? row.department_names.join(', ') : 'All departments'}
        </span>
      ),
    },
    {
      id: 'actions' as keyof LeaveHolidayRow,
      header: 'Actions',
      render: (_, row) => (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={processing}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => openEdit(row)}>Edit Holiday</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setHolidayToDelete(row.id)
                  setIsDeleteDialogOpen(true)
                }}
                className="text-destructive"
              >
                Delete Holiday
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const holidayDialog = (
    <Dialog open={isDialogOpen} onOpenChange={(next) => (next ? setIsDialogOpen(true) : closeDialog())}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
          <DialogDescription>Configure holiday settings for your organization.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label htmlFor="holidayName" required>Holiday Name</Label>
            <Input
              id="holidayName"
              placeholder="Enter holiday name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="holidayDate" required>Holiday Date</Label>
            <DatePicker
              id="holidayDate"
              value={form.date}
              onChange={(date) => setForm((prev) => ({ ...prev, date: asDate(date) }))}
              placeholder="Select a date"
            />
            <p className="text-xs text-muted-foreground">
              The day of the week and applicable year are derived from this date.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="holidayDayType">Day Type</Label>
            <Select
              value={form.dayType}
              onChange={(value) => setForm((prev) => ({ ...prev, dayType: value as 'full' | 'half' }))}
              options={dayTypeOptions}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="holidayDesc">Description (Optional)</Label>
            <Textarea
              id="holidayDesc"
              placeholder="Enter description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={closeDialog}>
            Cancel
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSave} disabled={processing}>
            {processing ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const weeklyOffCard = (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base sm:text-lg md:text-xl">Weekly Off Pattern</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Used alongside holidays when leave days are counted.
          </CardDescription>
        </div>
        {weekdaysDirty && (
          <Button
            className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto"
            onClick={() => saveWeekdays(weekdayDraft)}
            disabled={processing}
          >
            {processing ? 'Saving...' : 'Save Pattern'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {weekdays.map((weekday) => (
            <div key={weekday.day} className="grid gap-2">
              <Label htmlFor={`weekday-${weekday.day}`}>{weekday.label}</Label>
              <Select
                value={weekdayDraft[weekday.day] ?? weekday.day_type}
                onChange={(value) => setWeekdayDraft((prev) => ({ ...prev, [weekday.day]: value }))}
                options={weekdayTypeOptions}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  if (isLoading || loading) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (error && holidays.length === 0 && weekdays.length === 0) {
    return <ErrorState title="Unable to load the holiday calendar" description={error} retry={retry} />
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg md:text-xl">Holiday Calendar</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Manage organization holidays used during leave calculation.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              className="min-w-[120px]"
              value={calendarYear}
              onChange={setCalendarYear}
              options={yearOptions}
            />
            <Button className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto" onClick={openCreate}>
              <Plus className="size-4" />
              Add Holiday
            </Button>
          </div>
        </CardHeader>

        {(actionMessage || error) && (
          <CardContent className="pt-0">
            <Alert variant={error ? 'destructive' : undefined}>
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{error ?? actionMessage}</span>
                <Button variant="ghost" size="sm" onClick={clearMessages}>
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        <CardContent className="p-0">
          {holidays.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Calendar className="size-10" />}
                title={`No holidays configured for ${calendarYear}`}
                description="Add your first holiday to the organization calendar for this year."
                action={
                  <Button onClick={openCreate}>
                    <Plus className="size-4 mr-2" />
                    Add Holiday
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable columns={columns} data={holidays} density="compact" striped />
            </div>
          )}
        </CardContent>
      </Card>

      {weekdays.length > 0 && weeklyOffCard}

      {holidayDialog}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this holiday? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="w-full sm:w-auto" onClick={handleDelete} disabled={processing}>
              {processing ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
