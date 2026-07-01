'use client'

import React, { useState } from 'react'
import {
  Calendar as CalendarIcon,
  Users,
  CheckSquare,
  AlertCircle,
  Clock,
  Filter,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Video,
  MapPin,
  X,
  ExternalLink,
  Edit,
  Download,
  Plus,
  Monitor,
  MoreVertical
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

// ─── Dummy Data ─────────────────────────────────────────────────────────────

type SessionType = 'virtual' | 'classroom'
type SessionStatus = 'open' | 'almost-full' | 'full' | 'closed'

interface Session {
  id: string
  name: string
  type: SessionType
  trainer: {
    name: string
    email: string
  }
  startDateTime: string // ISO string or formatted for display
  endDateTime: string
  dateLabel: string
  timeLabel: string
  duration: string
  venue: string
  link?: string
  seats: {
    total: number
    registered: number
  }
  status: SessionStatus
  description: string
  notes: string
  dayIndex: number // 0-6 for Sun-Sat in the current week
  startHourIndex: number // 0 for 9am, 1 for 10am, etc. (relative to 9am start)
  durationHours: number
}

const STATS = [
  { label: 'Upcoming Sessions', value: '18', sub: 'Next 30 days', icon: CalendarIcon },
  { label: 'Total Registrations', value: '256', sub: 'Across all sessions', icon: Users },
  { label: 'Open Sessions', value: '11', sub: 'Registration open', icon: CheckSquare },
  { label: 'Full Sessions', value: '4', sub: 'No seats available', icon: Users },
  { label: 'Sessions This Month', value: '14', sub: 'In this month', icon: Clock },
]

const SESSIONS: Session[] = [
  {
    id: 's1',
    name: 'Effective Communication',
    type: 'virtual',
    trainer: { name: 'Michael Brown', email: 'michael.brown@company.com' },
    startDateTime: '2025-05-19T09:00:00Z',
    endDateTime: '2025-05-19T11:00:00Z',
    dateLabel: 'Mon, 19 May 2025',
    timeLabel: '09:00 AM - 11:00 AM',
    duration: '2h',
    venue: 'Zoom',
    link: 'https://zoom.us/j/123456789',
    seats: { total: 40, registered: 35 },
    status: 'almost-full',
    description: 'Learn the fundamentals of effective workplace communication.',
    notes: 'Please ensure your microphone and camera are working properly.',
    dayIndex: 1, // Mon
    startHourIndex: 0, // 9am
    durationHours: 2,
  },
  {
    id: 's2',
    name: 'Leadership Essentials',
    type: 'classroom',
    trainer: { name: 'Jane Smith', email: 'jane.smith@company.com' },
    startDateTime: '2025-05-20T10:00:00Z',
    endDateTime: '2025-05-20T12:00:00Z',
    dateLabel: 'Tue, 20 May 2025',
    timeLabel: '10:00 AM - 12:00 PM',
    duration: '2h',
    venue: 'Training Room A',
    seats: { total: 25, registered: 18 },
    status: 'open',
    description: 'Core leadership principles for new managers.',
    notes: 'Bring a notebook and pen.',
    dayIndex: 2, // Tue
    startHourIndex: 1, // 10am
    durationHours: 2,
  },
  {
    id: 's3',
    name: 'Project Management Fundamentals',
    type: 'virtual',
    trainer: { name: 'John Doe', email: 'john.doe@company.com' },
    startDateTime: '2025-05-21T09:00:00Z',
    endDateTime: '2025-05-21T11:00:00Z',
    dateLabel: 'Wed, 21 May 2025',
    timeLabel: '09:00 AM - 11:00 AM',
    duration: '2h',
    venue: 'Microsoft Teams',
    link: 'https://teams.microsoft.com/l/meetup-join/...',
    seats: { total: 30, registered: 22 },
    status: 'open',
    description: 'This session covers key principles and practical techniques of project management.',
    notes: 'Please ensure you have MS Project installed before the session.',
    dayIndex: 3, // Wed
    startHourIndex: 0, // 9am
    durationHours: 2,
  },
  {
    id: 's4',
    name: 'Excel Advanced Workshop',
    type: 'classroom',
    trainer: { name: 'Jane Smith', email: 'jane.smith@company.com' },
    startDateTime: '2025-05-22T13:00:00Z',
    endDateTime: '2025-05-22T16:00:00Z',
    dateLabel: 'Thu, 22 May 2025',
    timeLabel: '1:00 PM - 4:00 PM',
    duration: '3h',
    venue: 'Lab 2, Block B',
    seats: { total: 20, registered: 20 },
    status: 'full',
    description: 'Advanced data analysis using Excel PivotTables and macros.',
    notes: 'Requires basic understanding of Excel formulas.',
    dayIndex: 4, // Thu
    startHourIndex: 4, // 1pm (9am + 4)
    durationHours: 3,
  },
  {
    id: 's5',
    name: 'Safety Awareness Training',
    type: 'virtual',
    trainer: { name: 'Robert Johnson', email: 'robert.j@company.com' },
    startDateTime: '2025-05-23T10:00:00Z',
    endDateTime: '2025-05-23T12:00:00Z',
    dateLabel: 'Fri, 23 May 2025',
    timeLabel: '10:00 AM - 12:00 PM',
    duration: '2h',
    venue: 'Microsoft Teams',
    link: 'https://teams.microsoft.com/l/meetup-join/...',
    seats: { total: 50, registered: 28 },
    status: 'open',
    description: 'Mandatory safety protocol review for all employees.',
    notes: '',
    dayIndex: 5, // Fri
    startHourIndex: 1, // 10am
    durationHours: 2,
  },
]

const DAYS = ['Sun 18', 'Mon 19', 'Tue 20', 'Wed 21', 'Thu 22', 'Fri 23', 'Sat 24']
const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM']

const getStatusDetails = (status: SessionStatus) => {
  switch (status) {
    case 'open':
      return { variant: 'active' as const, label: 'Open' }
    case 'almost-full':
      return { variant: 'warning' as const, label: 'Almost Full' }
    case 'full':
      return { variant: 'error' as const, label: 'Full' }
    case 'closed':
      return { variant: 'inactive' as const, label: 'Closed' }
  }
}

// ─── Components ─────────────────────────────────────────────────────────────

export function SessionsCalendar() {
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sessions & Training Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage instructor-led, virtual and classroom training sessions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-9">
            <Download className="mr-2 size-4" /> Export
          </Button>
          <Button variant="outline" size="sm" className="h-9">
            More Actions <MoreVertical className="ml-2 size-4" />
          </Button>
          <Button size="sm" className="h-9">
            <Plus className="mr-2 size-4" /> New Session
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STATS.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="size-5 text-primary" />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                    {stat.label}
                  </span>
                  <div className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {stat.sub}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Content Area */}
      <Card className="shadow-sm border-border/60">
        <div className="flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b border-border/60">
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/30">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors",
                    viewMode === 'calendar' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CalendarIcon className="size-4" /> Calendar
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm transition-colors",
                    viewMode === 'list' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ListIcon className="size-4" /> List
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="size-8">
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="icon" className="size-8">
                  <ChevronRight className="size-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 ml-2">
                  Today
                </Button>
                <span className="text-sm font-bold text-foreground ml-2">
                  May 18 – May 24, 2025
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select className="h-8 rounded-md border border-border bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-ring">
                <option>All Types</option>
                <option>Virtual</option>
                <option>Classroom</option>
              </select>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="mr-2 size-4" /> Filters
              </Button>
            </div>
          </div>

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <div className="flex flex-col bg-muted/10">
              {/* Calendar Header (Days) */}
              <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-b border-border/60">
                <div className="p-3 text-xs font-semibold text-muted-foreground text-center border-r border-border/60">
                  All day
                </div>
                {DAYS.map((day, i) => {
                  const isToday = i === 3 // Wed 21 in dummy
                  return (
                    <div key={day} className="p-3 text-center border-r border-border/60 last:border-0 relative">
                      <span className={cn(
                        "text-sm font-medium",
                        isToday ? "text-primary font-bold" : "text-muted-foreground"
                      )}>
                        {day}
                      </span>
                      {isToday && (
                        <div className="absolute top-1 right-2 size-2 rounded-full bg-primary" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Calendar Grid */}
              <div className="relative">
                {/* Background grid lines */}
                {HOURS.map((hour, i) => (
                  <div key={hour} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-b border-border/60 group">
                    <div className="p-3 text-[11px] font-medium text-muted-foreground text-center border-r border-border/60">
                      {hour}
                    </div>
                    {DAYS.map((day, j) => (
                      <div key={`${day}-${hour}`} className="h-16 border-r border-border/60 last:border-0 group-hover:bg-muted/30 transition-colors" />
                    ))}
                  </div>
                ))}

                {/* Session Blocks */}
                {SESSIONS.map((session) => {
                  // Calculate absolute position on the grid
                  const topOffset = session.startHourIndex * 64 // 64px per hour
                  const height = session.durationHours * 64
                  const leftPercent = (session.dayIndex * 12.5) + 12.5 // 8 cols, 1st is time (12.5%)
                  
                  return (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={cn(
                        "absolute rounded-md border p-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col gap-1",
                        session.type === 'virtual' 
                          ? "bg-primary/5 border-primary/20 hover:border-primary/40" 
                          : "bg-muted border-border hover:border-muted-foreground/30"
                      )}
                      style={{
                        top: topOffset,
                        height,
                        left: `calc(${leftPercent}% + 6px)`,
                        width: `calc(12.5% - 12px)`, // Add some gap between borders
                      }}
                    >
                      <span className="text-xs font-semibold text-foreground leading-tight line-clamp-2">
                        {session.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3 shrink-0" />
                        {session.timeLabel}
                      </span>
                      <div className="mt-auto flex items-center gap-1">
                        <div className={cn(
                          "size-2 rounded-full shrink-0",
                          session.type === 'virtual' ? "bg-primary" : "bg-green-500"
                        )} />
                        <span className="text-[10px] font-medium text-muted-foreground truncate">
                          {session.type === 'virtual' ? 'Virtual' : 'Classroom'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Upcoming Sessions List */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Upcoming Sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Session Name</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Trainer</TableHead>
                <TableHead className="font-semibold">Start Date & Time</TableHead>
                <TableHead className="font-semibold">Venue / Link</TableHead>
                <TableHead className="font-semibold">Seats</TableHead>
                <TableHead className="font-semibold">Registered</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SESSIONS.map((session) => {
                const statusInfo = getStatusDetails(session.status)
                return (
                  <TableRow key={session.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedSession(session)}>
                    <TableCell className="font-medium text-foreground">
                      {session.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "size-2 rounded-full",
                          session.type === 'virtual' ? "bg-primary" : "bg-green-500"
                        )} />
                        <span className="capitalize">{session.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>{session.trainer.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{session.dateLabel.split(', ')[1]}</span>
                        <span className="text-xs text-muted-foreground">{session.timeLabel.split(' - ')[0]}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {session.venue}
                    </TableCell>
                    <TableCell>{session.seats.total}</TableCell>
                    <TableCell>{session.seats.registered}</TableCell>
                    <TableCell>
                      <StatusBadge variant={statusInfo.variant} className="font-medium">
                        {statusInfo.label}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedSession(session)}>
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/60">
            <span className="text-sm text-muted-foreground">
              Showing 1 to 5 of 18 sessions
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="size-8 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary">1</Button>
              <Button variant="outline" size="icon" className="size-8">2</Button>
              <Button variant="outline" size="icon" className="size-8">3</Button>
              <Button variant="outline" size="icon" className="size-8">4</Button>
              <Button variant="outline" size="icon" className="size-8"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <SheetContent side="right" className="w-[95vw] sm:max-w-4xl p-0 flex flex-col border-l">
          {selectedSession && (
            <>
              {/* Header */}
              <div className="p-6 border-b border-border/60 bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight mb-2">
                      {selectedSession.name}
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "size-2 rounded-full",
                          selectedSession.type === 'virtual' ? "bg-primary" : "bg-green-500"
                        )} />
                        <span className="text-sm font-medium text-muted-foreground capitalize">
                          {selectedSession.type} Session
                        </span>
                      </div>
                      <StatusBadge variant={getStatusDetails(selectedSession.status).variant}>
                        {getStatusDetails(selectedSession.status).label}
                      </StatusBadge>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0 -mr-2 -mt-2" onClick={() => setSelectedSession(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-6 border-b border-border/60 bg-card flex items-center gap-6">
                <button className="py-3 text-sm font-semibold text-primary border-b-2 border-primary -mb-px">
                  Overview
                </button>
                <button className="py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                  Registrations ({selectedSession.seats.registered})
                </button>
                <button className="py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                  Attendance
                </button>
                <button className="py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                  Files
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 bg-background">
                {/* Date & Time */}
                <div className="flex gap-4">
                  <div className="mt-0.5 text-muted-foreground">
                    <CalendarIcon className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Date & Time
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedSession.dateLabel}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {selectedSession.timeLabel} ({selectedSession.duration})
                    </span>
                  </div>
                </div>

                {/* Venue / Link */}
                <div className="flex gap-4">
                  <div className="mt-0.5 text-muted-foreground">
                    {selectedSession.type === 'virtual' ? <Monitor className="size-5" /> : <MapPin className="size-5" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {selectedSession.type === 'virtual' ? 'Virtual Link' : 'Venue'}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedSession.venue}
                    </span>
                    {selectedSession.link && (
                      <a href={selectedSession.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline flex items-center gap-1 mt-1">
                        Join Link <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Trainer */}
                <div className="flex gap-4">
                  <div className="mt-0.5 text-muted-foreground">
                    <Users className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Trainer
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedSession.trainer.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {selectedSession.trainer.email}
                    </span>
                  </div>
                </div>

                {/* Seats */}
                <div className="flex gap-4">
                  <div className="mt-0.5 text-muted-foreground">
                    <CheckSquare className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Seats
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedSession.seats.total} ({selectedSession.seats.registered} Registered • {selectedSession.seats.total - selectedSession.seats.registered} Available)
                    </span>
                  </div>
                </div>

                {/* Type */}
                <div className="flex gap-4">
                  <div className="mt-0.5 text-muted-foreground">
                    <Video className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Session Type
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      Instructor-Led Training
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="flex gap-4">
                  <div className="mt-0.5 text-muted-foreground">
                    <ListIcon className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description
                    </span>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                      {selectedSession.description}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {selectedSession.notes && (
                  <div className="flex gap-4">
                    <div className="mt-0.5 text-muted-foreground">
                      <AlertCircle className="size-5" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Notes
                      </span>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1 bg-muted p-3 rounded-md border border-border/50">
                        {selectedSession.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border/60 bg-card flex justify-between items-center">
                <Button variant="outline">
                  Edit Session
                </Button>
                <Button onClick={() => setSelectedSession(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
