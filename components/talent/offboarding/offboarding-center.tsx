'use client'

import React, { useState } from 'react'
import {
  Search,
  Plus,
  Calendar,
  Users,
  Shield,
  Filter,
  MoreHorizontal,
  Settings,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Bookmark,
  Info,
  ChevronDown,
  LayoutList,
  KanbanSquare,
  History,
  Download,
  DoorOpen,
  LogOut,
  CheckCircle2,
  FileText,
  Clock,
  UserCheck,
  RefreshCcw,
  ClipboardList,
  AlertCircle,
  FileDigit,
  Trash2,
  User,
  Briefcase,
  Edit2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/status-badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

import {
  mockOffboardingKPIs,
  mockExitCases,
  type OffboardingKPI,
  type ExitCase
} from './offboarding-data'

export function OffboardingCenter() {
  const [selectedCases, setSelectedCases] = useState<string[]>([])
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [activeTopTab, setActiveTopTab] = useState('overview')
  
  const activeCase = activeCaseId ? mockExitCases.find(c => c.id === activeCaseId) : null
  
  const toggleCase = (id: string) => {
    setSelectedCases(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const getKpiIcon = (iconName: OffboardingKPI['icon']) => {
    switch (iconName) {
      case 'door-open': return <DoorOpen className="size-5" />
      case 'log-out': return <LogOut className="size-5" />
      case 'calendar': return <Calendar className="size-5" />
      case 'shield': return <Shield className="size-5" />
      case 'users': return <Users className="size-5" />
      case 'check-circle': return <CheckCircle2 className="size-5" />
      default: return <DoorOpen className="size-5" />
    }
  }

  const getStatusVariant = (status: ExitCase['status']) => {
    switch (status) {
      case 'Resignation Submitted': return 'default'
      case 'Notice Period': return 'primary'
      case 'Clearance': return 'warning'
      case 'Exit Interview': return 'primary'
      case 'Awaiting F&F': return 'error'
      case 'Closed': return 'success'
      default: return 'default'
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Offboarding Center</h1>
              <Info className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Manage employee exits from resignation to final closure.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="size-4" /> Export
            </Button>
            <div className="flex items-center">
              <Button className="rounded-r-none flex items-center gap-2 border-r border-primary-foreground/20">
                Create Exit Case
              </Button>
              <Button className="rounded-l-none px-2">
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* KPIs Row */}
        <div className="flex overflow-x-auto gap-4 mb-6 pb-2 custom-scrollbar">
          {mockOffboardingKPIs.map((kpi) => (
            <Card key={kpi.id} className="shadow-sm min-w-[180px] flex-1">
              <CardContent className="p-4 flex flex-col h-full gap-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{kpi.title}</span>
                  <Info className="size-3.5 text-muted-foreground/50" />
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <div className="p-2 rounded-xl bg-muted/50 text-muted-foreground border">
                    {getKpiIcon(kpi.icon)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold text-foreground leading-none">{kpi.value}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">{kpi.subtitle}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tabs & Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-6">
              {['Exit Cases', 'Clearance Tracker', 'Exit Interviews', 'Reports'].map((tab) => (
                <button
                  key={tab}
                  className={cn(
                    "pb-3 text-sm font-semibold transition-colors",
                    tab === 'Exit Cases' 
                      ? "text-primary border-b-2 border-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-3 pb-2">
              <div className="relative w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search exit cases..." className="pl-9 h-9" />
              </div>
              <Button variant="outline" className="flex items-center gap-2 h-9">
                <Filter className="size-4" /> Filters (3)
              </Button>
              <div className="w-[140px]">
                <Select value="saved" options={[{label: 'Saved Views', value: 'saved'}]} size="sm" />
              </div>
              
              <div className="flex p-0.5 bg-muted rounded-md border ml-2">
                <Button size="icon" className="p-1.5 text-primary">
                  <LayoutList className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" className="p-1.5 text-muted-foreground">
                  <KanbanSquare className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" className="p-1.5 text-muted-foreground">
                  <History className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Status Sub-tabs */}
          <div className="flex items-center gap-2">
            {[
              { label: 'All', count: 36, active: true },
              { label: 'Resignation Submitted', count: 9 },
              { label: 'Notice Period', count: 14 },
              { label: 'Clearance', count: 11 },
              { label: 'Awaiting F&F', count: 5 },
              { label: 'Closed', count: 18 }
            ].map((tab) => (
              <button
                key={tab.label}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-colors",
                  tab.active 
                    ? "bg-primary/10 text-primary border-primary/20" 
                    : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                )}
              >
                {tab.label}
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px]",
                  tab.active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Main Area (12 cols) */}
          <div className="xl:col-span-12 flex flex-col gap-6">
            <Card className="shadow-sm overflow-hidden border-border/60">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="w-[40px] pl-4">
                        <Checkbox />
                      </TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Employee</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Department</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Last Working...</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Exit Reason</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Status</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Owner</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Updated On</TableHead>
                      <TableHead className="w-[40px] text-center font-semibold text-foreground h-10">
                        <Settings className="size-4" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockExitCases.map((exitCase) => (
                      <TableRow 
                        key={exitCase.id} 
                        className={cn("hover:bg-muted/10 cursor-pointer", exitCase.id === activeCaseId && 'bg-primary/5 hover:bg-primary/5')}
                        onClick={() => setActiveCaseId(exitCase.id)}
                      >
                        <TableCell className="pl-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedCases.includes(exitCase.id)}
                            onCheckedChange={() => toggleCase(exitCase.id)}
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground border shrink-0">
                              {exitCase.employee.initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground whitespace-nowrap">{exitCase.employee.name}</span>
                              <span className="text-[10px] text-muted-foreground">{exitCase.employee.id}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground/80 py-3">{exitCase.department}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground/80 py-3">{exitCase.lastWorkingDay}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground/80 py-3">{exitCase.exitReason}</TableCell>
                        <TableCell className="py-3">
                          <StatusBadge 
                            variant={getStatusVariant(exitCase.status)}
                            className={cn(
                              "border-0 px-2 py-0.5 text-[10px] whitespace-nowrap",
                              exitCase.status === 'Notice Period' ? 'bg-primary/10 text-primary' :
                              exitCase.status === 'Clearance' ? 'bg-warning/10 text-warning-foreground' :
                              exitCase.status === 'Exit Interview' ? 'bg-primary/10 text-primary' :
                              exitCase.status === 'Awaiting F&F' ? 'bg-destructive/10 text-destructive' :
                              exitCase.status === 'Closed' ? 'bg-success/10 text-success' :
                              'bg-muted text-muted-foreground'
                            )}
                          >
                            {exitCase.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground/80 py-3 whitespace-nowrap">{exitCase.owner}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground/80 py-3 whitespace-nowrap">{exitCase.updatedOn}</TableCell>
                        <TableCell className="text-center py-3">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="p-3 border-t flex items-center justify-between bg-muted/5">
                <span className="text-xs text-muted-foreground">Showing 1 to 8 of 36 entries</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground"><ChevronLeft className="size-4" /></Button>
                    <Button variant="default" size="icon" className="h-7 w-7 text-xs bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30">1</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-xs text-muted-foreground">2</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-xs text-muted-foreground">3</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-xs text-muted-foreground">4</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-xs text-muted-foreground">5</Button>
                    <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground"><ChevronRight className="size-4" /></Button>
                  </div>
                  <div className="w-[100px]"><Select value="10" options={[{label: '10 / page', value: '10'}]} size="sm" /></div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Detail Drawer (Sheet) */}
      <Sheet open={!!activeCaseId} onOpenChange={(open) => !open && setActiveCaseId(null)}>
        <SheetContent side="right" className="w-[95vw] sm:max-w-4xl p-0 flex flex-col border-l">
          {activeCase && (
            <div className="flex flex-col h-full bg-background">
              {/* Header */}
              <div className="px-6 py-5 border-b flex items-center justify-between bg-surface relative">
                <Button variant="ghost" size="icon" className="absolute top-4 right-4 h-6 w-6 text-muted-foreground" onClick={() => setActiveCaseId(null)}>
                  <X className="size-4" />
                </Button>
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary border-2 shadow-sm border-background font-bold text-lg">
                    {activeCase.employee.initials}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{activeCase.employee.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-medium text-muted-foreground">{activeCase.employee.title}</p>
                      <span className="text-muted-foreground text-xs">•</span>
                      <p className="text-sm text-muted-foreground">{activeCase.employee.id}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mr-8">
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground mb-1">Status</span>
                    <StatusBadge 
                      variant={getStatusVariant(activeCase.status)} 
                      className={cn(
                        "px-2 py-0.5 text-[10px] border-0 h-5",
                        activeCase.status === 'Notice Period' ? 'bg-primary/10 text-primary' :
                        activeCase.status === 'Clearance' ? 'bg-warning/10 text-warning-foreground' :
                        activeCase.status === 'Exit Interview' ? 'bg-primary/10 text-primary' :
                        activeCase.status === 'Awaiting F&F' ? 'bg-destructive/10 text-destructive' :
                        activeCase.status === 'Closed' ? 'bg-success/10 text-success' :
                        'bg-muted text-muted-foreground'
                      )}
                    >
                      {activeCase.status}
                    </StatusBadge>
                  </div>
                </div>
              </div>

              {/* Top Tabs */}
              <div className="border-b overflow-x-auto scrollbar-hide px-6 bg-surface-muted/30 flex justify-between items-center">
                <div className="flex space-x-1 py-2">
                  {['overview', 'clearance', 'documents', 'exit-interview', 'activity', 'comments'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTopTab(tab)}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95 capitalize",
                        activeTopTab === tab
                          ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {tab.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content Area */}
              <div className="flex-1 flex overflow-hidden bg-surface">
                
                {activeTopTab === 'overview' ? (
                  <div className="flex-1 flex w-full">
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
                      
                      {/* Stepper Progress */}
                      <div className="pb-6 border-b border-border">
                        <div className="flex items-start justify-between relative max-w-2xl mx-auto mt-2">
                          <div className="absolute top-3.5 left-4 right-4 h-[2px] bg-border z-0">
                            <div className="h-full bg-primary w-[25%]" />
                          </div>
                          
                          {[
                            { step: 1, label: 'Resignation', icon: Check, status: 'completed' },
                            { step: 2, label: 'Notice Period', icon: Calendar, status: 'current' },
                            { step: 3, label: 'Clearance', icon: Shield, status: 'upcoming' },
                            { step: 4, label: 'Exit Interview', icon: Users, status: 'upcoming' },
                            { step: 5, label: 'F&F', icon: FileText, status: 'upcoming' },
                            { step: 6, label: 'Closed', icon: CheckCircle2, status: 'upcoming' }
                          ].map((s) => (
                            <div key={s.step} className="flex flex-col items-center gap-2 z-10 w-16">
                              <div className={cn(
                                "relative z-10 size-7 rounded-full flex items-center justify-center border-2 transition-colors",
                                s.status === 'completed' ? 'border-primary text-primary bg-surface' :
                                s.status === 'current' ? 'border-primary text-primary-foreground bg-primary' :
                                'border-border text-muted-foreground bg-surface'
                              )}>
                                <s.icon className={cn("size-3.5", s.status === 'current' ? 'text-primary-foreground' : '')} />
                              </div>
                              <span className={cn(
                                "text-[10px] font-semibold text-center leading-tight whitespace-pre-line",
                                s.status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'
                              )}>
                                {s.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="flex flex-col gap-6">
                          {/* Exit Details */}
                          <div className="flex flex-col gap-3">
                            <h4 className="text-sm font-bold text-foreground">Exit Details</h4>
                            <div className="grid grid-cols-[130px_1fr] gap-y-4 text-xs bg-muted/20 p-4 rounded-lg border border-border/50">
                              <span className="text-muted-foreground">Exit Reason</span>
                              <span className="font-semibold text-foreground">{activeCase.exitReason}</span>
                              
                              <span className="text-muted-foreground">Resignation Date</span>
                              <span className="font-semibold text-foreground">01 May 2025</span>
                              
                              <span className="text-muted-foreground">Last Working Day</span>
                              <span className="font-semibold text-foreground">{activeCase.lastWorkingDay}</span>
                              
                              <span className="text-muted-foreground">Notice Period</span>
                              <span className="font-semibold text-foreground">30 Days</span>
                              
                              <span className="text-muted-foreground">Handover To</span>
                              <span className="font-semibold text-foreground">Riya Kapoor</span>
                              
                              <span className="text-muted-foreground">Exit Type</span>
                              <span className="font-semibold text-foreground">Voluntary</span>
                            </div>
                          </div>
                          
                          {/* Owner & Approvals */}
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-foreground">Owner & Approvals</h4>
                              <Button variant="ghost" size="icon" className="h-6 w-6"><Edit2 className="size-3 text-muted-foreground" /></Button>
                            </div>
                            
                            <div className="flex flex-col gap-4 bg-muted/20 p-4 rounded-lg border border-border/50">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Case Owner</span>
                                <div className="flex items-center gap-3">
                                  <div className="size-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 border uppercase">
                                    {activeCase.owner.substring(0, 2)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-foreground">{activeCase.owner}</span>
                                    <span className="text-[10px] text-muted-foreground">HR Business Partner</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Final Approval</span>
                                <div className="flex items-center gap-3">
                                  <div className="size-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 border">
                                    <User className="size-4" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-foreground">Rahul Das</span>
                                    <span className="text-[10px] text-muted-foreground">HR Manager</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                        
                        {/* Right Column */}
                        <div className="flex flex-col gap-6">
                          {/* Next Actions Highlights */}
                          <div className="flex flex-col gap-3">
                            <h4 className="text-sm font-bold text-foreground">Next Actions</h4>
                            <div className="flex flex-col gap-3">
                              <div className="flex items-start gap-3 bg-muted/20 p-3 rounded-lg border border-border/50">
                                <div className="mt-0.5"><div className="size-4 rounded-full border border-primary text-primary flex items-center justify-center"><div className="size-2 bg-primary rounded-full" /></div></div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-foreground font-semibold">Complete knowledge transfer</span>
                                  <span className="text-[10px] text-muted-foreground">Assigned to: Riya Kapoor</span>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                                <div className="mt-0.5"><div className="size-4 rounded-full border border-muted-foreground" /></div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-foreground font-semibold">Submit pending documents</span>
                                  <span className="text-[10px] text-muted-foreground">Due: 15 May 2025</span>
                                </div>
                              </div>
                              <button className="text-[11px] font-semibold text-primary hover:underline mt-1 text-left">View All Actions (4)</button>
                            </div>
                          </div>
                          
                          {/* Progress Overall */}
                          <div className="flex flex-col gap-3 mt-2">
                            <h4 className="text-sm font-bold text-foreground">Progress Tracking</h4>
                            <div className="flex flex-col gap-5 bg-muted/20 p-4 rounded-lg border border-border/50">
                              <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-muted-foreground font-medium">Handover Progress</span>
                                  <span className="font-bold text-foreground">60%</span>
                                </div>
                                <Progress value={60} className="h-2" />
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-muted-foreground font-medium">Clearance Progress</span>
                                  <span className="font-bold text-foreground">30%</span>
                                </div>
                                <Progress value={30} className="h-2" />
                              </div>
                            </div>
                          </div>
                          
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Sidebar */}
                    <div className="w-[220px] bg-muted/10 border-l border-border p-4 flex flex-col gap-4 overflow-y-auto">
                      <h3 className="text-sm font-bold text-foreground">Actions</h3>
                      
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" className="w-full justify-start text-[11px] h-9 gap-2 font-medium bg-card hover:bg-muted/50 border-border/80">
                          <FileText className="size-3.5 text-muted-foreground" /> View Resignation
                        </Button>
                        <Button variant="outline" className="w-full justify-start text-[11px] h-9 gap-2 font-medium bg-card hover:bg-muted/50 border-border/80">
                          <Clock className="size-3.5 text-muted-foreground" /> Extend Notice
                        </Button>
                        <Button variant="outline" className="w-full justify-start text-[11px] h-9 gap-2 font-medium bg-card hover:bg-muted/50 border-border/80">
                          <Users className="size-3.5 text-muted-foreground" /> Assign Handover
                        </Button>
                        <Button variant="outline" className="w-full justify-start text-[11px] h-9 gap-2 font-medium bg-card hover:bg-muted/50 border-border/80">
                          <Shield className="size-3.5 text-muted-foreground" /> Update Clearance
                        </Button>
                        <Button variant="outline" className="w-full justify-start text-[11px] h-9 gap-2 font-medium bg-card hover:bg-muted/50 border-border/80">
                          <Calendar className="size-3.5 text-muted-foreground" /> Schedule Exit Interview
                        </Button>
                        <Button variant="outline" className="w-full justify-start text-[11px] h-9 gap-2 font-medium bg-card hover:bg-muted/50 border-border/80">
                          <CheckCircle2 className="size-3.5 text-muted-foreground" /> View Clearance Status
                        </Button>
                        <Button variant="outline" className="w-full justify-start text-[11px] h-9 gap-2 font-medium bg-card hover:bg-muted/50 border-border/80">
                          <FileDigit className="size-3.5 text-muted-foreground" /> Generate F&F
                        </Button>
                        <Button variant="outline" className="w-full justify-start text-[11px] h-9 gap-2 font-medium bg-card hover:bg-muted/50 border-border/80">
                          <CheckCircle2 className="size-3.5 text-muted-foreground" /> Close Exit Case
                        </Button>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-border">
                        <Button variant="outline" className="w-full justify-start text-[11px] h-9 gap-2 font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
                          <Trash2 className="size-3.5" /> Withdraw Resignation
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p>Tab content for "{activeTopTab}" would go here.</p>
                  </div>
                )}
                
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
