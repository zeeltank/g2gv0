'use client'

import React, { useState, useEffect } from 'react'
import {
  Search,
  Plus,
  Calendar,
  Users,
  Shield,
  Filter,
  MoreHorizontal,
  Settings,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Info,
  ChevronDown,
  LayoutList,
  KanbanSquare,
  History,
  Download,
  DoorOpen,
  LogOut,
  CheckCircle2,
  FileText,
  Clock,
  UserCheck,
  RefreshCcw,
  ClipboardList,
  AlertCircle,
  FileDigit,
  Trash2,
  User,
  Edit2,
  Edit3,
  MessageSquare,
  Send,
  Building,
  UserX,
  Receipt,
  CheckSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/status-badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { offboardingService } from '@/services/talent/offboarding'
import type { ExitCase, ClearanceTask, DocumentItem, CaseComment, ActivityLogItem, OffbOverview, OffbFilterOptions } from '@/services/talent/offboarding'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'

export function OffboardingCenter() {
  const { user } = useAuth()
  const context = getLaravelContext(user)
  const isContextReady = isLaravelContextReady(context)

  // Navigation and view tabs
  const [activeMainTab, setActiveMainTab] = useState<'Exit Cases' | 'Clearance Tracker' | 'Exit Interviews' | 'Reports'>('Exit Cases')
  const [selectedCases, setSelectedCases] = useState<string[]>()
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [activeTopTab, setActiveTopTab] = useState('overview')

  // API State
  const [cases, setCases] = useState<ExitCase[]>([])
  const [loadingCases, setLoadingCases] = useState(false)
  
  const [overview, setOverview] = useState<OffbOverview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(false)
  
  const [filtersOptions, setFiltersOptions] = useState<OffbFilterOptions | null>(null)
  const [loadingFilters, setLoadingFilters] = useState(false)
  
  const [activeCaseDetails, setActiveCaseDetails] = useState<ExitCase | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Filters State
  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [exitTypeFilter, setExitTypeFilter] = useState('')
  const [viewLayout, setViewLayout] = useState<'list' | 'kanban' | 'history'>('list')
  const [filtersOpen, setFiltersOpen] = useState(false)
  
  // Pagination & Sorting State
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [totalCases, setTotalCases] = useState(0)
  const [sortBy, setSortBy] = useState('last_working_day')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Dialog States
  const [createOpen, setCreateOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Forms states
  const [newCase, setNewCase] = useState({
    employee_id: '',
    exit_type: 'voluntary' as 'voluntary' | 'involuntary',
    exit_reason: 'Better Opportunity',
    notice_date: new Date().toISOString().split('T')[0],
    last_working_day: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    manager_id: '',
    location: ''
  })
  
  const [extendDate, setExtendDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [newComment, setNewComment] = useState('')

  // Exit Interview edit state
  const [interviewForm, setInterviewForm] = useState({
    done: false,
    date: '',
    notes: ''
  })

  // Document Upload Mock State
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null)
  const [mockFileName, setMockFileName] = useState('')

  // Notifications
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const bumpRefresh = () => setRefreshTrigger(prev => prev + 1)

  const activeFiltersCount = (departmentFilter ? 1 : 0) + (reasonFilter ? 1 : 0) + (exitTypeFilter ? 1 : 0)

  const showBanner = (type: 'success' | 'error', message: string) => {
    setBanner({ type, message })
    setTimeout(() => setBanner(null), 5000)
  }

  // Load dropdown/filter options
  useEffect(() => {
    if (!isContextReady) return
    setLoadingFilters(true)
    offboardingService.getFilters(context)
      .then(res => setFiltersOptions(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoadingFilters(false))
  }, [isContextReady, refreshTrigger])

  // Load KPI overview
  useEffect(() => {
    if (!isContextReady) return
    setLoadingOverview(true)
    offboardingService.getOverview(context, departmentFilter || undefined)
      .then(res => setOverview(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoadingOverview(false))
  }, [isContextReady, departmentFilter, refreshTrigger])

  // Load cases list
  useEffect(() => {
    if (!isContextReady) return
    setLoadingCases(true)
    offboardingService.getCases(context, {
      search: searchQuery || undefined,
      department_id: departmentFilter || undefined,
      exit_reason: reasonFilter || undefined,
      status: statusFilter === 'All' ? undefined : statusFilter,
      exit_type: exitTypeFilter || undefined,
      page,
      per_page: perPage,
      sort_by: sortBy,
      sort_dir: sortDir
    })
      .then(res => {
        setCases(res.data)
        setTotalCases(res.pagination.total)
      })
      .catch(err => {
        console.error(err)
        showBanner('error', 'Failed to load exit cases')
      })
      .finally(() => setLoadingCases(false))
  }, [isContextReady, searchQuery, departmentFilter, reasonFilter, statusFilter, exitTypeFilter, page, perPage, sortBy, sortDir, refreshTrigger])

  // Load selected case details
  useEffect(() => {
    if (!isContextReady || !activeCaseId) {
      setActiveCaseDetails(null)
      return
    }
    setLoadingDetails(true)
    offboardingService.getCase(context, activeCaseId)
      .then(res => {
        setActiveCaseDetails(res.data)
        setInterviewForm({
          done: res.data.exit_interview_done || false,
          date: res.data.exit_interview_date || '',
          notes: res.data.exit_interview_notes || ''
        })
      })
      .catch(err => {
        console.error(err)
        showBanner('error', 'Failed to load case details')
      })
      .finally(() => setLoadingDetails(false))
  }, [isContextReady, activeCaseId, refreshTrigger])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, departmentFilter, reasonFilter, statusFilter, exitTypeFilter])

  const toggleCase = (id: string) => {
    setSelectedCases(prev => {
      const arr = prev || []
      return arr.includes(id) ? arr.filter(e => e !== id) : [...arr, id]
    })
  }

  const getKpiIcon = (iconName: string) => {
    switch (iconName) {
      case 'door-open': return <DoorOpen className="size-5" />
      case 'log-out': return <LogOut className="size-5" />
      case 'calendar': return <Calendar className="size-5" />
      case 'shield': return <Shield className="size-5" />
      case 'users': return <Users className="size-5" />
      case 'check-circle': return <CheckCircle2 className="size-5" />
      default: return <DoorOpen className="size-5" />
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Resignation Submitted': return 'default'
      case 'Notice Period': return 'primary'
      case 'Clearance': return 'warning'
      case 'Exit Interview': return 'primary'
      case 'Awaiting F&F': return 'error'
      case 'Closed': return 'success'
      default: return 'default'
    }
  }

  // Action handlers
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCase.employee_id || submitting) return
    
    setSubmitting(true)
    try {
      await offboardingService.createCase(context, {
        employee_id: parseInt(newCase.employee_id),
        exit_type: newCase.exit_type,
        exit_reason: newCase.exit_reason,
        notice_date: newCase.notice_date,
        last_working_day: newCase.last_working_day,
        manager_id: newCase.manager_id ? parseInt(newCase.manager_id) : undefined,
        location: newCase.location || undefined
      })
      showBanner('success', 'Exit case registered successfully')
      setCreateOpen(false)
      bumpRefresh()
      // reset form
      setNewCase({
        employee_id: '',
        exit_type: 'voluntary',
        exit_reason: 'Better Opportunity',
        notice_date: new Date().toISOString().split('T')[0],
        last_working_day: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        manager_id: '',
        location: ''
      })
    } catch (err: any) {
      console.error(err)
      showBanner('error', err.message || 'Failed to create exit case')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExtendNotice = async () => {
    if (!activeCaseId || !extendDate || submitting) return
    
    setSubmitting(true)
    try {
      await offboardingService.updateCase(context, activeCaseId, {
        last_working_day: extendDate
      })
      showBanner('success', 'Notice period extended successfully')
      setExtendOpen(false)
      bumpRefresh()
    } catch (err: any) {
      console.error(err)
      showBanner('error', 'Failed to extend notice period')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssignHandover = async () => {
    if (!activeCaseId || !assigneeId || submitting) return
    
    setSubmitting(true)
    try {
      await offboardingService.updateCase(context, activeCaseId, {
        manager_id: parseInt(assigneeId)
      })
      showBanner('success', 'Handover manager reassigned successfully')
      setAssignOpen(false)
      bumpRefresh()
    } catch (err: any) {
      console.error(err)
      showBanner('error', 'Failed to assign handover manager')
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdrawCase = async () => {
    if (!activeCaseId || submitting) return
    
    setSubmitting(true)
    try {
      await offboardingService.withdrawCase(context, activeCaseId)
      showBanner('success', 'Resignation case withdrawn and closed')
      setWithdrawOpen(false)
      setActiveCaseId(null)
      bumpRefresh()
    } catch (err: any) {
      console.error(err)
      showBanner('error', 'Failed to withdraw case')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusTransition = async (newStatus: string) => {
    if (!activeCaseId) return
    try {
      await offboardingService.updateStatus(context, activeCaseId, newStatus)
      showBanner('success', `Case moved to ${newStatus}`)
      bumpRefresh()
    } catch (err: any) {
      console.error(err)
      showBanner('error', `Failed to transition status to ${newStatus}`)
    }
  }

  const handleClearanceToggle = async (taskId: string, newStatus: 'Pending' | 'Cleared' | 'N/A') => {
    if (!activeCaseId || !activeCaseDetails) return
    const tasks = activeCaseDetails.clearance_tasks || []
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    
    try {
      await offboardingService.updateClearance(context, activeCaseId, updatedTasks)
      showBanner('success', 'Clearance checklist updated')
      bumpRefresh()
    } catch (err: any) {
      console.error(err)
      showBanner('error', 'Failed to update clearance checklist')
    }
  }

  const handleDocStatusUpdate = async (docId: string, newStatus: 'Pending' | 'Submitted' | 'Verified' | 'Rejected', fileName?: string | null) => {
    if (!activeCaseId || !activeCaseDetails) return
    const docs = activeCaseDetails.documents || []
    const updatedDocs = docs.map(d => {
      if (d.id === docId) {
        return {
          ...d,
          status: newStatus,
          fileName: fileName !== undefined ? fileName : d.fileName
        }
      }
      return d
    })

    try {
      await offboardingService.updateDocuments(context, activeCaseId, updatedDocs)
      showBanner('success', 'Document status updated')
      bumpRefresh()
    } catch (err: any) {
      console.error(err)
      showBanner('error', 'Failed to update documents')
    }
  }

  const handleUploadMockDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCaseId || !uploadingDocId || !mockFileName) return
    await handleDocStatusUpdate(uploadingDocId, 'Submitted', mockFileName)
    setUploadingDocId(null)
    setMockFileName('')
  }

  const handleSaveInterview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCaseId) return
    try {
      await offboardingService.updateExitInterview(context, activeCaseId, {
        exit_interview_done: interviewForm.done,
        exit_interview_date: interviewForm.date || null,
        exit_interview_notes: interviewForm.notes
      })
      showBanner('success', 'Exit interview details saved')
      bumpRefresh()
    } catch (err: any) {
      console.error(err)
      showBanner('error', 'Failed to save exit interview details')
    }
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCaseId || !newComment.trim()) return
    try {
      await offboardingService.addComment(context, activeCaseId, newComment)
      setNewComment('')
      bumpRefresh()
    } catch (err: any) {
      console.error(err)
      showBanner('error', 'Failed to add comment')
    }
  }

  // Calculations for Clearance tracker tab
  const getClearanceProgress = (c: ExitCase) => {
    const tasks = c.clearance_tasks || []
    if (tasks.length === 0) return 0
    const cleared = tasks.filter(t => t.status === 'Cleared' || t.status === 'N/A').length
    return Math.round((cleared / tasks.length) * 100)
  }

  const getClearanceSummaryByDept = (c: ExitCase, dept: string) => {
    const tasks = (c.clearance_tasks || []).filter(t => t.department === dept)
    if (tasks.length === 0) return 'N/A'
    const cleared = tasks.filter(t => t.status === 'Cleared' || t.status === 'N/A').length
    return `${cleared}/${tasks.length}`
  }

  const handleExportCSV = () => {
    if (cases.length === 0) return
    const headers = ['Case ID', 'Employee Name', 'Employee ID', 'Department', 'Last Working Day', 'Exit Reason', 'Exit Type', 'Status', 'Owner', 'Updated On']
    const rows = cases.map(c => [
      c.caseId,
      c.employee.name,
      c.employee.id,
      c.department,
      c.lastWorkingDay,
      c.exitReason,
      c.exitType,
      c.status,
      c.owner,
      c.updatedOn
    ])
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n')
      
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `exit_cases_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
        
        {/* Banner Messages */}
        {banner && (
          <div className={cn(
            "fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4",
            banner.type === 'success' ? "bg-success/15 text-success-foreground border-success/30" : "bg-destructive/15 text-destructive-foreground border-destructive/30"
          )}>
            <AlertCircle className="size-4 shrink-0" />
            <span>{banner.message}</span>
          </div>
        )}

        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 mt-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Offboarding Center</h1>
              <Info className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Manage employee exits from resignation submission to final clearance and closure.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              className="flex items-center gap-2 h-9"
              onClick={handleExportCSV}
              disabled={cases.length === 0}
            >
              <Download className="size-4" /> Export CSV
            </Button>
            <Button 
              className="flex items-center gap-2 h-9"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" /> Create Exit Case
            </Button>
          </div>
        </div>

        {/* KPIs Row */}
        <div className="flex overflow-x-auto gap-4 mb-6 pb-2 custom-scrollbar">
          {overview?.kpis.map((kpi) => {
            // Determine filter matching
            let isSelected = false
            if (kpi.title === 'Notice Period' && statusFilter === 'Notice Period') isSelected = true
            if (kpi.title === 'Clearance Pending' && statusFilter === 'Clearance') isSelected = true
            if (kpi.title === 'Exit Interviews' && statusFilter === 'Exit Interview') isSelected = true
            if (kpi.title === 'Closed' && statusFilter === 'Closed') isSelected = true
            if (kpi.title === 'Resignations' && exitTypeFilter === 'voluntary') isSelected = true

            return (
              <Card 
                key={kpi.id} 
                className={cn(
                  "shadow-sm min-w-[180px] flex-1 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50",
                  isSelected && "border-2 border-primary bg-primary/5"
                )}
                onClick={() => {
                  if (kpi.title === 'Notice Period') setStatusFilter(statusFilter === 'Notice Period' ? 'All' : 'Notice Period')
                  else if (kpi.title === 'Clearance Pending') setStatusFilter(statusFilter === 'Clearance' ? 'All' : 'Clearance')
                  else if (kpi.title === 'Exit Interviews') setStatusFilter(statusFilter === 'Exit Interview' ? 'All' : 'Exit Interview')
                  else if (kpi.title === 'Closed') setStatusFilter(statusFilter === 'Closed' ? 'All' : 'Closed')
                  else if (kpi.title === 'Resignations') setExitTypeFilter(exitTypeFilter === 'voluntary' ? '' : 'voluntary')
                  else setStatusFilter('All')
                }}
              >
                <CardContent className="p-4 flex flex-col h-full gap-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{kpi.title}</span>
                    <Info className="size-3.5 text-muted-foreground/50" />
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="p-2 rounded-xl bg-muted/50 text-muted-foreground border">
                      {getKpiIcon(kpi.icon)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-2xl font-bold text-foreground leading-none">{kpi.value}</span>
                      <span className="text-[10px] text-muted-foreground mt-1">{kpi.subtitle}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Main Tabs & Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-border gap-4 pb-2">
            <div className="flex items-center gap-6">
              {(['Exit Cases', 'Clearance Tracker', 'Exit Interviews', 'Reports'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveMainTab(tab)}
                  className={cn(
                    "pb-2 text-sm font-semibold transition-colors relative cursor-pointer",
                    activeMainTab === tab 
                      ? "text-primary border-b-2 border-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Search exit cases..." 
                  className="pl-9 h-9 rounded-xl"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Button 
                variant="outline" 
                className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-card hover:bg-muted/50"
                onClick={() => setFiltersOpen(true)}
              >
                <Filter className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>

              <div className="w-[140px]">
                <Select 
                  value="saved"
                  onChange={() => {}}
                  placeholder="Saved Views"
                  options={[{ label: 'Saved Views', value: 'saved' }]}
                  size="sm"
                  className="rounded-xl"
                />
              </div>

              {(searchQuery || departmentFilter || reasonFilter || statusFilter !== 'All' || exitTypeFilter) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSearchQuery('')
                    setDepartmentFilter('')
                    setReasonFilter('')
                    setStatusFilter('All')
                    setExitTypeFilter('')
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground h-9"
                >
                  Clear Filters
                </Button>
              )}

              <div className="flex p-0.5 bg-muted/40 rounded-xl border ml-2 items-center gap-0.5">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={cn(
                    "size-8 rounded-lg transition-all",
                    viewLayout === 'list' 
                      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/95" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setViewLayout('list')}
                >
                  <LayoutList className="size-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={cn(
                    "size-8 rounded-lg transition-all",
                    viewLayout === 'kanban' 
                      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/95" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setViewLayout('kanban')}
                >
                  <KanbanSquare className="size-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={cn(
                    "size-8 rounded-lg transition-all",
                    viewLayout === 'history' 
                      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/95" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setViewLayout('history')}
                >
                  <History className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Status Sub-tabs */}
          {activeMainTab === 'Exit Cases' && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: 'All', key: 'All' },
                { label: 'Resignation Submitted', key: 'Resignation Submitted' },
                { label: 'Notice Period', key: 'Notice Period' },
                { label: 'Clearance', key: 'Clearance' },
                { label: 'Exit Interview', key: 'Exit Interview' },
                { label: 'Awaiting F&F', key: 'Awaiting F&F' },
                { label: 'Closed', key: 'Closed' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer",
                    statusFilter === tab.key 
                      ? "bg-primary/10 text-primary border-primary/20" 
                      : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TAB CONTENTS */}
        {activeMainTab === 'Exit Cases' && viewLayout === 'list' && (
          <div className="grid grid-cols-1 gap-6">
            <Card className="shadow-sm overflow-hidden border-border/60">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="w-[40px] pl-4">
                        <Checkbox 
                          checked={selectedCases && selectedCases.length === cases.length && cases.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedCases(cases.map(c => c.id))
                            else setSelectedCases([])
                          }}
                        />
                      </TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Employee</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Department</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Last Working Day</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Exit Reason</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Type</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Status</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Owner</TableHead>
                      <TableHead className="font-semibold text-foreground h-10 text-xs">Updated On</TableHead>
                      <TableHead className="w-[40px] text-center font-semibold text-foreground h-10">
                        <Settings className="size-4" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingCases ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          <RefreshCcw className="size-6 animate-spin mx-auto mb-2" />
                          Loading cases...
                        </TableCell>
                      </TableRow>
                    ) : cases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          No exit cases found matching filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      cases.map((exitCase) => (
                        <TableRow 
                          key={exitCase.id} 
                          className={cn("hover:bg-muted/10 cursor-pointer", exitCase.id === activeCaseId && 'bg-primary/5 hover:bg-primary/5')}
                          onClick={() => {
                            setActiveCaseId(exitCase.id)
                            setActiveTopTab('overview')
                          }}
                        >
                          <TableCell className="pl-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedCases?.includes(exitCase.id) || false}
                              onCheckedChange={() => toggleCase(exitCase.id)}
                            />
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border shrink-0">
                                {exitCase.employee.initials}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground whitespace-nowrap">{exitCase.employee.name}</span>
                                <span className="text-[10px] text-muted-foreground">{exitCase.employee.id}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground/80 py-3">{exitCase.department}</TableCell>
                          <TableCell className="text-xs font-medium text-foreground/80 py-3">{exitCase.lastWorkingDay}</TableCell>
                          <TableCell className="text-xs font-medium text-foreground/80 py-3">{exitCase.exitReason}</TableCell>
                          <TableCell className="text-xs font-medium text-foreground/80 py-3 capitalize">{exitCase.exitType}</TableCell>
                          <TableCell className="py-3">
                            <StatusBadge variant={getStatusVariant(exitCase.status)} className="px-2 py-0.5 text-[10px] whitespace-nowrap">
                              {exitCase.status}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground/80 py-3 whitespace-nowrap">{exitCase.owner}</TableCell>
                          <TableCell className="text-xs font-medium text-foreground/80 py-3 whitespace-nowrap">{exitCase.updatedOn}</TableCell>
                          <TableCell className="text-center py-3" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-muted-foreground"
                              onClick={() => {
                                setActiveCaseId(exitCase.id)
                                setActiveTopTab('overview')
                              }}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination controls */}
              <div className="p-3 border-t flex items-center justify-between bg-muted/5">
                <span className="text-xs text-muted-foreground">
                  Showing {Math.min(totalCases, (page - 1) * perPage + 1)} to {Math.min(totalCases, page * perPage)} of {totalCases} entries
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button variant="default" size="icon" className="h-7 w-7 text-xs bg-primary/20 text-primary border border-primary/30">
                      {page}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-7 w-7 text-muted-foreground"
                      disabled={page >= Math.ceil(totalCases / perPage)}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  <div className="w-[110px]">
                    <Select 
                      value={String(perPage)} 
                      onChange={(v) => { setPerPage(parseInt(v)); setPage(1) }} 
                      options={[{label: '5 / page', value: '5'}, {label: '10 / page', value: '10'}, {label: '25 / page', value: '25'}, {label: '50 / page', value: '50'}]} 
                      size="sm" 
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeMainTab === 'Exit Cases' && viewLayout === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
            {[
              { title: 'Notice Period', status: 'Notice Period' },
              { title: 'Clearance', status: 'Clearance' },
              { title: 'Exit Interview', status: 'Exit Interview' },
              { title: 'Awaiting F&F', status: 'Awaiting F&F' },
              { title: 'Closed', status: 'Closed' }
            ].map(col => {
              const colCases = cases.filter(c => c.status === col.status)
              return (
                <div key={col.title} className="flex flex-col gap-3 min-w-[200px] bg-muted/20 p-3 rounded-lg border border-border/50">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-foreground">{col.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted font-bold text-muted-foreground">{colCases.length}</span>
                  </div>
                  <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                    {colCases.map(c => {
                      const pct = getClearanceProgress(c)
                      return (
                        <div 
                          key={c.id} 
                          className="bg-card border p-3 rounded-md shadow-sm hover:border-primary/50 cursor-pointer flex flex-col gap-2"
                          onClick={() => {
                            setActiveCaseId(c.id)
                            setActiveTopTab('overview')
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center font-bold text-[9px] text-primary">
                              {c.employee.initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-foreground truncate max-w-[120px]">{c.employee.name}</span>
                              <span className="text-[9px] text-muted-foreground">{c.employee.id}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 text-[10px]">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">LWD:</span>
                              <span className="font-medium text-foreground">{c.lastWorkingDay}</span>
                            </div>
                            <div className="flex flex-col gap-1 mt-1">
                              <div className="flex justify-between text-[9px]">
                                <span className="text-muted-foreground">Clearance</span>
                                <span className="font-bold text-foreground">{pct}%</span>
                              </div>
                              <Progress value={pct} className="h-1" />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {colCases.length === 0 && (
                      <div className="text-center py-6 text-[10px] text-muted-foreground border-2 border-dashed border-border/40 rounded-md">
                        No cases
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeMainTab === 'Clearance Tracker' && (
          <Card className="shadow-sm border-border/60">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-foreground text-sm">Active Clearance Tasks Tracker</h2>
              <p className="text-xs text-muted-foreground">Check status and mark clearance tasks across IT, Finance, HR and Admin.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="font-semibold text-foreground text-xs">Employee</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Department</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Last Working Day</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Progress</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">IT Clearance</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">HR Clearance</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Finance Clearance</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Admin Clearance</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs text-center">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCases ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        <RefreshCcw className="size-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : cases.filter(c => c.status === 'Clearance' || c.status === 'Notice Period').length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No employees currently in Notice Period or Clearance stage.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cases.filter(c => c.status === 'Clearance' || c.status === 'Notice Period').map((c) => {
                      const pct = getClearanceProgress(c)
                      return (
                        <TableRow key={c.id} className="hover:bg-muted/10 cursor-pointer" onClick={() => {
                          setActiveCaseId(c.id)
                          setActiveTopTab('clearance')
                        }}>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px]">
                                {c.employee.initials}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-foreground">{c.employee.name}</span>
                                <span className="text-[10px] text-muted-foreground">{c.employee.id}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs py-3">{c.department}</TableCell>
                          <TableCell className="text-xs py-3">{c.lastWorkingDay}</TableCell>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2 w-24">
                              <Progress value={pct} className="h-1.5" />
                              <span className="text-[10px] font-bold text-foreground">{pct}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <StatusBadge variant={getClearanceSummaryByDept(c, 'IT').includes('0/') ? 'warning' : 'success'} size="sm">
                              {getClearanceSummaryByDept(c, 'IT')}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="py-3">
                            <StatusBadge variant={getClearanceSummaryByDept(c, 'HR').includes('0/') ? 'warning' : 'success'} size="sm">
                              {getClearanceSummaryByDept(c, 'HR')}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="py-3">
                            <StatusBadge variant={getClearanceSummaryByDept(c, 'Finance').includes('0/') ? 'warning' : 'success'} size="sm">
                              {getClearanceSummaryByDept(c, 'Finance')}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="py-3">
                            <StatusBadge variant={getClearanceSummaryByDept(c, 'Admin').includes('0/') ? 'warning' : 'success'} size="sm">
                              {getClearanceSummaryByDept(c, 'Admin')}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <Button size="xs" variant="outline" onClick={() => {
                              setActiveCaseId(c.id)
                              setActiveTopTab('clearance')
                            }}>
                              Inspect
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {activeMainTab === 'Exit Interviews' && (
          <Card className="shadow-sm border-border/60">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-foreground text-sm">Exit Interview Scheduling & Feedback</h2>
              <p className="text-xs text-muted-foreground">Register meeting dates and compile insights from departing staff.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="font-semibold text-foreground text-xs">Employee</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Department</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Last Working Day</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Reason for Exit</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Status</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Interview Date</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs">Notes Summary</TableHead>
                    <TableHead className="font-semibold text-foreground text-xs text-center">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCases ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        <RefreshCcw className="size-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : cases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No exit cases found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cases.map((c) => (
                      <TableRow key={c.id} className="hover:bg-muted/10 cursor-pointer" onClick={() => {
                        setActiveCaseId(c.id)
                        setActiveTopTab('exit-interview')
                      }}>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px]">
                              {c.employee.initials}
                            </div>
                            <span className="text-xs font-semibold text-foreground">{c.employee.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs py-3">{c.department}</TableCell>
                        <TableCell className="text-xs py-3">{c.lastWorkingDay}</TableCell>
                        <TableCell className="text-xs py-3">{c.exitReason}</TableCell>
                        <TableCell className="py-3">
                          <StatusBadge variant={c.exit_interview_done ? 'success' : 'pending'} size="sm">
                            {c.exit_interview_done ? 'Completed' : 'Pending'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs py-3">{c.exit_interview_date || 'Not Scheduled'}</TableCell>
                        <TableCell className="text-xs py-3 max-w-[200px] truncate">{c.exit_interview_notes || 'No notes added yet'}</TableCell>
                        <TableCell className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <Button size="xs" variant="outline" onClick={() => {
                            setActiveCaseId(c.id)
                            setActiveTopTab('exit-interview')
                          }}>
                            Schedule/Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {activeMainTab === 'Reports' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-4 border-border/60">
              <CardHeader className="p-0 pb-3 border-b flex flex-row items-center gap-2">
                <DoorOpen className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-foreground">Exit Type Analysis</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 px-0 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-medium text-foreground">
                    <span>Voluntary (Resignations)</span>
                    <span className="font-bold">{overview?.totals.resignations ?? 0} ({overview?.totals.total_exits ? Math.round(((overview?.totals.resignations ?? 0) / overview.totals.total_exits) * 100) : 0}%)</span>
                  </div>
                  <Progress value={overview?.totals.total_exits ? ((overview?.totals.resignations ?? 0) / overview.totals.total_exits) * 100 : 0} className="h-2" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-medium text-foreground">
                    <span>Involuntary (Terminations/Retirements)</span>
                    <span className="font-bold">{(overview?.totals.total_exits ?? 0) - (overview?.totals.resignations ?? 0)} ({overview?.totals.total_exits ? Math.round((((overview?.totals.total_exits ?? 0) - (overview?.totals.resignations ?? 0)) / overview.totals.total_exits) * 100) : 0}%)</span>
                  </div>
                  <Progress value={overview?.totals.total_exits ? (((overview?.totals.total_exits ?? 0) - (overview?.totals.resignations ?? 0)) / overview.totals.total_exits) * 100 : 0} className="h-2 bg-destructive/10" />
                </div>
              </CardContent>
            </Card>

            <Card className="p-4 border-border/60">
              <CardHeader className="p-0 pb-3 border-b flex flex-row items-center gap-2">
                <UserX className="size-4 text-warning" />
                <CardTitle className="text-sm font-semibold text-foreground">Key Attrition Drivers</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 px-0 flex flex-col gap-3">
                {[
                  { reason: 'Better Opportunity', count: cases.filter(c => c.exitReason === 'Better Opportunity').length },
                  { reason: 'Personal Reasons', count: cases.filter(c => c.exitReason === 'Personal Reasons').length },
                  { reason: 'Career Change', count: cases.filter(c => c.exitReason === 'Career Change').length },
                  { reason: 'Relocation', count: cases.filter(c => c.exitReason === 'Relocation').length }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs border-b border-border/40 pb-2">
                    <span className="text-muted-foreground font-medium">{item.reason}</span>
                    <span className="font-bold text-foreground">{item.count} cases</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="p-4 border-border/60">
              <CardHeader className="p-0 pb-3 border-b flex flex-row items-center gap-2">
                <Building className="size-4 text-success" />
                <CardTitle className="text-sm font-semibold text-foreground">Departmental Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 px-0 flex flex-col gap-3">
                {filtersOptions?.departments.slice(0, 4).map((d, idx) => {
                  const count = cases.filter(c => c.department === d.label).length
                  return (
                    <div key={idx} className="flex justify-between items-center text-xs border-b border-border/40 pb-2">
                      <span className="text-muted-foreground font-medium">{d.label}</span>
                      <span className="font-bold text-foreground">{count} exits</span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* DETAIL DRAWER */}
      <Sheet open={!!activeCaseId} onOpenChange={(open) => !open && setActiveCaseId(null)}>
        <SheetContent side="right" className="w-[95vw] sm:max-w-4xl p-0 flex flex-col gap-0 border-l border-border/80">
          {loadingDetails ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-background">
              <RefreshCcw className="size-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium">Loading case file details...</p>
            </div>
          ) : activeCaseDetails ? (
            <div className="flex flex-col h-full bg-background">
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b flex items-center justify-between bg-card relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-4 right-4 h-6 w-6 text-muted-foreground" 
                  onClick={() => setActiveCaseId(null)}
                >
                  <X className="size-4" />
                </Button>
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary border-2 shadow-sm border-background font-bold text-lg">
                    {activeCaseDetails.employee.initials}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{activeCaseDetails.employee.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-medium text-muted-foreground">{activeCaseDetails.employee.title}</p>
                      <span className="text-muted-foreground text-xs">•</span>
                      <p className="text-sm text-muted-foreground">{activeCaseDetails.employee.id}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mr-8">
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground mb-1">Status</span>
                    <StatusBadge variant={getStatusVariant(activeCaseDetails.status)} className="px-2.5 py-0.5 text-xs font-semibold h-6">
                      {activeCaseDetails.status}
                    </StatusBadge>
                  </div>
                </div>
              </div>

              {/* Drawer Tabs */}
              <div className="border-b overflow-x-auto scrollbar-hide px-6 bg-muted/20 flex justify-between items-center">
                <div className="flex space-x-1 py-2">
                  {['overview', 'clearance', 'documents', 'exit-interview', 'activity', 'comments'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTopTab(tab)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 whitespace-nowrap cursor-pointer capitalize",
                        activeTopTab === tab
                          ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {tab.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drawer Tab Content */}
              <div className="flex-1 flex overflow-hidden bg-background">
                {activeTopTab === 'overview' && (
                  <div className="flex-1 flex w-full">
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-6">
                      {/* Stepper Progress */}
                      <div className="pb-6 border-b border-border">
                        <div className="flex items-start justify-between relative max-w-2xl mx-auto mt-2">
                          <div className="absolute top-3.5 left-4 right-4 h-[2px] bg-border z-0">
                            <div 
                              className="h-full bg-primary transition-all duration-300" 
                              style={{
                                width: 
                                  activeCaseDetails.status === 'Resignation Submitted' ? '0%' :
                                  activeCaseDetails.status === 'Notice Period' ? '20%' :
                                  activeCaseDetails.status === 'Clearance' ? '40%' :
                                  activeCaseDetails.status === 'Exit Interview' ? '60%' :
                                  activeCaseDetails.status === 'Awaiting F&F' ? '80%' :
                                  activeCaseDetails.status === 'Closed' ? '100%' : '0%'
                              }}
                            />
                          </div>
                          
                          {[
                            { step: 1, label: 'Resignation', icon: Check, status: 'completed' },
                            { step: 2, label: 'Notice Period', icon: Calendar, status: activeCaseDetails.status === 'Notice Period' ? 'current' : ['Clearance', 'Exit Interview', 'Awaiting F&F', 'Closed'].includes(activeCaseDetails.status) ? 'completed' : 'upcoming' },
                            { step: 3, label: 'Clearance', icon: Shield, status: activeCaseDetails.status === 'Clearance' ? 'current' : ['Exit Interview', 'Awaiting F&F', 'Closed'].includes(activeCaseDetails.status) ? 'completed' : 'upcoming' },
                            { step: 4, label: 'Exit Interview', icon: Users, status: activeCaseDetails.status === 'Exit Interview' ? 'current' : ['Awaiting F&F', 'Closed'].includes(activeCaseDetails.status) ? 'completed' : 'upcoming' },
                            { step: 5, label: 'F&F', icon: FileText, status: activeCaseDetails.status === 'Awaiting F&F' ? 'current' : activeCaseDetails.status === 'Closed' ? 'completed' : 'upcoming' },
                            { step: 6, label: 'Closed', icon: CheckCircle2, status: activeCaseDetails.status === 'Closed' ? 'current' : 'upcoming' }
                          ].map((s) => (
                            <div key={s.step} className="flex flex-col items-center gap-2 z-10 w-16">
                              <div className={cn(
                                "relative z-10 size-7 rounded-full flex items-center justify-center border-2 transition-colors",
                                s.status === 'completed' ? 'border-primary text-primary bg-background' :
                                s.status === 'current' ? 'border-primary text-primary-foreground bg-primary' :
                                'border-border text-muted-foreground bg-background'
                              )}>
                                <s.icon className={cn("size-3.5", s.status === 'current' ? 'text-primary-foreground' : '')} />
                              </div>
                              <span className={cn(
                                "text-[9px] font-semibold text-center leading-tight whitespace-pre-line",
                                s.status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'
                              )}>
                                {s.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column: Exit Details & Owner & Approvals */}
                        <div className="flex flex-col gap-6">
                          {/* Exit Details */}
                          <div className="flex flex-col gap-3">
                            <h4 className="text-sm font-bold text-foreground">Exit Details</h4>
                            <div className="grid grid-cols-[140px_1fr] gap-y-3.5 text-xs bg-card p-4 rounded-lg border border-border shadow-sm">
                              <span className="text-muted-foreground">Exit Reason</span>
                              <span className="font-semibold text-foreground text-right md:text-left">{activeCaseDetails.exitReason}</span>

                              <span className="text-muted-foreground">Resignation Date</span>
                              <span className="font-semibold text-foreground text-right md:text-left">{activeCaseDetails.noticeDate || 'N/A'}</span>

                              <span className="text-muted-foreground">Last Working Day</span>
                              <span className="font-semibold text-foreground text-right md:text-left">{activeCaseDetails.lastWorkingDay}</span>

                              <span className="text-muted-foreground">Notice Period</span>
                              <span className="font-semibold text-foreground text-right md:text-left">30 Days</span>

                              <span className="text-muted-foreground">Handover To</span>
                              <span className="font-semibold text-foreground text-right md:text-left">{activeCaseDetails.employee.manager || 'Riya Kapoor'}</span>

                              <span className="text-muted-foreground">Exit Type</span>
                              <span className="font-semibold text-foreground capitalize text-right md:text-left">{activeCaseDetails.exitType}</span>
                            </div>
                          </div>

                          {/* Owner & Approvals */}
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold text-foreground">Owner & Approvals</h4>
                              <button className="text-muted-foreground hover:text-foreground">
                                <Edit3 className="size-4" />
                              </button>
                            </div>
                            <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
                              <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Case Owner</span>
                                <div className="flex items-center gap-3">
                                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0 border">
                                    PR
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-foreground">Priya Sharma</span>
                                    <span className="text-[10px] text-muted-foreground">HR Business Partner</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Final Approval</span>
                                <div className="flex items-center gap-3">
                                  <div className="size-8 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground text-xs shrink-0 border">
                                    <User className="size-4 text-muted-foreground" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-foreground">Rahul Das</span>
                                    <span className="text-[10px] text-muted-foreground">HR Manager</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Next Actions & Progress Tracking */}
                        <div className="flex flex-col gap-6">
                          {/* Next Actions */}
                          <div className="flex flex-col gap-3">
                            <h4 className="text-sm font-bold text-foreground">Next Actions</h4>
                            <div className="flex flex-col gap-3 bg-card p-4 rounded-lg border border-border shadow-sm">
                              {/* Complete knowledge transfer */}
                              <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-muted/5">
                                <div className="mt-0.5 shrink-0">
                                  <div className="size-4 rounded-full border-2 border-primary flex items-center justify-center">
                                    <div className="size-1.5 bg-primary rounded-full" />
                                  </div>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-foreground">Complete knowledge transfer</span>
                                  <span className="text-[10px] text-muted-foreground">Assigned to: {activeCaseDetails.employee.manager || 'Riya Kapoor'}</span>
                                </div>
                              </div>

                              {/* Submit pending documents */}
                              <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60">
                                <div className="mt-0.5 shrink-0">
                                  <div className="size-4 rounded-full border-2 border-muted-foreground/40" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-foreground">Submit pending documents</span>
                                  <span className="text-[10px] text-muted-foreground">Due: 15 May 2025</span>
                                </div>
                              </div>

                              <button className="text-xs font-semibold text-primary hover:underline text-left mt-1">
                                View All Actions (4)
                              </button>
                            </div>
                          </div>

                          {/* Progress Tracking */}
                          <div className="flex flex-col gap-3">
                            <h4 className="text-sm font-bold text-foreground">Progress Tracking</h4>
                            <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-semibold text-foreground">Handover Progress</span>
                                  <span className="font-bold text-foreground">60%</span>
                                </div>
                                <Progress value={60} className="h-2" />
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="font-semibold text-foreground">Clearance Progress</span>
                                  <span className="font-bold text-foreground">30%</span>
                                </div>
                                <Progress value={30} className="h-2" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions Panel */}
                    <div className="w-[260px] bg-muted/5 border-l border-border p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
                      <h3 className="text-sm font-bold text-foreground">Actions</h3>
                      
                      <div className="flex flex-col gap-2.5">
                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-[11px] h-10 gap-3 font-medium bg-card border-border hover:bg-muted/10 shadow-sm"
                          onClick={() => showBanner('success', 'Opening resignation letter...')}
                        >
                          <FileText className="size-4 text-muted-foreground" /> View Resignation
                        </Button>

                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-[11px] h-10 gap-3 font-medium bg-card border-border hover:bg-muted/10 shadow-sm"
                          onClick={() => setExtendOpen(true)}
                        >
                          <Clock className="size-4 text-muted-foreground" /> Extend Notice
                        </Button>

                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-[11px] h-10 gap-3 font-medium bg-card border-border hover:bg-muted/10 shadow-sm"
                          onClick={() => setAssignOpen(true)}
                        >
                          <Users className="size-4 text-muted-foreground" /> Assign Handover
                        </Button>

                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-[11px] h-10 gap-3 font-medium bg-card border-border hover:bg-muted/10 shadow-sm"
                          onClick={() => setActiveTopTab('clearance')}
                        >
                          <Shield className="size-4 text-muted-foreground" /> Update Clearance
                        </Button>

                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-[11px] h-10 gap-3 font-medium bg-card border-border hover:bg-muted/10 shadow-sm"
                          onClick={() => setActiveTopTab('exit-interview')}
                        >
                          <Calendar className="size-4 text-muted-foreground" /> Schedule Exit Interview
                        </Button>

                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-[11px] h-10 gap-3 font-medium bg-card border-border hover:bg-muted/10 shadow-sm"
                          onClick={() => setActiveTopTab('clearance')}
                        >
                          <CheckSquare className="size-4 text-muted-foreground" /> View Clearance Status
                        </Button>

                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-[11px] h-10 gap-3 font-medium bg-card border-border hover:bg-muted/10 shadow-sm"
                          onClick={() => handleStatusTransition('Awaiting F&F')}
                        >
                          <Receipt className="size-4 text-muted-foreground" /> Generate F&F
                        </Button>

                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-[11px] h-10 gap-3 font-medium bg-card border-border hover:bg-muted/10 shadow-sm"
                          onClick={() => handleStatusTransition('Closed')}
                        >
                          <CheckCircle2 className="size-4 text-muted-foreground" /> Close Exit Case
                        </Button>
                      </div>
                      
                      <div className="mt-auto pt-4">
                        <Button 
                          variant="outline" 
                          className="w-full justify-start text-[11px] h-10 gap-3 font-semibold text-destructive hover:bg-destructive/5 border-destructive/30 hover:border-destructive bg-card"
                          onClick={() => setWithdrawOpen(true)}
                        >
                          <Trash2 className="size-4 text-destructive" /> Withdraw Resignation
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTopTab === 'clearance' && (
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="text-sm font-bold text-foreground">Clearance Checklist</h4>
                      <StatusBadge variant="primary" size="sm">
                        {activeCaseDetails.clearance_tasks?.filter(t => t.status === 'Cleared').length || 0} / {activeCaseDetails.clearance_tasks?.length || 0} Cleared
                      </StatusBadge>
                    </div>

                    <div className="flex flex-col gap-3">
                      {activeCaseDetails.clearance_tasks?.map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/5">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-foreground">{task.item}</span>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">{task.department} Department</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {(['Pending', 'Cleared', 'N/A'] as const).map((st) => (
                              <button
                                key={st}
                                onClick={() => handleClearanceToggle(task.id, st)}
                                className={cn(
                                  "px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer",
                                  task.status === st
                                    ? st === 'Cleared' ? 'bg-success/20 text-success-foreground border-success/40'
                                      : st === 'Pending' ? 'bg-warning/20 text-warning-foreground border-warning/40'
                                      : 'bg-muted text-muted-foreground border-border'
                                    : 'bg-background hover:bg-muted/40 text-muted-foreground border-border'
                                )}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTopTab === 'documents' && (
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="text-sm font-bold text-foreground">Exiting Documentation Checklist</h4>
                    </div>

                    <div className="flex flex-col gap-3">
                      {activeCaseDetails.documents?.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/5">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground">{doc.title}</span>
                              {doc.isMandatory && <span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Required</span>}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {doc.fileName ? `File: ${doc.fileName}` : 'No file uploaded yet'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <StatusBadge 
                              variant={doc.status === 'Verified' ? 'success' : doc.status === 'Submitted' ? 'primary' : doc.status === 'Rejected' ? 'error' : 'default'} 
                              size="sm"
                            >
                              {doc.status}
                            </StatusBadge>
                            
                            <div className="flex items-center gap-1.5">
                              {doc.status !== 'Verified' && (
                                <Button size="xs" variant="outline" onClick={() => setUploadingDocId(doc.id)}>
                                  Upload File
                                </Button>
                              )}
                              {doc.status === 'Submitted' && (
                                <>
                                  <Button size="xs" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => handleDocStatusUpdate(doc.id, 'Verified')}>
                                    Verify
                                  </Button>
                                  <Button size="xs" variant="destructive" onClick={() => handleDocStatusUpdate(doc.id, 'Rejected')}>
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTopTab === 'exit-interview' && (
                  <form onSubmit={handleSaveInterview} className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-4">
                    <h4 className="text-sm font-bold text-foreground border-b pb-2">Exit Interview Details</h4>
                    
                    <div className="flex items-center gap-2 py-2">
                      <Checkbox 
                        id="interview-done" 
                        checked={interviewForm.done}
                        onCheckedChange={(checked) => setInterviewForm(prev => ({ ...prev, done: !!checked }))}
                      />
                      <label htmlFor="interview-done" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                        Exit Interview Conducted Successfully
                      </label>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Interview Date</label>
                      <Input 
                        type="date"
                        value={interviewForm.date}
                        onChange={(e) => setInterviewForm(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full h-9"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Feedback & Exit Notes Summary</label>
                      <Textarea 
                        placeholder="Compile key insights, reason for exit, handover checklist confirmation, feedback on culture, salary, management..."
                        value={interviewForm.notes}
                        onChange={(e) => setInterviewForm(prev => ({ ...prev, notes: e.target.value }))}
                        className="min-h-[140px] text-xs"
                      />
                    </div>

                    <Button type="submit" className="mt-2 w-full sm:w-auto">
                      Save Exit Interview File
                    </Button>
                  </form>
                )}

                {activeTopTab === 'activity' && (
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-4">
                    <h4 className="text-sm font-bold text-foreground border-b pb-2">Exit Lifecycle Timeline</h4>
                    <div className="relative border-l border-border pl-6 ml-3 flex flex-col gap-6 py-2">
                      {activeCaseDetails.activity_log?.map((act) => (
                        <div key={act.id} className="relative">
                          <span className="absolute -left-9 top-0.5 flex size-6 items-center justify-center rounded-full bg-primary/10 border border-primary text-primary shrink-0">
                            <Check className="size-3" />
                          </span>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-foreground">{act.action}</span>
                            <p className="text-xs text-muted-foreground">{act.description}</p>
                            <span className="text-[10px] text-muted-foreground/80 mt-1">{act.timestamp} • By {act.actor}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTopTab === 'comments' && (
                  <div className="flex-1 flex flex-col overflow-hidden bg-background">
                    {/* Message Log */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col gap-4">
                      {activeCaseDetails.comments?.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-1.5">
                          <MessageSquare className="size-8 text-muted-foreground/40" />
                          <p className="text-xs">No comments posted yet. Add a comment to start the discussion.</p>
                        </div>
                      ) : (
                        activeCaseDetails.comments?.map((c) => (
                          <div key={c.id} className="flex items-start gap-3 bg-muted/10 p-3 rounded-lg border">
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px] shrink-0 border uppercase">
                              {c.initials}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-foreground">{c.author}</span>
                                <span className="text-[9px] text-muted-foreground">{c.timestamp}</span>
                              </div>
                              <p className="text-xs text-foreground/90 whitespace-pre-wrap">{c.comment}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* Input box */}
                    <form onSubmit={handlePostComment} className="p-4 border-t bg-card flex gap-2">
                      <Input 
                        placeholder="Type a comment or instruction..." 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="submit" size="icon" className="shrink-0">
                        <Send className="size-4" />
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* DIALOGS */}
      {/* 1. Create Case Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register New Exit Case</DialogTitle>
            <DialogDescription>Submit resignation details on behalf of an employee to start the offboarding lifecycle.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCase} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Employee</label>
              {filtersOptions && (
                <Select 
                  value={newCase.employee_id}
                  onChange={(val) => {
                    const emp = filtersOptions.employees.find(e => e.value === val)
                    setNewCase(prev => ({
                      ...prev,
                      employee_id: val,
                      department_id: emp?.department_id || '',
                      manager_id: filtersOptions.employees.find(e => e.department_id === emp?.department_id && e.value !== val)?.value || ''
                    }))
                  }}
                  placeholder="Select employee..."
                  options={filtersOptions.employees.map(e => ({ label: `${e.label} (${e.employee_no || 'No ID'})`, value: e.value }))}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Exit Type</label>
                <Select 
                  value={newCase.exit_type}
                  onChange={(val) => setNewCase(prev => ({ ...prev, exit_type: val as 'voluntary' | 'involuntary' }))}
                  options={[
                    { label: 'Voluntary (Resigned)', value: 'voluntary' },
                    { label: 'Involuntary (Terminated)', value: 'involuntary' }
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Reason</label>
                <Select 
                  value={newCase.exit_reason}
                  onChange={(val) => setNewCase(prev => ({ ...prev, exit_reason: val }))}
                  options={[
                    { label: 'Better Opportunity', value: 'Better Opportunity' },
                    { label: 'Career Change', value: 'Career Change' },
                    { label: 'Personal Reasons', value: 'Personal Reasons' },
                    { label: 'Relocation', value: 'Relocation' },
                    { label: 'Health Issues', value: 'Health Issues' },
                    { label: 'Termination', value: 'Involuntary/Termination' }
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Notice Date</label>
                <Input 
                  type="date"
                  value={newCase.notice_date}
                  onChange={(e) => setNewCase(prev => ({ ...prev, notice_date: e.target.value }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Last Working Day</label>
                <Input 
                  type="date"
                  value={newCase.last_working_day}
                  onChange={(e) => setNewCase(prev => ({ ...prev, last_working_day: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Reporting Manager (Handover)</label>
              {filtersOptions && (
                <Select 
                  value={newCase.manager_id}
                  onChange={(val) => setNewCase(prev => ({ ...prev, manager_id: val }))}
                  placeholder="Select manager..."
                  options={filtersOptions.employees.map(e => ({ label: e.label, value: e.value }))}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Campus / Work Location</label>
              <Input 
                placeholder="e.g. Pune Campus, Delhi HQ"
                value={newCase.location}
                onChange={(e) => setNewCase(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit">Register Exit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Extend Notice Date Dialog */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend Notice Period</DialogTitle>
            <DialogDescription>Modify the last working day of the employee.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">New Last Working Day</label>
              <Input 
                type="date" 
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExtendOpen(false)}>Cancel</Button>
              <Button onClick={handleExtendNotice}>Save Date Extension</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Assign Handover Manager Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign Handover Manager</DialogTitle>
            <DialogDescription>Specify the manager responsible for final signoffs.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Select Handover Lead</label>
              {filtersOptions && (
                <Select 
                  value={assigneeId}
                  onChange={(val) => setAssigneeId(val)}
                  placeholder="Select employee..."
                  options={filtersOptions.employees.map(e => ({ label: e.label, value: e.value }))}
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignHandover}>Reassign Manager</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. Withdraw Resignation Confirmation Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw Resignation Case</DialogTitle>
            <DialogDescription>Are you sure you want to withdraw this resignation? This exit case will be deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleWithdrawCase}>Withdraw & Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Upload File Mock Dialog */}
      <Dialog open={uploadingDocId !== null} onOpenChange={(open) => !open && setUploadingDocId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Exit Document</DialogTitle>
            <DialogDescription>Upload the requested file to the exit folder.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadMockDoc} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">File Name</label>
              <Input 
                placeholder="e.g. clearance_form_signed.pdf"
                value={mockFileName}
                onChange={(e) => setMockFileName(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setUploadingDocId(null)}>Cancel</Button>
              <Button type="submit">Submit Document</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. Dynamic Filters Slide-Out Sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-[90vw] sm:max-w-[340px] p-6 flex flex-col gap-6 border-l bg-background">
          <div className="flex items-center justify-between border-b pb-4">
            <h3 className="font-bold text-foreground text-sm">Refine Exit Cases</h3>
            <Button variant="ghost" size="icon" onClick={() => setFiltersOpen(false)} className="h-6 w-6">
              <X className="size-4" />
            </Button>
          </div>
          
          <div className="flex flex-col gap-5 flex-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Department</label>
              {filtersOptions && (
                <Select 
                  value={departmentFilter}
                  onChange={(val) => setDepartmentFilter(val)}
                  placeholder="All Departments"
                  options={[{ label: 'All Departments', value: '' }, ...filtersOptions.departments]}
                />
              )}
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Exit Reason</label>
              {filtersOptions && (
                <Select 
                  value={reasonFilter}
                  onChange={(val) => setReasonFilter(val)}
                  placeholder="All Reasons"
                  options={[{ label: 'All Reasons', value: '' }, ...filtersOptions.reasons]}
                />
              )}
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Exit Type</label>
              <Select 
                value={exitTypeFilter}
                onChange={(val) => setExitTypeFilter(val)}
                placeholder="All Types"
                options={[
                  { label: 'All Types', value: '' },
                  { label: 'Voluntary', value: 'voluntary' },
                  { label: 'Involuntary', value: 'involuntary' }
                ]}
              />
            </div>
          </div>
          
          <div className="pt-4 border-t flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setDepartmentFilter('')
                setReasonFilter('')
                setExitTypeFilter('')
                setFiltersOpen(false)
              }}
            >
              Reset
            </Button>
            <Button size="sm" onClick={() => setFiltersOpen(false)}>Apply</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
