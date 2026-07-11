'use client'

import { useState } from 'react'
import { Plus, MoreHorizontal, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePicker } from '@/components/ui/date-picker'
import { Textarea } from '@/components/ui/textarea'

interface Holiday {
  id: string
  name: string
  date: string
  day: string
  applicableYear: string
  description?: string
}

interface HolidayDialogProps {
  isOpen: boolean
  editingHoliday: Holiday | null
  newHolidayName: string
  newHolidayDate: Date | undefined
  newHolidayYear: string
  newHolidayDesc: string
  onOpenChange: (open: boolean) => void
  onNameChange: (name: string) => void
  onDateChange: (date: Date | undefined) => void
  onYearChange: (year: string) => void
  onDescChange: (desc: string) => void
  onSave: () => void
  onCancel: () => void
}

function HolidayDialogComponent({
  isOpen,
  editingHoliday,
  newHolidayName,
  newHolidayDate,
  newHolidayYear,
  newHolidayDesc,
  onOpenChange,
  onNameChange,
  onDateChange,
  onYearChange,
  onDescChange,
  onSave,
  onCancel,
}: HolidayDialogProps) {
  const yearOptions = [
    { label: '2026', value: '2026' },
    { label: '2025', value: '2025' },
    { label: '2027', value: '2027' },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto">
          <Plus className="size-4" />
          Add Holiday
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
          <DialogDescription>Configure holiday settings for your organization.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="holidayName">Holiday Name</Label>
            <Input
              id="holidayName"
              placeholder="Enter holiday name"
              value={newHolidayName}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="holidayDate">Holiday Date</Label>
            <DatePicker
              value={newHolidayDate}
              onChange={(date) => onDateChange(typeof date === 'string' ? new Date(date) : date)}
              placeholder="Select a date"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="holidayYear">Applicable Year</Label>
            <Select
              value={newHolidayYear}
              onChange={onYearChange}
              options={yearOptions}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="holidayDesc">Description (Optional)</Label>
            <Textarea
              id="holidayDesc"
              placeholder="Enter description"
              value={newHolidayDesc}
              onChange={(e) => onDescChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onCancel}>Cancel</Button>
          <Button className="w-full sm:w-auto" onClick={onSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const initialHolidays: Holiday[] = [
  { id: '1', name: 'Independence Day', date: '2026-08-15', day: 'Saturday', applicableYear: '2026' },
  { id: '2', name: 'Diwali', date: '2026-11-08', day: 'Sunday', applicableYear: '2026' },
  { id: '3', name: 'Gandhi Jayanti', date: '2026-10-02', day: 'Friday', applicableYear: '2026' },
  { id: '4', name: 'Dussehra', date: '2026-10-24', day: 'Saturday', applicableYear: '2026' },
  { id: '5', name: 'Raksha Bandhan', date: '2026-08-28', day: 'Friday', applicableYear: '2026' },
]

export default function HolidayCalendarTab({ isLoading }: { isLoading: boolean }) {
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays)
  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false)
  const [holidayToDelete, setHolidayToDelete] = useState<string | null>(null)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [newHolidayName, setNewHolidayName] = useState('')
  const [newHolidayDate, setNewHolidayDate] = useState<Date | undefined>()
  const [newHolidayYear, setNewHolidayYear] = useState('2026')
  const [newHolidayDesc, setNewHolidayDesc] = useState('')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const resetHolidayForm = () => {
    setNewHolidayName('')
    setNewHolidayDate(undefined)
    setNewHolidayYear('2026')
    setNewHolidayDesc('')
    setEditingHoliday(null)
  }

  const handleAddHoliday = () => {
    if (!newHolidayName || !newHolidayDate) return
    const dateStr = newHolidayDate.toISOString().split('T')[0]
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(newHolidayDate)
    const newHoliday: Holiday = {
      id: String(Date.now()),
      name: newHolidayName,
      date: dateStr,
      day,
      applicableYear: newHolidayYear,
      description: newHolidayDesc,
    }
    setHolidays([...holidays, newHoliday])
    resetHolidayForm()
    setIsHolidayDialogOpen(false)
  }

  const handleEditHoliday = (holiday: Holiday) => {
    setEditingHoliday(holiday)
    setNewHolidayName(holiday.name)
    setNewHolidayDate(new Date(holiday.date))
    setNewHolidayYear(holiday.applicableYear)
    setNewHolidayDesc(holiday.description || '')
    setIsHolidayDialogOpen(true)
  }

  const handleUpdateHoliday = () => {
    if (!editingHoliday || !newHolidayName || !newHolidayDate) return
    const dateStr = newHolidayDate.toISOString().split('T')[0]
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(newHolidayDate)
    setHolidays(holidays.map(h =>
      h.id === editingHoliday.id
        ? { ...h, name: newHolidayName, date: dateStr, day, applicableYear: newHolidayYear, description: newHolidayDesc }
        : h
    ))
    resetHolidayForm()
    setIsHolidayDialogOpen(false)
  }

  const handleHolidayDialogSave = () => {
    if (editingHoliday) {
      handleUpdateHoliday()
    } else {
      handleAddHoliday()
    }
  }

  const handleHolidayDialogCancel = () => {
    setIsHolidayDialogOpen(false)
    resetHolidayForm()
  }

  const handleDeleteHoliday = () => {
    if (!holidayToDelete) return
    setHolidays(holidays.filter(h => h.id !== holidayToDelete))
    setHolidayToDelete(null)
    setIsDeleteDialogOpen(false)
  }

  const holidayColumns: Column<Holiday>[] = [
    {
      id: 'name',
      header: 'Holiday Name',
      render: (value) => (
        <span className="text-sm font-medium text-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'date',
      header: 'Holiday Date',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'day',
      header: 'Day',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'applicableYear',
      header: 'Applicable Year',
      render: (value) => (
        <span className="text-sm text-muted-foreground">{String(value)}</span>
      ),
    },
    {
      id: 'actions' as keyof Holiday,
      header: 'Actions',
      render: (_, row) => (
        <div className="flex justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleEditHoliday(row)}>Edit Holiday</DropdownMenuItem>
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

  const HolidayDialog = () => (
    <Dialog open={isHolidayDialogOpen} onOpenChange={(open) => {
      setIsHolidayDialogOpen(open)
      if (!open) resetHolidayForm()
    }}>
      <DialogTrigger asChild>
        <Button className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto">
          <Plus className="size-4" />
          Add Holiday
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
          <DialogDescription>Configure holiday settings for your organization.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="holidayName">Holiday Name</Label>
            <Input
              id="holidayName"
              placeholder="Enter holiday name"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="holidayDate">Holiday Date</Label>
            <DatePicker
              value={newHolidayDate}
              onChange={(date) => setNewHolidayDate(typeof date === 'string' ? new Date(date) : date)}
              placeholder="Select a date"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="holidayYear">Applicable Year</Label>
            <Select
              value={newHolidayYear}
              onChange={setNewHolidayYear}
              options={yearOptions}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="holidayDesc">Description (Optional)</Label>
            <Textarea
              id="holidayDesc"
              placeholder="Enter description"
              value={newHolidayDesc}
              onChange={(e) => setNewHolidayDesc(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
            setIsHolidayDialogOpen(false)
            resetHolidayForm()
          }}>Cancel</Button>
          <Button className="w-full sm:w-auto" onClick={editingHoliday ? handleUpdateHoliday : handleAddHoliday}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (holidays.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={<Calendar className="size-10" />}
            title="No holidays configured"
            description="Get started by adding your first holiday to the organization calendar."
            action={
              <Button onClick={() => setIsHolidayDialogOpen(true)}>
                <Plus className="size-4 mr-2" />
                Add Holiday
              </Button>
            }
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base sm:text-lg md:text-xl">Holiday Calendar</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Manage organization holidays used during leave calculation.</CardDescription>
        </div>
        <HolidayDialogComponent
          isOpen={isHolidayDialogOpen}
          editingHoliday={editingHoliday}
          newHolidayName={newHolidayName}
          newHolidayDate={newHolidayDate}
          newHolidayYear={newHolidayYear}
          newHolidayDesc={newHolidayDesc}
          onOpenChange={(open) => {
            setIsHolidayDialogOpen(open)
            if (!open) resetHolidayForm()
          }}
          onNameChange={setNewHolidayName}
          onDateChange={setNewHolidayDate}
          onYearChange={setNewHolidayYear}
          onDescChange={setNewHolidayDesc}
          onSave={handleHolidayDialogSave}
          onCancel={handleHolidayDialogCancel}
        />
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <DataTable columns={holidayColumns} data={holidays} density="compact" striped />
        </div>
      </CardContent>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this item? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="w-full sm:w-auto" onClick={handleDeleteHoliday}>Delete</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
