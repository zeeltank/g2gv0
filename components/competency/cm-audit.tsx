'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  Settings,
  FileText,
  CheckCircle2,
  Edit3,
  MessageSquare,
  ArrowUpFromLine,
  ChevronRight,
  PlusCircle,
  Trash2,
  X,
  ChevronLeft,
  ExternalLink,
  History
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function CmAudit() {
  const [activeTab, setActiveTab] = useState('timeline')
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)

  const activities = [
    { id: '1', date: '31 May 2024, 04:35 PM', user: 'Sneha Gupta', initials: 'SG', action: 'Updated', recordType: 'Competency', recordName: 'Data Analysis', module: 'Competency Library' },
    { id: '2', date: '31 May 2024, 03:22 PM', user: 'Amit Kumar', initials: 'AK', action: 'Approved', recordType: 'Framework', recordName: 'Technical Framework', module: 'Framework' },
    { id: '3', date: '31 May 2024, 02:15 PM', user: 'Riya Mehta', initials: 'RM', action: 'Created', recordType: 'Assessment', recordName: 'Q2 Assessment 2024', module: 'Assessments' },
    { id: '4', date: '31 May 2024, 01:05 PM', user: 'Pooja Desai', initials: 'PD', action: 'Commented', recordType: 'Employee Profile', recordName: 'Rahul Verma', module: 'Employee Profile' },
    { id: '5', date: '31 May 2024, 11:48 AM', user: 'Manish Bansal', initials: 'MB', action: 'Uploaded', recordType: 'Certification', recordName: 'PMP Certification', module: 'Certifications' },
    { id: '6', date: '31 May 2024, 10:32 AM', user: 'Amit Kumar', initials: 'AK', action: 'Updated', recordType: 'Role Mapping', recordName: 'Manager - Sales', module: 'Role Mapping' },
    { id: '7', date: '31 May 2024, 09:20 AM', user: 'Riya Mehta', initials: 'RM', action: 'Imported', recordType: 'Competency', recordName: 'Competencies_May2024.xlsx', module: 'Administration' },
    { id: '8', date: '31 May 2024, 08:50 AM', user: 'Sneha Gupta', initials: 'SG', action: 'Deleted', recordType: 'Development Plan', recordName: 'Rahul Verma - Plan', module: 'Development Plans' },
  ]

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'Updated': return <Edit3 className="w-4 h-4 text-orange-500" />
      case 'Approved': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'Created': return <PlusCircle className="w-4 h-4 text-blue-500" />
      case 'Commented': return <MessageSquare className="w-4 h-4 text-purple-500" />
      case 'Uploaded': return <ArrowUpFromLine className="w-4 h-4 text-indigo-500" />
      case 'Imported': return <ArrowUpFromLine className="w-4 h-4 text-indigo-500" />
      case 'Deleted': return <Trash2 className="w-4 h-4 text-red-500" />
      default: return <History className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Audit & Activity Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all changes, approvals, comments, and user actions across competencies and related records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button variant="outline" className="h-10 w-10 p-0 rounded-xl font-semibold border-border bg-background">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none mb-1">12,842</p>
                <p className="text-sm font-semibold text-foreground">Total Activities</p>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none mb-1">487</p>
                <p className="text-sm font-semibold text-foreground">Approvals</p>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none mb-1">1,256</p>
                <p className="text-sm font-semibold text-foreground">Updates</p>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none mb-1">350</p>
                <p className="text-sm font-semibold text-foreground">Comments</p>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-full">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                <ArrowUpFromLine className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none mb-1">32</p>
                <p className="text-sm font-semibold text-foreground">Imports / Exports</p>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex items-center justify-between gap-3 bg-card rounded-xl">
          <div className="flex items-center gap-3 flex-1">
            <Select options={[{label: '01 May 2024 - 31 May 2024', value: 'may'}]} placeholder="01 May 2024 - 31 May 2024" className="h-10 bg-background w-56" />
            <Select options={[{label: 'All Record Types', value: 'all'}]} placeholder="All Record Types" className="h-10 bg-background w-48" />
            <Select options={[{label: 'All Modules', value: 'all'}]} placeholder="All Modules" className="h-10 bg-background w-40" />
            <Select options={[{label: 'All Users', value: 'all'}]} placeholder="All Users" className="h-10 bg-background w-40" />
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by keyword..." className="h-10 pl-8 bg-background border-border" />
            </div>
            <Button variant="outline" className="h-10 px-4 gap-2 bg-background border-border text-sm">
              <Filter className="w-4 h-4" /> Filters
            </Button>
          </div>
          <Button variant="link" className="text-primary font-semibold text-sm">
            Clear All
          </Button>
        </CardContent>
      </Card>

      {/* Main Split View Container */}
      <Card className="flex flex-col shadow-sm overflow-hidden flex-1 min-h-[600px]">
        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-border px-6 pt-4 bg-muted/10">
          {[
            { id: 'timeline', label: 'Activity Timeline' },
            { id: 'approvals', label: 'Approvals' },
            { id: 'comments', label: 'Comments' },
            { id: 'history', label: 'Version History' },
            { id: 'io', label: 'Imports / Exports' },
            { id: 'actions', label: 'User Actions Log' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedActivity(null); }}
              className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left/Main Area: Table */}
          <div className={`flex flex-col h-full border-r border-border transition-all duration-300 ${selectedActivity ? 'w-2/3' : 'w-full'}`}>
            <div className="flex-1 overflow-auto g2g-scrollbar relative bg-card">
              <Table className="w-full text-sm">
                <TableHeader className="bg-muted/30 border-b border-border sticky top-0 z-20">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6 py-3 font-bold text-foreground">Date & Time</TableHead>
                    <TableHead className="px-6 py-3 font-bold text-foreground">User</TableHead>
                    <TableHead className="px-6 py-3 font-bold text-foreground">Action</TableHead>
                    <TableHead className="px-6 py-3 font-bold text-foreground">Record Type</TableHead>
                    <TableHead className="px-6 py-3 font-bold text-foreground">Record Name</TableHead>
                    <TableHead className="px-6 py-3 font-bold text-foreground">Module</TableHead>
                    <TableHead className="px-6 py-3 font-bold text-foreground text-center">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {activities.map((row) => (
                    <TableRow key={row.id} className={`hover:bg-muted/30 cursor-pointer ${selectedActivity === row.id ? 'bg-primary/5' : ''}`} onClick={() => setSelectedActivity(row.id)}>
                      <TableCell className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {row.date}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground shrink-0 border border-border">
                            {row.initials}
                          </div>
                          <span className="font-medium text-foreground whitespace-nowrap">{row.user}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2 text-foreground font-medium">
                          {getActionIcon(row.action)}
                          {row.action}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-foreground">
                        {row.recordType}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className="text-primary font-semibold hover:underline cursor-pointer">{row.recordName}</span>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-muted-foreground">
                        {row.module}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-center">
                        <ChevronRight className="w-5 h-5 text-muted-foreground mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-card shrink-0">
              <span>Showing 1 to 8 of 12,842 activities</span>
              <div className="flex items-center gap-2">
                <span className="mr-2">
                  <Select options={[{label: '25 per page', value: '25'}]} placeholder="25 per page" className="w-32 h-8 inline-flex text-xs mx-1" />
                </span>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0"><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-primary text-primary-foreground border-primary">1</Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">2</Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">3</Button>
                <span className="px-1">...</span>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">514</Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Details Panel */}
          {selectedActivity && (() => {
            const act = activities.find(a => a.id === selectedActivity)
            return (
              <div className="w-1/3 flex flex-col h-full bg-muted/5 relative overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between bg-card z-10 shrink-0">
                  <h3 className="font-bold text-foreground text-sm">Activity Details</h3>
                  <Button 
                    variant="ghost" 
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedActivity(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex-1 overflow-auto g2g-scrollbar p-6 flex flex-col gap-6">
                  {/* Overview Card */}
                  <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-muted/20">
                      <h4 className="text-sm font-bold text-foreground">Overview</h4>
                    </div>
                    <div className="p-4 flex flex-col gap-4">
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-sm text-muted-foreground">Date & Time</span>
                        <span className="text-sm font-medium text-foreground col-span-2">{act?.date}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <span className="text-sm text-muted-foreground">User</span>
                        <div className="flex items-center gap-2 col-span-2">
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-secondary-foreground border border-border">
                            {act?.initials}
                          </div>
                          <span className="text-sm font-medium text-foreground">{act?.user}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <span className="text-sm text-muted-foreground">Action</span>
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground col-span-2">
                          {getActionIcon(act?.action || '')}
                          {act?.action}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-sm text-muted-foreground">Record Type</span>
                        <span className="text-sm font-medium text-foreground col-span-2">{act?.recordType}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-sm text-muted-foreground">Record Name</span>
                        <span className="text-sm font-semibold text-primary hover:underline cursor-pointer col-span-2">{act?.recordName}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-sm text-muted-foreground">Module</span>
                        <span className="text-sm font-medium text-foreground col-span-2">{act?.module}</span>
                      </div>
                    </div>
                  </div>

                  {/* Change Summary (only show for Updated action as per wireframe) */}
                  {act?.action === 'Updated' && (
                    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-border bg-muted/20">
                        <h4 className="text-sm font-bold text-foreground">Change Summary</h4>
                      </div>
                      <div className="p-0">
                        <Table className="w-full text-xs">
                          <TableHeader className="bg-transparent">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="h-8 font-semibold text-muted-foreground">Field</TableHead>
                              <TableHead className="h-8 font-semibold text-muted-foreground">Old Value</TableHead>
                              <TableHead className="h-8 font-semibold text-muted-foreground">New Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="hover:bg-muted/10">
                              <TableCell className="font-medium text-foreground align-top py-3">Description</TableCell>
                              <TableCell className="text-muted-foreground align-top py-3">Analyze data using basic techniques.</TableCell>
                              <TableCell className="text-foreground align-top py-3">Analyze complex data using different techniques.</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-muted/10">
                              <TableCell className="font-medium text-foreground py-3">Proficiency Level</TableCell>
                              <TableCell className="text-muted-foreground py-3">Level 3 - Proficient</TableCell>
                              <TableCell className="text-foreground py-3">Level 4 - Advanced</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-muted/10 border-b-0">
                              <TableCell className="font-medium text-foreground py-3">Last Updated By</TableCell>
                              <TableCell className="text-muted-foreground py-3">Amit Kumar</TableCell>
                              <TableCell className="text-foreground py-3">{act.user}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Record Link */}
                  <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden p-4">
                    <h4 className="text-sm font-bold text-foreground mb-3">Record Link</h4>
                    <Button variant="link" className="p-0 h-auto gap-2 text-primary font-semibold text-sm">
                      Open {act?.recordType} <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </Card>
    </div>
  )
}
