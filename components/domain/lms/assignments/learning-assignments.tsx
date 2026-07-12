'use client'

import React, { useState } from 'react'
import {
  Search,
  Bell,
  MoreVertical,
  Users,
  Clock,
  PlayCircle,
  CheckCircle2,
  CalendarDays,
  Filter,
  MonitorPlay,
  FileUp,
  UserPlus,
  Mail,
  ChevronDown,
  ChevronRight,
  Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

// Mock Data representing the wireframe
const ASSIGNMENTS_DATA = [
  {
    id: '1',
    initials: 'AS',
    name: 'Arjun Sharma',
    group: 'Marketing',
    course: 'Information Security Awareness',
    type: 'Course',
    assignmentType: 'Mandatory',
    dueDate: '20 May 2025',
    dueStatus: 'Overdue',
    status: 'Overdue',
    progress: 70,
    assignedBy: 'HR Manager',
    assignedOn: '10 Apr 2025',
  },
  {
    id: '2',
    initials: 'NP',
    name: 'Neha Patel',
    group: 'Finance',
    course: 'Code of Conduct',
    type: 'Course',
    assignmentType: 'Mandatory',
    dueDate: '25 May 2025',
    dueStatus: '2 days left',
    status: 'In Progress',
    progress: 40,
    assignedBy: 'HR Manager',
    assignedOn: '10 Apr 2025',
  },
  {
    id: '3',
    initials: 'RD',
    name: 'Ravi Desai',
    group: 'IT',
    course: 'Data Privacy Fundamentals',
    type: 'Course',
    assignmentType: 'Optional',
    dueDate: '10 Jun 2025',
    dueStatus: '18 days left',
    status: 'Not Started',
    progress: 0,
    assignedBy: 'Team Lead',
    assignedOn: '05 May 2025',
  },
  {
    id: '4',
    initials: 'SG',
    name: 'Sales Group',
    group: '12 Members',
    course: 'Product Knowledge 101',
    type: 'Learning Path',
    assignmentType: 'Mandatory',
    dueDate: '30 May 2025',
    dueStatus: '7 days left',
    status: 'In Progress',
    progress: 60,
    assignedBy: 'Department Head',
    assignedOn: '08 Apr 2025',
  },
  {
    id: '5',
    initials: 'PK',
    name: 'Priya Kapoor',
    group: 'HR',
    course: 'POSH Compliance Training',
    type: 'Course',
    assignmentType: 'Mandatory',
    dueDate: '15 May 2025',
    dueStatus: 'Overdue',
    status: 'Overdue',
    progress: 20,
    assignedBy: 'HR Manager',
    assignedOn: '01 Apr 2025',
  },
]

export function LearningAssignments() {
  const [activeTab, setActiveTab] = useState('queue')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const columns: Column<typeof ASSIGNMENTS_DATA[0]>[] = [
    {
      id: 'name',
      header: 'Learner / Group',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 border border-border/50">
            {row.initials}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground leading-snug">{row.name}</span>
            <span className="text-xs text-muted-foreground">{row.group}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'course',
      header: 'Course / Learning Path',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <MonitorPlay className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground leading-snug">{row.course}</span>
            <span className="text-xs text-muted-foreground">{row.type}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'assignmentType',
      header: 'Assignment Type',
      render: (val) => (
        <StatusBadge variant={val === 'Mandatory' ? 'error' : 'active'} className="bg-opacity-10 shadow-none border-none">
          {val as string}
        </StatusBadge>
      ),
    },
    {
      id: 'dueDate',
      header: 'Due Date ↓',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground leading-snug">{row.dueDate}</span>
          <span className={cn(
            "text-xs font-semibold",
            row.dueStatus === 'Overdue' ? "text-destructive" : "text-warning"
          )}>
            {row.dueStatus}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (val) => {
        const v = val as string;
        let variant: any = 'default';
        if (v === 'Overdue') variant = 'error';
        if (v === 'In Progress') variant = 'processing';
        if (v === 'Not Started') variant = 'inactive';
        
        return (
          <StatusBadge variant={variant} className="bg-opacity-10 shadow-none border-none">
            {v}
          </StatusBadge>
        )
      },
    },
    {
      id: 'progress',
      header: 'Progress',
      render: (val) => (
        <div className="flex items-center gap-2 w-full max-w-[100px]">
          <span className="text-xs font-bold w-8">{val}%</span>
          <Progress value={val as number} className="h-1.5 flex-1" />
        </div>
      ),
    },
    {
      id: 'assignedBy',
      header: 'Assigned By',
      render: (val) => <span className="text-sm font-medium">{val as string}</span>,
    },
    {
      id: 'assignedOn',
      header: 'Assigned On',
      render: (val) => <span className="text-sm font-medium">{val as string}</span>,
    },
    {
      id: 'id',
      header: '',
      render: () => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <MoreVertical className="size-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col w-full bg-background pb-12">
      
      {/* Top Navigation & Actions */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-6 shrink-0">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Learning Assignment & Enrollment</h1>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">Assign courses, enroll learners, and manage enrollment approvals.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="w-72 pl-9 h-9" placeholder="Search courses, learners, groups..." />
          </div>
          <div className="flex items-center gap-3 border-l border-border/60 pl-4">
            <Button variant="outline" className="font-semibold gap-2 shadow-sm">
              <FileUp className="size-4" /> Import Enrollments
            </Button>
            <div className="flex rounded-md shadow-sm">
              <Button className="rounded-r-none font-semibold gap-2 border-r border-primary-foreground/20">
                <Plus className="size-4" /> Assign Learning
              </Button>
              <Button className="rounded-l-none px-2 shrink-0">
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 shrink-0">
        <Card className="shadow-sm border-border/80">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Users className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Assigned</span>
              <span className="text-2xl font-black tracking-tight text-foreground">2,458</span>
              <span className="text-xs text-muted-foreground font-medium">Users</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/80">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Clock className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pending Approval</span>
              <span className="text-2xl font-black tracking-tight text-foreground">128</span>
              <span className="text-xs text-muted-foreground font-medium">Requests</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/80">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <PlayCircle className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">In Progress</span>
              <span className="text-2xl font-black tracking-tight text-foreground">1,732</span>
              <span className="text-xs text-muted-foreground font-medium">Enrollments</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/80">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completed</span>
              <span className="text-2xl font-black tracking-tight text-foreground">1,204</span>
              <span className="text-xs text-muted-foreground font-medium">Enrollments</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/80">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <CalendarDays className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Overdue</span>
              <span className="text-2xl font-black tracking-tight text-foreground">312</span>
              <span className="text-xs text-muted-foreground font-medium">Enrollments</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border/60 mb-4 shrink-0">
        {[
          { id: 'queue', label: 'Assignment Queue' },
          { id: 'enrollments', label: 'Enrollments' },
          { id: 'approval', label: 'Approval Queue', badge: '128' },
          { id: 'bulk', label: 'Bulk Operations' }
        ].map(tab => (
          <div
            key={tab.id}
            className={cn(
              "pb-3 cursor-pointer text-sm font-bold flex items-center gap-2 border-b-2 transition-colors",
              activeTab === tab.id 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none",
                activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {tab.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Main Content Area (Table + Filters Sidebar) */}
      <div className="flex flex-col xl:flex-row gap-6 items-stretch">
        
        {/* Table Area */}
        <div className="flex-1 flex flex-col w-full min-w-0">
          
          {/* Table Actions Bar */}
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" className="gap-2 h-8 font-bold bg-primary/5 border-primary/20 text-primary">
                <Filter className="size-3.5" /> Filter
              </Button>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{selectedIds.length} item selected</span>
                  <span className="text-sm font-semibold text-primary cursor-pointer hover:underline" onClick={() => setSelectedIds([])}>Clear</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 font-bold bg-background shadow-sm" disabled={selectedIds.length === 0}>Assign</Button>
              <Button variant="outline" size="sm" className="h-8 font-bold bg-background shadow-sm" disabled={selectedIds.length === 0}>Enroll</Button>
              <Button variant="outline" size="sm" className="h-8 font-bold bg-background shadow-sm" disabled={selectedIds.length === 0}>Approve</Button>
              <Button variant="outline" size="sm" className="h-8 font-bold bg-background shadow-sm text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive/20" disabled={selectedIds.length === 0}>Reject</Button>
              <Button variant="outline" size="sm" className="h-8 font-bold bg-background shadow-sm gap-2 ml-2" disabled={selectedIds.length === 0}>
                More <ChevronDown className="size-3" />
              </Button>
            </div>
          </div>

          {/* Data Table */}
          <div className="rounded-xl border border-border/80 shadow-sm bg-card overflow-hidden">
             <DataTable 
               columns={columns} 
               data={ASSIGNMENTS_DATA}
               selectable={true}
               selectedIds={selectedIds}
               onSelectChange={setSelectedIds}
               className="border-0 shadow-none rounded-none [&_th]:normal-case [&_th]:text-[13px] [&_th]:text-foreground [&_th]:font-bold"
             />
          </div>
          
          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground font-medium shrink-0">
            <span>Showing 1 to 5 of 2,458 results</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="size-8"><ChevronRight className="size-4 rotate-180" /></Button>
                <Button variant="outline" size="icon" className="size-8 bg-primary/10 text-primary border-primary/20 font-bold">1</Button>
                <Button variant="outline" size="icon" className="size-8 border-transparent">2</Button>
                <Button variant="outline" size="icon" className="size-8 border-transparent">3</Button>
                <span className="px-2">...</span>
                <Button variant="outline" size="icon" className="size-8 border-transparent">492</Button>
                <Button variant="outline" size="icon" className="size-8"><ChevronRight className="size-4" /></Button>
              </div>
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <Select options={[{label: '10', value: '10'}]} value="10" onChange={()=>{}} />
              </div>
            </div>
          </div>

          {/* Bottom Feature Cards (Moved inside the left column) */}
          <Card className="shadow-sm border-border/80 bg-card mt-6 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border/60 overflow-hidden">
            <div className="flex-1 flex items-start gap-5 p-8 hover:bg-muted/5 transition-colors cursor-pointer group">
              <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                <UserPlus className="size-5 text-foreground/70" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-foreground">Assign to Individuals or Groups</span>
                <span className="text-[13px] text-muted-foreground leading-snug">Assign learning to employees, teams, or departments.</span>
                <span className="text-sm font-bold text-primary mt-2 flex items-center gap-1 group-hover:underline">Assign Now <ChevronRight className="size-4" /></span>
              </div>
            </div>
            
            <div className="flex-1 flex items-start gap-5 p-8 hover:bg-muted/5 transition-colors cursor-pointer group">
              <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                <Mail className="size-5 text-foreground/70" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-foreground">Pending Approvals</span>
                <span className="text-[13px] text-muted-foreground leading-snug">Review and act on learner enrollment requests.</span>
                <span className="text-sm font-bold text-primary mt-2 flex items-center gap-1 group-hover:underline">View Approvals <ChevronRight className="size-4" /></span>
              </div>
            </div>

            <div className="flex-1 flex items-start gap-5 p-8 hover:bg-muted/5 transition-colors cursor-pointer group">
              <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                <FileUp className="size-5 text-foreground/70" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-bold text-foreground">Bulk Operations</span>
                <span className="text-[13px] text-muted-foreground leading-snug">Upload CSV to assign or enroll multiple learners.</span>
                <span className="text-sm font-bold text-primary mt-2 flex items-center gap-1 group-hover:underline">Upload CSV <ChevronRight className="size-4" /></span>
              </div>
            </div>
          </Card>

        </div>

        {/* Filters Sidebar */}
        <div className="w-full xl:w-[320px] shrink-0 flex flex-col bg-card rounded-xl border border-border/80 shadow-sm">
          <div className="p-4 border-b border-border/40 flex items-center justify-between">
            <h3 className="font-bold text-foreground">Filters</h3>
            <Button variant="ghost" size="icon" className="size-6 text-muted-foreground"><MoreVertical className="size-4" /></Button>
          </div>
          <div className="p-5 flex flex-col gap-6 flex-1">
            
            <div className="space-y-3">
              <label className="text-sm font-bold text-foreground">Quick Filters</label>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="font-semibold bg-destructive/5 text-destructive border-destructive/20 gap-1.5 cursor-pointer hover:bg-destructive/10 rounded-full px-3 py-1"><div className="size-1.5 rounded-full bg-destructive" /> Overdue</Badge>
                <Badge variant="outline" className="font-semibold bg-warning/5 text-warning border-warning/20 gap-1.5 cursor-pointer hover:bg-warning/10 rounded-full px-3 py-1"><div className="size-1.5 rounded-full bg-warning" /> Due Today</Badge>
                <Badge variant="outline" className="font-semibold bg-primary/5 text-primary border-primary/20 gap-1.5 cursor-pointer hover:bg-primary/10 rounded-full px-3 py-1"><div className="size-1.5 rounded-full bg-primary" /> Due This Week</Badge>
                <Badge variant="outline" className="font-semibold bg-secondary text-foreground gap-1.5 cursor-pointer hover:bg-secondary/80 rounded-full px-3 py-1"><div className="size-1.5 rounded-full bg-muted-foreground/40" /> Not Started</Badge>
                <Badge variant="outline" className="font-semibold bg-muted text-muted-foreground gap-1.5 cursor-pointer hover:bg-muted/80 rounded-full px-3 py-1"><div className="size-1.5 rounded-full bg-muted-foreground/50" /> In Progress</Badge>
                <Badge variant="outline" className="font-semibold bg-muted text-muted-foreground gap-1.5 cursor-pointer hover:bg-muted/80 rounded-full px-3 py-1"><div className="size-1.5 rounded-full bg-success/50" /> Completed</Badge>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assignment Type</label>
              <Select options={[{label: 'All', value: 'All'}]} value="All" onChange={()=>{}} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Learning Type</label>
              <Select options={[{label: 'All', value: 'All'}]} value="All" onChange={()=>{}} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</label>
              <Select options={[{label: 'All', value: 'All'}]} value="All" onChange={()=>{}} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department</label>
              <Select options={[{label: 'All', value: 'All'}]} value="All" onChange={()=>{}} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Due Date</label>
              <Input type="date" className="h-9 text-muted-foreground" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assigned By</label>
              <Select options={[{label: 'All', value: 'All'}]} value="All" onChange={()=>{}} />
            </div>

          </div>
          <div className="p-5 pt-0 flex items-center justify-between mt-auto">
             <Button variant="outline" className="font-bold shadow-sm rounded-full px-6">Reset</Button>
             <Button className="font-bold shadow-sm px-8 rounded-full">Apply Filters</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
