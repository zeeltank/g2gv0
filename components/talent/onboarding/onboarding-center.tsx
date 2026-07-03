'use client'

import React, { useState } from 'react'
import {
  Search,
  Plus,
  ChevronDown,
  Users,
  UserCheck,
  Calendar,
  CheckCircle2,
  Shield,
  Filter,
  MoreHorizontal,
  Mail,
  Edit2,
  FileText,
  Laptop,
  BookOpen,
  DollarSign,
  Heart,
  FileCheck,
  ChevronRight,
  User,
  Bell,
  HelpCircle,
  ExternalLink,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import {
  mockOnboardingKPIs,
  mockPreboardingTasks,
  mockJourneySteps,
  mockIntegrations,
  mockDocuments,
  mockKeyContacts,
  mockOnboardingProfile,
} from './onboarding-data'

export function OnboardingCenter() {
  const [activeTab, setActiveTab] = useState('preboarding')

  const tabs = [
    { id: 'preboarding', label: 'Preboarding' },
    { id: 'journey', label: 'Onboarding Journey' },
    { id: 'probation', label: 'Probation & Confirmation' },
    { id: 'timeline', label: 'Lifecycle Timeline' },
  ]

  const getKpiIcon = (icon?: string) => {
    switch (icon) {
      case 'users': return <Users className="size-5 text-primary" />
      case 'user-check': return <UserCheck className="size-5 text-primary" />
      case 'calendar': return <Calendar className="size-5 text-primary" />
      case 'check-circle': return <CheckCircle2 className="size-5 text-primary" />
      case 'shield': return <Shield className="size-5 text-primary" />
      default: return <Users className="size-5 text-primary" />
    }
  }

  const getIntegrationIcon = (icon: string) => {
    switch (icon) {
      case 'it': return <Laptop className="size-5 text-muted-foreground" />
      case 'learning': return <BookOpen className="size-5 text-muted-foreground" />
      case 'payroll': return <DollarSign className="size-5 text-muted-foreground" />
      case 'benefits': return <Heart className="size-5 text-muted-foreground" />
      case 'compliance': return <FileCheck className="size-5 text-muted-foreground" />
      default: return <FileText className="size-5 text-muted-foreground" />
    }
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-300 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="hover:text-foreground cursor-pointer transition-colors">Home</span>
            <ChevronRight className="size-3.5" />
            <span className="hover:text-foreground cursor-pointer transition-colors">Onboarding & Lifecycle</span>
            <ChevronRight className="size-3.5" />
            <span className="hover:text-foreground cursor-pointer transition-colors">New Hire Journey</span>
            <ChevronRight className="size-3.5" />
            <span className="font-semibold text-foreground">{mockOnboardingProfile.id}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Onboarding & Employee Lifecycle Center</h1>
          <p className="text-sm text-muted-foreground">Manage end-to-end employee onboarding and lifecycle milestones.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64 hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search for employee, candidate, requisition..." className="pl-9 bg-background" />
          </div>
          <Button variant="outline" className="gap-2 bg-background">
            More Actions <ChevronDown className="size-4" />
          </Button>
          <Button className="gap-2">
            <Plus className="size-4" /> Add Task
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/40 mb-6 flex items-center gap-6 overflow-x-auto min-w-max px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'py-3 text-sm font-semibold transition-all border-b-2 outline-none flex items-center gap-2',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.id === 'preboarding' && <User className="size-4" />}
            {tab.id === 'journey' && <CheckCircle2 className="size-4" />}
            {tab.id === 'probation' && <FileText className="size-4" />}
            {tab.id === 'timeline' && <Calendar className="size-4" />}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Main Area (9 cols) */}
          <div className="xl:col-span-9 flex flex-col gap-6">
            
            {/* KPIs Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {mockOnboardingKPIs.map((kpi) => (
                <Card key={kpi.id} className="shadow-sm">
                  <CardContent className="p-4 flex flex-col h-full gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        {getKpiIcon(kpi.icon)}
                      </div>
                      <span className="text-sm font-semibold text-foreground/80">{kpi.title}</span>
                    </div>
                    <div className="flex flex-col gap-2 mt-1 pl-[52px]">
                      <span className="text-3xl font-bold text-foreground leading-none">{kpi.value}</span>
                      {kpi.title === 'Onboarding Completion' && (
                        <Progress value={parseInt(kpi.value)} className="h-1.5 w-full bg-muted mt-1" />
                      )}
                    </div>
                    <div className="pl-[52px] mt-auto pt-4">
                      <button className="text-xs font-bold text-primary hover:underline text-left">
                        View {kpi.title === 'Onboarding Completion' ? 'report' : 'all'}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Top Row: Tasks & Journey Progress */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              
              {/* Preboarding Tasks Table */}
              <div className="lg:col-span-2">
                <Card className="shadow-sm h-full flex flex-col">
                  <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Preboarding Tasks</CardTitle>
                    <div className="flex items-center gap-2">
                      <Select 
                        value="all" 
                        options={[{ label: 'All Tasks', value: 'all' }]} 
                      />
                      <Select 
                        value="all" 
                        options={[{ label: 'All Owners', value: 'all' }]} 
                      />
                      <Button variant="outline" size="icon" className="size-9 bg-background">
                        <Filter className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 mt-4 flex-1 flex flex-col justify-between">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10 pl-4"></TableHead>
                          <TableHead>Task</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-10 pr-4"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockPreboardingTasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell className="pl-4 py-3">
                              <Checkbox checked={task.status === 'Completed'} />
                            </TableCell>
                            <TableCell className="py-3 font-medium text-sm text-foreground">
                              {task.title}
                            </TableCell>
                            <TableCell className="py-3 text-sm text-muted-foreground">
                              {task.category}
                            </TableCell>
                            <TableCell className="py-3 text-sm text-muted-foreground">
                              {task.dueDate}
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                                  {task.owner.initials}
                                </div>
                                <span className="text-sm text-foreground">{task.owner.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <StatusBadge 
                                variant={
                                  task.status === 'Completed' ? 'success' : 
                                  task.status === 'Pending' ? 'warning' : 'primary'
                                }
                                className={cn(
                                  "px-2 py-0.5",
                                  task.status === 'Pending' ? "bg-orange-100 text-orange-600 border-0" : "",
                                  task.status === 'Sent' ? "bg-blue-100 text-blue-600 border-0" : "",
                                  task.status === 'Completed' ? "bg-green-100 text-green-700 border-0 flex items-center gap-1" : ""
                                )}
                              >
                                {task.status === 'Completed' && <Check className="size-3" />}
                                {task.status}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="pr-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger className="p-1 rounded hover:bg-muted text-muted-foreground outline-none">
                                  <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Mark Complete</DropdownMenuItem>
                                  <DropdownMenuItem>Edit Task</DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex items-center justify-between p-4 border-t border-border/40 text-xs text-muted-foreground bg-muted/10 mt-auto">
                      <span>Showing 1 to 7 of 12 tasks</span>
                      <button className="font-semibold text-primary hover:underline">View all tasks</button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Journey Progress */}
              <div className="lg:col-span-1">
                <Card className="shadow-sm h-full flex flex-col">
                  <CardHeader className="p-4 pb-2 border-b border-border/40">
                    <CardTitle className="text-base">Onboarding Journey Progress</CardTitle>
                    <div className="flex flex-col gap-2 mt-4 mb-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Overall Progress</span>
                        <span className="font-bold text-primary text-xl">42%</span>
                      </div>
                      <Progress value={42} className="h-2 bg-muted" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 pt-6 flex-1 overflow-y-auto">
                    <div className="relative pl-6 space-y-6">
                      {/* Vertical Line */}
                      <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-border/60"></div>
                      
                      {mockJourneySteps.map((step, idx) => (
                        <div key={step.id} className="relative">
                          {/* Node point */}
                          <div className={cn(
                            "absolute -left-6 w-4 h-4 rounded-full border-2 bg-background flex items-center justify-center top-0.5",
                            step.status === 'Completed' ? 'border-primary bg-primary' :
                            step.status === 'In Progress' ? 'border-primary ring-2 ring-primary/20' : 'border-border/80'
                          )}>
                            {step.status === 'Completed' && <CheckCircle2 className="size-2.5 text-primary-foreground" />}
                            {step.status === 'In Progress' && <div className="size-1.5 rounded-full bg-primary" />}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className={cn(
                              "text-sm font-semibold",
                              step.status === 'In Progress' ? 'text-primary' : 
                              step.status === 'Completed' ? 'text-foreground' : 'text-muted-foreground'
                            )}>
                              {step.title}
                            </span>
                            {(step.date || step.description) && (
                              <span className={cn(
                                "text-xs",
                                step.status === 'In Progress' ? 'text-primary/70 font-medium' : 'text-muted-foreground'
                              )}>
                                {step.date || step.description}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Integrations & Tasks Cards Row */}
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-foreground">Onboarding Integrations & Tasks</h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {mockIntegrations.map((integration) => (
                  <Card key={integration.id} className="shadow-sm">
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted/50 text-muted-foreground shrink-0 mt-0.5">
                        {getIntegrationIcon(integration.icon)}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-xs font-bold text-foreground line-clamp-1">{integration.title}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">{integration.description}</span>
                        <div className="mt-1">
                          <span className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded",
                            integration.status === 'In Progress' ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
                          )}>
                            {integration.status}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

          </div>

          {/* Right Area (Profile Sidebar) - 3 cols */}
          <div className="xl:col-span-3 flex flex-col gap-4 h-full">
            
            {/* Profile Card */}
            <Card className="shadow-sm">
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="size-16 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground shrink-0 overflow-hidden">
                    {mockOnboardingProfile.avatarInitials}
                  </div>
                  <div className="flex flex-col items-start gap-1.5 pt-1">
                    <h3 className="text-base font-bold text-foreground">{mockOnboardingProfile.name}</h3>
                    <StatusBadge variant="success" className="px-2 py-0.5 text-[10px] font-semibold bg-success/10 text-success border-0">
                      {mockOnboardingProfile.status}
                    </StatusBadge>
                  </div>
                </div>
                <div className="flex flex-col text-xs text-muted-foreground gap-1.5 pt-2">
                  <span className="text-sm font-semibold text-foreground">{mockOnboardingProfile.role}</span>
                  <span>{mockOnboardingProfile.department} • {mockOnboardingProfile.location}</span>
                  <span>DOJ: {mockOnboardingProfile.dateOfJoin} • {mockOnboardingProfile.id}</span>
                </div>
                <button className="text-xs font-semibold text-primary hover:underline mt-1 text-left flex items-center gap-1 w-fit">
                  View Employee Profile <ExternalLink className="size-3" />
                </button>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card className="shadow-sm flex-1 flex flex-col">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Documents</CardTitle>
                <button className="text-xs font-semibold text-primary hover:underline">View all</button>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex flex-col gap-3 flex-1">
                {mockDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium text-foreground truncate cursor-pointer hover:underline">{doc.fileName}</span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                      doc.status === 'Sent' ? 'text-primary bg-primary/10' : 'text-warning bg-warning/10'
                    )}>
                      {doc.status}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Key Contacts */}
            <Card className="shadow-sm flex-1 flex flex-col">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Key Contacts</CardTitle>
                <button className="text-xs font-semibold text-primary hover:underline">View all</button>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex flex-col gap-4 flex-1">
                {mockKeyContacts.map((contact) => (
                  <div key={contact.id} className="flex items-start justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground font-medium">{contact.role}</span>
                      <span className="text-xs font-semibold text-foreground">{contact.name}</span>
                      <span className="text-[10px] text-primary hover:underline cursor-pointer">{contact.email}</span>
                    </div>
                    <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                      <Mail className="size-3.5" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="shadow-sm flex-1 flex flex-col">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Notes</CardTitle>
                <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  <Plus className="size-3" /> Add Note
                </button>
              </CardHeader>
              <CardContent className="p-4 pt-4 flex flex-col items-center justify-center text-center gap-2 bg-muted/10 rounded-b-lg flex-1 min-h-[100px]">
                <Edit2 className="size-6 text-muted-foreground/30" />
                <span className="text-xs text-muted-foreground">No notes added yet.</span>
              </CardContent>
            </Card>

          </div>

        </div>
      </div>
    </div>
  )
}
