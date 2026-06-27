'use client'

import React, { useState } from 'react'
import {
  Info,
  Copy,
  Download,
  Upload,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  LayoutGrid,
  Users,
  Calendar,
  Search,
  Filter,
  Settings,
  MoreVertical,
  GripVertical,
  Folder,
  FileText,
  PieChart,
  DownloadCloud,
  Map as MapIcon,
  Layers,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  ListChecks,
  Check,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Switch } from '@/components/ui/switch'
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

export function CmFrameworkMapping() {
  const [activeTab, setActiveTab] = useState('matrix')

  return (
    <div className="flex flex-col gap-6 p-6 min-h-max">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Framework & Role Mapping Studio <Info className="w-5 h-5 text-muted-foreground" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Design competency frameworks, set proficiency requirements and map them to job roles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2">
            <Copy className="w-4 h-4" /> Clone Framework
          </Button>
          <Button variant="outline" className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2">
            <Upload className="w-4 h-4" /> Import
          </Button>
          <Button variant="outline" className="h-10 px-4 rounded-xl font-semibold border-border bg-background gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
          
          <DropdownMenu>
            <div className="flex items-center rounded-xl bg-primary shadow-md shadow-primary/20 overflow-hidden group">
              <DropdownMenuTrigger className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-10 px-4 flex items-center gap-2 rounded-none border-r border-primary-foreground/20">
                <Plus className="w-4 h-4 stroke-[3]" /> Create Framework
              </DropdownMenuTrigger>
              <DropdownMenuTrigger className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 outline-none transition-colors">
                <ChevronDown className="w-4 h-4" />
              </DropdownMenuTrigger>
            </div>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>New Empty Framework</DropdownMenuItem>
              <DropdownMenuItem>From Template</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {/* Active Framework */}
        <div className="col-span-1 bg-card border border-primary/10 rounded-2xl p-4 flex flex-col gap-2 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Framework</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Global Competency Framework</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status="active" label="Published" />
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Total Competencies */}
        <div className="col-span-1 bg-card border border-primary/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Competencies</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-2xl font-bold text-foreground">48</p>
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <LayoutGrid className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Job Roles Mapped */}
        <div className="col-span-1 bg-card border border-primary/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job Roles Mapped</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-2xl font-bold text-foreground">36 <span className="text-sm font-semibold text-muted-foreground">/ 52</span></p>
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Users className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Mapping Coverage */}
        <div className="col-span-1 bg-card border border-primary/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mapping Coverage</p>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-foreground">69%</p>
            <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary rounded-full w-[69%]" />
            </div>
          </div>
        </div>

        {/* Last Published */}
        <div className="col-span-1 bg-card border border-primary/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Published</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-lg font-bold text-foreground">Apr 18, 2024</p>
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-border px-2">
        {['Framework Structure', 'Role Mapping Matrix', 'Weighting & Configuration', 'Proficiency Scale', 'Workflow & Review'].map(tab => {
          const id = tab.toLowerCase().split(' ')[0]
          const isActive = id === activeTab || (id === 'role' && activeTab === 'matrix')
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(id === 'role' ? 'matrix' : id)}
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

      {/* Tab Content Areas */}
      {activeTab === 'framework' && (
        <div className="flex-1 flex gap-6 min-h-0">
          <div className="w-96 shrink-0 flex flex-col gap-4 bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-4 shadow-sm h-full overflow-hidden">
            <h2 className="text-base font-bold text-foreground">Framework Structure</h2>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search categories..." className="h-9 pl-8 bg-background border-border" />
              </div>
              <Button variant="outline" className="w-9 h-9 p-0 bg-background border-border rounded-lg flex-shrink-0">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto g2g-scrollbar pr-2 flex flex-col gap-1">
              {/* Tree Item 1 - Expanded */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 text-primary cursor-pointer">
                  <div className="flex items-center gap-2">
                    <ChevronDown className="w-4 h-4" />
                    <span className="text-sm font-semibold">1. Core Competencies</span>
                  </div>
                  <span className="text-xs font-bold bg-background px-2 py-0.5 rounded-md text-primary">12</span>
                </div>
                <div className="flex flex-col pl-6 border-l border-border ml-3 gap-1 py-1">
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5" />
                      <span className="text-sm font-medium">1.1 Communication</span>
                    </div>
                    <span className="text-xs font-medium">5</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5" />
                      <span className="text-sm font-medium">1.2 Customer Focus</span>
                    </div>
                    <span className="text-xs font-medium">4</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5" />
                      <span className="text-sm font-medium">1.3 Integrity</span>
                    </div>
                    <span className="text-xs font-medium">3</span>
                  </div>
                </div>
              </div>

              {/* Tree Item 2 */}
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer mt-1">
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-sm font-semibold">2. Functional Competencies</span>
                </div>
                <span className="text-xs font-bold bg-muted-foreground/10 px-2 py-0.5 rounded-md">18</span>
              </div>

              {/* Tree Item 3 */}
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer mt-1">
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-sm font-semibold">3. Leadership Competencies</span>
                </div>
                <span className="text-xs font-bold bg-muted-foreground/10 px-2 py-0.5 rounded-md">10</span>
              </div>

              {/* Tree Item 4 */}
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer mt-1">
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" />
                  <span className="text-sm font-semibold">4. Digital Competencies</span>
                </div>
                <span className="text-xs font-bold bg-muted-foreground/10 px-2 py-0.5 rounded-md">8</span>
              </div>
            </div>

            <Button variant="outline" className="w-full border-dashed border-2 border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 gap-2 h-10 rounded-xl">
              <Plus className="w-4 h-4" /> Add Category
            </Button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl bg-card/20 text-muted-foreground p-12">
            <FileText className="w-12 h-12 mb-4 text-primary/40" />
            <p className="text-lg font-bold">Select a category</p>
            <p className="text-sm">Choose a category on the left to view and edit its details.</p>
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="w-full flex-1 flex flex-col h-full min-h-0">
          <div className="flex-1 flex flex-col bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden h-full">
          <div className="p-4 border-b border-primary/10 flex items-center justify-between bg-card z-10">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">Selected Category:</span>
              <span className="text-sm font-bold text-primary">1. Core Competencies</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-40 relative z-20">
                <Select options={[{label: 'All Roles', value: 'all'}, {label: 'Engineering', value: 'eng'}]} placeholder="All Roles" className="h-9 bg-background" />
              </div>
              <Button variant="outline" className="h-9 px-3 gap-2 bg-background border-border text-sm">
                <Filter className="w-3.5 h-3.5" /> Filters
              </Button>
              <Button variant="outline" className="h-9 px-3 gap-2 bg-background border-border text-sm">
                <Settings className="w-3.5 h-3.5" /> View Settings
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto g2g-scrollbar relative z-10">
            <Table className="w-full text-sm">
              <TableHeader className="bg-muted/30 border-b border-primary/10 sticky top-0 z-20">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-64 px-4 py-3 font-bold text-foreground">Competencies</TableHead>
                  <TableHead className="px-4 py-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-foreground">Software<br/>Engineer</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Required Level</span>
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-foreground">Senior Software<br/>Engineer</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Required Level</span>
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-foreground">Team<br/>Lead</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Required Level</span>
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-foreground">Engineering<br/>Manager</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Required Level</span>
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-foreground">Product<br/>Manager</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Required Level</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-16 text-center font-bold text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-primary/5">
                {[
                  { name: '1.1.1 Verbal Communication', l1: '3', c1: 'bg-yellow-400', l2: '4', c2: 'bg-green-500', l3: '4', c3: 'bg-green-500', l4: '4', c4: 'bg-green-500', l5: '4', c5: 'bg-green-500' },
                  { name: '1.1.2 Written Communication', l1: '3', c1: 'bg-yellow-400', l2: '3', c2: 'bg-yellow-400', l3: '4', c3: 'bg-green-500', l4: '4', c4: 'bg-green-500', l5: '4', c5: 'bg-green-500' },
                  { name: '1.1.3 Active Listening', l1: '3', c1: 'bg-yellow-400', l2: '4', c2: 'bg-green-500', l3: '4', c3: 'bg-green-500', l4: '5', c4: 'bg-blue-500', l5: '4', c5: 'bg-green-500' },
                  { name: '1.1.4 Presentation Skills', l1: '2', c1: 'bg-orange-400', l2: '3', c2: 'bg-yellow-400', l3: '4', c3: 'bg-green-500', l4: '5', c4: 'bg-blue-500', l5: '5', c5: 'bg-blue-500' },
                  { name: '1.1.5 Stakeholder Communication', l1: '3', c1: 'bg-yellow-400', l2: '4', c2: 'bg-green-500', l3: '5', c3: 'bg-blue-500', l4: '5', c4: 'bg-blue-500', l5: '5', c5: 'bg-blue-500' },
                ].map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab" />
                        {row.name}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-lg w-16 justify-between cursor-pointer hover:bg-muted transition-colors">
                          <span className="font-bold text-foreground">{row.l1}</span>
                          <div className={`w-2 h-2 rounded-full ${row.c1}`} />
                          <ChevronDown className="w-3 h-3 text-muted-foreground hidden group-hover:block absolute right-2" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-lg w-16 justify-between cursor-pointer hover:bg-muted transition-colors">
                          <span className="font-bold text-foreground">{row.l2}</span>
                          <div className={`w-2 h-2 rounded-full ${row.c2}`} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-lg w-16 justify-between cursor-pointer hover:bg-muted transition-colors">
                          <span className="font-bold text-foreground">{row.l3}</span>
                          <div className={`w-2 h-2 rounded-full ${row.c3}`} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-lg w-16 justify-between cursor-pointer hover:bg-muted transition-colors">
                          <span className="font-bold text-foreground">{row.l4}</span>
                          <div className={`w-2 h-2 rounded-full ${row.c4}`} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-lg w-16 justify-between cursor-pointer hover:bg-muted transition-colors">
                          <span className="font-bold text-foreground">{row.l5}</span>
                          <div className={`w-2 h-2 rounded-full ${row.c5}`} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none transition-colors mx-auto">
                          <MoreVertical className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit Mapping</DropdownMenuItem>
                          <DropdownMenuItem>Clear Mapping</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 border-t border-primary/10 bg-card z-10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Proficiency Level</span>
              <div className="flex items-center gap-3 text-xs font-medium text-foreground whitespace-nowrap">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> 1-Beginner</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" /> 2-Basic</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" /> 3-Intermediate</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> 4-Advanced</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" /> 5-Expert</div>
              </div>
            </div>
            <div className="flex items-center gap-6 whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Show Required Level</span>
                <Switch defaultChecked={true} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Show Current Level</span>
                <Switch defaultChecked={false} />
              </div>
            </div>
          </div>
          
          {/* Competency Details Bottom Panel */}
          <div className="p-5 border-t border-primary/10 bg-muted/20 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-bold text-foreground">Competency Details</h3>
              </div>
              <button className="text-sm font-bold text-primary hover:underline">View All</button>
            </div>
            
            <div className="grid grid-cols-4 gap-6">
              <div className="col-span-1">
                <p className="text-xs text-muted-foreground font-semibold mb-1">Competency Name</p>
                <p className="text-sm font-bold text-foreground">1.1.1 Verbal Communication</p>
                
                <p className="text-xs text-muted-foreground font-semibold mb-1 mt-4">Description</p>
                <p className="text-xs text-foreground leading-relaxed">Effectively conveys information and ideas through spoken communication.</p>
              </div>
              <div className="col-span-1">
                <p className="text-xs text-muted-foreground font-semibold mb-1">Category</p>
                <p className="text-sm font-bold text-foreground">1. Core Competencies</p>
                
                <p className="text-xs text-muted-foreground font-semibold mb-1 mt-4">Type</p>
                <p className="text-sm font-bold text-foreground">Skill</p>
              </div>
              <div className="col-span-1">
                <p className="text-xs text-muted-foreground font-semibold mb-1">Proficiency Scale</p>
                <p className="text-sm font-bold text-foreground">5 Level Scale</p>
                
                <p className="text-xs text-muted-foreground font-semibold mb-1 mt-4">Owner</p>
                <p className="text-sm font-bold text-foreground">HR Team</p>
              </div>
              <div className="col-span-1">
                <p className="text-xs text-muted-foreground font-semibold mb-1">Behavioral Indicators (Level 4 - Advanced)</p>
                <ul className="text-xs text-foreground leading-relaxed list-disc pl-4 space-y-1 mt-1">
                  <li>Communicates ideas clearly and confidently</li>
                  <li>Adapts communication to different audiences</li>
                  <li>Handles challenging conversations effectively</li>
                  <li>Influences others through effective communication</li>
                </ul>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'weighting' && (
        <div className="flex-1 flex gap-6 min-h-0">
          <div className="w-96 shrink-0 flex flex-col gap-4 h-full overflow-y-auto g2g-scrollbar">
            <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm shrink-0">
              <h3 className="text-sm font-bold text-foreground mb-4">Mapping Summary</h3>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 rounded-full border-[6px] border-muted flex items-center justify-center shrink-0">
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle cx="50%" cy="50%" r="46%" className="stroke-primary fill-none stroke-[6px]" strokeDasharray="289" strokeDashoffset="130" />
                    <circle cx="50%" cy="50%" r="46%" className="stroke-yellow-400 fill-none stroke-[6px]" strokeDasharray="289" strokeDashoffset="260" />
                    <circle cx="50%" cy="50%" r="46%" className="stroke-red-500 fill-none stroke-[6px]" strokeDasharray="289" strokeDashoffset="289" />
                  </svg>
                  <div className="text-center z-10">
                    <span className="text-xl font-bold text-foreground">36</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Total Roles</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-1.5">
                    <div className="w-2 h-2 rounded-sm bg-primary mt-1 shrink-0" />
                    <div className="text-xs">
                      <span className="font-semibold text-foreground">Fully Mapped</span>
                      <span className="text-muted-foreground block">(28) 55%</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <div className="w-2 h-2 rounded-sm bg-yellow-400 mt-1 shrink-0" />
                    <div className="text-xs">
                      <span className="font-semibold text-foreground">Partially Mapped</span>
                      <span className="text-muted-foreground block">(8) 15%</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <div className="w-2 h-2 rounded-sm bg-red-500 mt-1 shrink-0" />
                    <div className="text-xs">
                      <span className="font-semibold text-foreground">Not Mapped</span>
                      <span className="text-muted-foreground block">(16) 30%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4">Weighting Configuration</h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Core Competencies</span>
                  <span className="font-bold text-foreground">50%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Functional Competencies</span>
                  <span className="font-bold text-foreground">30%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Leadership Competencies</span>
                  <span className="font-bold text-foreground">20%</span>
                </div>
                <button className="text-sm font-bold text-primary hover:underline text-left mt-2">Manage Weighting</button>
              </div>
            </div>

            <div className="bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-5 shadow-sm shrink-0">
              <h3 className="text-sm font-bold text-foreground mb-4">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-sm font-medium text-foreground transition-colors">
                  <Plus className="w-4 h-4 text-primary" /> Add Competency
                </button>
                <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-sm font-medium text-foreground transition-colors">
                  <MapIcon className="w-4 h-4 text-primary" /> Map to Role
                </button>
                <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-sm font-medium text-foreground transition-colors">
                  <Copy className="w-4 h-4 text-primary" /> Bulk Update Levels
                </button>
                <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-sm font-medium text-foreground transition-colors">
                  <DownloadCloud className="w-4 h-4 text-primary" /> Download Mapping Template
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-2xl bg-card/20 text-muted-foreground p-12">
            <PieChart className="w-12 h-12 mb-4 text-primary/40" />
            <p className="text-lg font-bold">Configure Weighting</p>
            <p className="text-sm">Select a category on the left to manage its global weighting.</p>
          </div>
        </div>
      )}

      {activeTab === 'proficiency' && (
        <div className="flex-1 flex gap-6 min-h-0">
          <div className="w-96 shrink-0 flex flex-col gap-4 bg-card/50 backdrop-blur-xl border border-primary/10 rounded-2xl p-4 shadow-sm h-full overflow-hidden">
            <h2 className="text-base font-bold text-foreground">Proficiency Scales</h2>
            <Button className="w-full gap-2"><Plus className="w-4 h-4" /> Create New Scale</Button>
            
            <div className="flex-1 overflow-y-auto g2g-scrollbar flex flex-col gap-2 mt-2">
              <div className="p-3 border border-primary text-primary bg-primary/10 rounded-xl cursor-pointer">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-sm">Global 5-Level Scale</span>
                  <span className="text-xs bg-background px-2 py-0.5 rounded-md font-semibold">Default</span>
                </div>
                <p className="text-xs text-primary/70">Used across 85% of job roles</p>
              </div>
              <div className="p-3 border border-border bg-background hover:bg-muted rounded-xl cursor-pointer transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-sm text-foreground">Technical 3-Level Scale</span>
                </div>
                <p className="text-xs text-muted-foreground">For engineering and IT roles</p>
              </div>
              <div className="p-3 border border-border bg-background hover:bg-muted rounded-xl cursor-pointer transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-sm text-foreground">Leadership Scale</span>
                </div>
                <p className="text-xs text-muted-foreground">Executive and management</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden h-full">
            <div className="p-6 border-b border-primary/10 flex items-center justify-between bg-card z-10">
              <div>
                <h2 className="text-xl font-bold text-foreground">Global 5-Level Scale</h2>
                <p className="text-sm text-muted-foreground mt-1">Standard proficiency scale for all core and functional competencies.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2"><Edit2 className="w-4 h-4" /> Edit Scale</Button>
                <Button variant="outline" className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 g2g-scrollbar flex flex-col gap-4">
              {[
                { level: 1, name: 'Beginner', color: 'bg-red-500', desc: 'Has basic knowledge but requires guidance and supervision to complete tasks.' },
                { level: 2, name: 'Basic', color: 'bg-orange-400', desc: 'Can perform routine tasks independently but needs help with complex issues.' },
                { level: 3, name: 'Intermediate', color: 'bg-yellow-400', desc: 'Consistently performs tasks independently and can troubleshoot common problems.' },
                { level: 4, name: 'Advanced', color: 'bg-green-500', desc: 'Highly skilled, handles complex tasks, and mentors others in this competency.' },
                { level: 5, name: 'Expert', color: 'bg-blue-500', desc: 'Recognized authority. Drives strategy and innovation related to this competency.' },
              ].map(item => (
                <div key={item.level} className="flex gap-6 p-4 rounded-xl border border-border bg-background hover:border-primary/30 transition-colors">
                  <div className="flex flex-col items-center gap-2 shrink-0 w-24">
                    <div className={`w-12 h-12 rounded-full ${item.color} flex items-center justify-center text-white font-bold text-xl shadow-md`}>
                      {item.level}
                    </div>
                    <span className="font-bold text-sm text-foreground">{item.name}</span>
                  </div>
                  <div className="flex-1 border-l border-border pl-6 flex flex-col justify-center">
                    <h4 className="text-sm font-bold text-foreground mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'workflow' && (
        <div className="flex-1 flex flex-col h-full min-h-0 bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-primary/10 flex items-center justify-between bg-card z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-foreground">Review & Approvals</h2>
              <div className="flex bg-muted p-1 rounded-lg">
                <button className="px-4 py-1.5 rounded-md bg-background text-foreground text-sm font-bold shadow-sm">Pending (12)</button>
                <button className="px-4 py-1.5 rounded-md text-muted-foreground hover:text-foreground text-sm font-medium">Approved</button>
                <button className="px-4 py-1.5 rounded-md text-muted-foreground hover:text-foreground text-sm font-medium">Rejected</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="gap-2"><ListChecks className="w-4 h-4" /> Bulk Approve</Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto g2g-scrollbar relative z-10 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[
                { role: 'Software Engineer', dept: 'Engineering', user: 'Alex Johnson', date: 'Oct 24, 2023', changes: 5 },
                { role: 'Product Manager', dept: 'Product', user: 'Sarah Smith', date: 'Oct 23, 2023', changes: 12 },
                { role: 'Data Analyst', dept: 'Data Science', user: 'Mike Brown', date: 'Oct 22, 2023', changes: 3 },
                { role: 'UX Designer', dept: 'Design', user: 'Emily Davis', date: 'Oct 21, 2023', changes: 8 },
              ].map((item, idx) => (
                <div key={idx} className="bg-background border border-border rounded-xl p-5 shadow-sm hover:border-primary/40 transition-all flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-foreground text-base">{item.role}</h3>
                      <p className="text-xs text-muted-foreground">{item.dept}</p>
                    </div>
                    <StatusBadge status="warning" label="Pending" />
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-3 mb-4 flex-1">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-muted-foreground">Mapped By:</span>
                      <span className="font-semibold text-foreground">{item.user}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-muted-foreground">Submitted:</span>
                      <span className="font-semibold text-foreground">{item.date}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Modifications:</span>
                      <span className="font-bold text-primary">{item.changes} competencies</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
                      <Check className="w-4 h-4 mr-2" /> Approve
                    </Button>
                    <Button variant="outline" className="flex-1 bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">
                      <X className="w-4 h-4 mr-2" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
