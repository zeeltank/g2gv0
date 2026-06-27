'use client'

import React, { useState } from 'react'
import {
  Search,
  Filter,
  Plus,
  X,
  ChevronDown,
  Settings,
  MoreHorizontal,
  Edit2,
  Trash2,
  Users,
  Building2,
  ClipboardCheck,
  Target
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface Competency {
  id: string
  name: string
  category: string
  type: string
  scale: string
  status: 'active' | 'draft' | 'review'
  owner: string
  lastUpdated: string
  createdOn: string
  description: string
}

const mockCompetencies: Competency[] = [
  { id: 'c1', name: 'Customer Focus', category: 'Core', type: 'Behavior', scale: '1-5 Level Scale', status: 'active', owner: 'HR Team', lastUpdated: '12 May 2026', createdOn: '10 Jan 2026', description: 'Demonstrates a strong commitment to understanding customer needs and delivering solutions that exceed expectations.' },
  { id: 'c2', name: 'Analytical Thinking', category: 'Core', type: 'Skill', scale: '1-5 Level Scale', status: 'active', owner: 'HR Team', lastUpdated: '10 May 2026', createdOn: '12 Jan 2026', description: 'Ability to identify patterns and solve complex problems.' },
  { id: 'c3', name: 'Leadership', category: 'Leadership', type: 'Ability', scale: '1-5 Level Scale', status: 'active', owner: 'HR Team', lastUpdated: '08 May 2026', createdOn: '15 Jan 2026', description: 'Guides, directs and motivates teams.' },
  { id: 'c4', name: 'Communication', category: 'Core', type: 'Skill', scale: '1-5 Level Scale', status: 'active', owner: 'HR Team', lastUpdated: '06 May 2026', createdOn: '20 Jan 2026', description: 'Expresses ideas clearly and effectively.' },
  { id: 'c5', name: 'Problem Solving', category: 'Core', type: 'Skill', scale: '1-5 Level Scale', status: 'active', owner: 'HR Team', lastUpdated: '04 May 2026', createdOn: '01 Feb 2026', description: 'Finds effective solutions to difficult issues.' },
  { id: 'c6', name: 'Adaptability', category: 'Core', type: 'Attitude', scale: '1-5 Level Scale', status: 'active', owner: 'HR Team', lastUpdated: '02 May 2026', createdOn: '10 Feb 2026', description: 'Adjusts to new conditions effortlessly.' },
  { id: 'c7', name: 'Teamwork', category: 'Core', type: 'Behavior', scale: '1-5 Level Scale', status: 'active', owner: 'HR Team', lastUpdated: '30 Apr 2026', createdOn: '15 Feb 2026', description: 'Works collaboratively with others.' },
  { id: 'c8', name: 'Decision Making', category: 'Leadership', type: 'Ability', scale: '1-5 Level Scale', status: 'draft', owner: 'HR Team', lastUpdated: '28 Apr 2026', createdOn: '20 Feb 2026', description: 'Makes timely and informed decisions.' },
  { id: 'c9', name: 'Time Management', category: 'Functional', type: 'Skill', scale: '1-5 Level Scale', status: 'active', owner: 'HR Team', lastUpdated: '25 Apr 2026', createdOn: '01 Mar 2026', description: 'Uses time efficiently and effectively.' },
  { id: 'c10', name: 'Change Management', category: 'Leadership', type: 'Ability', scale: '1-5 Level Scale', status: 'review', owner: 'HR Team', lastUpdated: '22 Apr 2026', createdOn: '10 Mar 2026', description: 'Leads and manages organizational change.' },
]

export function CmCompetencyLibrary() {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Competency | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'proficiency' | 'associations' | 'attachments' | 'history'>('overview')

  const filteredCompetencies = mockCompetencies.filter(c => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.type.toLowerCase().includes(searchQuery.toLowerCase()) && !c.category.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (categoryFilter !== 'all' && c.category.toLowerCase() !== categoryFilter.toLowerCase()) return false
    if (typeFilter !== 'all' && c.type.toLowerCase() !== typeFilter.toLowerCase()) return false
    return true
  })

  return (
    <div className="flex h-full flex-col gap-6 p-6 overflow-y-auto g2g-scrollbar">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Competency Library</h1>
            <p className="text-sm text-muted-foreground mt-1">Create, manage and maintain organizational competencies.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsCreateOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl h-10 px-4 shadow-md shadow-primary/20 flex items-center gap-2">
              <Plus className="w-4 h-4 stroke-[3]" /> Create Competency
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-10 h-10 p-0 rounded-xl bg-background border border-border flex items-center justify-center hover:bg-accent hover:text-accent-foreground outline-none transition-colors">
                <ChevronDown className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>Import Competencies</DropdownMenuItem>
                <DropdownMenuItem>Export Library</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Action Bar / Filters */}
      <div className="relative z-20 flex items-center justify-between bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col gap-4 flex-1">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by competency name, category, type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-9 pr-4 rounded-xl border-input bg-background/50 text-sm focus-visible:ring-primary/50 w-full"
              />
            </div>
            <Button variant="outline" className="h-10 rounded-xl px-4 gap-2 text-sm font-semibold border-border bg-background/50">
              <Filter className="w-4 h-4" /> Filters
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-background/50 border border-border px-3 py-1.5 rounded-lg text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium text-foreground">Active</span>
              <button className="text-muted-foreground hover:text-foreground ml-1"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex items-center gap-2 text-sm w-48">
              <Select 
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[{label: 'All Categories', value: 'all'}, {label: 'Core', value: 'core'}, {label: 'Leadership', value: 'leadership'}, {label: 'Functional', value: 'functional'}]} 
                placeholder="Category: All" 
                className="bg-background/50 border-border" 
              />
            </div>
            <div className="flex items-center gap-2 text-sm w-40">
              <Select 
                value={typeFilter}
                onChange={setTypeFilter}
                options={[{label: 'All Types', value: 'all'}, {label: 'Behavior', value: 'behavior'}, {label: 'Skill', value: 'skill'}, {label: 'Ability', value: 'ability'}, {label: 'Attitude', value: 'attitude'}]} 
                placeholder="Type: All" 
                className="bg-background/50 border-border" 
              />
            </div>
            <button onClick={() => { setSearchQuery(''); setCategoryFilter('all'); setTypeFilter('all'); }} className="text-sm font-medium text-primary hover:underline ml-2">Clear All</button>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 border border-border bg-background/50 rounded-xl px-4 h-10 text-sm font-semibold cursor-pointer hover:bg-background transition-colors outline-none">
              Saved Views <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>Default View</DropdownMenuItem>
              <DropdownMenuItem>Active Core Competencies</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Save Current View...</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="relative z-10 bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm flex flex-col">
        <Table className="w-full text-sm rounded-2xl overflow-visible">
          <TableHeader className="bg-muted/30 border-b border-primary/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 px-6 py-4 rounded-tl-2xl">
                <Checkbox className="rounded flex items-center justify-center data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-muted-foreground/30" />
              </TableHead>
              <TableHead className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors">
                Competency Name <span className="ml-1 opacity-50">↕</span>
              </TableHead>
              <TableHead className="px-6 py-4">Category</TableHead>
              <TableHead className="px-6 py-4">Type</TableHead>
              <TableHead className="px-6 py-4">Proficiency Scale</TableHead>
              <TableHead className="px-6 py-4">Status</TableHead>
              <TableHead className="px-6 py-4">Owner</TableHead>
              <TableHead className="px-6 py-4 rounded-tr-2xl">Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-primary/5">
            {filteredCompetencies.map(comp => (
              <TableRow 
                key={comp.id} 
                onClick={() => setSelectedItem(comp)}
                className="group hover:bg-primary/[0.02] transition-colors cursor-pointer"
              >
                <TableCell className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox className="rounded flex items-center justify-center data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-muted-foreground/30" />
                </TableCell>
                <TableCell className="px-6 py-4 font-semibold text-primary">{comp.name}</TableCell>
                <TableCell className="px-6 py-4 text-muted-foreground font-medium">{comp.category}</TableCell>
                <TableCell className="px-6 py-4 text-muted-foreground">{comp.type}</TableCell>
                <TableCell className="px-6 py-4 text-muted-foreground">{comp.scale}</TableCell>
                <TableCell className="px-6 py-4">
                  <StatusBadge status={comp.status}>
                    {comp.status.charAt(0).toUpperCase() + comp.status.slice(1)}
                  </StatusBadge>
                </TableCell>
                <TableCell className="px-6 py-4 text-muted-foreground">{comp.owner}</TableCell>
                <TableCell className="px-6 py-4 text-muted-foreground">{comp.lastUpdated}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-primary/5 bg-muted/10">
          <span className="text-sm text-muted-foreground font-medium">Showing 1 to 10 of 87 entries</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <Button variant="outline" className="w-9 h-9 p-0 rounded-l-lg rounded-r-none border-border bg-background">
                <ChevronDown className="w-4 h-4 rotate-90" />
              </Button>
              <Button variant="outline" className="w-9 h-9 p-0 rounded-none border-y-border border-x-0 bg-primary/10 text-primary font-bold">1</Button>
              <Button variant="outline" className="w-9 h-9 p-0 rounded-none border-border bg-background">2</Button>
              <Button variant="outline" className="w-9 h-9 p-0 rounded-none border-y-border border-x-0 bg-background text-muted-foreground">...</Button>
              <Button variant="outline" className="w-9 h-9 p-0 rounded-none border-border bg-background">9</Button>
              <Button variant="outline" className="w-9 h-9 p-0 rounded-r-lg rounded-l-none border-border bg-background">
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </Button>
            </div>
            <div className="flex items-center gap-2 border border-border bg-background rounded-lg px-3 h-9 text-sm font-medium">
              10 / page <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Details Side Panel */}
      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right" className="w-full sm:w-[600px] lg:w-[800px] xl:w-[900px] sm:max-w-none p-0 bg-card border-l border-primary/10 flex flex-col shadow-2xl [&>button]:hidden">
          {selectedItem && (
            <>
              {/* Sheet Header */}
              <div className="flex items-center justify-between p-6 pb-4 border-b border-primary/5">
                <div className="flex items-center gap-4">
                  <SheetTitle className="text-2xl font-bold text-foreground">{selectedItem.name}</SheetTitle>
                  <StatusBadge status={selectedItem.status}>
                    {selectedItem.status.charAt(0).toUpperCase() + selectedItem.status.slice(1)}
                  </StatusBadge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="h-9 px-4 gap-2 border-border font-semibold rounded-lg bg-background hover:bg-muted">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-9 h-9 p-0 border border-border rounded-lg bg-background hover:bg-muted flex items-center justify-center outline-none transition-colors">
                      <MoreHorizontal className="w-4 h-4 text-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Clone Competency</DropdownMenuItem>
                      <DropdownMenuItem>Export PDF</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">Archive</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="ghost" onClick={() => setSelectedItem(null)} className="w-9 h-9 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Sheet Tabs */}
              <div className="border-b overflow-x-auto scrollbar-hide px-6 bg-surface-muted/30">
                <div className="flex w-full space-x-1 py-2 min-w-[500px]">
                  {(['overview', 'proficiency', 'associations', 'attachments', 'history'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95 capitalize text-center",
                        activeTab === tab 
                          ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {tab === 'proficiency' ? 'Proficiency Levels' : tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sheet Body */}
              <div className="flex-1 overflow-y-auto g2g-scrollbar p-6 flex flex-col gap-8">
                {activeTab === 'overview' && (
                  <>
                    {/* Basic Information */}
                    <div className="flex flex-col gap-4">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Basic Information</h3>
                      <div className="grid grid-cols-[140px_1fr] gap-y-4 text-sm">
                        <span className="text-muted-foreground font-medium">Competency Name</span>
                        <span className="text-foreground font-semibold">{selectedItem.name}</span>

                        <span className="text-muted-foreground font-medium">Category</span>
                        <span className="text-foreground">{selectedItem.category}</span>

                        <span className="text-muted-foreground font-medium">Type (KASA)</span>
                        <span className="text-foreground">{selectedItem.type}</span>

                        <span className="text-muted-foreground font-medium">Description</span>
                        <span className="text-foreground leading-relaxed pr-4">{selectedItem.description}</span>

                        <span className="text-muted-foreground font-medium">Owner</span>
                        <span className="text-foreground">{selectedItem.owner}</span>

                        <span className="text-muted-foreground font-medium">Status</span>
                        <div>
                          <StatusBadge status={selectedItem.status}>
                            {selectedItem.status.charAt(0).toUpperCase() + selectedItem.status.slice(1)}
                          </StatusBadge>
                        </div>

                        <span className="text-muted-foreground font-medium">Created On</span>
                        <span className="text-foreground">{selectedItem.createdOn}</span>

                        <span className="text-muted-foreground font-medium">Last Updated</span>
                        <span className="text-foreground">{selectedItem.lastUpdated} by Admin</span>
                      </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="flex flex-col gap-4">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Summary</h3>
                      <div className="grid grid-cols-4 gap-4">
                        <div className="border border-primary/10 bg-background/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="text-xs font-semibold text-muted-foreground">Mapped Roles</div>
                          <div className="text-xl font-bold text-foreground">24</div>
                        </div>
                        <div className="border border-primary/10 bg-background/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="text-xs font-semibold text-muted-foreground">Departments</div>
                          <div className="text-xl font-bold text-foreground">8</div>
                        </div>
                        <div className="border border-primary/10 bg-background/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <ClipboardCheck className="w-5 h-5" />
                          </div>
                          <div className="text-xs font-semibold text-muted-foreground">Assessments</div>
                          <div className="text-xl font-bold text-foreground">156</div>
                        </div>
                        <div className="border border-primary/10 bg-background/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                            <Target className="w-5 h-5" />
                          </div>
                          <div className="text-xs font-semibold text-muted-foreground">Development Plans</div>
                          <div className="text-xl font-bold text-foreground">42</div>
                        </div>
                      </div>
                    </div>

                    {/* Top Associated Roles */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Top Associated Roles</h3>
                        <button className="text-xs font-bold text-primary hover:underline">View All</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['Account Manager', 'Sales Executive', 'Customer Success Manager'].map(role => (
                          <span key={role} className="px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground">
                            {role}
                          </span>
                        ))}
                        <span className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                          +21 more
                        </span>
                      </div>
                    </div>
                  </>
                )}
                
                {activeTab !== 'overview' && (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    Content for {activeTab} goes here...
                  </div>
                )}
              </div>

              {/* Sheet Footer */}
              <div className="p-6 border-t border-primary/5 flex items-center justify-between bg-muted/10 mt-auto">
                <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold text-sm h-9 px-4">
                  <Trash2 className="w-4 h-4 mr-2" /> Archive Competency
                </Button>
                <Button variant="outline" onClick={() => setSelectedItem(null)} className="h-9 px-6 rounded-lg font-bold border-border bg-background">
                  Close
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Competency Modal / Sheet (Dummy) */}
      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent side="right" className="w-full sm:w-[500px] p-0 bg-card border-l border-primary/10 flex flex-col shadow-2xl [&>button]:hidden">
          <div className="flex items-center justify-between p-6 pb-4 border-b border-primary/5">
            <SheetTitle className="text-xl font-bold text-foreground">Create Competency</SheetTitle>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="w-9 h-9 p-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto g2g-scrollbar">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Competency Name</label>
              <Input placeholder="Enter name" className="bg-background/50 border-border" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Category</label>
              <Select options={[{label: 'Core', value: 'core'}, {label: 'Leadership', value: 'leadership'}]} placeholder="Select category" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Description</label>
              <textarea 
                className="flex w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary min-h-[100px] resize-none" 
                placeholder="Enter description..."
              />
            </div>
          </div>
          <div className="p-6 border-t border-primary/5 flex items-center justify-end gap-3 bg-muted/10 mt-auto">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="h-9 px-6 rounded-lg font-bold border-border bg-background">
              Cancel
            </Button>
            <Button onClick={() => setIsCreateOpen(false)} className="h-9 px-6 rounded-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90">
              Create
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
