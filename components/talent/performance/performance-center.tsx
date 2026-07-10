'use client'

import React, { useState } from 'react'
import {
  Search,
  Plus,
  Calendar,
  Users,
  Clock,
  UserCheck,
  Scale,
  CheckCircle2,
  Gift,
  Filter,
  MoreHorizontal,
  Settings,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  FileText,
  Bookmark,
  Info,
  ChevronDown,
  LayoutList,
  KanbanSquare,
  History,
  Send,
  Eye,
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
import { cn } from '@/lib/utils'

import {
  mockPerformanceKPIs,
  mockEmployeeReviews,
  mockActivityFeed,
  type PerformanceKPI,
  type EmployeeReview
} from './performance-data'

export function PerformanceCenter() {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(['rev-1', 'rev-2', 'rev-3'])

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const getKpiIcon = (iconName: PerformanceKPI['icon']) => {
    switch (iconName) {
      case 'calendar': return <Calendar className="size-5" />
      case 'users': return <Users className="size-5" />
      case 'user-clock': return <Clock className="size-5" />
      case 'user-check': return <UserCheck className="size-5" />
      case 'scale': return <Scale className="size-5" />
      case 'check-circle': return <CheckCircle2 className="size-5" />
      case 'gift': return <Gift className="size-5" />
      default: return <Calendar className="size-5" />
    }
  }

  const getStageVariant = (stage: EmployeeReview['stage']) => {
    switch (stage) {
      case 'Self Review': return 'primary'
      case 'Manager Review': return 'processing'
      case 'Calibration': return 'warning'
      case 'Final Review': return 'success'
      case 'Completed': return 'success'
      default: return 'default'
    }
  }

  const getStatusVariant = (status: EmployeeReview['status']) => {
    switch (status) {
      case 'Completed': return 'success'
      case 'In Progress': return 'primary'
      case 'Pending': return 'warning'
      default: return 'default'
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Performance & Rewards Center</h1>
              <Info className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Manage goals, performance reviews, ratings, appraisals and reward decisions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-[220px]">
              <Select 
                value="fy24"
                options={[{ label: "FY 2024-25 (Apr'24-Mar'25)", value: 'fy24' }]}
              />
            </div>
            <div className="w-[120px]">
              <Select 
                value="actions"
                options={[{ label: 'Actions', value: 'actions' }]}
              />
            </div>
            <Button className="flex items-center gap-2">
              <Plus className="size-4" /> Create / Launch
            </Button>
          </div>
        </div>

        {/* KPIs Row - Horizontal Scroll or Grid */}
        <div className="flex overflow-x-auto gap-4 mb-6 pb-2 custom-scrollbar">
          {mockPerformanceKPIs.map((kpi) => (
            <Card key={kpi.id} className="shadow-sm min-w-[200px] flex-1">
              <CardContent className="p-4 flex flex-col h-full gap-2 relative">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-muted/50 text-muted-foreground border">
                    {getKpiIcon(kpi.icon)}
                  </div>
                  <span className="text-sm font-semibold text-foreground/80 leading-tight">{kpi.title}</span>
                </div>
                <div className="flex flex-col gap-1 mt-2 pl-[48px]">
                  <span className="text-3xl font-bold text-foreground leading-none">{kpi.value}</span>
                  <span className="text-[10px] text-muted-foreground">{kpi.subtitle}</span>
                </div>
                {kpi.progress && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    <div className="size-12 rounded-full border-4 border-primary/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-foreground">{kpi.progress}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Main Area (9 cols) */}
          <div className="xl:col-span-9 flex flex-col gap-5">
            
            {/* Top Tabs */}
            <div className="flex items-center gap-6 border-b border-border">
              {['Goals', 'Reviews', 'Appraisals', 'Compensation', 'Bonus', 'Calibration'].map((tab) => (
                <button
                  key={tab}
                  className={cn(
                    "pb-3 text-sm font-semibold flex items-center gap-2 transition-colors",
                    tab === 'Reviews' 
                      ? "text-primary border-b-2 border-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === 'Reviews' && <CheckCircle2 className="size-4" />}
                  {tab}
                </button>
              ))}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-[160px]"><Select value="all_dept" options={[{label: 'All Departments', value: 'all_dept'}]} /></div>
              <div className="w-[160px]"><Select value="all_mgr" options={[{label: 'All Managers', value: 'all_mgr'}]} /></div>
              <div className="w-[160px]"><Select value="all_status" options={[{label: 'All Status', value: 'all_status'}]} /></div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search employee" className="pl-9" />
              </div>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="size-4" /> More Filters
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Bookmark className="size-4" /> Saved Views <ChevronDown className="size-3" />
              </Button>
            </div>

            {/* Secondary Tabs & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="flex p-1 bg-muted/50 rounded-lg border">
                  <Button size="sm" className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-foreground">
                    <LayoutList className="size-4" /> Employee List
                  </Button>
                  <Button size="sm" variant="ghost" className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                    <KanbanSquare className="size-4" /> Review Board
                  </Button>
                  <Button size="sm" variant="ghost" className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                    <History className="size-4" /> Cycle Timeline
                  </Button>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs font-semibold text-foreground">{selectedEmployees.length} selected</span>
                  <Button variant="ghost" size="sm" className="text-xs font-medium text-primary hover:underline h-auto p-0">Clear Selection</Button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-[140px]"><Select value="start_action" options={[{label: 'Start Action', value: 'start_action'}]} /></div>
                <Button variant="outline" className="flex items-center gap-2">
                  More <ChevronDown className="size-3" />
                </Button>
              </div>
            </div>

            {/* Table Area */}
            <Card className="shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[40px] pl-4">
                        <Checkbox checked={true} />
                      </TableHead>
                      <TableHead className="font-semibold text-foreground">Employee</TableHead>
                      <TableHead className="font-semibold text-foreground">Department</TableHead>
                      <TableHead className="font-semibold text-foreground">Manager</TableHead>
                      <TableHead className="font-semibold text-foreground">Cycle</TableHead>
                      <TableHead className="font-semibold text-foreground">Stage</TableHead>
                      <TableHead className="font-semibold text-foreground">Overall Rating</TableHead>
                      <TableHead className="font-semibold text-foreground">Status</TableHead>
                      <TableHead className="font-semibold text-foreground">Due Date</TableHead>
                      <TableHead className="w-[60px] text-center font-semibold text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockEmployeeReviews.map((review) => (
                      <TableRow key={review.id} className="hover:bg-muted/10 cursor-pointer">
                        <TableCell className="pl-4">
                          <Checkbox 
                            checked={selectedEmployees.includes(review.id)}
                            onCheckedChange={() => toggleEmployee(review.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border">
                              {review.employee.initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground">{review.employee.name}</span>
                              <span className="text-xs text-muted-foreground">{review.employee.id}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground/80">{review.department}</TableCell>
                        <TableCell className="text-sm text-foreground/80">{review.manager}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground/80">{review.cycle.split(' ')[0]} {review.cycle.split(' ')[1]}</span>
                            <span className="text-[10px] text-muted-foreground">{review.cycle.split(' ')[2]}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge 
                            variant={getStageVariant(review.stage)}
                            className="bg-transparent border shadow-sm px-2.5 py-1 text-xs"
                          >
                            {review.stage}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          {review.overallRating ? (
                            <div className="flex items-center gap-1.5">
                              <div className={cn(
                                "size-2 rounded-full",
                                review.overallRating.startsWith('5') ? 'bg-success' :
                                review.overallRating.startsWith('4') ? 'bg-success' :
                                review.overallRating.startsWith('3') ? 'bg-primary' : 'bg-warning'
                              )} />
                              <span className="text-sm font-medium text-foreground">{review.overallRating}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge 
                            variant={getStatusVariant(review.status)}
                            className={cn(
                              "border-0 px-2 py-0.5",
                              review.status === 'In Progress' ? 'bg-primary/10 text-primary' :
                              review.status === 'Pending' ? 'bg-warning/10 text-warning-foreground' :
                              'bg-success/10 text-success'
                            )}
                          >
                            {review.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-sm text-foreground/80">
                          {review.dueDate || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="p-4 border-t flex items-center justify-between bg-muted/5">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Showing 1 to 25 of 612 entries</span>
                  <div className="w-[120px]"><Select value="25" options={[{label: '25 per page', value: '25'}]} /></div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="text-muted-foreground"><ChevronLeft className="size-4 mr-1" /> Previous</Button>
                  <Button variant="default" size="sm" className="h-8 w-8">1</Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 text-muted-foreground">2</Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 text-muted-foreground">3</Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 text-muted-foreground">4</Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 text-muted-foreground">5</Button>
                  <span className="text-muted-foreground px-2">...</span>
                  <Button variant="ghost" size="sm" className="h-8 w-8 text-muted-foreground">25</Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">Next <ChevronRight className="size-4 ml-1" /></Button>
                </div>
              </div>
            </Card>

            {/* Activity Feed Section */}
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center gap-6 border-b border-border">
                {['Activity Feed', 'Comments (3)', 'Notes (2)', 'Attachments (4)', 'Audit Trail'].map((tab) => (
                  <button
                    key={tab}
                    className={cn(
                      "pb-3 text-sm font-semibold transition-colors",
                      tab === 'Activity Feed' 
                        ? "text-primary border-b-2 border-primary" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              <div className="flex flex-col gap-6 py-2 px-2">
                {mockActivityFeed.map((activity, index) => (
                  <div key={activity.id} className="flex gap-4 relative">
                    {index !== mockActivityFeed.length - 1 && (
                      <div className="absolute left-[15px] top-8 bottom-[-24px] w-0.5 bg-border"></div>
                    )}
                    <div className={cn(
                      "size-8 rounded-full flex items-center justify-center shrink-0 z-10 border",
                      activity.type === 'status_change' ? 'bg-primary/10 text-primary border-primary/20' :
                      activity.type === 'reminder' ? 'bg-warning/10 text-warning border-warning/20' :
                      'bg-success/10 text-success border-success/20'
                    )}>
                      {activity.type === 'status_change' ? <div className="size-1.5 rounded-full bg-primary" /> :
                       activity.type === 'reminder' ? <div className="size-1.5 rounded-full bg-warning" /> :
                       <Check className="size-3.5" />}
                    </div>
                    <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-2 pt-1.5">
                      <p className="text-sm text-foreground">
                        {activity.type === 'status_change' && <span className="font-bold border bg-muted px-1.5 py-0.5 rounded text-xs mr-2">{activity.userInitial}</span>}
                        {activity.type === 'status_change' ? (
                          <><span className="font-semibold">{activity.userName}</span> {activity.action}</>
                        ) : (
                          <>{activity.action}</>
                        )}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">{activity.date}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end mt-2">
                  <button className="text-xs font-semibold text-primary hover:underline">View All</button>
                </div>
              </div>
            </div>

          </div>

          {/* Right Area (Sidebar) - 3 cols */}
          <div className="xl:col-span-3 flex flex-col gap-4 h-full">
            
            {/* Employee Overview Card */}
            <Card className="shadow-sm flex flex-col flex-1 relative overflow-hidden">
              <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-muted-foreground">
                <X className="size-4" />
              </Button>
              
              <div className="p-5 flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-foreground">Employee Overview</h2>
                
                <div className="flex items-start gap-3">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0">
                    AS
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-bold text-foreground">Arjun Sharma</h3>
                    <span className="text-xs text-muted-foreground">E1234</span>
                    <span className="text-sm font-medium text-foreground mt-0.5">Product Manager</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <div className="flex items-center gap-1.5"><LayoutList className="size-3.5" /> Product</div>
                  <span className="text-border">|</span>
                  <div className="flex items-center gap-1.5"><Filter className="size-3.5" /> Bangalore</div>
                  <span className="text-border">|</span>
                  <div className="flex items-center gap-1.5"><Calendar className="size-3.5" /> Joined 12 Jan 2021</div>
                </div>

                {/* Internal Tabs */}
                <div className="flex items-center gap-4 border-b border-border mt-2">
                  {['Overview', 'Goals', 'Reviews', 'Compensation', 'Docs', 'More'].map((tab) => (
                    <button
                      key={tab}
                      className={cn(
                        "pb-2 text-xs font-semibold transition-colors flex items-center gap-1",
                        tab === 'Overview' 
                          ? "text-primary border-b-2 border-primary" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab} {tab === 'More' && <ChevronDown className="size-3" />}
                    </button>
                  ))}
                </div>

                {/* Review Cycle Progress */}
                <div className="flex flex-col gap-3 mt-2">
                  <h4 className="text-sm font-semibold text-foreground">Review Cycle Progress</h4>
                  
                  {/* Stepper */}
                  <div className="flex items-start justify-between relative mt-2 mb-4 px-2">
                    <div className="absolute top-3 left-6 right-6 h-[2px] bg-border z-0">
                      <div className="h-full bg-primary w-[25%]" />
                    </div>
                    
                    {[
                      { step: 1, label: 'Self Review', status: 'completed' },
                      { step: 2, label: 'Manager\nReview', status: 'current' },
                      { step: 3, label: 'Calibration', status: 'upcoming' },
                      { step: 4, label: 'Final Review', status: 'upcoming' },
                      { step: 5, label: 'Completed', status: 'upcoming' }
                    ].map((s) => (
                      <div key={s.step} className="flex flex-col items-center gap-2 z-10 w-16">
                        <div className={cn(
                          "size-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 bg-background",
                          s.status === 'completed' ? 'border-primary bg-primary text-primary-foreground' :
                          s.status === 'current' ? 'border-primary text-primary' :
                          'border-muted bg-muted text-muted-foreground'
                        )}>
                          {s.status === 'completed' ? <Check className="size-3" /> : s.step}
                        </div>
                        <span className="text-[9px] font-semibold text-center leading-tight whitespace-pre-line text-muted-foreground">
                          {s.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Ratings Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border rounded-lg bg-muted/20 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">Overall Rating (Draft)</span>
                      <span className="text-xs text-foreground mt-2 border-t pt-2 border-dashed">Not yet rated</span>
                    </div>
                    <div className="p-3 border rounded-lg bg-muted/20 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-muted-foreground">Potential Rating (Draft)</span>
                      <span className="text-xs text-foreground mt-2 border-t pt-2 border-dashed">Not yet rated</span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 mt-4 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><div className="size-4 rounded bg-primary/10 flex items-center justify-center"><LayoutList className="size-2.5 text-primary" /></div> Current Stage</span>
                      <span className="font-semibold text-primary pl-5.5">Self Review</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><div className="size-4 rounded bg-success/10 flex items-center justify-center"><CheckCircle2 className="size-2.5 text-success" /></div> Status</span>
                      <span className="font-semibold text-foreground pl-5.5">In Progress</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="size-3.5" /> Due Date</span>
                      <span className="font-semibold text-foreground pl-5">15 May 2025</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><UserCheck className="size-3.5" /> Manager</span>
                      <div className="flex items-center gap-1.5 pl-5">
                        <div className="size-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">RM</div>
                        <span className="font-semibold text-foreground">Rohit Malhotra</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="size-3.5" /> Last Updated</span>
                      <span className="font-medium text-foreground pl-5">05 May 2025, 11:30 AM</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Edit2 className="size-3.5" /> Last Updated By</span>
                      <div className="flex items-center gap-1.5 pl-5">
                        <div className="size-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">AS</div>
                        <span className="font-semibold text-foreground">Arjun Sharma</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-col gap-2 mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-1">Quick Actions</h4>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-xs flex items-center gap-1.5">
                        <Send className="size-3" /> Send Reminder
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs flex items-center gap-1.5">
                        <Eye className="size-3" /> View Review
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs flex items-center gap-1.5">
                        <Edit2 className="size-3" /> Add Note
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs flex items-center gap-1.5">
                        More <ChevronDown className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Team Comparison */}
                  <div className="flex flex-col gap-3 mt-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Team Comparison (Product Department)</h4>
                      <button className="text-[10px] font-semibold text-primary hover:underline">View Details</button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">Average Rating</span>
                        <span className="text-base font-bold text-foreground flex items-center gap-1">3.8 <span className="text-[10px] font-normal text-muted-foreground">(Meets)</span></span>
                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1 flex items-center">
                           <div className="h-full bg-primary/30 w-full relative"><div className="absolute right-1/4 top-1/2 -translate-y-1/2 size-1.5 bg-primary rounded-full"></div></div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">Top Performer %</span>
                        <span className="text-base font-bold text-foreground">18%</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">Low Performer %</span>
                        <span className="text-base font-bold text-foreground">6%</span>
                        <div className="flex flex-col gap-0.5 mt-2">
                          <span className="text-[9px] font-semibold text-muted-foreground">Calibration Status</span>
                          <div className="flex items-center gap-1">
                            <div className="size-1.5 rounded-full bg-primary"></div>
                            <span className="text-[10px] text-foreground">In Progress</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </div>
  )
}
