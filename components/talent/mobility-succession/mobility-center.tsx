'use client'

import React, { useState } from 'react'
import {
  Search,
  Plus,
  Calendar,
  Users,
  Briefcase,
  FileText,
  ArrowLeftRight,
  TrendingUp,
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
  ArrowUpCircle,
  Minus,
  ArrowRight,
  Edit2,
  PowerOff,
  User,
  Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  mockMobilityKPIs,
  mockInternalJobs,
  type MobilityKPI,
  type InternalJob
} from './mobility-data'

export function MobilityCenter() {
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  
  const toggleJob = (id: string) => {
    setSelectedJobs(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const getKpiIcon = (iconName: MobilityKPI['icon']) => {
    switch (iconName) {
      case 'briefcase': return <Briefcase className="size-5" />
      case 'users': return <Users className="size-5" />
      case 'file-text': return <FileText className="size-5" />
      case 'arrow-left-right': return <ArrowLeftRight className="size-5" />
      case 'trending-up': return <TrendingUp className="size-5" />
      case 'shield': return <Shield className="size-5" />
      default: return <Briefcase className="size-5" />
    }
  }

  const getStatusVariant = (status: InternalJob['status']) => {
    switch (status) {
      case 'Open': return 'success'
      case 'In Review': return 'primary'
      case 'Closed': return 'default'
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
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Internal Mobility & Succession Center</h1>
              <Info className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Manage internal job opportunities, talent movement and build future leadership pipelines.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="size-4" /> Export
            </Button>
            <div className="flex items-center">
              <Button className="rounded-r-none flex items-center gap-2 border-r border-primary-foreground/20">
                <Plus className="size-4" /> Create New
              </Button>
              <Button className="rounded-l-none px-2">
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex items-center gap-6 border-b border-border mb-6">
          {['Overview', 'Internal Jobs', 'Applications', 'Transfers', 'Promotions', 'Succession Plans', 'Talent Pools'].map((tab) => (
            <button
              key={tab}
              className={cn(
                "pb-3 text-sm font-semibold transition-colors",
                tab === 'Overview' 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* KPIs Row */}
        <div className="flex overflow-x-auto gap-4 mb-6 pb-2 custom-scrollbar">
          {mockMobilityKPIs.map((kpi) => (
            <Card key={kpi.id} className="shadow-sm min-w-[200px] flex-1">
              <CardContent className="p-4 flex flex-col h-full gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-muted/50 text-muted-foreground border">
                    {getKpiIcon(kpi.icon)}
                  </div>
                  <span className="text-sm font-semibold text-foreground/80 leading-tight">{kpi.title}</span>
                </div>
                
                <div className="flex items-end justify-between pl-[52px]">
                  <span className="text-3xl font-bold text-foreground leading-none">{kpi.value}</span>
                </div>
                
                <div className="pl-[52px] mt-auto">
                  {kpi.action ? (
                    <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 mt-1">
                      {kpi.action} <ArrowRight className="size-3" />
                    </button>
                  ) : kpi.trend.isNeutral ? (
                    <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                      <Minus className="size-3.5" />
                      <span className="text-xs font-medium">{kpi.trend.value}</span>
                    </div>
                  ) : (
                    <div className={cn(
                      "flex items-center gap-1.5 mt-1",
                      kpi.trend.isPositive ? "text-success" : "text-warning"
                    )}>
                      {kpi.trend.isPositive ? <ArrowUpCircle className="size-3.5" /> : <ArrowRight className="size-3.5" />}
                      <span className="text-xs font-medium">{kpi.trend.value}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
              <span className="text-muted-foreground">Business Unit</span>
              <span className="font-semibold text-foreground">All</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
              <span className="text-muted-foreground">Department</span>
              <span className="font-semibold text-foreground">All</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
              <span className="text-muted-foreground">Location</span>
              <span className="font-semibold text-foreground">All</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
              <span className="text-muted-foreground">Grade</span>
              <span className="font-semibold text-foreground">All</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
              <span className="text-muted-foreground">Job Type</span>
              <span className="font-semibold text-foreground">All</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex items-center gap-2 h-9">
              <Filter className="size-4" /> More Filters
            </Button>
            <Button variant="outline" className="flex items-center gap-2 h-9">
              <Bookmark className="size-4" /> Save View
            </Button>
          </div>
        </div>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Main Area (9 cols) */}
          <div className="xl:col-span-9 flex flex-col gap-6">
            
            {/* Table Header & Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">Internal Jobs</h2>
                  <span className="bg-muted px-2 py-0.5 rounded text-xs font-semibold text-muted-foreground">18</span>
                </div>
                <div className="flex p-1 bg-muted/30 rounded-lg border ml-4">
                  <button className="flex items-center gap-2 px-3 py-1 bg-background shadow-sm rounded text-xs font-semibold text-primary">
                    Table
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground">
                    Board
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground">
                    Timeline
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Sort by:</span>
                  <span className="font-semibold text-foreground">Posted Date</span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground border">
                  <Settings className="size-4" />
                </Button>
              </div>
            </div>

            {/* Table Area */}
            <Card className="shadow-sm overflow-hidden border-border/60">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="w-[40px] pl-4">
                        <Checkbox />
                      </TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Job Title</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Department</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Location</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Grade</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Posted On</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Applications</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Status</TableHead>
                      <TableHead className="w-[40px] text-center font-semibold text-foreground h-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockInternalJobs.map((job) => (
                      <TableRow key={job.id} className={cn("hover:bg-muted/10 cursor-pointer", job.id === 'job-1' && 'bg-primary/5 hover:bg-primary/5')}>
                        <TableCell className="pl-4 py-3">
                          <Checkbox 
                            checked={selectedJobs.includes(job.id)}
                            onCheckedChange={() => toggleJob(job.id)}
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">{job.title}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">{job.jobId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground/80 py-3">{job.department}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground/80 py-3">{job.location}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground/80 py-3">{job.grade}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground/80 py-3">{job.postedOn}</TableCell>
                        <TableCell className="text-xs font-medium text-foreground py-3 text-center">{job.applications}</TableCell>
                        <TableCell className="py-3">
                          <StatusBadge 
                            variant={getStatusVariant(job.status)}
                            className={cn(
                              "border-0 px-2.5 py-0.5 text-[10px]",
                              job.status === 'Open' ? 'bg-success/10 text-success' :
                              job.status === 'In Review' ? 'bg-primary/10 text-primary' :
                              'bg-muted text-muted-foreground'
                            )}
                          >
                            {job.status}
                          </StatusBadge>
                        </TableCell>
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
                <span className="text-xs text-muted-foreground">Showing 1 to 10 of 18 entries</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground"><ChevronLeft className="size-4" /></Button>
                    <Button variant="default" size="icon" className="h-7 w-7 text-xs">1</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-xs text-muted-foreground">2</Button>
                    <Button variant="outline" size="icon" className="h-7 w-7 text-muted-foreground"><ChevronRight className="size-4" /></Button>
                  </div>
                  <div className="w-[100px]"><Select value="10" options={[{label: '10 / page', value: '10'}]} size="sm" /></div>
                </div>
              </div>
            </Card>

            {/* Analytics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <Card className="shadow-sm border-border/60">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-xs font-semibold">Talent Movement Summary</CardTitle>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                    This Quarter <ChevronDown className="size-3" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-4 flex items-center gap-6">
                  {/* Fake Donut Chart */}
                  <div className="relative size-24 shrink-0 rounded-full border-[12px] border-muted flex items-center justify-center">
                     <div className="absolute inset-[-12px] rounded-full border-[12px] border-primary/20 border-r-primary border-t-primary border-b-primary rotate-45"></div>
                     <div className="absolute inset-[-12px] rounded-full border-[12px] border-transparent border-t-success rotate-[135deg]"></div>
                     <div className="flex flex-col items-center">
                       <span className="text-xs font-bold text-muted-foreground">Total</span>
                       <span className="text-xl font-bold text-foreground">46</span>
                     </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-primary" />
                        <span className="text-muted-foreground font-medium">Internal Transfers</span>
                      </div>
                      <span className="font-semibold text-foreground">20 (43%)</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-success" />
                        <span className="text-muted-foreground font-medium">Promotions</span>
                      </div>
                      <span className="font-semibold text-foreground">16 (35%)</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-primary/30" />
                        <span className="text-muted-foreground font-medium">Lateral Moves</span>
                      </div>
                      <span className="font-semibold text-foreground">10 (22%)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/60">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-xs font-semibold">Succession Coverage</CardTitle>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                    All Critical Roles <ChevronDown className="size-3" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-4 flex items-center gap-6">
                  {/* Fake Donut Chart */}
                  <div className="relative size-24 shrink-0 rounded-full border-[12px] border-muted flex items-center justify-center">
                     <div className="absolute inset-[-12px] rounded-full border-[12px] border-transparent border-t-success border-r-success -rotate-45"></div>
                     <div className="absolute inset-[-12px] rounded-full border-[12px] border-transparent border-b-primary rotate-45"></div>
                     <div className="flex flex-col items-center">
                       <span className="text-xs font-bold text-muted-foreground">Total</span>
                       <span className="text-xl font-bold text-foreground">22</span>
                     </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-success" />
                        <span className="text-muted-foreground font-medium">Ready Now</span>
                      </div>
                      <span className="font-semibold text-foreground">6 (27%)</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-primary" />
                        <span className="text-muted-foreground font-medium">Ready in 1-2 yrs</span>
                      </div>
                      <span className="font-semibold text-foreground">10 (45%)</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-muted-foreground/40" />
                        <span className="text-muted-foreground font-medium">Ready in 2+ yrs</span>
                      </div>
                      <span className="font-semibold text-foreground">6 (27%)</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-destructive" />
                        <span className="text-muted-foreground font-medium">No Successor</span>
                      </div>
                      <span className="font-semibold text-foreground">0 (0%)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/60">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-xs font-semibold">Top Departments by Mobility</CardTitle>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                    This Quarter <ChevronDown className="size-3" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-3 flex flex-col justify-center gap-2.5 h-[120px]">
                  {[
                    { dept: 'Product', val: 12, max: 15 },
                    { dept: 'Sales', val: 8, max: 15 },
                    { dept: 'Technology', val: 7, max: 15 },
                    { dept: 'Marketing', val: 5, max: 15 },
                    { dept: 'Finance', val: 4, max: 15 }
                  ].map((row) => (
                    <div key={row.dept} className="flex items-center justify-between gap-3 text-[10px]">
                      <span className="text-muted-foreground font-medium w-[60px] truncate">{row.dept}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(row.val / row.max) * 100}%` }}></div>
                      </div>
                      <span className="font-semibold text-foreground w-[12px] text-right">{row.val}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

            </div>
          </div>

          {/* Right Area (Sidebar Sheet) - 3 cols */}
          <div className="xl:col-span-3 flex flex-col h-full border rounded-lg bg-card shadow-sm overflow-hidden relative">
            <div className="flex items-center justify-between p-4 border-b bg-muted/10">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">Senior Product Manager</h3>
                  <StatusBadge variant="success" className="px-1.5 py-0 text-[9px] border-0 bg-success/10 text-success h-4">Open</StatusBadge>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium mt-0.5">
                  <span>INT-2024-018</span>
                  <span className="text-border">|</span>
                  <span>Product</span>
                  <span className="text-border">|</span>
                  <span>Bengaluru</span>
                  <span className="text-border">|</span>
                  <span>Grade G7</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground absolute top-4 right-4">
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex items-center gap-5 px-4 border-b border-border bg-muted/10">
              {['Overview', 'Job Details', 'Applicants (24)', 'Approvals', 'Activity'].map((tab) => (
                <button
                  key={tab}
                  className={cn(
                    "pb-2.5 pt-2 text-[11px] font-semibold transition-colors whitespace-nowrap",
                    tab === 'Overview' 
                      ? "text-primary border-b-2 border-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar">
              <div className="grid grid-cols-[110px_1fr] gap-y-4 gap-x-2 text-xs">
                <div className="text-muted-foreground flex items-center gap-1.5"><Briefcase className="size-3.5" /> Job Type</div>
                <div className="font-semibold text-foreground">Permanent</div>
                
                <div className="text-muted-foreground flex items-center gap-1.5"><Calendar className="size-3.5" /> Posted On</div>
                <div className="font-semibold text-foreground">12 May 2024</div>
                
                <div className="text-muted-foreground flex items-center gap-1.5"><Clock className="size-3.5" /> Last Date to Apply</div>
                <div className="font-semibold text-foreground">26 May 2024</div>
                
                <div className="text-muted-foreground flex items-center gap-1.5"><User className="size-3.5" /> Hiring Manager</div>
                <div className="flex items-center gap-1.5">
                  <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">AS</div>
                  <span className="font-semibold text-foreground">Anita Sharma</span>
                </div>
                
                <div className="text-muted-foreground flex items-center gap-1.5"><Users className="size-3.5" /> Current Incumbent</div>
                <div className="font-semibold text-foreground">—</div>
                
                <div className="text-muted-foreground flex items-center gap-1.5"><FileText className="size-3.5" /> Vacancies</div>
                <div className="font-semibold text-foreground">1</div>
                
                <div className="text-muted-foreground flex items-center gap-1.5"><ArrowLeftRight className="size-3.5" /> Relocation</div>
                <div className="font-semibold text-foreground">Not Required</div>
                
                <div className="text-muted-foreground flex items-start gap-1.5 mt-1"><LayoutList className="size-3.5 mt-0.5" /> Job Description</div>
                <div className="flex flex-col gap-1 mt-1">
                  <p className="text-foreground/90 font-medium leading-relaxed">
                    Lead product strategy and execution for core platform initiatives...
                  </p>
                  <button className="text-primary font-semibold hover:underline w-fit text-[10px]">View More</button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-card mt-auto">
              <h4 className="text-[11px] font-semibold text-foreground mb-2">Quick Actions</h4>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="h-8 text-[11px] flex items-center gap-1.5 flex-1">
                  <Users className="size-3.5" /> View Applicants
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-[11px] flex items-center gap-1.5 flex-1">
                  <Edit2 className="size-3.5" /> Edit Job
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-[11px] flex items-center gap-1.5 flex-1">
                  <PowerOff className="size-3.5" /> Close Job
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex items-center justify-center">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
