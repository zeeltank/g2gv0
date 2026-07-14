'use client'

import React from 'react'
import {
  Briefcase,
  Users,
  UserPlus,
  TrendingUp,
  ArrowRightLeft,
  LogOut,
  MoreHorizontal,
  ChevronRight,
  Clock,
  Calendar,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Utility for SVG Donut Chart
const DonutChart = ({
  percentage,
  colorClass,
  label
}: {
  percentage: number
  colorClass: string
  label: string
}) => {
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative flex items-center justify-center size-32 shrink-0">
      <svg className="size-full transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="currentColor"
          strokeWidth="16"
          fill="transparent"
          className="text-muted"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          stroke="currentColor"
          strokeWidth="16"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn("transition-all duration-1000 ease-in-out", colorClass)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold text-foreground">{percentage}%</span>
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</span>
      </div>
    </div>
  )
}

export function TalentDashboard() {
  return (
    <div className="flex flex-col w-full bg-background pb-12">
      {/* Header section matches wireframe exactly */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Talent Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Real-time overview of your talent lifecycle and key workforce activities.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Business Unit</span>
            <Select options={[{ label: 'All', value: 'all' }]} value="all" onChange={() => {}} className="w-32 h-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Department</span>
            <Select options={[{ label: 'All', value: 'all' }]} value="all" onChange={() => {}} className="w-32 h-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location</span>
            <Select options={[{ label: 'All', value: 'all' }]} value="all" onChange={() => {}} className="w-32 h-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground invisible">Date</span>
            <div className="flex items-center">
              <Button variant="outline" className="h-9 font-medium shadow-sm bg-card justify-between w-[200px]">
                May 1 - May 31, 2025 <Calendar className="size-4 text-muted-foreground ml-2" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9 ml-2 shrink-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Top KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Briefcase className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Open Positions</span>
            </div>
            <div className="text-3xl font-bold text-foreground mb-3">142</div>
            <div className="flex items-center justify-between text-xs font-bold text-destructive">
              <span>23 Critical</span>
              <ChevronRight className="size-3 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Users className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Candidate Pipeline</span>
            </div>
            <div className="text-3xl font-bold text-foreground mb-3">1,287</div>
            <div className="flex items-center justify-between text-xs font-bold text-success">
              <span>▲ 12% vs last 30 days</span>
              <ChevronRight className="size-3 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <UserPlus className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Onboarding</span>
            </div>
            <div className="text-3xl font-bold text-foreground mb-3">86</div>
            <div className="flex items-center justify-between text-xs font-bold text-primary">
              <span>14 Preboarding</span>
              <ChevronRight className="size-3 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <TrendingUp className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Performance</span>
            </div>
            <div className="text-3xl font-bold text-foreground mb-3">279</div>
            <div className="flex items-center justify-between text-xs font-bold text-warning">
              <span>96 Pending Reviews</span>
              <ChevronRight className="size-3 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <ArrowRightLeft className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Mobility</span>
            </div>
            <div className="text-3xl font-bold text-foreground mb-3">38</div>
            <div className="flex items-center justify-between text-xs font-bold text-primary">
              <span>12 Applications</span>
              <ChevronRight className="size-3 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <LogOut className="size-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Offboarding</span>
            </div>
            <div className="text-3xl font-bold text-foreground mb-3">27</div>
            <div className="flex items-center justify-between text-xs font-bold text-destructive">
              <span>9 Clearances Pending</span>
              <ChevronRight className="size-3 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Dashboard Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Hiring Pipeline */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">Hiring Pipeline Overview</CardTitle>
            </div>
            <span className="text-xs font-bold text-primary cursor-pointer hover:underline">View Details</span>
          </CardHeader>
          <CardContent className="p-5 pt-4 flex-1 flex flex-col">
            <div className="flex-1">
              <div className="flex items-end justify-between px-2 mb-3">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Requisition</span>
                  <span className="text-xl font-bold text-foreground">58</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Screening</span>
                  <span className="text-xl font-bold text-foreground">382</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Interview</span>
                  <span className="text-xl font-bold text-foreground">214</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Offer</span>
                  <span className="text-xl font-bold text-foreground">48</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Hired</span>
                  <span className="text-xl font-bold text-foreground">36</span>
                </div>
              </div>
              {/* Funnel visualization bar */}
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex mb-8 mt-4">
                <div className="bg-primary/20 h-full w-[25%]" />
                <div className="bg-primary/40 h-full w-[35%]" />
                <div className="bg-primary/60 h-full w-[20%]" />
                <div className="bg-primary/80 h-full w-[15%]" />
                <div className="bg-primary h-full w-[5%]" />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-auto">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Average Time to Hire</span>
                <span className="text-sm font-bold text-foreground mt-1">28 Days</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Offer Acceptance Rate</span>
                <span className="text-sm font-bold text-success mt-1">92%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Cycle Progress */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">Performance Cycle Progress</CardTitle>
            </div>
            <span className="text-xs font-bold text-primary cursor-pointer hover:underline">View Details</span>
          </CardHeader>
          <CardContent className="p-5 pt-4 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-center gap-8 flex-1">
              <DonutChart percentage={62} colorClass="text-slate-700" label="Completed" />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-sm bg-slate-700" />
                    <span className="text-xs font-bold text-muted-foreground">Completed</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">62% (173)</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-sm bg-muted-foreground/40" />
                    <span className="text-xs font-bold text-muted-foreground">In Progress</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">28% (78)</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-sm bg-muted/60" />
                    <span className="text-xs font-bold text-muted-foreground">Not Started</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">10% (28)</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center border-t border-border/40 pt-4 mt-6">
              <span className="text-xs font-bold text-foreground">Cycle: Annual Performance Review 2025</span>
              <span className="text-xs text-muted-foreground mt-0.5">Apr 01, 2025 - Jun 30, 2025</span>
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Progress */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">Onboarding Progress</CardTitle>
            </div>
            <span className="text-xs font-bold text-primary cursor-pointer hover:underline">View Details</span>
          </CardHeader>
          <CardContent className="p-5 pt-4 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-center gap-8 flex-1">
              <DonutChart percentage={78} colorClass="text-slate-600" label="Completed" />
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-sm bg-slate-600" />
                    <span className="text-xs font-bold text-muted-foreground">Completed</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">78% (67)</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-sm bg-muted-foreground/40" />
                    <span className="text-xs font-bold text-muted-foreground">In Progress</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">17% (15)</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-sm bg-muted/60" />
                    <span className="text-xs font-bold text-muted-foreground">Not Started</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">5% (4)</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-6">
               <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Average Onboarding Completion Time</span>
               <span className="text-sm font-bold text-success mt-1">24 Days</span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Bottom Dashboard Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Action Items */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">My Action Items</CardTitle>
            </div>
            <span className="text-xs font-bold text-primary cursor-pointer hover:underline">View All</span>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            <div className="flex flex-col divide-y divide-border/40">
              
              <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Approve Job Requisitions</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 font-bold border-0">8</Badge>
                  <span className="text-xs font-bold text-destructive flex items-center gap-1 group-hover:underline">Due Today <ChevronRight className="size-3" /></span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <Briefcase className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Interview Feedback Pending</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className="bg-warning/10 text-warning hover:bg-warning/20 font-bold border-0">15</Badge>
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">Due This Week <ChevronRight className="size-3" /></span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <LogOut className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Offer Approvals</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 font-bold border-0">6</Badge>
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">Due This Week <ChevronRight className="size-3" /></span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Performance Reviews Pending</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className="bg-warning/10 text-warning hover:bg-warning/20 font-bold border-0">42</Badge>
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">Due This Week <ChevronRight className="size-3" /></span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <UserPlus className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Onboarding Tasks Pending</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 font-bold border-0">11</Badge>
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">Due This Week <ChevronRight className="size-3" /></span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <LogOut className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Clearances Pending</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 font-bold border-0">9</Badge>
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">Due This Week <ChevronRight className="size-3" /></span>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">Recent Activities</CardTitle>
            </div>
            <span className="text-xs font-bold text-primary cursor-pointer hover:underline">View All</span>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col gap-6">
            
            <div className="flex gap-4">
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border/60">
                <Users className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">New candidate Rahul Sharma moved to Interview stage</span>
                <span className="text-xs font-bold text-muted-foreground">Senior Software Engineer</span>
              </div>
              <span className="text-[11px] font-bold text-muted-foreground ml-auto whitespace-nowrap">30m ago</span>
            </div>

            <div className="flex gap-4">
              <div className="size-8 rounded-full bg-success/10 flex items-center justify-center shrink-0 border border-success/20">
                <CheckCircle2 className="size-3.5 text-success" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Offer accepted by Priya Mehta</span>
                <span className="text-xs font-bold text-muted-foreground">Product Manager</span>
              </div>
              <span className="text-[11px] font-bold text-muted-foreground ml-auto whitespace-nowrap">1h ago</span>
            </div>

            <div className="flex gap-4">
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border/60">
                <FileText className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Review submitted by Ankit Verma for 6 employees</span>
                <span className="text-xs font-bold text-muted-foreground">Annual Performance Review 2025</span>
              </div>
              <span className="text-[11px] font-bold text-muted-foreground ml-auto whitespace-nowrap">2h ago</span>
            </div>

            <div className="flex gap-4">
              <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border/60">
                <Briefcase className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">New requisition R-10056 approved</span>
                <span className="text-xs font-bold text-muted-foreground">Data Analyst</span>
              </div>
              <span className="text-[11px] font-bold text-muted-foreground ml-auto whitespace-nowrap">3h ago</span>
            </div>

            <div className="flex gap-4">
              <div className="size-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 border border-destructive/20">
                <AlertCircle className="size-3.5 text-destructive" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Employee Neha Joshi submitted resignation</span>
                <span className="text-xs font-bold text-muted-foreground">UX Designer</span>
              </div>
              <span className="text-[11px] font-bold text-muted-foreground ml-auto whitespace-nowrap">5h ago</span>
            </div>

            <div className="mt-auto pt-4 flex items-center justify-center border-t border-border/40">
              <span className="text-xs font-bold text-primary cursor-pointer hover:underline">View All Activities</span>
            </div>

          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="shadow-sm col-span-1 flex flex-col">
          <CardHeader className="pb-2 pt-5 px-5 flex flex-row items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-2">
              <LinkIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-bold text-foreground">Quick Links</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12 justify-start gap-3 shadow-sm hover:border-primary/40 font-medium">
                <div className="size-6 rounded-md bg-muted flex items-center justify-center border border-border/60"><Briefcase className="size-3.5" /></div>
                Create Requisition
              </Button>
              <Button variant="outline" className="h-12 justify-start gap-3 shadow-sm hover:border-primary/40 font-medium">
                <div className="size-6 rounded-md bg-muted flex items-center justify-center border border-border/60"><FileText className="size-3.5" /></div>
                Post a Job
              </Button>
              <Button variant="outline" className="h-12 justify-start gap-3 shadow-sm hover:border-primary/40 font-medium">
                <div className="size-6 rounded-md bg-muted flex items-center justify-center border border-border/60"><UserPlus className="size-3.5" /></div>
                Add Candidate
              </Button>
              <Button variant="outline" className="h-12 justify-start gap-3 shadow-sm hover:border-primary/40 font-medium">
                <div className="size-6 rounded-md bg-muted flex items-center justify-center border border-border/60"><Calendar className="size-3.5" /></div>
                Schedule Interview
              </Button>
              <Button variant="outline" className="h-12 justify-start gap-3 shadow-sm hover:border-primary/40 font-medium">
                <div className="size-6 rounded-md bg-muted flex items-center justify-center border border-border/60"><TrendingUp className="size-3.5" /></div>
                Launch Review Cycle
              </Button>
              <Button variant="outline" className="h-12 justify-start gap-3 shadow-sm hover:border-primary/40 font-medium">
                <div className="size-6 rounded-md bg-muted flex items-center justify-center border border-border/60"><ArrowRightLeft className="size-3.5" /></div>
                Internal Job Posting
              </Button>
              <Button variant="outline" className="h-12 justify-start gap-3 shadow-sm hover:border-primary/40 font-medium">
                <div className="size-6 rounded-md bg-muted flex items-center justify-center border border-border/60"><CheckCircle2 className="size-3.5" /></div>
                Onboarding Checklist
              </Button>
              <Button variant="outline" className="h-12 justify-start gap-3 shadow-sm hover:border-primary/40 font-medium">
                <div className="size-6 rounded-md bg-muted flex items-center justify-center border border-border/60"><LogOut className="size-3.5" /></div>
                Initiate Exit
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

// A simple local wrapper component since I used LinkIcon but didn't import it.
const LinkIcon = ({ className }: { className?: string }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
  )
}
