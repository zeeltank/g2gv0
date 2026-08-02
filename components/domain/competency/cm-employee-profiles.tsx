'use client'

import React, { useState, useMemo } from 'react'
import {
  Info,
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
  ChevronRight,
  Clock,
  Star,
  X,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useCompetencyEmployeeProfile } from '@/hooks/use-employee-profile'
import { useAuth } from '@/hooks/use-auth'
import type { EmployeeCompetencyItem } from '@/services/competency'

export function CmEmployeeProfiles({ userId }: { userId?: string }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('ratings')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<(EmployeeCompetencyItem & { category: string }) | null>(null)
  const [historyItem, setHistoryItem] = useState<(EmployeeCompetencyItem & { category: string }) | null>(null)
  const [editItem, setEditItem] = useState<(EmployeeCompetencyItem & { category: string }) | null>(null)
  const [editLevel, setEditLevel] = useState(1)

  // Add Competency form state
  const [selectedSkillId, setSelectedSkillId] = useState<string>('')
  const [newLevel, setNewLevel] = useState(3)

  const effectiveUserId = userId || user?.id?.toString()
  const {
    data, loading, error,
    availableSkills, availableSkillsLoading, loadAvailableSkills,
    addSkill, updateSkill, saving,
    skillHistory, skillHistoryLoading, loadSkillHistory, clearSkillHistory,
    notes, notesLoading, saveNotes, requestReassessment, assignDevelopmentPlan, addCertification,
    certifications, developmentPlans, evidence, careerPath, addEvidence, removeEvidence,
  } = useCompetencyEmployeeProfile(effectiveUserId || null)

  // Quick-action dialogs
  const [reassessOpen, setReassessOpen] = useState(false)
  const [reassessForm, setReassessForm] = useState({ title: '', due_date: '' })
  const [planOpen, setPlanOpen] = useState(false)
  const [planForm, setPlanForm] = useState({ title: '', due_date: '' })
  const [certOpen, setCertOpen] = useState(false)
  const [certForm, setCertForm] = useState({ name: '', issuing_body: '', issued_date: '', expiry_date: '' })
  const [notesEditing, setNotesEditing] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [evidenceForm, setEvidenceForm] = useState({ title: '', evidence_type: 'document', description: '', link: '' })

  // Open Add Competency dialog
  const handleOpenAdd = () => {
    loadAvailableSkills()
    setSelectedSkillId('')
    setNewLevel(3)
    setAddDialogOpen(true)
  }

  const handleAddSubmit = async () => {
    if (!selectedSkillId) return
    const res = await addSkill(Number(selectedSkillId), newLevel)
    if (res.ok) {
      setAddDialogOpen(false)
    } else {
      alert(res.message)
    }
  }

  // View Details
  const handleViewDetails = (item: EmployeeCompetencyItem, category: string) => {
    setDetailItem({ ...item, category })
  }

  // History
  const handleViewHistory = (item: EmployeeCompetencyItem, category: string) => {
    setHistoryItem({ ...item, category })
    loadSkillHistory(item.skill_id)
  }

  // Edit rating
  const handleEditRating = (item: EmployeeCompetencyItem, category: string) => {
    setEditItem({ ...item, category })
    setEditLevel(item.current)
  }

  const handleEditSubmit = async () => {
    if (!editItem) return
    const res = await updateSkill(editItem.matrix_id, editLevel)
    if (res.ok) {
      setEditItem(null)
    } else {
      alert(res.message)
    }
  }

  // Quick actions
  const openReassess = () => {
    setReassessForm({ title: `Re-assessment: ${data?.employee.name ?? ''}`, due_date: '' })
    setReassessOpen(true)
  }
  const submitReassess = async () => {
    if (!reassessForm.title.trim()) return
    const res = await requestReassessment({ title: reassessForm.title, jobrole: data?.employee.role, due_date: reassessForm.due_date || undefined })
    if (res.ok) setReassessOpen(false); else alert(res.message)
  }

  const openPlan = () => {
    setPlanForm({ title: `Development Plan: ${data?.employee.name ?? ''}`, due_date: '' })
    setPlanOpen(true)
  }
  const submitPlan = async () => {
    if (!planForm.title.trim()) return
    const res = await assignDevelopmentPlan({ title: planForm.title, jobrole: data?.employee.role, due_date: planForm.due_date || undefined })
    if (res.ok) setPlanOpen(false); else alert(res.message)
  }

  const openCert = () => {
    setCertForm({ name: '', issuing_body: '', issued_date: '', expiry_date: '' })
    setCertOpen(true)
  }
  const submitCert = async () => {
    if (!certForm.name.trim()) return
    const res = await addCertification({
      name: certForm.name,
      jobrole: data?.employee.role,
      issuing_body: certForm.issuing_body || undefined,
      issued_date: certForm.issued_date || undefined,
      expiry_date: certForm.expiry_date || undefined,
    })
    if (res.ok) setCertOpen(false); else alert(res.message)
  }

  const openNotesEdit = () => { setNotesDraft(notes); setNotesEditing(true) }
  const submitNotes = async () => {
    const res = await saveNotes(notesDraft)
    if (res.ok) setNotesEditing(false); else alert(res.message)
  }

  const openEvidence = () => { setEvidenceForm({ title: '', evidence_type: 'document', description: '', link: '' }); setEvidenceOpen(true) }
  const submitEvidence = async () => {
    if (!evidenceForm.title.trim()) return
    const res = await addEvidence({ ...evidenceForm, status: 'pending' })
    if (res.ok) setEvidenceOpen(false); else alert(res.message)
  }
  const handleRemoveEvidence = async (id: number) => {
    if (!window.confirm('Remove this evidence item?')) return
    const res = await removeEvidence(id)
    if (!res.ok) alert(res.message)
  }

  const getGapColor = (gap: number) => {
    if (gap > 0) return 'text-success font-bold'
    if (gap < 0) return 'text-destructive font-bold'
    return 'text-muted-foreground'
  }

  const getLevelColor = (level: number) => {
    const colors: Record<number, string> = { 1: 'bg-destructive', 2: 'bg-warning', 3: 'bg-success', 4: 'bg-primary', 5: 'bg-indigo-500' }
    return colors[level] || 'bg-muted'
  }

  const getLevelLabel = (level: number) => {
    const labels: Record<number, string> = { 1: 'Beginner', 2: 'Basic', 3: 'Proficient', 4: 'Advanced', 5: 'Expert' }
    return labels[level] || 'N/A'
  }

  const proficiencySummary = useMemo(() => {
    if (!data) return []
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let total = 0
    data.competencies.forEach(cat => { cat.items.forEach(item => { if (item.current >= 1 && item.current <= 5) { counts[item.current as keyof typeof counts]++ } total++ }) })
    if (total === 0) return []
    return [
      { label: 'Expert (5)', count: counts[5], percent: ((counts[5] / total) * 100).toFixed(1), color: 'bg-indigo-500' },
      { label: 'Advanced (4)', count: counts[4], percent: ((counts[4] / total) * 100).toFixed(1), color: 'bg-primary' },
      { label: 'Proficient (3)', count: counts[3], percent: ((counts[3] / total) * 100).toFixed(1), color: 'bg-success' },
      { label: 'Basic (2)', count: counts[2], percent: ((counts[2] / total) * 100).toFixed(1), color: 'bg-warning' },
      { label: 'Beginner (1)', count: counts[1], percent: ((counts[1] / total) * 100).toFixed(1), color: 'bg-destructive' },
    ]
  }, [data])

  const totalCompetencies = proficiencySummary.reduce((acc, stat) => acc + stat.count, 0)

  // Flat, date-sorted list of the employee's competency assessments for the History tab.
  const competencyTimeline = useMemo(() => {
    if (!data) return []
    const items = data.competencies.flatMap(cat => cat.items.map(item => ({ ...item, category: cat.category })))
    return items.sort((a, b) => {
      const tb = new Date(b.date).getTime()
      const ta = new Date(a.date).getTime()
      return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta)
    })
  }, [data])

  const certStatusVariant = (status: string) => {
    if (status === 'valid') return 'success'
    if (status === 'expiring') return 'warning'
    return 'error'
  }
  const planStatusVariant = (status: string) => {
    if (status === 'completed') return 'success'
    if (status === 'overdue') return 'error'
    if (status === 'on_hold') return 'warning'
    return 'processing'
  }

  const categoryOptions = useMemo(() => {
    if (!data) return [{ label: 'All Categories', value: 'all' }]
    return [{ label: 'All Categories', value: 'all' }, ...data.competencies.map(cat => ({ label: cat.category, value: cat.category }))]
  }, [data])

  const filteredCompetencies = useMemo(() => {
    if (!data) return []
    if (categoryFilter === 'all') return data.competencies
    return data.competencies.filter(c => c.category === categoryFilter)
  }, [data, categoryFilter])

  if (!effectiveUserId) return <div className="p-12 text-center text-muted-foreground">No user ID provided or authenticated.</div>
  if (loading) return <div className="p-12 text-center text-muted-foreground">Loading employee profile...</div>
  if (error || !data) return <div className="p-12 text-center text-destructive">Error: {error || 'Failed to load data'}</div>

  const { employee, metrics } = data

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
              <DropdownMenuItem onClick={handleOpenAdd}>Add Competency</DropdownMenuItem>
              <DropdownMenuItem onClick={openReassess}>Request Assessment</DropdownMenuItem>
              <DropdownMenuItem onClick={openPlan}>Assign Development Plan</DropdownMenuItem>
              <DropdownMenuItem onClick={openCert}>Add Certification</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Employee Summary Card */}
      <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl">{employee.initials}</div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-foreground">{employee.name}</h2>
              <StatusBadge status="success" label="Active" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-2">{employee.role}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
              <span>{employee.department}</span><span className="w-1 h-1 rounded-full bg-border" /><span>{employee.location}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium mt-1">
              <span>Employee ID: {employee.emp_id}</span><span className="w-1 h-1 rounded-full bg-border" /><span>Joined: {employee.joined}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-12 pr-4">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between gap-12">
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Reports To</p><p className="text-sm font-bold text-foreground">{employee.reports_to}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Employment Type</p><p className="text-sm font-bold text-foreground">{employee.type}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Experience</p><p className="text-sm font-bold text-foreground">{employee.experience}</p></div>
            </div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Latest Assessment</p><p className="text-sm font-bold text-foreground">{metrics.latest_assessment}</p><p className="text-xs text-muted-foreground">(Cycle: {metrics.latest_cycle})</p></div>
          </div>
          <div className="h-20 w-px bg-border mx-2" />
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <p className="text-xs font-bold text-muted-foreground mb-1">Overall Competency Score</p>
              <div className="flex items-end gap-1"><span className="text-3xl font-black text-foreground leading-none">{metrics.overall_score}</span><span className="text-lg font-bold text-muted-foreground leading-none mb-0.5">/ 5</span></div>
              <p className="text-sm font-bold text-success mt-1">{getLevelLabel(Math.round(metrics.overall_score))}</p>
            </div>
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90"><circle cx="50%" cy="50%" r="46%" className="stroke-muted fill-none stroke-[6px]" /><circle cx="50%" cy="50%" r="46%" className="stroke-primary fill-none stroke-[6px]" strokeDasharray={`${(metrics.overall_score / 5) * 289} 289`} strokeDashoffset="0" /></svg>
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
          const isActive = tab.id === activeTab; const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm font-semibold transition-colors relative flex items-center gap-2 ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-4 h-4" />{tab.label}{isActive && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
            </button>
          )
        })}
      </div>

      {activeTab === 'ratings' && (
        <div className="flex gap-6 items-start min-h-[600px]">
          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Select options={categoryOptions} value={categoryFilter} onChange={setCategoryFilter} placeholder="All Categories" className="w-44 bg-background" />
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-foreground">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-destructive" /> 1-Beginner</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-warning" /> 2-Basic</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-success" /> 3-Proficient</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-primary" /> 4-Advanced</div>
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
                  {filteredCompetencies.map((group, gIdx) => (
                    <React.Fragment key={gIdx}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={9} className="px-4 py-2 font-bold text-foreground text-xs">
                          <div className="flex items-center gap-2"><ChevronDown className="w-4 h-4" /> {group.category}</div>
                        </TableCell>
                      </TableRow>
                      {group.items.map((item, iIdx) => (
                        <TableRow key={iIdx} className="hover:bg-muted/30">
                          <TableCell className="px-4 py-3 font-medium text-foreground pl-10">{item.name}</TableCell>
                          <TableCell className="px-4 py-3 text-muted-foreground text-xs">{group.category.split(' ')[0]}</TableCell>
                          <TableCell className="px-4 py-3 text-center font-bold text-foreground">{item.required}</TableCell>
                          <TableCell className="px-4 py-3 text-center font-bold text-foreground">{item.current}</TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${getLevelColor(item.current)}`} style={{ width: `${(item.current / 5) * 100}%` }} /></div>
                              <span className="text-xs font-bold w-6">{item.current.toFixed(1)}</span>
                            </div>
                          </TableCell>
                          <TableCell className={`px-4 py-3 text-center text-xs ${getGapColor(item.gap)}`}>{item.gap > 0 ? `+${item.gap}` : item.gap === 0 ? '—' : item.gap}</TableCell>
                          <TableCell className="px-4 py-3 text-muted-foreground text-xs">{item.date}</TableCell>
                          <TableCell className="px-4 py-3 text-muted-foreground text-xs">{item.assessor}</TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground outline-none transition-colors mx-auto"><MoreVertical className="w-4 h-4" /></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(item, group.category)}>View Details</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewHistory(item, group.category)}>History</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                  {filteredCompetencies.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="h-32 text-center text-muted-foreground">No competencies found for this user.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="p-3 border-t border-border text-xs text-muted-foreground bg-card">Showing {totalCompetencies} competencies</div>
          </div>

          {/* Right Sidebar */}
          <div className="w-80 shrink-0 flex flex-col gap-6">
            <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4"><h3 className="font-bold text-foreground">Proficiency Summary</h3><Info className="w-4 h-4 text-muted-foreground" /></div>
              <div className="flex flex-col gap-3">
                {proficiencySummary.map(stat => (
                  <div key={stat.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 w-28"><div className={`w-2 h-2 rounded-full ${stat.color}`} /><span className="text-foreground font-medium">{stat.label}</span></div>
                    <div className="flex-1 mx-3 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full ${stat.color}`} style={{ width: `${stat.percent}%` }} /></div>
                    <span className="text-muted-foreground w-12 text-right">{stat.count} ({stat.percent}%)</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between font-bold text-sm text-foreground"><span>Total Competencies</span><span>{totalCompetencies}</span></div>
            </div>

            <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30"><h3 className="font-bold text-foreground">Quick Actions</h3></div>
              <div className="flex flex-col">
                <button onClick={handleOpenAdd} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border text-sm text-foreground font-medium">
                  <span className="flex items-center gap-3"><Plus className="w-4 h-4 text-primary" /> Add Competency</span><ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={openReassess} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border text-sm text-foreground font-medium">
                  <span className="flex items-center gap-3"><RefreshCw className="w-4 h-4 text-primary" /> Request Re-assessment</span><ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={openPlan} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border text-sm text-foreground font-medium">
                  <span className="flex items-center gap-3"><Target className="w-4 h-4 text-primary" /> Assign Development Plan</span><ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={openCert} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-sm text-foreground font-medium">
                  <span className="flex items-center gap-3"><Award className="w-4 h-4 text-primary" /> Add Certification</span><ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-5 relative">
              <h3 className="font-bold text-foreground mb-3">Notes</h3>
              {!notesEditing && (
                <Button variant="ghost" onClick={openNotesEdit} className="absolute top-3 right-3 h-8 w-8 p-0 text-muted-foreground"><Edit3 className="w-4 h-4" /></Button>
              )}
              {notesEditing ? (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    placeholder="Add private notes related to this employee competency profile..."
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setNotesEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={submitNotes} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                  </div>
                </div>
              ) : notesLoading ? (
                <p className="text-sm text-muted-foreground">Loading notes...</p>
              ) : notes ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">{notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Add private notes related to this employee competency profile...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== COMPETENCY HISTORY ===== */}
      {activeTab === 'history' && (
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-6 min-h-[400px]">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><History className="w-5 h-5" /> Competency Assessment History</h3>
          {competencyTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No competency history for this employee yet.</p>
          ) : (
            <div className="relative flex flex-col gap-0 pl-2">
              <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />
              {competencyTimeline.map((item, i) => (
                <div key={`${item.skill_id}-${i}`} className="flex items-start gap-4 relative pl-8 pb-5">
                  <div className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-background ${getLevelColor(item.current)}`} />
                  <div className="flex-1 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category} · Assessed by {item.assessor || 'System'}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <StatusBadge status="processing" label={`Level ${item.current} · ${getLevelLabel(item.current)}`} size="sm" />
                      <span className="text-xs text-muted-foreground w-24 text-right">{item.date || '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CERTIFICATIONS ===== */}
      {activeTab === 'certs' && (
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-6 min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground flex items-center gap-2"><Award className="w-5 h-5" /> Certifications</h3>
            <Button onClick={openCert} className="gap-2"><Plus className="w-4 h-4" /> Add Certification</Button>
          </div>
          {certifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No certifications recorded for this employee.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {certifications.map(cert => (
                <div key={cert.id} className="bg-background border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"><Award className="w-5 h-5" /></div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{cert.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{cert.issuing_body || '—'}</p>
                      </div>
                    </div>
                    <StatusBadge status={cert.status} label={cert.status} size="sm" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                    <span>Issued: <span className="text-foreground font-medium">{cert.issued_date || '—'}</span></span>
                    <span>Expires: <span className="text-foreground font-medium">{cert.expiry_date || '—'}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== DEVELOPMENT PLANS ===== */}
      {activeTab === 'plans' && (
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-6 min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground flex items-center gap-2"><Target className="w-5 h-5" /> Development Plans</h3>
            <Button onClick={openPlan} className="gap-2"><Plus className="w-4 h-4" /> Assign Plan</Button>
          </div>
          {developmentPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No development plans assigned to this employee.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {developmentPlans.map(plan => (
                <div key={plan.id} className="bg-background border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-foreground text-sm">{plan.title}</p>
                    <StatusBadge status={planStatusVariant(plan.status)} label={plan.status.replace('_', ' ')} size="sm" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1"><span className="text-muted-foreground">Progress</span><span className="font-bold text-foreground">{plan.progress}%</span></div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${plan.progress}%` }} /></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                    <span>Start: <span className="text-foreground font-medium">{plan.start_date || '—'}</span></span>
                    <span>Due: <span className="text-foreground font-medium">{plan.due_date || '—'}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== PROFILE INFO ===== */}
      {activeTab === 'profile' && (
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-6 min-h-[400px]">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><FileText className="w-5 h-5" /> Profile Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-5">
            {[
              { label: 'Full Name', value: employee.name },
              { label: 'Employee ID', value: employee.emp_id },
              { label: 'Job Role', value: employee.role },
              { label: 'Department', value: employee.department },
              { label: 'Location', value: employee.location },
              { label: 'Reports To', value: employee.reports_to },
              { label: 'Employment Type', value: employee.type },
              { label: 'Experience', value: employee.experience },
              { label: 'Joined', value: employee.joined },
            ].map(f => (
              <div key={f.label}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{f.label}</p>
                <p className="text-sm font-semibold text-foreground">{f.value || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== EVIDENCE REPOSITORY ===== */}
      {activeTab === 'evidence' && (
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-6 min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground flex items-center gap-2"><Folder className="w-5 h-5" /> Evidence Repository</h3>
            <Button onClick={openEvidence} className="gap-2"><Plus className="w-4 h-4" /> Add Evidence</Button>
          </div>
          {evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No evidence uploaded for this employee.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {evidence.map(ev => (
                <div key={ev.id} className="bg-background border border-border rounded-xl p-5 shadow-sm flex flex-col gap-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"><FileText className="w-5 h-5" /></div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{ev.title}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{ev.evidence_type}</p>
                      </div>
                    </div>
                    <StatusBadge status={ev.status === 'verified' ? 'success' : 'warning'} label={ev.status} />
                  </div>
                  {ev.competency_name && <p className="text-xs text-muted-foreground">Competency: <span className="text-foreground font-medium">{ev.competency_name}</span></p>}
                  {ev.description && <p className="text-xs text-muted-foreground line-clamp-2">{ev.description}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3 mt-auto">
                    <span>{ev.date || '—'}</span>
                    <button onClick={() => handleRemoveEvidence(ev.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== CAREER PATH ===== */}
      {activeTab === 'career' && (
        <div className="bg-card/90 backdrop-blur-2xl border border-primary/10 rounded-2xl shadow-sm p-6 min-h-[400px]">
          <h3 className="font-bold text-foreground mb-6 flex items-center gap-2"><Route className="w-5 h-5" /> Career Path</h3>
          {!careerPath?.current ? (
            <p className="text-sm text-muted-foreground text-center py-12">No role assigned — a career path can&apos;t be mapped yet.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Current role */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Current Role</p>
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
                  <p className="text-lg font-bold text-foreground">{careerPath.current.jobrole}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{careerPath.current.department || '—'}{careerPath.current.job_level ? ` · ${careerPath.current.job_level}` : ''}</p>
                </div>
              </div>
              {/* Next roles */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
                  {careerPath.path_source === 'related' ? 'Recommended Next Roles' : 'Progression Roles In Department'}
                </p>
                {careerPath.next_roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6">No onward roles are defined for this position.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {careerPath.next_roles.map((r, i) => (
                      <div key={i} className="rounded-xl border border-border bg-background p-5 shadow-sm hover:border-primary/40 transition-colors flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-primary">
                          <ChevronRight className="w-4 h-4" />
                          <p className="font-bold text-foreground text-sm">{r.jobrole}</p>
                        </div>
                        {r.department && <p className="text-xs text-muted-foreground">{r.department}</p>}
                        {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                        <div className="mt-auto pt-2">
                          <StatusBadge status="processing" size="sm">{r.required_skills} required skills</StatusBadge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ADD COMPETENCY DIALOG ===== */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Add Competency</DialogTitle>
            <DialogDescription>Select a competency from the catalog and assign an initial proficiency level.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Competency</label>
              {availableSkillsLoading ? (
                <p className="text-sm text-muted-foreground">Loading skills...</p>
              ) : (
                <Select
                  options={availableSkills.map(s => ({ label: `${s.title}${s.category ? ` (${s.category})` : ''}`, value: String(s.id) }))}
                  value={selectedSkillId}
                  onChange={setSelectedSkillId}
                  placeholder="Select a competency..."
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Proficiency Level</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(lvl => (
                  <button key={lvl} onClick={() => setNewLevel(lvl)} className={`flex-1 h-10 rounded-lg border-2 text-sm font-bold transition-all ${newLevel === lvl ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}>
                    {lvl}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Selected: {getLevelLabel(newLevel)} ({newLevel}/5)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSubmit} disabled={!selectedSkillId || saving}>{saving ? 'Adding...' : 'Add Competency'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== VIEW DETAILS DIALOG ===== */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">{detailItem?.name} <StatusBadge status={detailItem && detailItem.gap >= 0 ? 'success' : 'warning'} label={detailItem ? getLevelLabel(detailItem.current) : ''} /></DialogTitle>
            <DialogDescription>{detailItem?.category}</DialogDescription>
          </DialogHeader>
          {detailItem && (
            <div className="flex flex-col gap-4 py-4">
              {detailItem.description && <p className="text-sm text-muted-foreground">{detailItem.description}</p>}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/30 rounded-xl p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Required</p>
                  <p className="text-2xl font-black text-foreground">{detailItem.required}</p>
                  <p className="text-xs text-muted-foreground">{getLevelLabel(detailItem.required)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Current</p>
                  <p className="text-2xl font-black text-foreground">{detailItem.current}</p>
                  <p className="text-xs text-muted-foreground">{getLevelLabel(detailItem.current)}</p>
                </div>
                <div className="bg-muted/30 rounded-xl p-4 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Gap</p>
                  <p className={`text-2xl font-black ${getGapColor(detailItem.gap)}`}>{detailItem.gap > 0 ? `+${detailItem.gap}` : detailItem.gap === 0 ? '—' : detailItem.gap}</p>
                  <p className="text-xs text-muted-foreground">{detailItem.gap > 0 ? 'Exceeds' : detailItem.gap < 0 ? 'Needs Improvement' : 'On Target'}</p>
                </div>
              </div>
              <div className="border-t border-border pt-4 flex flex-col gap-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Assessed On</span><span className="font-semibold text-foreground">{detailItem.date}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Assessed By</span><span className="font-semibold text-foreground">{detailItem.assessor}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Interest Level</span><span className="font-semibold text-foreground">{detailItem.interest_level}/5</span></div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { setDetailItem(null); handleEditRating(detailItem, detailItem.category) }}><Edit3 className="w-4 h-4" /> Update Rating</Button>
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { setDetailItem(null); handleViewHistory(detailItem, detailItem.category) }}><History className="w-4 h-4" /> View History</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== HISTORY DIALOG ===== */}
      <Dialog open={!!historyItem} onOpenChange={() => { setHistoryItem(null); clearSkillHistory() }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> {historyItem?.name} — History</DialogTitle>
            <DialogDescription>{historyItem?.category}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {skillHistoryLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading history...</p>
            ) : skillHistory ? (
              <div className="flex flex-col gap-4">
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs font-bold text-muted-foreground mb-2">Current State</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-5 h-5 ${s <= skillHistory.skill.current_level ? 'text-primary fill-primary' : 'text-muted'}`} />
                      ))}
                    </div>
                    <span className="text-sm font-bold">{getLevelLabel(skillHistory.skill.current_level)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Last assessed by: {skillHistory.skill.assessor || 'System'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-3">Timeline</p>
                  <div className="flex flex-col gap-0 relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />
                    {skillHistory.timeline.map((entry, i) => (
                      <div key={i} className="flex items-start gap-4 relative pl-6 pb-4">
                        <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 ${i === 0 ? 'bg-primary border-primary' : 'bg-background border-border'}`} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{entry.action}</p>
                          <p className="text-xs text-muted-foreground">Level {entry.level} — {entry.date} — by {entry.by}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No history available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== EDIT RATING DIALOG ===== */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogDescription>Adjust the proficiency level for this competency.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">New Proficiency Level</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(lvl => (
                  <button key={lvl} onClick={() => setEditLevel(lvl)} className={`flex-1 h-12 rounded-lg border-2 text-sm font-bold transition-all flex flex-col items-center justify-center ${editLevel === lvl ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}>
                    <span className="text-lg">{lvl}</span>
                    <span className="text-[9px] leading-none">{getLevelLabel(lvl)}</span>
                  </button>
                ))}
              </div>
              {editItem && editLevel !== editItem.current && (
                <p className="text-xs text-muted-foreground mt-2">Changing from <span className="font-bold">{editItem.current}</span> ({getLevelLabel(editItem.current)}) → <span className="font-bold text-primary">{editLevel}</span> ({getLevelLabel(editLevel)})</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEditSubmit} disabled={saving || (editItem ? editLevel === editItem.current : true)}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== REQUEST RE-ASSESSMENT DIALOG ===== */}
      <Dialog open={reassessOpen} onOpenChange={setReassessOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Request Re-assessment</DialogTitle>
            <DialogDescription>Opens a new competency assessment for {data?.employee.name}.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Assessment Title</label>
              <Input value={reassessForm.title} onChange={e => setReassessForm(p => ({ ...p, title: e.target.value }))} placeholder="Assessment title" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Due Date</label>
              <Input type="date" value={reassessForm.due_date} onChange={e => setReassessForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassessOpen(false)}>Cancel</Button>
            <Button onClick={submitReassess} disabled={saving || !reassessForm.title.trim()}>{saving ? 'Requesting...' : 'Request'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ASSIGN DEVELOPMENT PLAN DIALOG ===== */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Development Plan</DialogTitle>
            <DialogDescription>Creates an active development plan for {data?.employee.name}.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Plan Title</label>
              <Input value={planForm.title} onChange={e => setPlanForm(p => ({ ...p, title: e.target.value }))} placeholder="Plan title" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Target Date</label>
              <Input type="date" value={planForm.due_date} onChange={e => setPlanForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>Cancel</Button>
            <Button onClick={submitPlan} disabled={saving || !planForm.title.trim()}>{saving ? 'Assigning...' : 'Assign'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ADD CERTIFICATION DIALOG ===== */}
      <Dialog open={certOpen} onOpenChange={setCertOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Add Certification</DialogTitle>
            <DialogDescription>Records a certification for {data?.employee.name}.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Certification Name</label>
              <Input value={certForm.name} onChange={e => setCertForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. AWS Solutions Architect" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Issuing Body</label>
              <Input value={certForm.issuing_body} onChange={e => setCertForm(p => ({ ...p, issuing_body: e.target.value }))} placeholder="e.g. Amazon Web Services" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Issued Date</label>
                <Input type="date" value={certForm.issued_date} onChange={e => setCertForm(p => ({ ...p, issued_date: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Expiry Date</label>
                <Input type="date" value={certForm.expiry_date} onChange={e => setCertForm(p => ({ ...p, expiry_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertOpen(false)}>Cancel</Button>
            <Button onClick={submitCert} disabled={saving || !certForm.name.trim()}>{saving ? 'Adding...' : 'Add Certification'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ADD EVIDENCE DIALOG ===== */}
      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Add Evidence</DialogTitle>
            <DialogDescription>Attach supporting evidence for {data?.employee.name}.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Title</label>
              <Input value={evidenceForm.title} onChange={e => setEvidenceForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Project Portfolio" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Type</label>
              <Select
                value={evidenceForm.evidence_type}
                onChange={v => setEvidenceForm(p => ({ ...p, evidence_type: v }))}
                options={[
                  { label: 'Document', value: 'document' },
                  { label: 'Certification', value: 'certification' },
                  { label: 'Project', value: 'project' },
                  { label: 'Endorsement', value: 'endorsement' },
                  { label: 'Training', value: 'training' },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Link (optional)</label>
              <Input value={evidenceForm.link} onChange={e => setEvidenceForm(p => ({ ...p, link: e.target.value }))} placeholder="https://…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Description</label>
              <textarea value={evidenceForm.description} onChange={e => setEvidenceForm(p => ({ ...p, description: e.target.value }))} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none" placeholder="Notes about this evidence..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceOpen(false)}>Cancel</Button>
            <Button onClick={submitEvidence} disabled={saving || !evidenceForm.title.trim()}>{saving ? 'Adding...' : 'Add Evidence'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
