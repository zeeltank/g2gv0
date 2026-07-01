'use client'

import React, { useState } from 'react'
import {
  BookOpen,
  FileText,
  Archive,
  AlertCircle,
  Users,
  Search,
  ListFilter,
  MoreVertical,
  Plus,
  LayoutGrid,
  List,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Settings
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FilterBar, type Filter } from '@/components/ui/filter-bar'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { CourseDetailsSheet } from './course-details-sheet'

interface Course {
  id: string
  title: string
  description: string
  category: string
  type: string
  mandatory: boolean
  version: string
  assignedLearners: number
  completionRate: number
  status: 'Published' | 'Draft' | 'Archived' | 'Under Review'
  updatedAt: string
}

const mockCourses: Course[] = [
  { id: 'c1', title: 'Workplace Safety', description: 'Understand safety protocols and main...', category: 'Compliance', type: 'eLearning', mandatory: true, version: '2.1', assignedLearners: 1245, completionRate: 78, status: 'Published', updatedAt: 'May 12, 2024' },
  { id: 'c2', title: 'Code of Conduct', description: 'Company policies and ethical guidelines.', category: 'Compliance', type: 'PDF', mandatory: true, version: '1.3', assignedLearners: 1876, completionRate: 92, status: 'Published', updatedAt: 'May 10, 2024' },
  { id: 'c3', title: 'Effective Communication', description: 'Improve communication skills across...', category: 'Soft Skills', type: 'Video', mandatory: false, version: '1.0', assignedLearners: 856, completionRate: 61, status: 'Published', updatedAt: 'May 08, 2024' },
  { id: 'c4', title: 'Leadership Essentials', description: 'Core leadership principles for new...', category: 'Leadership', type: 'Blended', mandatory: false, version: '1.2', assignedLearners: 642, completionRate: 45, status: 'Published', updatedAt: 'May 05, 2024' },
  { id: 'c5', title: 'Data Privacy Awareness', description: 'Protect data and maintain privacy.', category: 'Compliance', type: 'SCORM', mandatory: true, version: '1.1', assignedLearners: 1532, completionRate: 88, status: 'Published', updatedAt: 'Apr 30, 2024' },
  { id: 'c6', title: 'Microsoft Excel Basics', description: 'Learn Excel from scratch to pro.', category: 'Technical', type: 'eLearning', mandatory: false, version: '1.0', assignedLearners: 1102, completionRate: 34, status: 'Draft', updatedAt: 'Apr 28, 2024' },
  { id: 'c7', title: 'Customer Service Excellence', description: 'Deliver exceptional service to clients.', category: 'Customer Service', type: 'Video', mandatory: false, version: '1.0', assignedLearners: 967, completionRate: 70, status: 'Draft', updatedAt: 'Apr 25, 2024' },
  { id: 'c8', title: 'Project Management Fundamentals', description: 'Introduction to project management.', category: 'Project Management', type: 'Blended', mandatory: false, version: '1.0', assignedLearners: 523, completionRate: 20, status: 'Under Review', updatedAt: 'Apr 20, 2024' },
]

function KpiCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ElementType }) {
  return (
    <Card className="rounded-xl border-border/80 shadow-sm transition-shadow hover:shadow-md bg-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-muted-foreground tracking-wide flex items-center gap-2">
              <Icon className="size-4" /> {title}
            </p>
            <h3 className="text-2xl font-black tracking-tight text-foreground">{value}</h3>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function LearningCatalog() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('courses')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedMandatory, setSelectedMandatory] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  const tabs = [
    { id: 'courses', label: 'Courses' },
    { id: 'learning-paths', label: 'Learning Paths' },
    { id: 'curricula', label: 'Curricula' },
    { id: 'categories', label: 'Categories' },
  ]

  const filters: Filter[] = [
    {
      id: 'search',
      label: '',
      type: 'search',
      value: searchQuery,
      onChange: (val) => setSearchQuery(val as string),
    },
    {
      id: 'category',
      label: 'Category',
      type: 'select',
      value: selectedCategory,
      options: [
        { label: 'Compliance', value: 'Compliance' },
        { label: 'Soft Skills', value: 'Soft Skills' },
        { label: 'Technical', value: 'Technical' },
      ],
      onChange: (val) => setSelectedCategory(val as string),
    },
    {
      id: 'type',
      label: 'Type',
      type: 'select',
      value: selectedType,
      options: [
        { label: 'eLearning', value: 'eLearning' },
        { label: 'Video', value: 'Video' },
        { label: 'Blended', value: 'Blended' },
        { label: 'PDF', value: 'PDF' },
        { label: 'SCORM', value: 'SCORM' },
      ],
      onChange: (val) => setSelectedType(val as string),
    },
    {
      id: 'mandatory',
      label: 'Mandatory',
      type: 'select',
      value: selectedMandatory,
      options: [
        { label: 'Yes', value: 'Yes' },
        { label: 'No', value: 'No' },
      ],
      onChange: (val) => setSelectedMandatory(val as string),
    },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      value: selectedStatus,
      options: [
        { label: 'Published', value: 'Published' },
        { label: 'Draft', value: 'Draft' },
        { label: 'Archived', value: 'Archived' },
        { label: 'Under Review', value: 'Under Review' },
      ],
      onChange: (val) => setSelectedStatus(val as string),
    },
  ]

  const columns: Column<Course>[] = [
    {
      id: 'title',
      header: 'Course',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted border border-border/50">
            <ImageIcon className="size-5 text-muted-foreground/50" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm truncate text-foreground">{row.title}</span>
            <span className="text-xs text-muted-foreground truncate">{row.description}</span>
          </div>
        </div>
      ),
    },
    { id: 'category', header: 'Category' },
    { id: 'type', header: 'Type' },
    {
      id: 'mandatory',
      header: 'Mandatory',
      render: (val) => (
        <span className="text-sm font-medium">{val ? 'Yes' : 'No'}</span>
      ),
    },
    { id: 'version', header: 'Version' },
    { 
      id: 'assignedLearners', 
      header: 'Assigned Learners',
      render: (val) => <span className="font-medium">{val.toLocaleString()}</span>
    },
    {
      id: 'completionRate',
      header: 'Completion',
      render: (val) => (
        <div className="flex flex-col gap-1.5 w-24">
          <span className="text-[11px] font-bold text-foreground leading-none">{val}%</span>
          <Progress value={val as number} className="h-1.5 w-full bg-muted-foreground/20 [&>div]:bg-primary" />
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (val) => {
        let variant: 'success' | 'warning' | 'default' | 'error' = 'default'
        if (val === 'Published') variant = 'success'
        if (val === 'Under Review') variant = 'warning'
        if (val === 'Draft') variant = 'default'
        if (val === 'Archived') variant = 'error'
        
        return (
          <StatusBadge variant={variant} className="text-[10px] uppercase font-bold tracking-wider">
            {val as string}
          </StatusBadge>
        )
      },
    },
    { id: 'updatedAt', header: 'Updated' },
    {
      id: 'id',
      header: '',
      render: () => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="size-4 text-muted-foreground" />
          </Button>
        </div>
      ),
    },
  ]

  const filteredCourses = mockCourses.filter((c) => {
    if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (selectedCategory && c.category !== selectedCategory) return false
    if (selectedType && c.type !== selectedType) return false
    if (selectedMandatory && c.mandatory !== (selectedMandatory === 'Yes')) return false
    if (selectedStatus && c.status !== selectedStatus) return false
    return true
  })

  return (
    <div className="flex flex-col gap-6 w-full h-full pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Learning Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage courses, learning paths, curricula and categories.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border/60">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-8 rounded-md"
              onClick={() => setViewMode('list')}
            >
              <List className="size-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="size-8 rounded-md"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="size-4" />
            </Button>
          </div>
          <Button className="gap-2 shrink-0" onClick={() => router.push('/module/m4/learning/create-course')}>
            <Plus className="size-4" /> New Course
          </Button>
          <Button variant="outline" size="icon" className="shrink-0">
            <MoreVertical className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative pb-3 text-sm font-semibold transition-colors outline-none whitespace-nowrap',
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-t-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <FilterBar 
          filters={filters} 
          className="flex-1 [&_.flex-wrap]:justify-start" 
        />
        <Button variant="ghost" size="sm" className="gap-2 shrink-0 text-muted-foreground h-9 mt-auto">
          <ListFilter className="size-4" /> Clear All
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Total Courses" value="256" icon={BookOpen} />
        <KpiCard title="Published" value="198" icon={FileText} />
        <KpiCard title="Draft" value="32" icon={FileText} />
        <KpiCard title="Archived" value="26" icon={Archive} />
        <KpiCard title="Mandatory" value="124" icon={AlertCircle} />
        <KpiCard title="Total Learners" value="8,342" icon={Users} />
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center justify-between border border-border/80 bg-card rounded-lg p-2 px-4 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
            {selectedRows.length} selected
          </span>
          <div className="h-4 w-px bg-border mx-2" />
          <Button variant="ghost" size="sm" className="h-8 gap-2" disabled={selectedRows.length === 0}>
            <CheckCircle2 className="size-4" /> Publish
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-2" disabled={selectedRows.length === 0}>
            <Archive className="size-4" /> Archive
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-2" disabled={selectedRows.length === 0}>
            <Users className="size-4" /> Assign
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-2" disabled={selectedRows.length === 0}>
            <Plus className="size-4" /> Add to Path
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={selectedRows.length === 0}>
            Delete
          </Button>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-2 bg-card">
          <Upload className="size-4" /> Export
        </Button>
      </div>

      {/* Data Table */}
      <div className="flex-1 bg-card rounded-xl">
        <DataTable
          columns={columns}
          data={filteredCourses}
          selectable
          selectedIds={selectedRows}
          onSelectChange={setSelectedRows}
          onRowClick={(row) => setSelectedCourse(row)}
          pagination={{
            page: 1,
            pageSize: 10,
            total: 256,
            onPageChange: () => {},
          }}
          className="border-border/80 shadow-sm"
        />
      </div>

      {/* Details Sheet */}
      <CourseDetailsSheet
        course={selectedCourse}
        open={!!selectedCourse}
        onOpenChange={(open) => !open && setSelectedCourse(null)}
      />
    </div>
  )
}
