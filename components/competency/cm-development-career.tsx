'use client'

import React, { useState } from 'react'
import {
  Info,
  Search,
  Filter,
  MoreVertical,
  ChevronDown,
  User,
  Target,
  Route,
  FileText,
  Plus,
  ArrowRight,
  TrendingUp,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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
} from '@/components/ui/dropdown-menu'

export function CmDevelopmentCareer() {
  const [activeTab, setActiveTab] = useState('plans')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [planTab, setPlanTab] = useState('overview')

  const plans = [
    { id: '1', name: 'Systems Leadership Development Plan', empInitials: 'AR', empName: 'Aarav Rao', role: 'Engineering Manager', status: 'In Progress', date: '30 May 2025', progress: 60, owner: 'SJ' },
    { id: '2', name: 'Data Analytics Skills Enhancement', empInitials: 'NP', empName: 'Neha Patel', role: 'Data Analyst', status: 'In Progress', date: '15 Jun 2025', progress: 40, owner: 'RK' },
    { id: '3', name: 'Product Management Path', empInitials: 'SK', empName: 'Sanjay Kumar', role: 'Associate PM', status: 'Not Started', date: '30 Jun 2025', progress: 0, owner: 'AM' },
    { id: '4', name: 'Leadership Readiness Plan', empInitials: 'PM', empName: 'Priya Mehta', role: 'Team Lead', status: 'In Progress', date: '20 May 2025', progress: 75, owner: 'SJ' },
    { id: '5', name: 'Cloud Architecture Development', empInitials: 'VK', empName: 'Vikram K.', role: 'Solutions Architect', status: 'Completed', date: '10 May 2025', progress: 100, owner: 'RK' },
    { id: '6', name: 'Communication Skills Improvement', empInitials: 'RT', empName: 'Ritika Tiwari', role: 'Business Analyst', status: 'In Progress', date: '05 Jun 2025', progress: 30, owner: 'AM' },
  ]

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Development & Career Path Workspace <Info className="w-5 h-5 text-muted-foreground" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage employee development plans, career paths and learning initiatives.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2">
            <FileText className="w-4 h-4" /> Create Development Plan
          </Button>
          <Button variant="outline" className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2">
            <Route className="w-4 h-4" /> Create Career Path
          </Button>
          <Button className="h-10 px-4 rounded-xl font-bold gap-2">
            <BookOpen className="w-4 h-4" /> Assign Learning
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <ClipboardList className="w-5 h-5" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Active Development Plans</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-2xl font-bold text-foreground leading-none">128</p>
              <p className="text-xs font-semibold text-green-500 mb-0.5">↗ 12 vs last month</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5 flex items-center justify-between h-full">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Plans In Progress</p>
              <p className="text-2xl font-bold text-foreground mt-1">86</p>
            </div>
            <div className="relative w-14 h-14 rounded-full flex items-center justify-center shrink-0">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="50%" cy="50%" r="46%" className="stroke-muted fill-none stroke-[4px]" />
                <circle cx="50%" cy="50%" r="46%" className="stroke-blue-500 fill-none stroke-[4px]" strokeDasharray="289" strokeDashoffset="120" />
              </svg>
              <span className="text-xs font-bold text-foreground z-10">67%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Plans Completed</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-2xl font-bold text-foreground leading-none">42</p>
              <p className="text-xs font-semibold text-green-500 mb-0.5">↗ 8 vs last month</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                <Route className="w-5 h-5" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Career Paths Created</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-2xl font-bold text-foreground leading-none">64</p>
              <p className="text-xs font-semibold text-green-500 mb-0.5">↗ 6 vs last month</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                <BookOpen className="w-5 h-5" />
              </div>
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">Learning Assigned</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-2xl font-bold text-foreground leading-none">214</p>
              <p className="text-xs font-semibold text-green-500 mb-0.5">↗ 18 vs last month</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-border px-2 mt-2">
        {['Development Plans', 'Career Paths', 'Learning Assignments'].map(tab => {
          const id = tab.toLowerCase().split(' ')[0]
          const isActive = id === activeTab
          return (
            <button
              key={tab}
              onClick={() => { setActiveTab(id); setSelectedPlan(null); }}
              className={`pb-3 text-sm font-semibold transition-colors relative ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab}
              {isActive && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Main Studio Area */}
      {activeTab === 'development' ? (
        <div className="w-full flex flex-col gap-6">
          <div className="flex gap-6 items-stretch min-w-[1000px] h-[600px]">
            {/* Left/Main Area: Plans List */}
            <Card className={`flex flex-col overflow-hidden h-full transition-all duration-300 ${selectedPlan ? 'w-1/2' : 'w-full'}`}>
              <div className="p-4 border-b border-border flex items-center justify-between bg-card z-10 shrink-0">
                <div className="flex items-center gap-2 w-64">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search plans..." className="h-9 pl-8 bg-background border-border" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Select options={[{label: 'Status: All', value: 'all'}, {label: 'In Progress', value: 'progress'}]} placeholder="Status: All" className="h-9 bg-background w-32" />
                  <Select options={[{label: 'Department: All', value: 'all'}]} placeholder="Department: All" className="h-9 bg-background w-36" />
                  <Select options={[{label: 'Owner: All', value: 'all'}]} placeholder="Plan Owner: All" className="h-9 bg-background w-36" />
                  <Button variant="outline" className="h-9 px-3 gap-2 bg-background border-border text-sm">
                    <Filter className="w-3.5 h-3.5" /> More Filters
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto g2g-scrollbar relative z-10 bg-card">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-muted/30 border-b border-border sticky top-0 z-20">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4 py-3 font-bold text-foreground">Plan Name</TableHead>
                      <TableHead className="px-4 py-3 font-bold text-foreground">Employee</TableHead>
                      {!selectedPlan && <TableHead className="px-4 py-3 font-bold text-foreground">Role</TableHead>}
                      <TableHead className="px-4 py-3 font-bold text-foreground">Status</TableHead>
                      {!selectedPlan && <TableHead className="px-4 py-3 font-bold text-foreground">Due Date</TableHead>}
                      <TableHead className="px-4 py-3 font-bold text-foreground">Progress</TableHead>
                      {!selectedPlan && <TableHead className="px-4 py-3 font-bold text-foreground text-center">Plan Owner</TableHead>}
                      <TableHead className="w-12 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {plans.map((row) => (
                      <TableRow key={row.id} className={`hover:bg-muted/30 cursor-pointer ${selectedPlan === row.id ? 'bg-primary/5' : ''}`} onClick={() => setSelectedPlan(row.id)}>
                        <TableCell className="px-4 py-4 font-medium text-foreground">
                          {row.name}
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                              {row.empInitials}
                            </div>
                            <span className="font-semibold text-xs whitespace-nowrap">{row.empName}</span>
                          </div>
                        </TableCell>
                        {!selectedPlan && (
                          <TableCell className="px-4 py-4 text-muted-foreground text-xs">
                            {row.role}
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-4">
                          <StatusBadge 
                            status={row.status === 'Completed' ? 'success' : row.status === 'Not Started' ? 'default' : 'info'} 
                            label={row.status} 
                          />
                        </TableCell>
                        {!selectedPlan && (
                          <TableCell className="px-4 py-4 text-muted-foreground text-xs">
                            {row.date}
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-4">
                          <div className="flex items-center gap-2 w-full max-w-[120px]">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${row.progress === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${row.progress}%` }} />
                            </div>
                            <span className="text-[10px] font-bold w-6">{row.progress}%</span>
                          </div>
                        </TableCell>
                        {!selectedPlan && (
                          <TableCell className="px-4 py-4 text-center">
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground shrink-0 mx-auto border border-border">
                              {row.owner}
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none transition-colors mx-auto">
                              <MoreVertical className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit Plan</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-card">
                <span>Showing 1 to {plans.length} of {plans.length} plans</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0"><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-primary text-primary-foreground border-primary">1</Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0"><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>

            {/* Right Sidebar: Plan Details */}
            {selectedPlan && (() => {
              const plan = plans.find(p => p.id === selectedPlan)
              return (
                <Card className="flex-1 flex flex-col overflow-hidden h-full">
                  <div className="p-5 border-b border-border flex flex-col gap-4 bg-card z-10 shrink-0 relative">
                    <Button 
                      variant="ghost" 
                      className="absolute top-4 right-4 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedPlan(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <div className="pr-8">
                      <h2 className="text-lg font-bold text-foreground leading-tight">
                        {plan?.name}
                      </h2>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                          {plan?.empInitials}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{plan?.empName}</p>
                          <p className="text-xs text-muted-foreground">{plan?.role}</p>
                        </div>
                      </div>
                      <Button variant="link" className="text-primary text-xs p-0 h-auto font-semibold">View Profile</Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2 bg-muted/20 p-3 rounded-xl border border-border">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Plan Status</p>
                        <StatusBadge status="info" label={plan?.status || ''} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Plan Period</p>
                        <p className="text-xs font-semibold text-foreground">01 Apr 2025 - {plan?.date}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Plan Owner</p>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[8px] font-bold text-secondary-foreground">
                            {plan?.owner}
                          </div>
                          <span className="text-xs font-semibold">Sunil Jadhav</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Progress</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${plan?.progress}%` }} />
                          </div>
                          <span className="text-[10px] font-bold w-6">{plan?.progress}%</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Internal Tabs */}
                    <div className="flex items-center gap-6 mt-2 border-b border-border/50">
                      {['Plan Overview', 'Competency Gaps', 'Actions', 'Notes & History'].map(tab => {
                        const id = tab.toLowerCase().split(' ')[0]
                        const isActive = id === planTab
                        return (
                          <button
                            key={tab}
                            onClick={() => setPlanTab(id)}
                            className={`pb-2 text-xs font-semibold transition-colors relative ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            {tab}
                            {isActive && (
                              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <CardContent className="flex-1 overflow-auto g2g-scrollbar relative z-10 p-5">
                    {planTab === 'plan' ? (
                      <div className="flex flex-col gap-6">
                        <div>
                          <h4 className="text-sm font-bold text-foreground mb-2">Objective</h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Strengthen leadership, communication and technical decision-making skills to prepare for Senior Manager role.
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-foreground mb-2">Key Focus Areas</h4>
                          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            <li>Strategic Leadership</li>
                            <li>People Management</li>
                            <li>Technical Architecture</li>
                            <li>Communication</li>
                          </ul>
                        </div>
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-foreground mb-1">Next Milestone</h4>
                              <p className="text-sm font-semibold text-primary">Lead a cross-functional project</p>
                              <p className="text-xs text-muted-foreground mt-1">Due: 10 May 2025</p>
                            </div>
                            <StatusBadge status="info" label="In Progress" />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground mb-2 uppercase text-muted-foreground">Linked Career Path</h4>
                          <Button variant="link" className="p-0 h-auto text-primary font-bold">Engineering Leadership Path <ChevronRight className="w-4 h-4 ml-1" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
                        <p className="text-sm font-bold">Content for {planTab} coming soon.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })()}
          </div>
          
          {/* Career Path Explorer Visual Component */}
          {!selectedPlan && (
            <Card className="mt-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
                <div className="flex items-center gap-2">
                  <CardTitle>Career Path Explorer</CardTitle>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
                <Button variant="outline" className="h-8 gap-2 text-xs">View Full Path <ArrowRight className="w-3.5 h-3.5" /></Button>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <p className="text-sm font-semibold text-muted-foreground mb-6">Engineering Leadership Path</p>
                
                <div className="flex items-center justify-center gap-4 w-full overflow-x-auto pb-4 pt-2">
                  
                  {/* Node 1 */}
                  <div className="flex-1 min-w-[200px] p-4 rounded-xl border border-green-500 bg-green-500/5 shadow-sm shrink-0 flex flex-col justify-between h-[108px]">
                    <div>
                      <p className="font-bold text-sm text-foreground">Engineering Manager</p>
                      <p className="text-[11px] text-muted-foreground mt-1">(Current Role)</p>
                    </div>
                    <div className="flex justify-end">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <div className="shrink-0 text-muted-foreground/60">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  {/* Node 2 */}
                  <div className="flex-1 min-w-[200px] p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 shadow-sm shrink-0 flex flex-col justify-between h-[108px]">
                    <div>
                      <p className="font-bold text-sm text-foreground">Senior Engineering Manager</p>
                      <p className="text-[11px] text-muted-foreground mt-1">(Next Role)</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: '65%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-foreground">65% Match</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="shrink-0 text-muted-foreground/60">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  {/* Node 3 */}
                  <div className="flex-1 min-w-[200px] p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 shadow-sm shrink-0 flex flex-col justify-between h-[108px]">
                    <div>
                      <p className="font-bold text-sm text-foreground">Director of Engineering</p>
                      <p className="text-[11px] text-muted-foreground mt-1">(Future Role)</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 h-1.5 bg-purple-500/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-purple-500" style={{ width: '40%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-foreground">40% Match</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="shrink-0 text-muted-foreground/60">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  {/* Node 4 */}
                  <div className="flex-1 min-w-[200px] p-4 rounded-xl border border-border bg-card shadow-sm shrink-0 flex flex-col justify-between h-[108px]">
                    <div>
                      <p className="font-bold text-sm text-foreground">VP of Engineering</p>
                      <p className="text-[11px] text-muted-foreground mt-1">(Future Role)</p>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: '25%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">25% Match</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl bg-card/20 text-muted-foreground p-12 min-h-[400px]">
          <p className="text-lg font-bold">This section is coming soon</p>
          <p className="text-sm">We are currently building the {activeTab} functionality.</p>
        </div>
      )}
    </div>
  )
}
