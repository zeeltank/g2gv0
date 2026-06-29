'use client'

import React, { useState } from 'react'
import {
  Info,
  Plus,
  Search,
  Filter,
  Settings,
  MoreVertical,
  Users,
  CheckCircle2,
  Clock,
  X,
  ChevronRight,
  ChevronLeft,
  FileText,
  Activity,
  ClipboardList,
  Scale
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
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

export function CmAssessmentWorkspace() {
  const [activeTab, setActiveTab] = useState('campaigns')
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [campaignTab, setCampaignTab] = useState('participants')

  const campaigns = [
    { id: '1', name: 'Q2 2025 Competency Assessment', type: 'Self + Manager', participants: 182, completion: 68, status: 'In Progress', date: '30 Jun 2025' },
    { id: '2', name: 'Leadership Competency Review', type: '360 Degree', participants: 96, completion: 55, status: 'In Progress', date: '15 Jul 2025' },
    { id: '3', name: 'Annual Competency Assessment 2025', type: 'Self + Manager', participants: 214, completion: 82, status: 'In Progress', date: '31 Aug 2025' },
    { id: '4', name: 'Q1 2025 Competency Assessment', type: 'Self + Manager', participants: 188, completion: 100, status: 'Completed', date: '31 Mar 2025' },
    { id: '5', name: 'Leadership 360 Review 2025', type: '360 Degree', participants: 64, completion: 100, status: 'Completed', date: '31 Mar 2025' },
  ]

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Assessment & Calibration Workspace <Info className="w-5 h-5 text-muted-foreground" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage assessment campaigns, ratings, and calibration for competency evaluations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2">
            <Settings className="w-4 h-4" /> View Configuration
          </Button>
          
          <DropdownMenu>
            <div className="flex items-center rounded-xl bg-primary shadow-md shadow-primary/20 overflow-hidden group">
              <DropdownMenuTrigger className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-10 px-4 flex items-center gap-2 rounded-none border-r border-primary-foreground/20">
                <Plus className="w-4 h-4 stroke-[3]" /> New Assessment Campaign
              </DropdownMenuTrigger>
            </div>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Standard Assessment</DropdownMenuItem>
              <DropdownMenuItem>360 Degree Review</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Active Campaigns</p>
            <p className="text-2xl font-bold text-foreground">3</p>
          </div>
        </div>
        
        <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-full flex items-center justify-center shrink-0">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="50%" cy="50%" r="46%" className="stroke-muted fill-none stroke-[4px]" />
              <circle cx="50%" cy="50%" r="46%" className="stroke-green-500 fill-none stroke-[4px]" strokeDasharray="289" strokeDashoffset="80" />
            </svg>
            <span className="text-sm font-bold text-foreground z-10">72%</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Overall Completion</p>
            <p className="text-xs font-bold text-foreground mt-1">412 / 572 Completed</p>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Pending Manager Ratings</p>
            <p className="text-2xl font-bold text-foreground">54</p>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Pending Calibration</p>
            <p className="text-2xl font-bold text-foreground">18</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-border px-2 mt-2">
        {['Campaigns', 'Participant Ratings', 'Calibration', 'Approvals', 'Closed Campaigns'].map(tab => {
          const id = tab.toLowerCase().split(' ')[0]
          const isActive = id === activeTab
          return (
            <button
              key={tab}
              onClick={() => { setActiveTab(id); setSelectedCampaign(null); }}
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
      {activeTab === 'campaigns' ? (
        <div className="w-full overflow-x-auto pb-4 g2g-scrollbar">
          <div className="flex gap-6 items-stretch min-w-[1000px] h-[700px]">
            
            {/* Left/Main Area: Campaigns List */}
            <div className={`flex flex-col bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden h-full transition-all duration-300 ${selectedCampaign ? 'w-1/2' : 'w-full'}`}>
              <div className="p-4 border-b border-primary/10 flex items-center justify-between bg-card z-10 shrink-0">
                <div className="flex items-center gap-2 w-64">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search campaigns..." className="h-9 pl-8 bg-background border-border" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Select options={[{label: 'All Status', value: 'all'}, {label: 'In Progress', value: 'progress'}]} placeholder="Status" className="h-9 bg-background w-32" />
                  <Select options={[{label: 'All Types', value: 'all'}, {label: 'Self + Manager', value: 'self'}]} placeholder="Assessment Type" className="h-9 bg-background w-44" />
                  <Button variant="outline" className="h-9 px-3 gap-2 bg-background border-border text-sm">
                    <Filter className="w-3.5 h-3.5" /> More Filters
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto g2g-scrollbar relative z-10">
                <Table className="w-full text-sm">
                  <TableHeader className="bg-muted/30 border-b border-primary/10 sticky top-0 z-20">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4 py-3 font-bold text-foreground">Campaign Name</TableHead>
                      {!selectedCampaign && <TableHead className="px-4 py-3 font-bold text-foreground">Assessment Type</TableHead>}
                      <TableHead className="px-4 py-3 font-bold text-foreground text-center">Participants</TableHead>
                      {!selectedCampaign && <TableHead className="px-4 py-3 font-bold text-foreground">Completion</TableHead>}
                      <TableHead className="px-4 py-3 font-bold text-foreground">Status</TableHead>
                      {!selectedCampaign && <TableHead className="px-4 py-3 font-bold text-foreground">Due Date</TableHead>}
                      <TableHead className="w-16 text-center font-bold text-foreground"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-primary/5">
                    {campaigns.map((row) => (
                      <TableRow key={row.id} className={`hover:bg-muted/30 cursor-pointer ${selectedCampaign === row.id ? 'bg-primary/5' : ''}`} onClick={() => setSelectedCampaign(row.id)}>
                        <TableCell className="px-4 py-4 font-medium text-foreground">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${row.status === 'Completed' ? 'bg-green-500' : 'bg-primary'}`} />
                            {row.name}
                          </div>
                        </TableCell>
                        {!selectedCampaign && (
                          <TableCell className="px-4 py-4 text-muted-foreground">
                            {row.type}
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-4 text-center font-semibold">
                          {row.participants}
                        </TableCell>
                        {!selectedCampaign && (
                          <TableCell className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold w-8">{row.completion}%</span>
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${row.completion === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${row.completion}%` }} />
                              </div>
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-4">
                          <StatusBadge status={row.status === 'Completed' ? 'success' : 'info'} label={row.status} />
                        </TableCell>
                        {!selectedCampaign && (
                          <TableCell className="px-4 py-4 text-muted-foreground">
                            {row.date}
                          </TableCell>
                        )}
                        <TableCell className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none transition-colors mx-auto">
                              <MoreVertical className="w-4 h-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit Campaign</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-card">
                <span>Showing 1 to {campaigns.length} of {campaigns.length} campaigns</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0"><ChevronLeft className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-primary text-primary-foreground border-primary">1</Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0"><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Campaign Details */}
            {selectedCampaign && (
              <div className="flex-1 flex flex-col bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden h-full">
                <div className="p-5 border-b border-primary/10 flex flex-col gap-3 bg-card z-10 shrink-0 relative">
                  <Button 
                    variant="ghost" 
                    className="absolute top-4 right-4 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedCampaign(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <div className="flex justify-between items-start pr-8">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {campaigns.find(c => c.id === selectedCampaign)?.name}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Self + Manager • 182 Participants • Due: 30 Jun 2025
                      </p>
                    </div>
                    <StatusBadge status="info" label="In Progress" />
                  </div>
                  
                  {/* Internal Tabs */}
                  <div className="flex items-center gap-6 mt-2 border-b border-border/50">
                    {['Overview', 'Participants', 'Ratings', 'Calibration', 'Audit Trail'].map(tab => {
                      const id = tab.toLowerCase().split(' ')[0]
                      const isActive = id === campaignTab
                      return (
                        <button
                          key={tab}
                          onClick={() => setCampaignTab(id)}
                          className={`pb-2 text-xs font-semibold transition-colors relative ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {tab} {['Ratings', 'Calibration'].includes(tab) && <span className="bg-muted px-1.5 py-0.5 rounded-full ml-1 text-[10px]">5</span>}
                          {isActive && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-auto g2g-scrollbar relative z-10 p-4">
                  {campaignTab === 'participants' ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4">
                        <div className="relative w-64">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="Search employee..." className="h-9 pl-8 bg-background border-border" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" className="h-9 text-xs gap-2"><Filter className="w-3.5 h-3.5" /> Filters</Button>
                          <Select options={[{label: 'Bulk Actions', value: 'bulk'}]} placeholder="Bulk Actions" className="h-9 bg-background w-32" />
                        </div>
                      </div>

                      <div className="border border-border rounded-xl overflow-hidden">
                        <Table className="w-full text-sm">
                          <TableHeader className="bg-muted/30 border-b border-primary/10">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-10 text-center"><input type="checkbox" className="rounded border-border" /></TableHead>
                              <TableHead className="px-4 py-3 font-bold text-foreground">Employee</TableHead>
                              <TableHead className="px-4 py-3 font-bold text-foreground">Role</TableHead>
                              <TableHead className="px-4 py-3 text-center font-bold text-foreground">Self</TableHead>
                              <TableHead className="px-4 py-3 text-center font-bold text-foreground">Manager</TableHead>
                              <TableHead className="px-4 py-3 font-bold text-foreground">Status</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-primary/5">
                            {[
                              { initials: 'AS', name: 'Aarav Sharma', id: 'E1001', role: 'Sr. Software Engineer', self: true, manager: false, status: 'Pending Manager' },
                              { initials: 'NP', name: 'Neha Patel', id: 'E1002', role: 'Product Analyst', self: true, manager: false, status: 'Pending Manager' },
                              { initials: 'RK', name: 'Rohan Kumar', id: 'E1003', role: 'Team Lead', self: true, manager: true, status: 'Pending Calibration' },
                              { initials: 'PS', name: 'Priya Singh', id: 'E1004', role: 'UX Designer', self: true, manager: true, status: 'Pending Calibration' },
                              { initials: 'VD', name: 'Vikram Desai', id: 'E1005', role: 'Business Analyst', self: true, manager: true, status: 'Completed' },
                            ].map((row, i) => (
                              <TableRow key={i} className="hover:bg-muted/30">
                                <TableCell className="text-center">
                                  <input type="checkbox" className="rounded border-border" defaultChecked={i === 2} />
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                      {row.initials}
                                    </div>
                                    <div>
                                      <p className="font-bold text-foreground text-xs leading-none">{row.name}</p>
                                      <p className="text-[10px] text-muted-foreground mt-1">{row.id}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                                  {row.role}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-center">
                                  {row.self ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <Clock className="w-4 h-4 text-orange-500 mx-auto" />}
                                  {row.self && <span className="text-[10px] text-muted-foreground block mt-1">12 May</span>}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-center">
                                  {row.manager ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <Clock className="w-4 h-4 text-orange-500 mx-auto" />}
                                  {row.manager ? <span className="text-[10px] text-muted-foreground block mt-1">15 May</span> : <span className="text-[10px] text-muted-foreground block mt-1">--</span>}
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                  <StatusBadge 
                                    status={row.status.includes('Calibration') ? 'default' : row.status === 'Completed' ? 'success' : 'warning'} 
                                    label={row.status} 
                                  />
                                </TableCell>
                                <TableCell className="px-4 py-3 text-center">
                                  <Button variant="ghost" className="h-6 w-6 p-0 text-muted-foreground"><MoreVertical className="w-3.5 h-3.5" /></Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">1 participant selected</span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" className="h-8 text-xs"><FileText className="w-3.5 h-3.5 mr-2" /> Send Reminder</Button>
                          <Button variant="outline" className="h-8 text-xs"><Activity className="w-3.5 h-3.5 mr-2" /> View Ratings</Button>
                          <Button className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90">Start Calibration</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl bg-card/20 text-muted-foreground p-12 h-full">
                      <p className="text-lg font-bold">This section is coming soon</p>
                      <p className="text-sm">We are currently building the {campaignTab} functionality.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl bg-card/20 text-muted-foreground p-12 mt-4">
          <p className="text-lg font-bold">This section is coming soon</p>
          <p className="text-sm">We are currently building this tab's functionality.</p>
        </div>
      )}
    </div>
  )
}
