'use client'

import React, { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, User, CheckCircle2, AlertCircle, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { Task } from '@/types/task-management'
import { mockTasks } from '@/lib/mock-data/task-management'

interface TaskCalendarViewProps {
  tasks?: Task[]
  onSelectTask?: (task: Task) => void
}

export function TaskCalendarView({ tasks = mockTasks as Task[], onSelectTask }: TaskCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 26)) // June 26, 2026 as reference day
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')

  const prevPeriod = () => {
    if (view === 'month') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    else if (view === 'week') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7))
    else if (view === 'day') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1))
  }

  const nextPeriod = () => {
    if (view === 'month') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    else if (view === 'week') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7))
    else if (view === 'day') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1))
  }

  const getStatusClasses = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-primary/20 text-primary border-primary/30'
      case 'in_progress': return 'bg-primary/10 text-primary border-primary/20'
      case 'at_risk': return 'bg-background text-primary border-primary/50 shadow-sm'
      case 'planning': return 'bg-muted text-foreground border-border'
      default: return 'bg-muted/50 text-muted-foreground border-border/50'
    }
  }

  // Generate calendar data based on view
  let visibleDays: (Date | null)[] = []
  
  if (view === 'month') {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
    
    // Fill blanks
    for (let i = 0; i < firstDayOfMonth; i++) visibleDays.push(null)
    // Fill days
    for (let i = 1; i <= daysInMonth; i++) {
      visibleDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i))
    }
  } else if (view === 'week') {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(d.getDate() + i)
      visibleDays.push(d)
    }
  } else if (view === 'day') {
    visibleDays.push(currentDate)
  }

  const headerDateString = view === 'day' 
    ? currentDate.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' })
    : currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="flex h-full w-full overflow-hidden bg-background/50">
      
      {/* Main Calendar Area */}
      <div className="flex flex-col flex-1 p-6 transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 text-primary shadow-sm">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <p className="text-sm text-muted-foreground">Deadline Tracking & Scheduling</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-card/50 backdrop-blur-md border border-primary/10 p-1 rounded-xl shadow-sm">
              {['month', 'week', 'day'].map((v) => (
                <Button
                  variant={view === v ? 'default' : 'ghost'}
                  key={v}
                  onClick={() => setView(v as any)}
                  className={cn(
                    "rounded-lg capitalize transition-all duration-300",
                    view === v ? "shadow-md" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {v}
                </Button>
              ))}
            </div>
            
            <div className="flex items-center gap-1 bg-card/50 backdrop-blur-md border border-primary/10 rounded-xl p-1 shadow-sm">
              <Button variant="ghost" size="icon" onClick={prevPeriod} className="rounded-lg hover:bg-primary/10 hover:text-primary">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={nextPeriod} className="rounded-lg hover:bg-primary/10 hover:text-primary">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-xl overflow-hidden flex flex-col">
          {/* Days Header */}
          <div className={cn("grid border-b border-primary/10 bg-primary/5", view === 'day' ? "grid-cols-1" : "grid-cols-7")}>
            {view === 'day' ? (
              <div className="p-4 text-center text-sm font-bold text-primary">
                {currentDate.toLocaleDateString('default', { weekday: 'long' })}
              </div>
            ) : (
              ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-4 text-center text-sm font-bold text-primary">
                  {day}
                </div>
              ))
            )}
          </div>
          
          {/* Calendar Body */}
          <div className={cn("flex-1 grid g2g-scrollbar overflow-y-auto", view === 'day' ? "grid-cols-1" : "grid-cols-7")}>
            {visibleDays.map((dateObj, idx) => {
              if (!dateObj) {
                return <div key={`blank-${idx}`} className="border-r border-b border-primary/5 bg-background/20 p-2 min-h-[120px]" />
              }

              const y = dateObj.getFullYear()
              const m = (dateObj.getMonth() + 1).toString().padStart(2, '0')
              const d = dateObj.getDate().toString().padStart(2, '0')
              const dateString = `${y}-${m}-${d}`
              const dayTasks = tasks.filter(t => t.dueDate === dateString)
              const isToday = dateObj.getDate() === 26 && dateObj.getMonth() === 5 && dateObj.getFullYear() === 2026 // Hardcoded 'today' for demo

              return (
                <div key={dateString} className={cn("border-r border-b border-primary/5 p-2 transition-colors hover:bg-primary/5 group", view === 'month' ? "min-h-[120px]" : "min-h-[400px]")}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all",
                      isToday ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground group-hover:text-primary bg-background/50"
                    )}>
                      {dateObj.getDate()}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                        {dayTasks.length} Tasks
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {dayTasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask?.(task)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border shadow-sm hover:scale-[1.02] flex flex-col gap-1",
                          getStatusClasses(task.status)
                        )}
                      >
                        <span className="truncate">{task.title}</span>
                        {(view === 'week' || view === 'day') && (
                           <span className="font-medium opacity-80 text-[10px] flex items-center gap-1">
                             <User className="w-3 h-3" /> {task.assignee}
                           </span>
                        )}
                      </div>
                    ))}
                    {dayTasks.length === 0 && view === 'day' && (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                        <CheckCircle2 className="w-12 h-12 mb-2" />
                        <span className="text-sm font-bold">No tasks due this day</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
