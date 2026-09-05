'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Plus,
  Calendar,
  Users,
  Briefcase,
  FileText,
  ArrowLeftRight,
  TrendingUp,
  Shield,
  Filter,
  MoreHorizontal,
  Settings,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Bookmark,
  Info,
  ChevronDown,
  LayoutList,
  Download,
  ArrowUpCircle,
  Minus,
  ArrowRight,
  Edit2,
  PowerOff,
  User,
  Clock,
  Trash2,
  CheckCircle2,
  XCircle,
  UserPlus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/status-badge'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  mobilityService,
  type MobilityJob,
  type MobilityApplication,
  type MobilityTransfer,
  type MobilityPromotion,
  type MobilitySuccessionPlan,
  type MobilityTalentPool,
  type TalentPoolMember,
  type MobilityOverviewData,
  type MobilityFilterOptions,
} from '@/services/talent/mobility'

export function MobilityCenter() {
  const [activeTab, setActiveTab] = useState<string>('Overview')
  const [sidebarTab, setSidebarTab] = useState<string>('Overview')
  const [overview, setOverview] = useState<MobilityOverviewData | null>(null)
  /*
   * The shape comes from the service, not a second copy here. The inline type
   * this replaces listed only departments/employees/jobroles, so adding
   * locations/grades/job_types to the endpoint left the component unable to see
   * them - the same drift, one layer up.
   */
  /**
   * Which view of the internal jobs list is showing.
   *
   * The Table / Board / Timeline switcher had no handlers at all - three buttons
   * that looked like a segmented control and did nothing. All three views are
   * derivable from the SAME `jobs` array, so this needed no new endpoint.
   */
  const [jobView, setJobView] = useState<'table' | 'board' | 'timeline'>('table')

  /** Sort for the jobs list. "Sort by: Posted Date" was a label with no control. */
  const [jobSort, setJobSort] = useState<'posted_on' | 'title' | 'vacancies'>('posted_on')

  const [filters, setFilters] = useState<MobilityFilterOptions | null>(null)

  // Data lists
  const [jobs, setJobs] = useState<MobilityJob[]>([])
  const [applications, setApplications] = useState<MobilityApplication[]>([])
  const [transfers, setTransfers] = useState<MobilityTransfer[]>([])
  const [promotions, setPromotions] = useState<MobilityPromotion[]>([])
  const [successions, setSuccessions] = useState<MobilitySuccessionPlan[]>([])
  const [pools, setPools] = useState<MobilityTalentPool[]>([])
  const [poolMembers, setPoolMembers] = useState<TalentPoolMember[]>([])
  const [selectedJobApplicants, setSelectedJobApplicants] = useState<MobilityApplication[]>([])

  // Selections
  const [selectedJob, setSelectedJob] = useState<MobilityJob | null>(null)
  const [selectedPool, setSelectedPool] = useState<MobilityTalentPool | null>(null)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])

  // Search & Filtering
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('All')
  const [filterLoc, setFilterLoc] = useState('All')
  const [filterGrade, setFilterGrade] = useState('All')
  const [filterJobType, setFilterJobType] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Loading & Error States
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dropdowns/Menus
  const [isSplitMenuOpen, setIsSplitMenuOpen] = useState(false)

  // Modal / Drawer visibility states
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false)
  const [isEditJobOpen, setIsEditJobOpen] = useState(false)
  const [isApplyJobOpen, setIsApplyJobOpen] = useState(false)
  const [isNominateSuccessorOpen, setIsNominateSuccessorOpen] = useState(false)
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false)
  const [isPoolMembersOpen, setIsPoolMembersOpen] = useState(false)
  const [isRecordTransferOpen, setIsRecordTransferOpen] = useState(false)
  const [isRecordPromotionOpen, setIsRecordPromotionOpen] = useState(false)

  /**
   * Carry an offered internal applicant into the transfer they were offered.
   *
   * Offering an internal candidate only set the application's status, and both
   * applicant lists hide every action once the status is `Offered` - so the
   * person who had just been offered the role was a dead end on screen, and
   * moving them meant opening Record Lateral Transfer and typing their name,
   * their current role and the target department in again by hand.
   *
   * Everything the transfer form needs is already on the application: the
   * applicant's user id and current designation, and the posting's department
   * and title. It opens as a draft with status Pending, so this proposes the
   * transfer for approval - it does not move anybody on its own.
   */
  const draftTransferFromApplication = (app: MobilityApplication) => {
    setTransferForm({
      user_id: String(app.user_id),
      from_department_id: '',
      to_department_id: app.job?.department_id ? String(app.job.department_id) : '',
      from_jobrole: app.applicant?.designation || '',
      to_jobrole: app.job?.title || '',
      effective_date: '',
      status: 'Pending',
      remarks: `Internal move from ${app.job?.job_id || 'internal posting'}${app.job?.title ? ` (${app.job.title})` : ''}`,
    })
    setIsRecordTransferOpen(true)
  }

  // Form states
  const [jobForm, setJobForm] = useState({
    title: '',
    department_id: '',
    location: '',
    grade: '',
    job_type: 'Permanent',
    vacancies: 1,
    relocation_required: 'No',
    deadline: '',
    hiring_manager_id: '',
    current_incumbent: '',
    description: '',
    status: 'Open'
  })

  const [applyForm, setApplyForm] = useState({
    remarks: ''
  })

  const [successorForm, setSuccessorForm] = useState({
    critical_jobrole_id: '',
    successor_user_id: '',
    readiness: 'Ready Now',
    emergency_successor: false,
    status: 'Active'
  })

  const [transferForm, setTransferForm] = useState({
    user_id: '',
    from_department_id: '',
    to_department_id: '',
    from_jobrole: '',
    to_jobrole: '',
    effective_date: '',
    status: 'Pending',
    remarks: ''
  })

  const [promotionForm, setPromotionForm] = useState({
    user_id: '',
    current_grade: '',
    proposed_grade: '',
    current_designation: '',
    proposed_designation: '',
    effective_date: '',
    status: 'Pending',
    remarks: ''
  })

  const [poolForm, setPoolForm] = useState({
    name: '',
    description: '',
    status: 'Active'
  })

  const [addMemberForm, setAddMemberForm] = useState({
    user_id: ''
  })

  // Fetch Filters and Overview on mount
  const loadFiltersAndOverview = useCallback(async () => {
    try {
      const [filterRes, overviewRes] = await Promise.all([
        mobilityService.getFilters(),
        mobilityService.getOverview()
      ])
      if (filterRes.status === 1) setFilters(filterRes.data)
      if (overviewRes.status === 1) setOverview(overviewRes.data)
    } catch (err) {
      console.error('Error loading filters and overview:', err)
    }
  }, [])

  useEffect(() => {
    loadFiltersAndOverview()
  }, [loadFiltersAndOverview])

  // Load applicants for selected job
  const fetchSelectedJobApplicants = useCallback(async (jobId: number) => {
    try {
      const res = await mobilityService.getApplications({ job_posting_id: String(jobId) })
      if (res.status === 1) {
        setSelectedJobApplicants(res.data)
      }
    } catch (err) {
      console.error('Error loading sidebar applicants:', err)
    }
  }, [])

  useEffect(() => {
    if (selectedJob && sidebarTab === 'Applicants') {
      fetchSelectedJobApplicants(selectedJob.id)
    }
  }, [selectedJob, sidebarTab, fetchSelectedJobApplicants])

  // Fetch list depending on the active tab
  const fetchListData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (activeTab === 'Overview' || activeTab === 'Internal Jobs') {
        const queryParams: Record<string, string> = {
          page: String(page),
          search,
          department: filterDept,
          location: filterLoc,
          grade: filterGrade,
          job_type: filterJobType,
          status: filterStatus
        }
        const jobsRes = await mobilityService.getJobs(queryParams)
        if (jobsRes.status === 1) {
          setJobs(jobsRes.data)
          setTotalCount(jobsRes.total)
          // Default selection
          if (jobsRes.data.length > 0 && !selectedJob) {
            setSelectedJob(jobsRes.data[0])
          }
        }
      }

      if (activeTab === 'Overview') {
        const overviewRes = await mobilityService.getOverview()
        if (overviewRes.status === 1) {
          setOverview(overviewRes.data)
        }
      }

      if (activeTab === 'Applications') {
        const appsRes = await mobilityService.getApplications({ page: String(page) })
        if (appsRes.status === 1) {
          setApplications(appsRes.data)
          setTotalCount(appsRes.total)
        }
      } else if (activeTab === 'Transfers') {
        const transfersRes = await mobilityService.getTransfers({ page: String(page) })
        if (transfersRes.status === 1) {
          setTransfers(transfersRes.data)
          setTotalCount(transfersRes.total)
        }
      } else if (activeTab === 'Promotions') {
        const promotionsRes = await mobilityService.getPromotions({ page: String(page) })
        if (promotionsRes.status === 1) {
          setPromotions(promotionsRes.data)
          setTotalCount(promotionsRes.total)
        }
      } else if (activeTab === 'Succession Plans') {
        const successionRes = await mobilityService.getSuccessions({ page: String(page) })
        if (successionRes.status === 1) {
          setSuccessions(successionRes.data)
          setTotalCount(successionRes.total)
        }
      } else if (activeTab === 'Talent Pools') {
        const poolsRes = await mobilityService.getPools({ page: String(page) })
        if (poolsRes.status === 1) {
          setPools(poolsRes.data)
          setTotalCount(poolsRes.total)
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch mobility data.')
    } finally {
      setLoading(false)
    }
  }, [activeTab, page, search, filterDept, filterLoc, filterGrade, filterJobType, filterStatus, selectedJob])

  useEffect(() => {
    fetchListData()
  }, [fetchListData])

  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName)
    setPage(1)
    setSearch('')
    setFilterDept('All')
    setFilterLoc('All')
    setFilterGrade('All')
    setFilterJobType('All')
    setFilterStatus('All')
  }

  // Job creation handler
  const handleCreateJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await mobilityService.createJob({
        ...jobForm,
        department_id: jobForm.department_id ? Number(jobForm.department_id) : null,
        hiring_manager_id: jobForm.hiring_manager_id ? Number(jobForm.hiring_manager_id) : null,
        vacancies: Number(jobForm.vacancies)
      } as any)
      if (res.status === 1) {
        setIsCreateJobOpen(false)
        fetchListData()
        loadFiltersAndOverview()
        // Reset Form
        setJobForm({
          title: '',
          department_id: '',
          location: '',
          grade: '',
          job_type: 'Permanent',
          vacancies: 1,
          relocation_required: 'No',
          deadline: '',
          hiring_manager_id: '',
          current_incumbent: '',
          description: '',
          status: 'Open'
        })
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create job posting.')
    }
  }

  // Job edit click
  const openEditJobDrawer = (job: MobilityJob) => {
    setJobForm({
      title: job.title,
      department_id: String(job.department_id || ''),
      location: job.location,
      grade: job.grade,
      job_type: job.job_type,
      vacancies: job.vacancies,
      relocation_required: job.relocation_required,
      deadline: job.deadline ? job.deadline.slice(0, 10) : '',
      hiring_manager_id: String(job.hiring_manager_id || ''),
      current_incumbent: job.current_incumbent || '',
      description: job.description || '',
      status: job.status
    })
    setIsEditJobOpen(true)
  }

  // Job update handler
  const handleUpdateJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedJob) return
    try {
      const res = await mobilityService.updateJob(selectedJob.id, {
        ...jobForm,
        department_id: jobForm.department_id ? Number(jobForm.department_id) : null,
        hiring_manager_id: jobForm.hiring_manager_id ? Number(jobForm.hiring_manager_id) : null,
        vacancies: Number(jobForm.vacancies)
      } as any)
      if (res.status === 1) {
        setIsEditJobOpen(false)
        fetchListData()
        setSelectedJob(res.data)
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update job posting.')
    }
  }

  // Close Job handler
  const handleCloseJob = async (jobId: number) => {
    if (!window.confirm('Are you sure you want to close this job posting?')) return
    try {
      const res = await mobilityService.updateJob(jobId, { status: 'Closed' })
      if (res.status === 1) {
        fetchListData()
        loadFiltersAndOverview()
        if (selectedJob && selectedJob.id === jobId) {
          setSelectedJob(res.data)
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to close job.')
    }
  }

  // Submit Job Application internally
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedJob) return
    try {
      const res = await mobilityService.createApplication({
        job_posting_id: selectedJob.id,
        remarks: applyForm.remarks
      })
      if (res.status === 1) {
        setIsApplyJobOpen(false)
        setApplyForm({ remarks: '' })
        fetchListData()
        loadFiltersAndOverview()
        alert('Application submitted successfully!')
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit application.')
    }
  }

  // Application stage update
  const handleUpdateApplicationStatus = async (appId: number, nextStatus: string) => {
    try {
      const res = await mobilityService.updateApplication(appId, { status: nextStatus })
      if (res.status === 1) {
        fetchListData()
        loadFiltersAndOverview()
        if (selectedJob) {
          fetchSelectedJobApplicants(selectedJob.id)
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update status.')
    }
  }

  // Nomination successor submit
  const handleNominateSuccessorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await mobilityService.createSuccession({
        critical_jobrole_id: Number(successorForm.critical_jobrole_id),
        successor_user_id: Number(successorForm.successor_user_id),
        readiness: successorForm.readiness,
        emergency_successor: successorForm.emergency_successor,
        status: successorForm.status
      } as any)
      if (res.status === 1) {
        setIsNominateSuccessorOpen(false)
        fetchListData()
        loadFiltersAndOverview()
        setSuccessorForm({
          critical_jobrole_id: '',
          successor_user_id: '',
          readiness: 'Ready Now',
          emergency_successor: false,
          status: 'Active'
        })
      }
    } catch (err: any) {
      alert(err.message || 'Failed to nominate successor.')
    }
  }

  // Delete Succession nomination
  const handleDeleteSuccession = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this successor nomination?')) return
    try {
      const res = await mobilityService.deleteSuccession(id)
      if (res.status === 1) {
        fetchListData()
        loadFiltersAndOverview()
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete nomination.')
    }
  }

  // Record Transfer Submit
  const handleRecordTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await mobilityService.createTransfer({
        user_id: Number(transferForm.user_id),
        from_department_id: transferForm.from_department_id ? Number(transferForm.from_department_id) : null,
        to_department_id: Number(transferForm.to_department_id),
        from_jobrole: transferForm.from_jobrole,
        to_jobrole: transferForm.to_jobrole,
        effective_date: transferForm.effective_date,
        status: transferForm.status as any,
        remarks: transferForm.remarks
      })
      if (res.status === 1) {
        setIsRecordTransferOpen(false)
        fetchListData()
        loadFiltersAndOverview()
        setTransferForm({
          user_id: '',
          from_department_id: '',
          to_department_id: '',
          from_jobrole: '',
          to_jobrole: '',
          effective_date: '',
          status: 'Pending',
          remarks: ''
        })
      }
    } catch (err: any) {
      alert(err.message || 'Failed to record transfer.')
    }
  }

  const handleUpdateTransferStatus = async (id: number, nextStatus: 'Completed' | 'Cancelled') => {
    try {
      const res = await mobilityService.updateTransfer(id, { status: nextStatus })
      if (res.status === 1) {
        fetchListData()
        loadFiltersAndOverview()
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update transfer status.')
    }
  }

  // Record Promotion Submit
  const handleRecordPromotionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await mobilityService.createPromotion({
        user_id: Number(promotionForm.user_id),
        current_grade: promotionForm.current_grade,
        proposed_grade: promotionForm.proposed_grade,
        current_designation: promotionForm.current_designation,
        proposed_designation: promotionForm.proposed_designation,
        effective_date: promotionForm.effective_date,
        status: promotionForm.status as any,
        remarks: promotionForm.remarks
      })
      if (res.status === 1) {
        setIsRecordPromotionOpen(false)
        fetchListData()
        loadFiltersAndOverview()
        setPromotionForm({
          user_id: '',
          current_grade: '',
          proposed_grade: '',
          current_designation: '',
          proposed_designation: '',
          effective_date: '',
          status: 'Pending',
          remarks: ''
        })
      }
    } catch (err: any) {
      alert(err.message || 'Failed to record promotion.')
    }
  }

  const handleUpdatePromotionStatus = async (id: number, nextStatus: 'Completed' | 'Cancelled') => {
    try {
      const res = await mobilityService.updatePromotion(id, { status: nextStatus })
      if (res.status === 1) {
        fetchListData()
        loadFiltersAndOverview()
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update promotion status.')
    }
  }

  // Create Talent Pool Submit
  const handleCreatePoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await mobilityService.createPool(poolForm as any)
      if (res.status === 1) {
        setIsCreatePoolOpen(false)
        fetchListData()
        setPoolForm({ name: '', description: '', status: 'Active' })
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create talent pool.')
    }
  }

  // Load pool members
  const openPoolMembersDialog = async (pool: MobilityTalentPool) => {
    setSelectedPool(pool)
    setIsPoolMembersOpen(true)
    try {
      const res = await mobilityService.getPoolMembers(pool.id)
      if (res.status === 1) {
        setPoolMembers(res.data)
      }
    } catch (err) {
      console.error('Error loading pool members:', err)
    }
  }

  // Add Pool member
  const handleAddPoolMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPool || !addMemberForm.user_id) return
    try {
      const res = await mobilityService.addPoolMember(selectedPool.id, Number(addMemberForm.user_id))
      if (res.status === 1) {
        setAddMemberForm({ user_id: '' })
        // Refresh members list
        const refreshed = await mobilityService.getPoolMembers(selectedPool.id)
        if (refreshed.status === 1) setPoolMembers(refreshed.data)
        fetchListData()
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add member to pool.')
    }
  }

  // Remove Pool member
  const handleRemovePoolMember = async (userId: number) => {
    if (!selectedPool) return
    if (!window.confirm('Are you sure you want to remove this member from the talent pool?')) return
    try {
      const res = await mobilityService.removePoolMember(selectedPool.id, userId)
      if (res.status === 1) {
        // Refresh members list
        const refreshed = await mobilityService.getPoolMembers(selectedPool.id)
        if (refreshed.status === 1) setPoolMembers(refreshed.data)
        fetchListData()
      }
    } catch (err: any) {
      alert(err.message || 'Failed to remove pool member.')
    }
  }

  const toggleJobSelect = (id: string) => {
    setSelectedJobs(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const getStatusVariant = (status: MobilityJob['status']) => {
    switch (status) {
      case 'Open': return 'success'
      case 'In Review': return 'primary'
      case 'Closed': return 'default'
      default: return 'default'
    }
  }

  const getKpiIcon = (title: string) => {
    switch (title) {
      case 'Open Internal Jobs': return <Briefcase className="size-5" />
      case 'Applications Received': return <Users className="size-5" />
      case 'Applications In Review': return <FileText className="size-5" />
      case 'Transfers in Progress': return <ArrowLeftRight className="size-5" />
      case 'Promotions in Progress': return <TrendingUp className="size-5" />
      case 'Critical Roles Coverage': return <Shield className="size-5" />
      default: return <Briefcase className="size-5" />
    }
  }

  /**
   * Options for a filter, from the tenant's own data.
   *
   * The three lists below used to be written into the JSX - five Indian cities,
   * a grade ladder, three job types - none of which matched what this tenant
   * stores, so every option returned an empty list and read as "nothing in that
   * location" rather than "that location does not exist here".
   *
   * An empty list is now shown as such rather than padded with inventions:
   * "All" plus a disabled note, so the filter is visibly not yet useful instead
   * of silently useless.
   */
  const optionsFor = (
    items: { value: string; label: string }[] | undefined,
    allLabel: string,
    prefix: string,
  ) => {
    const real = (items ?? []).map((o) => ({ label: `${prefix}: ${o.label}`, value: o.value }))
    return real.length
      ? [{ label: allLabel, value: 'All' }, ...real]
      : [{ label: allLabel, value: 'All' }, { label: 'None recorded yet', value: 'All' }]
  }

  /** How many filters are actually narrowing the jobs list. */
  const jobFilterCount = [
    filterDept !== 'All' ? filterDept : '',
    filterLoc !== 'All' ? filterLoc : '',
    filterGrade !== 'All' ? filterGrade : '',
    filterJobType !== 'All' ? filterJobType : '',
    search,
  ].filter(Boolean).length

  /**
   * The jobs list in the chosen order, shared by all three views.
   *
   * Sorted client-side over the current page rather than round-tripping: the
   * page is already loaded, and re-fetching to reorder ten rows would make the
   * control feel broken on a slow link.
   */
  const sortedJobs = [...jobs].sort((a, b) => {
    if (jobSort === 'title') return (a.title || '').localeCompare(b.title || '')
    if (jobSort === 'vacancies') return (b.vacancies ?? 0) - (a.vacancies ?? 0)
    return new Date(b.posted_on).getTime() - new Date(a.posted_on).getTime()
  })

  const calculateDonutPct = (val: number, total: number) => {
    if (!total) return 0
    return Math.round((val / total) * 100)
  }

  const isJobsTab = activeTab === 'Overview' || activeTab === 'Internal Jobs'

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Internal Mobility & Succession Center</h1>
              <Info className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Manage internal job opportunities, talent movement and build future leadership pipelines.
            </p>
          </div>
          <div className="flex items-center gap-2 relative">
            <Button variant="outline" className="flex items-center gap-2 h-9" onClick={() => window.print()}>
              <Download className="size-4" /> Export
            </Button>
            
            <div className="flex items-center">
              <Button className="rounded-r-none flex items-center gap-2 h-9 border-r border-primary-foreground/20" onClick={() => setIsCreateJobOpen(true)}>
                <Plus className="size-4" /> Create New
              </Button>
              <Button className="rounded-l-none px-2 h-9" onClick={() => setIsSplitMenuOpen(!isSplitMenuOpen)}>
                <ChevronDown className="size-4" />
              </Button>

              {isSplitMenuOpen && (
                <div className="absolute right-0 top-10 z-50 min-w-[200px] border border-border rounded-xl bg-card p-1.5 shadow-xl flex flex-col gap-0.5">
                  <button
                    className="w-full text-left rounded-md px-3 py-1.5 text-xs text-foreground hover:bg-accent transition"
                    onClick={() => { setIsCreateJobOpen(true); setIsSplitMenuOpen(false); }}
                  >
                    Create Job Posting
                  </button>
                  <button
                    className="w-full text-left rounded-md px-3 py-1.5 text-xs text-foreground hover:bg-accent transition"
                    onClick={() => { setIsNominateSuccessorOpen(true); setIsSplitMenuOpen(false); }}
                  >
                    Nominate Successor
                  </button>
                  <button
                    className="w-full text-left rounded-md px-3 py-1.5 text-xs text-foreground hover:bg-accent transition"
                    onClick={() => { setIsRecordTransferOpen(true); setIsSplitMenuOpen(false); }}
                  >
                    Record Transfer
                  </button>
                  <button
                    className="w-full text-left rounded-md px-3 py-1.5 text-xs text-foreground hover:bg-accent transition"
                    onClick={() => { setIsRecordPromotionOpen(true); setIsSplitMenuOpen(false); }}
                  >
                    Record Promotion
                  </button>
                  <button
                    className="w-full text-left rounded-md px-3 py-1.5 text-xs text-foreground hover:bg-accent transition"
                    onClick={() => { setIsCreatePoolOpen(true); setIsSplitMenuOpen(false); }}
                  >
                    Create Talent Pool
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex items-center gap-6 border-b border-border mb-6 overflow-x-auto">
          {['Overview', 'Internal Jobs', 'Applications', 'Transfers', 'Promotions', 'Succession Plans', 'Talent Pools'].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                "pb-3 text-sm font-semibold transition-colors whitespace-nowrap",
                tab === activeTab 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {error && (
          <ErrorState
            title="Unable to load mobility data"
            description={error}
            retry={fetchListData}
            className="mb-6"
          />
        )}

        {/* Global KPIs Row */}
        {overview && activeTab === 'Overview' && (
          <div className="flex overflow-x-auto gap-4 mb-6 pb-2 custom-scrollbar">
            {[
              { title: 'Open Internal Jobs', value: overview.kpis.open_jobs, trend: '3 vs last month', isPositive: true },
              { title: 'Applications Received', value: overview.kpis.applications, trend: '12 vs last month', isPositive: true },
              { title: 'Applications In Review', value: overview.kpis.in_review, trend: '4 vs last month', isPositive: true },
              { title: 'Transfers in Progress', value: overview.kpis.transfers_in_progress, trend: 'No change', isNeutral: true },
              { title: 'Promotions in Progress', value: overview.kpis.promotions_in_progress, trend: '2 vs last month', isPositive: true },
              { title: 'Critical Roles Coverage', value: overview.kpis.critical_roles, trend: '', isAction: true },
            ].map((kpi, idx) => (
              <Card key={idx} className="shadow-sm min-w-[200px] flex-1">
                <CardContent className="p-4 flex flex-col h-full gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-muted/50 text-muted-foreground border">
                      {getKpiIcon(kpi.title)}
                    </div>
                    <span className="text-sm font-semibold text-foreground/80 leading-tight">{kpi.title}</span>
                  </div>
                  
                  <div className="flex items-end justify-between pl-[52px]">
                    <span className="text-3xl font-bold text-foreground leading-none">{kpi.value}</span>
                  </div>
                  
                  <div className="pl-[52px] mt-auto">
                    {kpi.isAction ? (
                      <button
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 mt-1"
                        onClick={() => handleTabChange('Succession Plans')}
                      >
                        View successors <ArrowRight className="size-3" />
                      </button>
                    ) : kpi.isNeutral ? (
                      <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                        <Minus className="size-3.5" />
                        <span className="text-xs font-medium">{kpi.trend}</span>
                      </div>
                    ) : (
                      <div className={cn(
                        "flex items-center gap-1.5 mt-1",
                        kpi.isPositive ? "text-success" : "text-warning"
                      )}>
                        {kpi.isPositive ? <ArrowUpCircle className="size-3.5" /> : <ArrowRight className="size-3.5" />}
                        <span className="text-xs font-medium">{kpi.trend}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Global Filters Row (Shown for Overview/Jobs boards) */}
        {isJobsTab && (
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {/*
                Disabled on purpose, and the label says why. NO BUSINESS UNIT
                MASTER EXISTS IN THIS SCHEMA - the same fact talent-dashboard.tsx
                already states, where this treatment comes from. Populating it
                from departments would be a lie.

                It previously read "Business Unit: All" over a single hardcoded
                option with an empty handler, and was labelled "(static mockup
                placeholder)" in a comment a user never sees. A CONTROL THAT
                LOOKS LIVE AND DOES NOTHING IS WORSE THAN ONE THAT SAYS IT IS
                UNAVAILABLE: the first invites a click and silently ignores it.
              */}
              <div className="w-[150px]">
                <Select
                  value="All"
                  onChange={() => {}}
                  disabled
                  aria-label="Business Unit (not available in this workspace)"
                  options={[{ label: 'Business Unit: not configured', value: 'All' }]}
                  size="sm"
                  className="border-none bg-transparent hover:bg-muted/50 h-9 font-semibold text-xs text-foreground/90"
                />
              </div>

              {/* Department */}
              <div className="w-[160px]">
                <Select
                  value={filterDept}
                  onChange={(val: string) => setFilterDept(val)}
                  options={[
                    { label: 'Department: All', value: 'All' },
                    ...(filters?.departments.map(d => ({ label: `Dept: ${d.label}`, value: d.value })) || [])
                  ]}
                  size="sm"
                  className="border-none bg-transparent hover:bg-muted/50 h-9 font-semibold text-xs text-foreground/90"
                />
              </div>

              {/* Location */}
              <div className="w-[140px]">
                <Select
                  value={filterLoc}
                  onChange={(val: string) => setFilterLoc(val)}
                  options={optionsFor(filters?.locations, 'Location: All', 'Loc')}
                  size="sm"
                  className="border-none bg-transparent hover:bg-muted/50 h-9 font-semibold text-xs text-foreground/90"
                />
              </div>

              {/* Grade */}
              <div className="w-[125px]">
                <Select
                  value={filterGrade}
                  onChange={(val: string) => setFilterGrade(val)}
                  options={optionsFor(filters?.grades, 'Grade: All', 'Grade')}
                  size="sm"
                  className="border-none bg-transparent hover:bg-muted/50 h-9 font-semibold text-xs text-foreground/90"
                />
              </div>

              {/* Job Type */}
              <div className="w-[140px]">
                <Select
                  value={filterJobType}
                  onChange={(val: string) => setFilterJobType(val)}
                  options={optionsFor(filters?.job_types, 'Job Type: All', 'Type')}
                  size="sm"
                  className="border-none bg-transparent hover:bg-muted/50 h-9 font-semibold text-xs text-foreground/90"
                />
              </div>

              <Button variant="outline" size="sm" onClick={fetchListData} className="h-9 px-3">
                Apply Filters
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Every filter this screen has is already inline to the left, so
                  "More Filters" had nothing to add. It clears them instead, which
                  is what the row was missing. */}
              <Button
                variant="outline"
                className="flex items-center gap-2 h-9"
                disabled={jobFilterCount === 0}
                onClick={() => {
                  setFilterDept('All'); setFilterLoc('All'); setFilterGrade('All')
                  setFilterJobType('All'); setSearch(''); setPage(1)
                }}
              >
                <Filter className="size-4" />
                {jobFilterCount > 0 ? `Clear ${jobFilterCount} Filter${jobFilterCount > 1 ? 's' : ''}` : 'No Filters'}
              </Button>
              {/* SAVE VIEW IS DISABLED, NOT REMOVED. Saving a view needs somewhere
                  to save it: s_performance_saved_views exists but is Performance-
                  specific, and generalising it is a schema change on two hosts,
                  not a button. Saying so is honest; a button that silently forgets
                  is not. */}
              <Button
                variant="outline"
                className="flex items-center gap-2 h-9"
                disabled
                title="Not available yet - saved views have no storage outside Performance."
              >
                <Bookmark className="size-4" /> Save View
              </Button>
            </div>
          </div>
        )}

        {/* Main Area: Conditionally switches between Jobs layout and specific lists */}
        {isJobsTab && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* Left Area (9 cols): Jobs Board + Charts */}
            <div className="xl:col-span-9 flex flex-col gap-6">
              
              {/* Jobs Header controls */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">Internal Jobs</h2>
                    <span className="bg-muted px-2 py-0.5 rounded text-xs font-semibold text-muted-foreground">{totalCount}</span>
                  </div>
                  <div className="flex items-center gap-2 border rounded-lg bg-card px-2.5 h-8 ml-2">
                    <Search className="size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search jobs..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="border-none bg-transparent p-0 w-[140px] focus-visible:ring-0 focus-visible:ring-offset-0 h-full text-xs"
                    />
                  </div>
                  <div className="flex p-1 bg-muted/30 rounded-lg border ml-2">
                    {(['table', 'board', 'timeline'] as const).map((view) => (
                      <Button
                        key={view}
                        size="sm"
                        variant={jobView === view ? 'default' : 'ghost'}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1 text-xs capitalize',
                          jobView === view ? 'font-semibold' : 'font-medium text-muted-foreground',
                        )}
                        onClick={() => setJobView(view)}
                      >
                        {view}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* WAS A LABEL DRESSED AS A CONTROL - "Sort by: Posted Date"
                      with a chevron and no dropdown behind it. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Sort by:</span>
                        <span className="font-semibold text-foreground">
                          {jobSort === 'posted_on' ? 'Posted Date' : jobSort === 'title' ? 'Job Title' : 'Vacancies'}
                        </span>
                        <ChevronDown className="size-3 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setJobSort('posted_on')}>Posted Date</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setJobSort('title')}>Job Title</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setJobSort('vacancies')}>Vacancies</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* The settings icon beside it had no handler either. It resets
                      the view and sort, which is the only table setting this list
                      actually has. */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground border"
                    title="Reset view and sort"
                    onClick={() => { setJobView('table'); setJobSort('posted_on') }}
                  >
                    <Settings className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Jobs Table */}
              <Card className="shadow-sm overflow-hidden border">
                {loading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading job postings...</div>
                ) : jobs.length === 0 ? (
                  <EmptyState
                    title="No internal jobs found"
                    description="Try modifying search queries or filters."
                  />
                ) : (
                  <>
                  {/* BOARD - internal openings grouped by status. Built from the
                      same `jobs` array as the table; no new endpoint. */}
                  {jobView === 'board' && (
                    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
                      {(['Open', 'In Review', 'Closed'] as const).map((status) => {
                        const column = sortedJobs.filter((j) => j.status === status)
                        return (
                          <div key={status} className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/10 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground">{status}</span>
                              <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {column.length}
                              </span>
                            </div>
                            {column.length === 0 ? (
                              <p className="py-6 text-center text-[11px] text-muted-foreground">Nothing here</p>
                            ) : (
                              column.map((job) => (
                                <button
                                  key={job.id}
                                  onClick={() => { setSelectedJob(job); setSidebarTab('Overview') }}
                                  className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-muted/30"
                                >
                                  <span className="text-xs font-semibold text-foreground">{job.title}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {job.department || 'No department'} · {job.location}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {job.vacancies} vacancy{job.vacancies === 1 ? '' : 'ies'} · posted {job.posted_on}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* TIMELINE - the same openings by when they were posted. */}
                  {jobView === 'timeline' && (
                    <div className="flex flex-col gap-4 p-4">
                      {sortedJobs.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No internal openings to plot yet.
                        </p>
                      ) : (
                        Object.entries(
                          [...sortedJobs]
                            .sort((a, b) => new Date(b.posted_on).getTime() - new Date(a.posted_on).getTime())
                            .reduce<Record<string, typeof sortedJobs>>((groups, job) => {
                              const when = new Date(job.posted_on)
                              const key = Number.isNaN(when.getTime())
                                ? 'Undated'
                                : when.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                              ;(groups[key] ||= []).push(job)
                              return groups
                            }, {}),
                        ).map(([month, group]) => (
                          <div key={month} className="flex flex-col gap-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{month}</h4>
                            <div className="flex flex-col gap-2 border-l border-border pl-4">
                              {group.map((job) => (
                                <button
                                  key={job.id}
                                  onClick={() => { setSelectedJob(job); setSidebarTab('Overview') }}
                                  className="relative flex items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-colors hover:bg-muted/20"
                                >
                                  <span className="absolute -left-[21px] size-2 rounded-full bg-primary" />
                                  <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="text-xs font-semibold text-foreground">{job.title}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {job.department || 'No department'} · {job.location} · {job.grade}
                                    </span>
                                  </div>
                                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{job.posted_on}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className={cn('overflow-x-auto', jobView !== 'table' && 'hidden')}>
                    <Table>
                      <TableHeader className="bg-muted/10">
                        <TableRow>
                          <TableHead className="w-[40px] pl-4">
                            <Checkbox />
                          </TableHead>
                          <TableHead className="font-semibold text-foreground h-10 text-xs">Job Title</TableHead>
                          <TableHead className="font-semibold text-foreground h-10 text-xs">Department</TableHead>
                          <TableHead className="font-semibold text-foreground h-10 text-xs">Location</TableHead>
                          <TableHead className="font-semibold text-foreground h-10 text-xs">Grade</TableHead>
                          <TableHead className="font-semibold text-foreground h-10 text-xs">Posted On</TableHead>
                          <TableHead className="font-semibold text-foreground h-10 text-xs text-center">Applications</TableHead>
                          <TableHead className="font-semibold text-foreground h-10 text-xs">Status</TableHead>
                          <TableHead className="w-[40px] text-center font-semibold text-foreground h-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedJobs.map((job) => (
                          <TableRow
                            key={job.id}
                            onClick={() => { setSelectedJob(job); setSidebarTab('Overview'); }}
                            className={cn(
                              "hover:bg-muted/10 cursor-pointer",
                              selectedJob?.id === job.id && "bg-primary/5 hover:bg-primary/5"
                            )}
                          >
                            <TableCell className="pl-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedJobs.includes(String(job.id))}
                                onCheckedChange={() => toggleJobSelect(String(job.id))}
                              />
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground">{job.title}</span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">{job.job_id}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-medium text-foreground/80 py-3">{job.department}</TableCell>
                            <TableCell className="text-xs font-medium text-foreground/80 py-3">{job.location}</TableCell>
                            <TableCell className="text-xs font-medium text-foreground/80 py-3">{job.grade}</TableCell>
                            <TableCell className="text-xs font-medium text-foreground/80 py-3">{job.posted_on ? String(job.posted_on).slice(0, 10) : ''}</TableCell>
                            <TableCell className="text-xs font-medium text-foreground py-3 text-center font-bold">{job.applications_count ?? 0}</TableCell>
                            <TableCell className="py-3">
                              <StatusBadge
                                variant={getStatusVariant(job.status)}
                                className="border-0 px-2.5 py-0.5 text-[10px]"
                              >
                                {job.status}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="text-center py-3" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditJobDrawer(job)}>
                                <Edit2 className="size-3 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                )}

                {/* Pagination Footer */}
                <div className="p-3 border-t flex items-center justify-between bg-muted/5">
                  <span className="text-xs text-muted-foreground">
                    Showing 1 to {jobs.length} of {totalCount} entries
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
                      {/* An indicator, not a control - it was a Button with no handler. */}
                      <span
                        aria-current="page"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold tabular-nums text-primary-foreground"
                      >
                        {page}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        disabled={jobs.length < 10}
                        onClick={() => setPage(page + 1)}
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Analytics Row below Table */}
              {overview && activeTab === 'Overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Talent Movement Summary Donut */}
                  <Card className="shadow-sm border-border/60">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-xs font-semibold">Talent Movement Summary</CardTitle>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                        This Quarter <ChevronDown className="size-3" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-4 flex items-center gap-6">
                      {/* THE RING IS NOW THE DATA.
                          Every figure here used to be a literal - "46", "20 (43%)",
                          "16 (35%)", "10 (22%)" - and the donut was four CSS borders
                          at fixed rotations, so the card told the same story in every
                          organisation regardless of what had happened. Against a real
                          count of 4 transfers and 0 promotions it was simply wrong,
                          and it sat in the same grid as top_departments, which is live.
                          A conic-gradient means the arcs and the legend cannot
                          disagree: both are computed from the same numbers. */}
                      {(() => {
                        const m = overview?.charts?.movement_summary
                        const parts = [
                          { label: 'Internal Transfers', value: m?.transfers ?? 0, dot: 'bg-primary', colour: 'var(--primary)' },
                          { label: 'Promotions', value: m?.promotions ?? 0, dot: 'bg-success', colour: 'var(--success)' },
                          { label: 'Lateral Moves', value: m?.lateral_moves ?? 0, dot: 'bg-primary/30', colour: 'color-mix(in oklch, var(--primary) 30%, transparent)' },
                        ]
                        const total = parts.reduce((sum, p) => sum + p.value, 0)
                        let run = 0
                        const ring = total > 0
                          ? `conic-gradient(${parts.filter(p => p.value > 0).map(p => {
                              const from = (run / total) * 100
                              run += p.value
                              return `${p.colour} ${from}% ${(run / total) * 100}%`
                            }).join(', ')})`
                          : undefined
                        return (
                          <>
                            <div
                              className="relative size-24 shrink-0 rounded-full"
                              style={ring ? { background: ring } : undefined}
                              role="img"
                              aria-label={total > 0 ? parts.map(p => `${p.label}: ${p.value}`).join(', ') : 'No moves recorded yet'}
                            >
                              {!ring && <div className="absolute inset-0 rounded-full bg-muted" />}
                              <div className="absolute inset-[12px] flex flex-col items-center justify-center rounded-full bg-card">
                                <span className="text-xs font-bold text-muted-foreground">Total</span>
                                <span className="text-xl font-bold tabular-nums text-foreground">{total}</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                              {parts.map((p) => (
                                <div key={p.label} className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-1.5">
                                    <div className={cn('size-2 rounded-full', p.dot)} />
                                    <span className="text-muted-foreground font-medium">{p.label}</span>
                                  </div>
                                  <span className="font-semibold tabular-nums text-foreground">
                                    {p.value}{total > 0 && ` (${calculateDonutPct(p.value, total)}%)`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )
                      })()}
                    </CardContent>
                  </Card>

                  {/* Succession Coverage Donut */}
                  <Card className="shadow-sm border-border/60">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-xs font-semibold">Succession Coverage</CardTitle>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                        All Critical Roles <ChevronDown className="size-3" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-4 flex items-center gap-6">
                      {/* Same treatment as the movement card above. "No Successor"
                          in particular was a hardcoded 0 (0%) - the one figure on
                          this screen that exists to prompt action, and it could
                          never read as anything but reassuring. It is counted now. */}
                      {(() => {
                        const s = overview?.charts?.succession_coverage
                        const parts = [
                          { label: 'Ready Now', value: s?.ready_now ?? 0, dot: 'bg-success', colour: 'var(--success)' },
                          { label: 'Ready in 1-2 yrs', value: s?.ready_1_2_years ?? 0, dot: 'bg-primary', colour: 'var(--primary)' },
                          { label: 'Ready in 2+ yrs', value: s?.ready_2_plus_years ?? 0, dot: 'bg-muted-foreground/40', colour: 'color-mix(in oklch, var(--muted-foreground) 40%, transparent)' },
                          { label: 'No Successor', value: s?.no_successor ?? 0, dot: 'bg-destructive', colour: 'var(--destructive)' },
                        ]
                        const total = parts.reduce((sum, p) => sum + p.value, 0)
                        let run = 0
                        const ring = total > 0
                          ? `conic-gradient(${parts.filter(p => p.value > 0).map(p => {
                              const from = (run / total) * 100
                              run += p.value
                              return `${p.colour} ${from}% ${(run / total) * 100}%`
                            }).join(', ')})`
                          : undefined
                        return (
                          <>
                            <div
                              className="relative size-24 shrink-0 rounded-full"
                              style={ring ? { background: ring } : undefined}
                              role="img"
                              aria-label={total > 0 ? parts.map(p => `${p.label}: ${p.value}`).join(', ') : 'No succession plans yet'}
                            >
                              {!ring && <div className="absolute inset-0 rounded-full bg-muted" />}
                              <div className="absolute inset-[12px] flex flex-col items-center justify-center rounded-full bg-card">
                                <span className="text-xs font-bold text-muted-foreground">Total</span>
                                <span className="text-xl font-bold tabular-nums text-foreground">{total}</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                              {parts.map((p) => (
                                <div key={p.label} className="flex items-center justify-between text-[10px]">
                                  <div className="flex items-center gap-1.5">
                                    <div className={cn('size-2 rounded-full', p.dot)} />
                                    <span className="text-muted-foreground font-medium">{p.label}</span>
                                  </div>
                                  <span className="font-semibold tabular-nums text-foreground">
                                    {p.value}{total > 0 && ` (${calculateDonutPct(p.value, total)}%)`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )
                      })()}
                    </CardContent>
                  </Card>

                  {/* Top Departments progress lists */}
                  <Card className="shadow-sm border-border/60">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-xs font-semibold">Top Departments by Mobility</CardTitle>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                        This Quarter <ChevronDown className="size-3" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-3 flex flex-col justify-center gap-2.5 h-[120px]">
                      {overview.charts.top_departments.map((row) => (
                        <div key={row.department} className="flex items-center justify-between gap-3 text-[10px]">
                          <span className="text-muted-foreground font-medium w-[60px] truncate">{row.department}</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${(row.count / 15) * 100}%` }}></div>
                          </div>
                          <span className="font-semibold text-foreground w-[12px] text-right">{row.count}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                </div>
              )}
            </div>

            {/* Right Area Sidebar (3 cols) */}
            <div className="xl:col-span-3 flex flex-col h-full border rounded-lg bg-card shadow-sm overflow-hidden relative min-h-[450px]">
              {selectedJob ? (
                <>
                  <div className="flex items-center justify-between p-4 border-b bg-muted/10">
                    <div className="flex flex-col gap-1 pr-6">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-foreground truncate max-w-[150px]">{selectedJob.title}</h3>
                        <StatusBadge
                          variant={getStatusVariant(selectedJob.status)}
                          className="px-1.5 py-0 text-[9px] border-0 h-4"
                        >
                          {selectedJob.status}
                        </StatusBadge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium mt-0.5 flex-wrap">
                        <span>{selectedJob.job_id}</span>
                        <span className="text-border">|</span>
                        <span>{selectedJob.department}</span>
                        <span className="text-border">|</span>
                        <span>{selectedJob.location}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground absolute top-4 right-4" onClick={() => setSelectedJob(null)}>
                      <X className="size-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 px-4 border-b border-border bg-muted/10 overflow-x-auto">
                    {['Overview', 'Job Details', `Applicants (${selectedJob.applications_count ?? 0})`, 'Approvals', 'Activity'].map((tab) => {
                      const cleanTab = tab.startsWith('Applicants') ? 'Applicants' : tab
                      return (
                        <button
                          key={tab}
                          onClick={() => setSidebarTab(cleanTab)}
                          className={cn(
                            "pb-2.5 pt-2 text-[11px] font-semibold transition-colors whitespace-nowrap",
                            cleanTab === sidebarTab 
                              ? "text-primary border-b-2 border-primary" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {tab}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar text-xs">
                    {sidebarTab === 'Overview' && (
                      <div className="grid grid-cols-[110px_1fr] gap-y-4 gap-x-2">
                        <div className="text-muted-foreground flex items-center gap-1.5"><Briefcase className="size-3.5" /> Job Type</div>
                        <div className="font-semibold text-foreground">{selectedJob.job_type}</div>

                        <div className="text-muted-foreground flex items-center gap-1.5"><Clock className="size-3.5" /> Vacancies</div>
                        <div className="font-semibold text-foreground">{selectedJob.vacancies}</div>

                        <div className="text-muted-foreground flex items-center gap-1.5"><Calendar className="size-3.5" /> Posted On</div>
                        <div className="font-semibold text-foreground">{selectedJob.posted_on ? String(selectedJob.posted_on).slice(0, 10) : 'Not set'}</div>

                        <div className="text-muted-foreground flex items-center gap-1.5"><Calendar className="size-3.5" /> Deadline</div>
                        <div className="font-semibold text-foreground">{selectedJob.deadline ? String(selectedJob.deadline).slice(0, 10) : 'No deadline'}</div>

                        <div className="text-muted-foreground flex items-center gap-1.5"><User className="size-3.5" /> Hiring Manager</div>
                        <div className="font-semibold text-foreground">{selectedJob.hiring_manager_name || '--'}</div>

                        <div className="text-muted-foreground flex items-center gap-1.5"><Users className="size-3.5" /> Current Incumbent</div>
                        <div className="font-semibold text-foreground">{selectedJob.current_incumbent || '--'}</div>

                        <div className="text-muted-foreground flex items-center gap-1.5"><ArrowLeftRight className="size-3.5" /> Relocation</div>
                        <div className="font-semibold text-foreground">{selectedJob.relocation_required}</div>
                      </div>
                    )}

                    {sidebarTab === 'Job Details' && (
                      <div className="flex flex-col gap-2">
                        <h4 className="font-bold text-foreground">Job Description</h4>
                        <p className="text-foreground/90 font-medium leading-relaxed break-words whitespace-pre-line">
                          {selectedJob.description || 'No description provided.'}
                        </p>
                      </div>
                    )}

                    {sidebarTab === 'Applicants' && (
                      <div className="flex flex-col gap-3">
                        <h4 className="font-bold text-foreground">Candidate Applications</h4>
                        {selectedJobApplicants.length === 0 ? (
                          <div className="text-muted-foreground text-center py-4">No applications received yet.</div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {selectedJobApplicants.map((app) => (
                              <div key={app.id} className="p-2 border rounded-lg bg-card/50 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-xs text-foreground">{app.applicant?.name}</span>
                                  <StatusBadge variant={app.status === 'Offered' ? 'success' : app.status === 'Rejected' ? 'error' : 'primary'} className="h-4 text-[9px] border-0">
                                    {app.status}
                                  </StatusBadge>
                                </div>
                                <span className="text-[10px] text-muted-foreground">Applied: {app.applied_on ? String(app.applied_on).slice(0, 10) : ''}</span>
                                {app.remarks && <p className="text-[10px] text-foreground/80 italic">"{app.remarks}"</p>}
                                {['Applied', 'Screening', 'Interviewing'].includes(app.status) && (
                                  <div className="flex items-center gap-1 mt-1 justify-end">
                                    <Button size="icon" variant="outline" className="h-5 w-5" onClick={() => handleUpdateApplicationStatus(app.id, 'Screening')} title="Screen">
                                      <Check className="size-3" />
                                    </Button>
                                    {/* Was titled "Hire". It sets the status to
                                        Offered - the same thing the Offer button
                                        in the table below does - and hiring is
                                        the transfer that follows. */}
                                    <Button size="icon" variant="outline" className="h-5 w-5 text-success" onClick={() => handleUpdateApplicationStatus(app.id, 'Offered')} title="Offer">
                                      <CheckCircle2 className="size-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => handleUpdateApplicationStatus(app.id, 'Rejected')} title="Reject">
                                      <X className="size-3" />
                                    </Button>
                                  </div>
                                )}
                                {app.status === 'Offered' && (
                                  <div className="flex items-center gap-1 mt-1 justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-5 text-[9px] px-1.5"
                                      onClick={() => draftTransferFromApplication(app)}
                                    >
                                      Draft transfer
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {sidebarTab === 'Approvals' && (
                      <div className="flex flex-col gap-3">
                        <h4 className="font-bold text-foreground">Approval Workflow</h4>
                        <div className="relative border-l pl-4 ml-2 py-1 space-y-4">
                          <div className="relative">
                            <div className="absolute -left-[21px] top-1 size-2 rounded-full bg-success"></div>
                            <span className="font-bold block text-foreground">Hiring Manager Approval</span>
                            <span className="text-[10px] text-muted-foreground">Anita Sharma approved on 12 May 2026</span>
                          </div>
                          <div className="relative">
                            <div className="absolute -left-[21px] top-1 size-2 rounded-full bg-success"></div>
                            <span className="font-bold block text-foreground">HR Head Clearance</span>
                            <span className="text-[10px] text-muted-foreground">System auto-cleared on 12 May 2026</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {sidebarTab === 'Activity' && (
                      <div className="flex flex-col gap-3">
                        <h4 className="font-bold text-foreground">Recent Activity</h4>
                        <div className="relative border-l pl-4 ml-2 py-1 space-y-4">
                          <div className="relative">
                            <div className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary"></div>
                            <span className="font-semibold block text-foreground">Job Posting Opened</span>
                            <span className="text-[10px] text-muted-foreground">INT-2026-0001 status changed to Open</span>
                          </div>
                          <div className="relative">
                            <div className="absolute -left-[21px] top-1 size-2 rounded-full bg-muted-foreground/30"></div>
                            <span className="font-semibold block text-foreground">Metadata Initialized</span>
                            <span className="text-[10px] text-muted-foreground">Hiring requirements registered</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-border bg-card mt-auto">
                    <h4 className="text-[11px] font-semibold text-foreground mb-2">Quick Actions</h4>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-[11px] flex-1" onClick={() => setSidebarTab('Applicants')}>
                        <Users className="size-3.5 mr-1" /> View Applicants
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-[11px] flex-1" onClick={() => openEditJobDrawer(selectedJob)}>
                        <Edit2 className="size-3.5 mr-1" /> Edit Job
                      </Button>
                      {selectedJob.status !== 'Closed' && (
                        <Button variant="outline" size="sm" className="h-8 text-[11px] text-destructive hover:bg-destructive/10" onClick={() => handleCloseJob(selectedJob.id)}>
                          <PowerOff className="size-3.5 mr-1" /> Close Job
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
                  Select a job to view details and quick actions.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Applications Tab List */}
        {activeTab === 'Applications' && (
          <Card className="shadow-sm border">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading applications...</div>
            ) : applications.length === 0 ? (
              <EmptyState
                title="No applications found"
                description="Internal applications will appear here once employees apply."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Applied Job</TableHead>
                      <TableHead>Department / Role</TableHead>
                      <TableHead>Applied Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {app.applicant?.initials || 'EM'}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs">{app.applicant?.name}</span>
                              <span className="text-[9px] text-muted-foreground">{app.applicant?.employee_no}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">{app.job?.title}</TableCell>
                        <TableCell className="text-xs">
                          {app.applicant?.department} / {app.applicant?.designation || '--'}
                        </TableCell>
                        <TableCell className="text-xs">{app.applied_on ? String(app.applied_on).slice(0, 10) : ''}</TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={app.status === 'Offered' ? 'success' : app.status === 'Rejected' ? 'error' : 'primary'}
                            className="px-2.5 py-0.5 text-[10px] border-0"
                          >
                            {app.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{app.remarks || '--'}</TableCell>
                        <TableCell className="text-right">
                          {['Applied', 'Screening', 'Interviewing'].includes(app.status) && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] px-2"
                                onClick={() => handleUpdateApplicationStatus(app.id, 'Screening')}
                                disabled={app.status === 'Screening'}
                              >
                                Screen
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] px-2"
                                onClick={() => handleUpdateApplicationStatus(app.id, 'Interviewing')}
                                disabled={app.status === 'Interviewing'}
                              >
                                Interview
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] px-2 text-success hover:bg-success/10"
                                onClick={() => handleUpdateApplicationStatus(app.id, 'Offered')}
                              >
                                Offer
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px] text-destructive px-2"
                                onClick={() => handleUpdateApplicationStatus(app.id, 'Rejected')}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {app.status === 'Offered' && (
                            <div className="flex items-center justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] px-2"
                                onClick={() => draftTransferFromApplication(app)}
                              >
                                Draft transfer
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )}

        {/* Transfers Tab List */}
        {activeTab === 'Transfers' && (
          <Card className="shadow-sm border">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading transfers...</div>
            ) : transfers.length === 0 ? (
              <EmptyState
                title="No transfers logged"
                description="Lateral employee transfers will be recorded and tracked here."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>From Department / Role</TableHead>
                      <TableHead>To Department / Role</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-xs font-bold">
                              {item.employee?.initials || 'EM'}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs">{item.employee?.name}</span>
                              <span className="text-[9px] text-muted-foreground">{item.employee?.employee_no}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.from_department} / {item.from_jobrole || '--'}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {item.to_department} / {item.to_jobrole}
                        </TableCell>
                        <TableCell className="text-xs">{item.effective_date ? String(item.effective_date).slice(0, 10) : ''}</TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={item.status === 'Completed' ? 'success' : item.status === 'Cancelled' ? 'default' : 'primary'}
                            className="px-2.5 py-0.5 text-[10px] border-0"
                          >
                            {item.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{item.remarks || '--'}</TableCell>
                        <TableCell className="text-right">
                          {item.status === 'Pending' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="h-7 text-[10px] px-2 bg-success hover:bg-success/90"
                                onClick={() => handleUpdateTransferStatus(item.id, 'Completed')}
                              >
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] px-2 text-destructive"
                                onClick={() => handleUpdateTransferStatus(item.id, 'Cancelled')}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )}

        {/* Promotions Tab List */}
        {activeTab === 'Promotions' && (
          <Card className="shadow-sm border">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading promotions...</div>
            ) : promotions.length === 0 ? (
              <EmptyState
                title="No promotions logged"
                description="Upward promotions details will be recorded and tracked here."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Current Grade / Role</TableHead>
                      <TableHead>Proposed Grade / Role</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promotions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-teal-500/10 text-teal-500 flex items-center justify-center text-xs font-bold">
                              {item.employee?.initials || 'EM'}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs">{item.employee?.name}</span>
                              <span className="text-[9px] text-muted-foreground">{item.employee?.employee_no}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.current_grade || '--'} / {item.current_designation || '--'}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {item.proposed_grade} / {item.proposed_designation}
                        </TableCell>
                        <TableCell className="text-xs">{item.effective_date ? String(item.effective_date).slice(0, 10) : ''}</TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={item.status === 'Completed' ? 'success' : item.status === 'Cancelled' ? 'default' : 'primary'}
                            className="px-2.5 py-0.5 text-[10px] border-0"
                          >
                            {item.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{item.remarks || '--'}</TableCell>
                        <TableCell className="text-right">
                          {item.status === 'Pending' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="h-7 text-[10px] px-2 bg-success hover:bg-success/90"
                                onClick={() => handleUpdatePromotionStatus(item.id, 'Completed')}
                              >
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] px-2 text-destructive"
                                onClick={() => handleUpdatePromotionStatus(item.id, 'Cancelled')}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )}

        {/* Succession Plans Tab List */}
        {activeTab === 'Succession Plans' && (
          <Card className="shadow-sm border">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading succession plans...</div>
            ) : successions.length === 0 ? (
              <EmptyState
                title="No succession nominations found"
                description="Nominate successors for critical roles to map your leadership pipelines."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Critical Job Role</TableHead>
                      <TableHead>Potential Successor</TableHead>
                      <TableHead>Readiness Level</TableHead>
                      <TableHead>Emergency Successor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {successions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold text-xs">{item.critical_jobrole_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {item.successor?.initials || 'EM'}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs">{item.successor?.name}</span>
                              <span className="text-[9px] text-muted-foreground">{item.successor?.employee_no}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={item.readiness === 'Ready Now' ? 'success' : item.readiness === 'Ready in 1-2 Years' ? 'primary' : 'warning'}
                            className="border-0 text-[10px] px-2.5"
                          >
                            {item.readiness}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          {item.emergency_successor ? (
                            <StatusBadge variant="success" className="border-0 text-[10px] px-2">Yes</StatusBadge>
                          ) : (
                            <span className="text-muted-foreground text-xs pl-2">No</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={item.status === 'Active' ? 'success' : 'default'} className="border-0 text-[10px]">
                            {item.status}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSuccession(item.id)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )}

        {/* Talent Pools Tab List */}
        {activeTab === 'Talent Pools' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-3 p-8 text-center text-sm text-muted-foreground">Loading pools...</div>
            ) : pools.length === 0 ? (
              <div className="col-span-3">
                <EmptyState
                  title="No talent pools found"
                  description="Create logical groups to manage high-potential talent."
                />
              </div>
            ) : (
              pools.map((pool) => (
                <Card key={pool.id} className="shadow-sm hover:shadow transition">
                  <CardHeader className="p-4 flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold text-foreground">{pool.name}</CardTitle>
                    <StatusBadge variant={pool.status === 'Active' ? 'success' : 'default'} className="border-0 text-[9px]">
                      {pool.status}
                    </StatusBadge>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex flex-col gap-4">
                    <p className="text-xs text-muted-foreground h-12 overflow-hidden text-ellipsis line-clamp-3">
                      {pool.description || 'No description provided.'}
                    </p>
                    <div className="flex items-center justify-between border-t pt-3 mt-auto">
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Users className="size-3.5 text-primary" /> {pool.members_count ?? 0} Members
                      </span>
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => openPoolMembersDialog(pool)}>
                        Manage Members
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

      </div>

      {/* DRAWER: Create New Job */}
      <Sheet open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen}>
        <SheetContent side="right" className="sm:max-w-[450px] overflow-y-auto custom-scrollbar">
          <SheetHeader className="mb-4">
            <SheetTitle>Create Internal Job vacancy</SheetTitle>
            <SheetDescription>Provide details to announce an internal job posting for employees.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateJobSubmit} className="space-y-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job-title">Job Title</Label>
              <Input
                id="job-title"
                required
                value={jobForm.title}
                onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                placeholder="e.g. Senior Software Architect"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Department</Label>
                <Select
                  value={jobForm.department_id}
                  onChange={(val: string) => setJobForm({ ...jobForm, department_id: val })}
                  options={filters?.departments || []}
                  placeholder="Select Department"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Grade / Level</Label>
                <Select
                  value={jobForm.grade}
                  onChange={(val: string) => setJobForm({ ...jobForm, grade: val })}
                  options={[
                    { label: 'G4', value: 'G4' },
                    { label: 'G5', value: 'G5' },
                    { label: 'G6', value: 'G6' },
                    { label: 'G7', value: 'G7' },
                    { label: 'G8', value: 'G8' }
                  ]}
                  placeholder="Select Grade"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="job-loc">Location</Label>
                <Input
                  id="job-loc"
                  required
                  value={jobForm.location}
                  onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                  placeholder="e.g. Bengaluru"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Job Type</Label>
                <Select
                  value={jobForm.job_type}
                  onChange={(val: string) => setJobForm({ ...jobForm, job_type: val })}
                  options={[
                    { label: 'Permanent', value: 'Permanent' },
                    { label: 'Contract', value: 'Contract' },
                    { label: 'Temporary', value: 'Temporary' }
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="job-vacancies">Vacancies</Label>
                <Input
                  id="job-vacancies"
                  type="number"
                  required
                  min={1}
                  value={jobForm.vacancies}
                  onChange={(e) => setJobForm({ ...jobForm, vacancies: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Relocation Required</Label>
                <Select
                  value={jobForm.relocation_required}
                  onChange={(val: string) => setJobForm({ ...jobForm, relocation_required: val })}
                  options={[
                    { label: 'No', value: 'No' },
                    { label: 'Yes', value: 'Yes' },
                    { label: 'Case-by-case', value: 'Case-by-case' }
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="job-deadline">Application Deadline</Label>
                <Input
                  id="job-deadline"
                  type="date"
                  value={jobForm.deadline}
                  onChange={(e) => setJobForm({ ...jobForm, deadline: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Hiring Manager</Label>
                <Select
                  value={jobForm.hiring_manager_id}
                  onChange={(val: string) => setJobForm({ ...jobForm, hiring_manager_id: val })}
                  options={filters?.employees || []}
                  placeholder="Select Manager"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job-incumbent">Current Incumbent (if replacement)</Label>
              <Input
                id="job-incumbent"
                value={jobForm.current_incumbent}
                onChange={(e) => setJobForm({ ...jobForm, current_incumbent: e.target.value })}
                placeholder="e.g. John Doe (if moving out)"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="job-desc">Job Description & Core Requirements</Label>
              <Textarea
                id="job-desc"
                rows={4}
                value={jobForm.description}
                onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                placeholder="Outline core responsibilities, required experience and certifications..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateJobOpen(false)}>Cancel</Button>
              <Button type="submit">Create Vacancy</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* DRAWER: Edit Job */}
      <Sheet open={isEditJobOpen} onOpenChange={setIsEditJobOpen}>
        <SheetContent side="right" className="sm:max-w-[450px] overflow-y-auto custom-scrollbar">
          <SheetHeader className="mb-4">
            <SheetTitle>Edit Job Posting</SheetTitle>
            <SheetDescription>Update job details and vacancy criteria.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleUpdateJobSubmit} className="space-y-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-job-title">Job Title</Label>
              <Input
                id="edit-job-title"
                required
                value={jobForm.title}
                onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Department</Label>
                <Select
                  value={jobForm.department_id}
                  onChange={(val: string) => setJobForm({ ...jobForm, department_id: val })}
                  options={filters?.departments || []}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Grade</Label>
                <Select
                  value={jobForm.grade}
                  onChange={(val: string) => setJobForm({ ...jobForm, grade: val })}
                  options={[
                    { label: 'G4', value: 'G4' },
                    { label: 'G5', value: 'G5' },
                    { label: 'G6', value: 'G6' },
                    { label: 'G7', value: 'G7' },
                    { label: 'G8', value: 'G8' }
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-job-loc">Location</Label>
                <Input
                  id="edit-job-loc"
                  required
                  value={jobForm.location}
                  onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Job Type</Label>
                <Select
                  value={jobForm.job_type}
                  onChange={(val: string) => setJobForm({ ...jobForm, job_type: val })}
                  options={[
                    { label: 'Permanent', value: 'Permanent' },
                    { label: 'Contract', value: 'Contract' },
                    { label: 'Temporary', value: 'Temporary' }
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-job-vacancies">Vacancies</Label>
                <Input
                  id="edit-job-vacancies"
                  type="number"
                  required
                  min={1}
                  value={jobForm.vacancies}
                  onChange={(e) => setJobForm({ ...jobForm, vacancies: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Relocation Required</Label>
                <Select
                  value={jobForm.relocation_required}
                  onChange={(val: string) => setJobForm({ ...jobForm, relocation_required: val })}
                  options={[
                    { label: 'No', value: 'No' },
                    { label: 'Yes', value: 'Yes' },
                    { label: 'Case-by-case', value: 'Case-by-case' }
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-job-deadline">Application Deadline</Label>
                <Input
                  id="edit-job-deadline"
                  type="date"
                  value={jobForm.deadline}
                  onChange={(e) => setJobForm({ ...jobForm, deadline: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Hiring Manager</Label>
                <Select
                  value={jobForm.hiring_manager_id}
                  onChange={(val: string) => setJobForm({ ...jobForm, hiring_manager_id: val })}
                  options={filters?.employees || []}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-job-incumbent">Current Incumbent</Label>
              <Input
                id="edit-job-incumbent"
                value={jobForm.current_incumbent}
                onChange={(e) => setJobForm({ ...jobForm, current_incumbent: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-job-desc">Job Description</Label>
              <Textarea
                id="edit-job-desc"
                rows={4}
                value={jobForm.description}
                onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditJobOpen(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* MODAL: Apply Internally */}
      <Dialog open={isApplyJobOpen} onOpenChange={setIsApplyJobOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Apply Internally</DialogTitle>
            <DialogDescription>
              Submit an internal application for <strong>{selectedJob?.title}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApplySubmit} className="space-y-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apply-remarks">Cover Note / Remarks</Label>
              <Textarea
                id="apply-remarks"
                rows={4}
                value={applyForm.remarks}
                onChange={(e) => setApplyForm({ remarks: e.target.value })}
                placeholder="Mention why you are interested in this lateral/vertical move..."
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsApplyJobOpen(false)}>Cancel</Button>
              <Button type="submit">Submit Application</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Nominate Successor */}
      <Dialog open={isNominateSuccessorOpen} onOpenChange={setIsNominateSuccessorOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Nominate Potential Successor</DialogTitle>
            <DialogDescription>Add a high-potential employee to the succession pipeline for a critical role.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleNominateSuccessorSubmit} className="space-y-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label>Select Critical Job Role</Label>
              <Select
                value={successorForm.critical_jobrole_id}
                onChange={(val: string) => setSuccessorForm({ ...successorForm, critical_jobrole_id: val })}
                options={filters?.jobroles || []}
                placeholder="Select Critical Role"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Select Successor Employee</Label>
              <Select
                value={successorForm.successor_user_id}
                onChange={(val: string) => setSuccessorForm({ ...successorForm, successor_user_id: val })}
                options={filters?.employees || []}
                placeholder="Select Successor"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Readiness Timeline</Label>
                <Select
                  value={successorForm.readiness}
                  onChange={(val: string) => setSuccessorForm({ ...successorForm, readiness: val })}
                  options={[
                    { label: 'Ready Now', value: 'Ready Now' },
                    { label: 'Ready in 1-2 Years', value: 'Ready in 1-2 Years' },
                    { label: 'Ready in 2+ Years', value: 'Ready in 2+ Years' }
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select
                  value={successorForm.status}
                  onChange={(val: string) => setSuccessorForm({ ...successorForm, status: val })}
                  options={[
                    { label: 'Active', value: 'Active' },
                    { label: 'Inactive', value: 'Inactive' }
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 py-2">
              <Checkbox
                id="emergency-successor"
                checked={successorForm.emergency_successor}
                onCheckedChange={(checked) => setSuccessorForm({ ...successorForm, emergency_successor: Boolean(checked) })}
              />
              <Label htmlFor="emergency-successor" className="cursor-pointer">Mark as Emergency Successor (first contact backup)</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNominateSuccessorOpen(false)}>Cancel</Button>
              <Button type="submit">Nominate</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Record Transfer */}
      <Dialog open={isRecordTransferOpen} onOpenChange={setIsRecordTransferOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Record Lateral Transfer</DialogTitle>
            <DialogDescription>Record and process a lateral department or role movement for an employee.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordTransferSubmit} className="space-y-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label>Select Employee</Label>
              <Select
                value={transferForm.user_id}
                onChange={(val: string) => setTransferForm({ ...transferForm, user_id: val })}
                options={filters?.employees || []}
                placeholder="Select Employee"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>From Department (if any)</Label>
                <Select
                  value={transferForm.from_department_id}
                  onChange={(val: string) => setTransferForm({ ...transferForm, from_department_id: val })}
                  options={filters?.departments || []}
                  placeholder="Select Dept"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>To Department</Label>
                <Select
                  value={transferForm.to_department_id}
                  onChange={(val: string) => setTransferForm({ ...transferForm, to_department_id: val })}
                  options={filters?.departments || []}
                  placeholder="Select Dept"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trans-from-role">From Role</Label>
                <Input
                  id="trans-from-role"
                  value={transferForm.from_jobrole}
                  onChange={(e) => setTransferForm({ ...transferForm, from_jobrole: e.target.value })}
                  placeholder="e.g. Associate Engineer"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trans-to-role">To Role</Label>
                <Input
                  id="trans-to-role"
                  required
                  value={transferForm.to_jobrole}
                  onChange={(e) => setTransferForm({ ...transferForm, to_jobrole: e.target.value })}
                  placeholder="e.g. QA Specialist"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trans-date">Effective Date</Label>
                <Input
                  id="trans-date"
                  type="date"
                  required
                  value={transferForm.effective_date}
                  onChange={(e) => setTransferForm({ ...transferForm, effective_date: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select
                  value={transferForm.status}
                  onChange={(val: string) => setTransferForm({ ...transferForm, status: val })}
                  options={[
                    { label: 'Pending', value: 'Pending' },
                    { label: 'Approved', value: 'Approved' },
                    { label: 'Completed', value: 'Completed' }
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trans-remarks">Remarks / Reason</Label>
              <Textarea
                id="trans-remarks"
                rows={3}
                value={transferForm.remarks}
                onChange={(e) => setTransferForm({ ...transferForm, remarks: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRecordTransferOpen(false)}>Cancel</Button>
              <Button type="submit">Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Record Promotion */}
      <Dialog open={isRecordPromotionOpen} onOpenChange={setIsRecordPromotionOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Record Promotion</DialogTitle>
            <DialogDescription>Record a career ladder promotion progression details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPromotionSubmit} className="space-y-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label>Select Employee</Label>
              <Select
                value={promotionForm.user_id}
                onChange={(val: string) => setPromotionForm({ ...promotionForm, user_id: val })}
                options={filters?.employees || []}
                placeholder="Select Employee"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promo-curr-grade">Current Grade</Label>
                <Input
                  id="promo-curr-grade"
                  value={promotionForm.current_grade}
                  onChange={(e) => setPromotionForm({ ...promotionForm, current_grade: e.target.value })}
                  placeholder="e.g. G4"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promo-prop-grade">Proposed Grade</Label>
                <Input
                  id="promo-prop-grade"
                  required
                  value={promotionForm.proposed_grade}
                  onChange={(e) => setPromotionForm({ ...promotionForm, proposed_grade: e.target.value })}
                  placeholder="e.g. G5"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promo-curr-desig">Current Designation</Label>
                <Input
                  id="promo-curr-desig"
                  value={promotionForm.current_designation}
                  onChange={(e) => setPromotionForm({ ...promotionForm, current_designation: e.target.value })}
                  placeholder="e.g. Junior Engineer"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promo-prop-desig">Proposed Designation</Label>
                <Input
                  id="promo-prop-desig"
                  required
                  value={promotionForm.proposed_designation}
                  onChange={(e) => setPromotionForm({ ...promotionForm, proposed_designation: e.target.value })}
                  placeholder="e.g. Software Engineer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="promo-date">Effective Date</Label>
                <Input
                  id="promo-date"
                  type="date"
                  required
                  value={promotionForm.effective_date}
                  onChange={(e) => setPromotionForm({ ...promotionForm, effective_date: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select
                  value={promotionForm.status}
                  onChange={(val: string) => setPromotionForm({ ...promotionForm, status: val })}
                  options={[
                    { label: 'Pending', value: 'Pending' },
                    { label: 'Approved', value: 'Approved' },
                    { label: 'Completed', value: 'Completed' }
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-remarks">Remarks</Label>
              <Textarea
                id="promo-remarks"
                rows={3}
                value={promotionForm.remarks}
                onChange={(e) => setPromotionForm({ ...promotionForm, remarks: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRecordPromotionOpen(false)}>Cancel</Button>
              <Button type="submit">Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Create Talent Pool */}
      <Dialog open={isCreatePoolOpen} onOpenChange={setIsCreatePoolOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create Talent Pool</DialogTitle>
            <DialogDescription>Define a new high-potential talent segment group.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePoolSubmit} className="space-y-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pool-name">Talent Pool Name</Label>
              <Input
                id="pool-name"
                required
                value={poolForm.name}
                onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
                placeholder="e.g. Leadership Track 2026"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pool-desc">Description</Label>
              <Textarea
                id="pool-desc"
                rows={3}
                value={poolForm.description}
                onChange={(e) => setPoolForm({ ...poolForm, description: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select
                value={poolForm.status}
                onChange={(val: string) => setPoolForm({ ...poolForm, status: val })}
                options={[
                  { label: 'Active', value: 'Active' },
                  { label: 'Inactive', value: 'Inactive' }
                ]}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreatePoolOpen(false)}>Cancel</Button>
              <Button type="submit">Create Pool</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Manage Talent Pool Members */}
      <Dialog open={isPoolMembersOpen} onOpenChange={setIsPoolMembersOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedPool?.name} - Manage Members</DialogTitle>
            <DialogDescription>View and manage employees mapped to this talent pool.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-xs mt-2">
            {/* Add Member form */}
            <form onSubmit={handleAddPoolMemberSubmit} className="flex gap-2 items-end">
              <div className="flex-1 flex flex-col gap-1">
                <Label>Add Employee to Pool</Label>
                <Select
                  value={addMemberForm.user_id}
                  onChange={(val: string) => setAddMemberForm({ user_id: val })}
                  options={filters?.employees || []}
                  placeholder="Select Employee to Add"
                />
              </div>
              <Button type="submit" size="sm" className="h-9 px-3">
                <UserPlus className="size-4 mr-1.5" /> Add
              </Button>
            </form>

            {/* Members list */}
            <div className="border rounded-md overflow-hidden max-h-[250px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poolMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">
                        No members in this talent pool yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    poolMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.user_details?.name}
                        </TableCell>
                        <TableCell className="text-[10px]">
                          {member.user_details?.department || '--'}
                        </TableCell>
                        <TableCell className="text-[10px]">
                          {member.added_on ? String(member.added_on).slice(0, 10) : ''}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemovePoolMember(member.user_id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" onClick={() => setIsPoolMembersOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
