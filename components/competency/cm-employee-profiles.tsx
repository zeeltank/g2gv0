'use client'

import React, { useState } from 'react'
import {
  Info,
  Search,
  Filter,
  MoreVertical,
  Download,
  ChevronDown,
  User,
  History,
  Award,
  Folder,
  Target,
  Route,
  FileText,
  Plus,
  RefreshCw,
  Edit3,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Progress } from '@/components/ui/progress'
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

export function CmEmployeeProfiles() {
  const [activeTab, setActiveTab] = useState('ratings')

  // Sample data
  const competencies = [
    { category: 'Core Competencies', items: [
      { name: 'Problem Solving', required: 4, current: 4, gap: 0, date: '15 Apr 2024', assessor: 'Neha Verma' },
      { name: 'Analytical Thinking', required: 4, current: 3, gap: -1, date: '15 Apr 2024', assessor: 'Neha Verma' },
      { name: 'Communication', required: 3, current: 4, gap: 1, date: '15 Apr 2024', assessor: 'Neha Verma' },
      { name: 'Teamwork', required: 3, current: 4, gap: 1, date: '15 Apr 2024', assessor: 'Neha Verma' },
    ]},
    { category: 'Functional Competencies', items: [
      { name: 'Software Design', required: 4, current: 3, gap: -1, date: '15 Apr 2024', assessor: 'Neha Verma' },
      { name: 'System Architecture', required: 4, current: 3, gap: -1, date: '15 Apr 2024', assessor: 'Neha Verma' },
      { name: 'Coding Standards', required: 3, current: 4, gap: 1, date: '15 Apr 2024', assessor: 'Neha Verma' },
    ]},
    { category: 'Leadership Competencies', items: [
      { name: 'Ownership', required: 3, current: 3, gap: 0, date: '15 Apr 2024', assessor: 'Neha Verma' },
      { name: 'Mentoring', required: 3, current: 2, gap: -1, date: '15 Apr 2024', assessor: 'Neha Verma' },
    ]},
  ]

  const getGapColor = (gap: number) => {
    if (gap > 0) return 'text-green-500 font-bold'
    if (gap < 0) return 'text-red-500 font-bold'
    return 'text-muted-foreground'
  }

  const getLevelColor = (level: number) => {
    const colors: Record<number, string> = {
      1: 'bg-red-500',
      2: 'bg-orange-500',
      3: 'bg-yellow-500',
      4: 'bg-green-500',
      5: 'bg-blue-500'
    }
    return colors[level] || 'bg-muted'
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Employee Competency Profile <Info className="w-5 h-5 text-muted-foreground" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View competency ratings, history, certifications, evidence and development plans for the employee.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2">
            <Download className="w-4 h-4" /> Export Profile
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="h-10 px-4 rounded-xl font-semibold border border-border bg-background flex items-center gap-2 outline-none hover:bg-muted transition-colors">
              Actions <ChevronDown className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Request Assessment</DropdownMenuItem>
              <DropdownMenuItem>View Talent Profile</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Employee Summary Card */}
      <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl">
            AS
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-foreground">Arjun Sharma</h2>
              <StatusBadge status="success" label="Active" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-2">Senior Software Engineer</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
              <span>Engineering</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>Product Engineering</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>Mumbai, India</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium mt-1">
              <span>Employee ID: E12345</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span>Joined: 12 Jan 2020</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-12 pr-4">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-12">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Reports To</p>
                <p className="text-sm font-bold text-foreground">Neha Verma</p>
                <p className="text-xs text-muted-foreground">Engineering Manager</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Employment Type</p>
                <p className="text-sm font-bold text-foreground">Full Time</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Experience</p>
                <p className="text-sm font-bold text-foreground">4.3 Years</p>
              </div>
            </div>
            <div className="flex justify-between gap-12">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Latest Assessment</p>
                <p className="text-sm font-bold text-foreground">15 Apr 2024</p>
                <p className="text-xs text-muted-foreground">(Cycle: Q1 2024)</p>
              </div>
            </div>
          </div>
          
          <div className="h-20 w-px bg-border mx-2" />

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <p className="text-xs font-bold text-muted-foreground mb-1">Overall Competency Score</p>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-black text-foreground leading-none">3.6</span>
                <span className="text-lg font-bold text-muted-foreground leading-none mb-0.5">/ 5</span>
              </div>
              <p className="text-sm font-bold text-green-500 mt-1">Proficient</p>
            </div>
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="50%" cy="50%" r="46%" className="stroke-muted fill-none stroke-[6px]" />
                <circle cx="50%" cy="50%" r="46%" className="stroke-primary fill-none stroke-[6px]" strokeDasharray="289" strokeDashoffset="80" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-border px-4 bg-card/50 rounded-t-xl pt-4">
        {[
          { id: 'ratings', label: 'Competency Ratings', icon: User },
          { id: 'history', label: 'Competency History', icon: History },
          { id: 'certs', label: 'Certifications', icon: Award },
          { id: 'evidence', label: 'Evidence Repository', icon: Folder },
          { id: 'plans', label: 'Development Plans', icon: Target },
          { id: 'career', label: 'Career Path', icon: Route },
          { id: 'profile', label: 'Profile Info', icon: FileText },
        ].map(tab => {
          const isActive = tab.id === activeTab
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          )
        })}
      </div>

      {activeTab === 'ratings' ? (
        <div className="flex gap-6 items-start min-h-[600px]">
          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select options={[{label: 'All Categories', value: 'all'}]} placeholder="All Categories" className="w-44 bg-background" />
                <Select options={[{label: 'Group by: Category', value: 'cat'}]} placeholder="Group by" className="w-44 bg-background" />
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-foreground">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> 1-Beginner</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /> 2-Basic</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500" /> 3-Proficient</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> 4-Advanced</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> 5-Expert</div>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto g2g-scrollbar">
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/30 border-b border-primary/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 py-3 font-bold text-foreground">Competency</TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground">Category</TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground text-center">Required</TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground text-center">Current</TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground w-32">Score</TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground text-center">Gap</TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground">Assessed On</TableHead>
                    <TableHead className="px-4 py-3 font-bold text-foreground">Assessed By</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competencies.map((group, gIdx) => (
                    <React.Fragment key={gIdx}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={9} className="px-4 py-2 font-bold text-foreground text-xs">
                          <div className="flex items-center gap-2">
                            <ChevronDown className="w-4 h-4" /> {group.category}
                          </div>
                        </TableCell>
                      </TableRow>
                      {group.items.map((item, iIdx) => (
                        <TableRow key={iIdx} className="hover:bg-muted/30">
                          <TableCell className="px-4 py-3 font-medium text-foreground pl-10">
                            {item.name}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-muted-foreground text-xs">
                            {item.category || group.category.split(' ')[0]}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center font-bold text-foreground">
                            {item.required}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center font-bold text-foreground">
                            {item.current}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${getLevelColor(item.current)}`} style={{ width: `${(item.current / 5) * 100}%` }} />
                              </div>
                              <span className="text-xs font-bold w-6">{item.current.toFixed(1)}</span>
                            </div>
                          </TableCell>
                          <TableCell className={`px-4 py-3 text-center text-xs ${getGapColor(item.gap)}`}>
                            {item.gap > 0 ? `+${item.gap}` : item.gap === 0 ? '—' : item.gap}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-muted-foreground text-xs">
                            {item.date}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-muted-foreground text-xs">
                            {item.assessor}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none transition-colors mx-auto">
                                <MoreVertical className="w-4 h-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>View Details</DropdownMenuItem>
                                <DropdownMenuItem>History</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-3 border-t border-border text-xs text-muted-foreground bg-card">
              Showing 1 to 8 of 8 competencies
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-80 shrink-0 flex flex-col gap-6">
            <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-bold text-foreground">Proficiency Summary</h3>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
              
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Expert (5)', count: 1, percent: 12.5, color: 'bg-indigo-500' },
                  { label: 'Advanced (4)', count: 3, percent: 37.5, color: 'bg-blue-500' },
                  { label: 'Proficient (3)', count: 2, percent: 25.0, color: 'bg-green-500' },
                  { label: 'Basic (2)', count: 1, percent: 12.5, color: 'bg-orange-500' },
                  { label: 'Beginner (1)', count: 1, percent: 12.5, color: 'bg-red-500' },
                ].map(stat => (
                  <div key={stat.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 w-28">
                      <div className={`w-2 h-2 rounded-full ${stat.color}`} />
                      <span className="text-foreground font-medium">{stat.label}</span>
                    </div>
                    <div className="flex-1 mx-3 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${stat.color}`} style={{ width: `${stat.percent}%` }} />
                    </div>
                    <span className="text-muted-foreground w-12 text-right">{stat.count} ({stat.percent}%)</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between font-bold text-sm text-foreground">
                <span>Total Competencies</span>
                <span>8</span>
              </div>
            </div>

            <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="font-bold text-foreground">Quick Actions</h3>
              </div>
              <div className="flex flex-col">
                <button className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border text-sm text-foreground font-medium">
                  <span className="flex items-center gap-3"><Plus className="w-4 h-4 text-primary" /> Add Competency</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border text-sm text-foreground font-medium">
                  <span className="flex items-center gap-3"><RefreshCw className="w-4 h-4 text-primary" /> Request Re-assessment</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border text-sm text-foreground font-medium">
                  <span className="flex items-center gap-3"><Target className="w-4 h-4 text-primary" /> Assign Development Plan</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-sm text-foreground font-medium">
                  <span className="flex items-center gap-3"><Award className="w-4 h-4 text-primary" /> Add Certification</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-5 relative">
              <h3 className="font-bold text-foreground mb-3">Notes</h3>
              <Button variant="ghost" className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground">
                <Edit3 className="w-4 h-4" />
              </Button>
              <p className="text-sm text-muted-foreground italic">
                Add private notes related to this employee competency profile...
              </p>
            </div>
          </div>
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
