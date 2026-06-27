'use client'

import React from 'react'
import { 
  BookOpen, Layers, Briefcase, ClipboardCheck, Award, User, Target,
  Filter, Plus, LayoutGrid, Clock, Users, ArrowRight, CalendarDays
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Mock Data
const summaryMetrics = [
  { label: 'Total Competencies', value: '1,248', desc: 'Published', icon: BookOpen },
  { label: 'Active Frameworks', value: '24', desc: 'Published', icon: Layers },
  { label: 'Job Roles Mapped', value: '312', desc: 'Out of 345', icon: Briefcase },
  { label: 'Active Assessments', value: '8', desc: 'In progress', icon: ClipboardCheck },
  { label: 'Certifications', value: '2,156', desc: 'Valid', icon: Award },
  { label: 'Development Plans', value: '1,842', desc: 'Active', icon: User },
]

const progressMetrics = [
  { title: 'Role Mapping Completion', percent: 90, main: '312 / 345', sub: 'Roles Mapped', color: 'text-primary' },
  { title: 'Assessment Completion', percent: 68, main: '1,842 / 2,700', sub: 'Completed Assessments', color: 'text-emerald-500' },
  { title: 'Certification Compliance', percent: 86, main: '2,156 / 2,500', sub: 'Certified Employees', color: 'text-purple-500' },
  { title: 'Development Plan Completion', percent: 62, main: '1,142 / 1,842', sub: 'Completed Plans', color: 'text-orange-500' },
]

const workQueues = [
  { label: 'Pending My Approvals', count: 18, icon: User },
  { label: 'Pending Reviews', count: 27, icon: Users },
  { label: 'Open Assessments', count: 8, icon: ClipboardCheck },
  { label: 'Expiring Certifications (30 Days)', count: 46, icon: Award },
  { label: 'Overdue Development Plans', count: 31, icon: Target },
]

const recentActivity = [
  { user: 'Sarah Johnson', action: 'Completed assessment for Leadership Framework', time: '2h ago' },
  { user: 'Michael Lee', action: 'Approved development plan for Emily Davis', time: '5h ago' },
  { user: 'HR Team', action: 'Published framework "Technical Competencies v2.0"', time: '1d ago' },
  { user: 'Priya Sharma', action: 'Added certification proof for Project Management', time: '1d ago' },
  { user: 'James Walker', action: 'Updated proficiency level for Data Analysis', time: '2d ago' },
]

const quickActions = [
  { label: 'Create Competency', icon: BookOpen },
  { label: 'Create Framework', icon: Layers },
  { label: 'Launch Assessment', icon: ClipboardCheck },
  { label: 'Create Development Plan', icon: Target },
  { label: 'Create Role Mapping', icon: Briefcase },
  { label: 'Import Data', icon: ArrowRight }, // Using ArrowRight as a stand-in for import/cloud-upload
]

export function CmCommandCenter() {
  return (
    <div className="flex h-full flex-col gap-6 p-6 overflow-y-auto g2g-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Competency Command Center
          </h1>
          
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-10 px-4 shadow-md shadow-primary/20 flex items-center gap-2">
          <Plus className="w-4 h-4 stroke-[3]" /> Create New
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="grid grid-cols-5 gap-4 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-20">Business Unit</span>
            <Select value="all" options={[{ label: 'All', value: 'all' }]} className="h-9 bg-background/50 rounded-lg text-xs font-medium" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-20">Department</span>
            <Select value="all" options={[{ label: 'All', value: 'all' }]} className="h-9 bg-background/50 rounded-lg text-xs font-medium" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-16">Location</span>
            <Select value="all" options={[{ label: 'All', value: 'all' }]} className="h-9 bg-background/50 rounded-lg text-xs font-medium" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-20">Job Family</span>
            <Select value="all" options={[{ label: 'All', value: 'all' }]} className="h-9 bg-background/50 rounded-lg text-xs font-medium" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-16">Job Role</span>
            <Select value="all" options={[{ label: 'All', value: 'all' }]} className="h-9 bg-background/50 rounded-lg text-xs font-medium" />
          </div>
        </div>
        <Button variant="outline" className="h-9 rounded-lg px-4 gap-2 text-xs font-bold border-border bg-background/50">
          <Filter className="w-3.5 h-3.5" /> Filters
        </Button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryMetrics.map((metric, i) => (
          <div key={i} className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center gap-2 group hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
              <metric.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-foreground leading-none">{metric.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{metric.label}</div>
            <div className="text-xs text-muted-foreground">{metric.desc}</div>
            <button className="text-[10px] text-primary font-bold hover:underline mt-1 opacity-0 group-hover:opacity-100 transition-opacity">View all</button>
          </div>
        ))}
      </div>

      {/* Progress Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {progressMetrics.map((prog, i) => (
          <div key={i} className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl p-5 shadow-sm flex items-center gap-5">
            {/* Fake Circular Progress for UI Mockup */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-muted/30" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className={prog.color} strokeWidth="3" strokeDasharray={`${prog.percent}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
                {prog.percent}%
              </div>
            </div>
            <div className="flex flex-col flex-1">
              <div className="text-xs font-bold text-muted-foreground mb-1">{prog.title}</div>
              <div className="text-lg font-bold text-foreground leading-tight">{prog.main}</div>
              <div className="text-xs text-muted-foreground">{prog.sub}</div>
              <button className="text-[10px] text-primary font-bold hover:underline mt-2 self-start">View details</button>
            </div>
          </div>
        ))}
      </div>

      {/* Lower Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Work Queues */}
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/5 bg-primary/5">
            <h3 className="font-bold text-sm text-foreground">Work Queues</h3>
          </div>
          <div className="flex flex-col p-2">
            {workQueues.map((wq, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-primary/5 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                    <wq.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{wq.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-foreground">{wq.count}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-primary/5 mt-auto">
            <button className="text-xs text-primary font-bold hover:underline">View all work queues</button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/5 bg-primary/5">
            <h3 className="font-bold text-sm text-foreground">Recent Activity</h3>
          </div>
          <div className="flex flex-col p-5 gap-5">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0 mt-0.5">
                  {activity.user.charAt(0)}
                </div>
                <div className="flex flex-col flex-1 gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{activity.user}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">{activity.time}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.action}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-primary/5 mt-auto">
            <button className="text-xs text-primary font-bold hover:underline">View all activity</button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-[24px] shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/5 bg-primary/5">
            <h3 className="font-bold text-sm text-foreground">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5">
            {quickActions.map((qa, i) => (
              <button key={i} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-primary/10 bg-background/50 hover:bg-primary/5 hover:border-primary/30 transition-all group text-center">
                <qa.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs font-bold text-foreground">{qa.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Assessment Calendar Bottom Bar */}
      <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-4 flex items-center justify-between mt-2">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground">Assessment Calendar (Next 60 Days)</span>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Q2 Competency Assessment Cycle</span>
              <span className="text-xs text-muted-foreground ml-2">May 10 - Jun 30, 2026</span>
            </div>
          </div>
        </div>
        <Button variant="outline" className="h-9 rounded-lg font-bold text-xs bg-background">
          <CalendarDays className="w-3.5 h-3.5 mr-2" /> View Calendar
        </Button>
      </div>

    </div>
  )
}
