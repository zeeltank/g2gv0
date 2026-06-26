'use client'

import React, { useState } from 'react'
import { 
  Briefcase, 
  Search, 
  Filter, 
  MoreVertical,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CreateProjectModal } from './create-project-modal'

// Mock Data
const mockProjects = [
  {
    id: 'PRJ-001',
    name: 'Q3 Enterprise Deployment',
    description: 'Rollout of the new enterprise task management architecture to all North American departments.',
    status: 'in_progress',
    progress: 65,
    owner: 'Sarah Chen',
    dueDate: '2026-09-30',
    tasksTotal: 42,
    tasksCompleted: 27,
    members: ['Sarah Chen', 'Michael Scott', 'Jim Halpert']
  },
  {
    id: 'PRJ-002',
    name: 'Compliance Audit 2026',
    description: 'Annual security and compliance audit prep for SOC2 certification.',
    status: 'at_risk',
    progress: 30,
    owner: 'Dwight Schrute',
    dueDate: '2026-08-15',
    tasksTotal: 18,
    tasksCompleted: 5,
    members: ['Dwight Schrute', 'Angela Martin']
  },
  {
    id: 'PRJ-003',
    name: 'Employee Onboarding Revamp',
    description: 'Redesigning the first 30 days experience for new hires including digital assets.',
    status: 'planning',
    progress: 10,
    owner: 'Pam Beesly',
    dueDate: '2026-11-01',
    tasksTotal: 24,
    tasksCompleted: 2,
    members: ['Pam Beesly', 'Toby Flenderson']
  },
  {
    id: 'PRJ-004',
    name: 'Q2 Performance Reviews',
    description: 'Company-wide mid-year performance evaluations and compensation adjustments.',
    status: 'completed',
    progress: 100,
    owner: 'Michael Scott',
    dueDate: '2026-06-15',
    tasksTotal: 156,
    tasksCompleted: 156,
    members: ['Michael Scott', 'Toby Flenderson', 'David Wallace']
  }
]

export function ProjectsListView() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'bg-primary/20 text-primary border-primary/30'
      case 'in_progress': return 'bg-primary/10 text-primary border-primary/20'
      case 'at_risk': return 'bg-background text-primary border-primary/50 shadow-sm'
      case 'planning': return 'bg-muted text-foreground border-border'
      default: return 'bg-muted/50 text-muted-foreground border-border/50'
    }
  }

  const formatStatus = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  let filteredProjects = mockProjects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.owner.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (filterStatus !== 'all') {
    filteredProjects = filteredProjects.filter(p => p.status === filterStatus)
  }

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Header Area */}
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects & Workstreams</h1>
  
          </div>
          
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> New Project
          </Button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between p-2 rounded-2xl bg-card/30 backdrop-blur-xl border border-primary/10 shadow-sm shrink-0 relative z-20">
        <div className="flex items-center gap-2 flex-1 max-w-md ml-2 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 pr-2">
          <Select 
            value={filterStatus} 
            onChange={setFilterStatus}
            options={[
              { label: 'All Projects', value: 'all' },
              { label: 'In Progress', value: 'in_progress' },
              { label: 'Planning', value: 'planning' },
              { label: 'At Risk', value: 'at_risk' },
              { label: 'Completed', value: 'completed' }
            ]}
            className="w-[160px]"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto g2g-scrollbar pt-2 pb-6 pr-2">
        {filteredProjects.map((project) => (
          <div 
            key={project.id}
            className="group relative flex flex-col rounded-[24px] border border-primary/10 bg-card/90 backdrop-blur-2xl p-6 shadow-xl transition-all duration-500 hover:shadow-2xl hover:border-primary/30 hover:-translate-y-1.5 cursor-pointer"
          >
            {/* Card Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
                  <Briefcase className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground line-clamp-1">{project.name}</h3>
                  <p className="text-sm text-muted-foreground">{project.id}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center justify-center outline-none h-8 w-8 rounded-lg border border-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer">
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 rounded-xl">
                  <DropdownMenuItem className="cursor-pointer">Edit Project</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">Manage Team</DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer text-danger focus:text-danger">Archive</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">
              {project.description}
            </p>

            {/* Meta Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Due Date
                </span>
                <span className="text-sm font-medium">{new Date(project.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Tasks
                </span>
                <span className="text-sm font-medium">{project.tasksCompleted} / {project.tasksTotal}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex flex-col gap-2 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-foreground">Progress</span>
                <span className="font-bold text-primary">{project.progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10 shadow-inner">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <span className={cn("px-2.5 py-1 text-[11px] uppercase tracking-wider font-bold rounded-lg border", getStatusColor(project.status))}>
                {formatStatus(project.status)}
              </span>
              
              <div className="flex items-center -space-x-2">
                {project.members.slice(0, 3).map((member, i) => (
                  <div 
                    key={i} 
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-xs font-medium text-primary ring-1 ring-primary/20"
                    title={member}
                  >
                    {member.charAt(0)}
                  </div>
                ))}
                {project.members.length > 3 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
                    +{project.members.length - 3}
                  </div>
                )}
              </div>
            </div>
            
            {/* Overlay Hover Effect */}
            <div className="absolute inset-0 rounded-2xl ring-2 ring-primary/0 group-hover:ring-primary/20 transition-all pointer-events-none" />
          </div>
        ))}
        
        {filteredProjects.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-4">
              <Briefcase className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No projects found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        )}
      </div>

      <CreateProjectModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
    </div>
  )
}
