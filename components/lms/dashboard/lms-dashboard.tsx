'use client'

import React, { useState } from 'react'
import {
  BookOpen,
  ClipboardCheck,
  Clock,
  Award,
  Trophy,
  BarChart2,
  Settings,
  Image as ImageIcon,
  ChevronRight,
  ChevronDown,
  PlusCircle,
  FileText,
  Download,
  Send,
  MessageSquare,
  CheckCircle2,
  CalendarDays,
  Bell,
  BookMarked
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'

function KpiCard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
}: {
  title: string
  value: string | number
  subtext: string
  icon: React.ElementType
  trend?: 'neutral' | 'warning' | 'success' | 'primary'
}) {
  const trendColor = 
    trend === 'warning' ? 'text-danger' : 
    trend === 'success' ? 'text-success' : 
    trend === 'primary' ? 'text-primary' : 'text-muted-foreground'

  return (
    <Card className="rounded-xl border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
            <Icon className="size-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">{value}</h3>
            <p className={cn('text-xs font-semibold', trendColor)}>{subtext}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MyLearningWidget() {
  const [activeTab, setActiveTab] = useState('in-progress')
  
  const tabs = [
    { id: 'in-progress', label: 'In Progress (4)' },
    { id: 'not-started', label: 'Not Started (8)' },
    { id: 'completed', label: 'Completed (18)' },
    { id: 'overdue', label: 'Overdue (2)' },
  ]

  const courses = [
    { id: 1, title: 'Workplace Safety Essentials', due: 'Due: 20 May 2025', progress: 60 },
    { id: 2, title: 'Data Privacy Awareness', due: 'Due: 15 May 2025', progress: 30 },
    { id: 3, title: 'Leadership Fundamentals', due: 'Due: 30 May 2025', progress: 10 },
    { id: 4, title: 'Effective Communication', due: 'No due date', progress: 75 },
  ]

  return (
    <Card className="flex h-[420px] flex-col overflow-hidden rounded-xl border-border/80 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-2 pt-4">
        <CardTitle className="text-base font-bold">My Learning</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs font-semibold text-primary">
          View All <ChevronRight className="size-3.5" />
        </Button>
      </CardHeader>
      
      <div className="px-5">
        <div className="flex items-center gap-4 border-b border-border/60">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative -mb-px pb-2 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap',
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <CardContent className="flex-1 overflow-auto p-0">
        <div className="flex flex-col">
          {courses.map((course) => (
            <div key={course.id} className="flex items-center gap-3 border-b border-border/50 px-5 py-3.5 hover:bg-muted/30">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/50">
                <ImageIcon className="size-5 text-muted-foreground/40" />
              </div>
              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <h4 className="text-sm font-semibold leading-tight text-foreground truncate">{course.title}</h4>
                <p className="text-[11px] font-medium text-muted-foreground">{course.due}</p>
              </div>
              <div className="flex w-14 flex-col items-end gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-foreground">{course.progress}%</span>
                <Progress value={course.progress} className="h-1.5 w-full bg-muted-foreground/20 [&>div]:bg-primary" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <div className="border-t border-border/50 px-3 py-2 bg-muted/10">
        <Button variant="ghost" size="sm" className="h-8 text-[13px] font-semibold text-primary w-full justify-start gap-1">
          Go to My Learning <ChevronRight className="size-4" />
        </Button>
      </div>
    </Card>
  )
}

function UpcomingDeadlinesWidget() {
  const deadlines = [
    { date: '15', month: 'MAY', title: 'Data Privacy Awareness', type: 'Mandatory Training', status: 'Overdue' },
    { date: '20', month: 'MAY', title: 'Workplace Safety Essentials', type: 'Mandatory Training', status: 'Due Soon' },
    { date: '25', month: 'MAY', title: 'Code of Conduct', type: 'Mandatory Training', status: 'Due Soon' },
    { date: '30', month: 'MAY', title: 'Customer Service Excellence', type: 'Elective Course', status: 'Upcoming' },
  ]

  return (
    <Card className="flex h-[420px] flex-col overflow-hidden rounded-xl border-border/80 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5 border-b border-border/60">
        <CardTitle className="text-base font-bold">Upcoming Deadlines</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs font-semibold text-primary">
          View All <ChevronRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        <div className="flex flex-col divide-y divide-border/50">
          {deadlines.map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-4 hover:bg-muted/30">
              <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border/80 bg-background py-1.5 shadow-sm">
                <span className="text-base font-bold leading-none">{item.date}</span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{item.month}</span>
              </div>
              <div className="flex flex-1 flex-col gap-1 min-w-0 pt-0.5">
                <h4 className="text-sm font-semibold leading-tight text-foreground truncate">{item.title}</h4>
                <p className="text-[11px] font-medium text-muted-foreground">{item.type}</p>
              </div>
              <StatusBadge 
                variant={
                  item.status === 'Overdue' ? 'error' : 
                  item.status === 'Due Soon' ? 'pending' : 'default'
                }
                className="shrink-0 text-[10px] uppercase font-bold tracking-wider"
              >
                {item.status}
              </StatusBadge>
            </div>
          ))}
        </div>
      </CardContent>
      <div className="border-t border-border/50 px-3 py-2 bg-muted/10">
        <Button variant="ghost" size="sm" className="h-8 text-[13px] font-semibold text-primary w-full justify-start gap-1">
          View All Deadlines <ChevronRight className="size-4" />
        </Button>
      </div>
    </Card>
  )
}

function UpcomingSessionsWidget() {
  const sessions = [
    { date: '08', month: 'MAY', title: 'Effective Communication Workshop', time: '10:00 AM - 12:00 PM', type: 'Virtual Session', status: 'Registered' },
    { date: '12', month: 'MAY', title: 'Leadership Skills Training', time: '02:00 PM - 04:00 PM', type: 'Room 201, Building A', status: 'Registered' },
    { date: '18', month: 'MAY', title: 'Project Management Essentials', time: '10:00 AM - 12:00 PM', type: 'Virtual Session', status: 'Seat Available' },
  ]

  return (
    <Card className="flex h-[420px] flex-col overflow-hidden rounded-xl border-border/80 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5 border-b border-border/60">
        <CardTitle className="text-base font-bold">Upcoming Sessions</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs font-semibold text-primary">
          View Calendar <ChevronRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        <div className="flex flex-col divide-y divide-border/50">
          {sessions.map((item, i) => (
            <div key={i} className="flex flex-col gap-2 p-4 hover:bg-muted/30">
              <div className="flex items-start gap-3">
                <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border/80 bg-background py-1.5 shadow-sm">
                  <span className="text-base font-bold leading-none">{item.date}</span>
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{item.month}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1 min-w-0 pt-0.5">
                  <h4 className="text-sm font-semibold leading-tight text-foreground truncate">{item.title}</h4>
                  <p className="text-[11px] font-medium text-muted-foreground">{item.time} • {item.type}</p>
                </div>
              </div>
              <div className="flex justify-end">
                 <span className={cn('text-[11px] font-bold uppercase tracking-wider', item.status === 'Registered' ? 'text-success' : 'text-primary')}>
                   {item.status}
                 </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <div className="border-t border-border/50 px-3 py-2 bg-muted/10 mt-auto">
        <Button variant="ghost" size="sm" className="h-8 text-[13px] font-semibold text-primary w-full justify-start gap-1">
          Browse All Sessions <ChevronRight className="size-4" />
        </Button>
      </div>
    </Card>
  )
}

function QuickActionsWidget() {
  const actions = [
    { icon: BookMarked, label: 'Browse Course Catalog' },
    { icon: PlusCircle, label: 'Enroll in a Course' },
    { icon: FileText, label: 'My Transcript' },
    { icon: Download, label: 'Download Certificates' },
    { icon: Send, label: 'Request Training' },
    { icon: MessageSquare, label: 'Give Feedback' },
  ]

  return (
    <Card className="flex h-[420px] flex-col overflow-hidden rounded-xl border-border/80 shadow-sm bg-card">
      <CardHeader className="space-y-0 px-5 pb-3 pt-5 border-b border-border/60">
        <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-0">
        <div className="flex flex-col divide-y divide-border/30">
          {actions.map((action, i) => (
            <button 
              key={i}
              className="group flex items-center gap-3 px-5 py-4 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <action.icon className="size-4" />
              </div>
              <span className="text-sm font-semibold text-foreground flex-1 group-hover:text-primary transition-colors">{action.label}</span>
              <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary/70 transition-colors" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function RecentActivityWidget() {
  const activities = [
    { icon: CheckCircle2, text: 'You completed "Cyber Security Basics"', time: '2 hours ago', tone: 'success' },
    { icon: CalendarDays, text: 'You registered for "Leadership Skills Training"', time: 'Yesterday', tone: 'primary' },
    { icon: Bell, text: 'Your assignment "Workplace Safety" is due soon', time: 'Yesterday', tone: 'warning' },
    { icon: BookOpen, text: 'New course "AI Fundamentals" is available', time: '2 days ago', tone: 'neutral' },
  ]

  const toneMap = {
    success: 'bg-success/15 text-success',
    primary: 'bg-primary/15 text-primary',
    warning: 'bg-warning/15 text-warning',
    neutral: 'bg-muted text-muted-foreground'
  }

  return (
    <Card className="flex h-[420px] flex-col overflow-hidden rounded-xl border-border/80 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5 border-b border-border/60">
        <CardTitle className="text-base font-bold">Recent Activity</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs font-semibold text-primary">
          View All <ChevronRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-5">
        <div className="flex flex-col gap-6">
          {activities.map((item, i) => (
            <div key={i} className="flex gap-4 relative">
              {i !== activities.length - 1 && (
                <div className="absolute left-[15px] top-[30px] bottom-[-24px] w-px border-l-2 border-dashed border-border/60 z-0" />
              )}
              <div className="relative z-10 shrink-0 mt-0.5">
                <div className={cn("flex size-8 items-center justify-center rounded-full", toneMap[item.tone as keyof typeof toneMap])}>
                  <item.icon className="size-4" />
                </div>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-[13px] font-medium leading-relaxed text-foreground">{item.text}</p>
                <span className="text-[11px] font-semibold text-muted-foreground">{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DonutChart({ value, label, colorClass }: { value: number, label: string, colorClass: string }) {
  return (
    <div className="relative flex size-32 items-center justify-center rounded-full bg-muted/30">
      {/* Visual representation placeholder */}
      <div className={cn("absolute inset-0 rounded-full border-[10px] border-transparent border-t-current border-r-current rotate-45 opacity-80", colorClass)} />
      <div className="flex flex-col items-center justify-center rounded-full bg-card size-[104px] shadow-sm">
        <span className="text-3xl font-black tracking-tight text-foreground">{value}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

function LearningProgressWidget() {
  return (
    <Card className="flex h-[420px] flex-col overflow-hidden rounded-xl border-border/80 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5 border-b border-border/60">
        <CardTitle className="text-base font-bold">Learning Progress</CardTitle>
        <Button variant="outline" size="sm" className="h-7 text-xs font-semibold gap-1">
          This Month <ChevronDown className="size-3" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 p-6">
        <div className="flex items-center gap-6 justify-center lg:justify-start">
          <div className="shrink-0">
            <DonutChart value={65} label="Overall" colorClass="text-success" />
          </div>
          <div className="flex flex-1 flex-col gap-3 max-w-[200px]">
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span className="size-2.5 rounded-full bg-success"></span>
                Completed
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">18</span>
                <span className="text-muted-foreground w-8 text-right font-semibold">45%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span className="size-2.5 rounded-full bg-primary"></span>
                In Progress
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">4</span>
                <span className="text-muted-foreground w-8 text-right font-semibold">10%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span className="size-2.5 rounded-full bg-muted-foreground/40"></span>
                Not Started
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">18</span>
                <span className="text-muted-foreground w-8 text-right font-semibold">45%</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-auto rounded-lg bg-muted/40 p-4 flex items-center justify-between border border-border/50">
          <span className="text-sm font-semibold text-muted-foreground">Total Enrolled Courses</span>
          <span className="text-lg font-black text-foreground">40</span>
        </div>
      </CardContent>
    </Card>
  )
}

function CertificationsWidget() {
  return (
    <Card className="flex h-[420px] flex-col overflow-hidden rounded-xl border-border/80 shadow-sm">
      <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-3 pt-5 border-b border-border/60">
        <CardTitle className="text-base font-bold">Certifications</CardTitle>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs font-semibold text-primary">
          View All <ChevronRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 p-6">
        <div className="flex items-center gap-6 justify-center lg:justify-start">
          <div className="shrink-0">
            <DonutChart value={3} label="Total" colorClass="text-success" />
          </div>
          <div className="flex flex-1 flex-col gap-3 max-w-[200px]">
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span className="size-2.5 rounded-full bg-success"></span>
                Active
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">2</span>
                <span className="text-muted-foreground w-8 text-right font-semibold">67%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span className="size-2.5 rounded-full bg-warning"></span>
                Expiring Soon
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">1</span>
                <span className="text-muted-foreground w-8 text-right font-semibold">33%</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span className="size-2.5 rounded-full bg-danger"></span>
                Expired
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">0</span>
                <span className="text-muted-foreground w-8 text-right font-semibold">0%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <div className="border-t border-border/50 px-3 py-2 bg-muted/10 mt-auto">
        <Button variant="ghost" size="sm" className="h-8 text-[13px] font-semibold text-primary w-full justify-start gap-1">
          Manage Certifications <ChevronRight className="size-4" />
        </Button>
      </div>
    </Card>
  )
}

export function LmsDashboard() {
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
    <div className="relative space-y-5">
      {/* Page Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground lg:text-xl">
            Welcome back, John! <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-sm font-medium text-muted-foreground lg:text-sm">
            Here's what's happening with your learning today.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-10 justify-center gap-2 rounded-lg border-border/80 bg-card px-4 text-sm font-semibold shadow-sm"
        >
          <Settings className="size-4 text-muted-foreground" />
          Customize Dashboard
        </Button>
      </header>

      {/* KPI Cards Row */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Courses Assigned" value={12} subtext="4 In Progress" icon={BookOpen} trend="primary" />
        <KpiCard title="Mandatory Training" value={5} subtext="2 Overdue" icon={ClipboardCheck} trend="warning" />
        <KpiCard title="Upcoming Sessions" value={3} subtext="Next: Tomorrow" icon={Clock} trend="success" />
        <KpiCard title="Certifications Due" value={2} subtext="Next: 15 May 2025" icon={Award} trend="warning" />
        <KpiCard title="Learning Hours" value={28} subtext="This Month" icon={Trophy} trend="primary" />
        <KpiCard title="Completed Courses" value={18} subtext="All Time" icon={BarChart2} trend="primary" />
      </section>

      {/* Main Workspace (4-Column Grid) */}
      <section className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <MyLearningWidget />
        <UpcomingDeadlinesWidget />
        <UpcomingSessionsWidget />
        <QuickActionsWidget />
        
        <LearningProgressWidget />
        <CertificationsWidget />
        <RecentActivityWidget />
        
        <Card className="flex h-[420px] flex-col overflow-hidden rounded-xl border-border/80 shadow-sm bg-card">
          <CardHeader className="space-y-0 px-5 pb-3 pt-5 border-b border-border/60">
            <CardTitle className="text-base font-bold">Calendar</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-5 flex flex-col items-center">
            <div className="w-full max-w-[280px] mx-auto flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-sm font-bold text-foreground">
                  {format(date || new Date(), 'MMMM yyyy')}
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setDate(d => subMonths(d || new Date(), 1))}
                    className="flex size-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
                  >
                    <ChevronRight className="size-4 rotate-180" />
                  </button>
                  <button 
                    onClick={() => setDate(d => addMonths(d || new Date(), 1))}
                    className="flex size-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 w-full text-center gap-y-2 flex-1 content-start">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} className="text-[11px] font-bold tracking-wide text-muted-foreground mb-1">
                    {day}
                  </div>
                ))}
                
                {eachDayOfInterval({
                  start: startOfWeek(startOfMonth(date || new Date())),
                  end: endOfWeek(endOfMonth(date || new Date()))
                }).map((day, i) => {
                  const isCurrentMonth = isSameMonth(day, date || new Date())
                  const isCurrentDay = isToday(day)
                  // Simulate some events
                  const hasSession = i === 12 || i === 18
                  const hasDeadline = i === 15 || i === 24
                  
                  return (
                    <div key={i} className="flex justify-center items-center relative py-0.5">
                      <button className={cn(
                        "flex size-8 items-center justify-center rounded-md text-[13px] transition-colors relative z-10",
                        !isCurrentMonth ? "text-muted-foreground/30 font-medium" : "text-foreground font-medium",
                        isCurrentDay ? "bg-primary text-primary-foreground font-bold shadow-sm" : "hover:bg-muted/60"
                      )}>
                        {format(day, 'd')}
                      </button>
                      
                      {/* Dots underneath */}
                      {isCurrentMonth && (hasSession || hasDeadline) && (
                         <div className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 flex items-center gap-0.5 z-20">
                            {hasSession && <span className="size-1 rounded-full bg-primary" />}
                            {hasDeadline && <span className="size-1 rounded-full bg-warning" />}
                         </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3 mt-auto text-[11px] font-semibold tracking-wider uppercase text-muted-foreground pt-4 border-t border-border/40 w-full shrink-0">
              <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Session</div>
              <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" /> Deadline</div>
              <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> Event</div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
