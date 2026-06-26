'use client'

import React, { useState } from 'react'
import { 
  X, 
  Briefcase, 
  Users, 
  Target, 
  Calendar as CalendarIcon, 
  FileText, 
  CheckCircle2, 
  ShieldCheck,
  Building,
  DollarSign,
  ArrowRight
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

type WizardStep = 1 | 2 | 3 | 4

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const [step, setStep] = useState<WizardStep>(1)
  
  // R&D: Domain Agnostic Enterprise Project Schema
  const [projectData, setProjectData] = useState({
    // Step 1: Basics
    name: '',
    category: '', // IT, Finance, Healthcare, Real Estate, R&D
    description: '',
    
    // Step 2: Governance & Team
    department: '',
    sponsor: '', // Executive sponsor
    projectManager: '',
    teamSize: '1-5',
    members: [] as string[],
    
    // Step 3: Timeline & Scope
    priority: 'medium',
    startDate: '',
    dueDate: '',
    budgetEstimate: '', // Optional, generic
    
    // Step 4: Compliance & Meta
    regulatoryFlags: [] as string[], // e.g., HIPAA, SOC2, GDPR
    clientName: '',
  })

  const resetAndClose = () => {
    setStep(1)
    onClose()
  }

  const handleNext = () => {
    if (step < 4) setStep((s) => (s + 1) as WizardStep)
  }

  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep)
  }

  const handleSubmit = () => {
    // Save project logic here
    resetAndClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-card/95 backdrop-blur-3xl border-primary/20 shadow-2xl rounded-2xl">
        {/* Dynamic Header */}
        <div className="bg-gradient-to-r from-primary/10 via-background to-background p-6 border-b border-primary/10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              Initiate New Project
            </DialogTitle>
            <DialogDescription>
              Define cross-functional parameters, governance, and scope for your new initiative.
            </DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center gap-2 mt-6">
            {[
              { num: 1, label: 'Basics', icon: FileText },
              { num: 2, label: 'Governance', icon: Users },
              { num: 3, label: 'Timeline & Scope', icon: Target },
              { num: 4, label: 'Compliance', icon: ShieldCheck }
            ].map((s) => (
              <React.Fragment key={s.num}>
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all duration-300",
                  step === s.num ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : 
                  step > s.num ? "bg-primary/20 text-primary" : "text-muted-foreground"
                )}>
                  <s.icon className="h-4 w-4" />
                  <span className="hidden md:inline">{s.label}</span>
                </div>
                {s.num < 4 && (
                  <div className={cn(
                    "h-[2px] flex-1 rounded-full transition-all duration-300",
                    step > s.num ? "bg-primary/40" : "bg-primary/10"
                  )} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          <div className="min-h-[300px] animate-in fade-in slide-in-from-right-4 duration-300">
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Project Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Q3 Enterprise Deployment"
                    value={projectData.name}
                    onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-input bg-background/50 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Domain / Category</label>
                  <Select
                    value={projectData.category}
                    onChange={(val) => setProjectData({ ...projectData, category: val })}
                    options={[
                      { label: 'Information Technology (IT)', value: 'it' },
                      { label: 'Healthcare & Clinical', value: 'healthcare' },
                      { label: 'Finance & Operations', value: 'finance' },
                      { label: 'Real Estate & Construction', value: 'real_estate' },
                      { label: 'Research & Development', value: 'rd' },
                      { label: 'Marketing & Sales', value: 'marketing' }
                    ]}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Executive Summary</label>
                  <textarea
                    placeholder="Briefly describe the business case and core objectives..."
                    value={projectData.description}
                    onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
                    className="w-full h-24 p-4 rounded-xl border border-input bg-background/50 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none g2g-scrollbar"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block flex items-center gap-2">
                    <Building className="h-4 w-4" /> Primary Department
                  </label>
                  <Select
                    value={projectData.department}
                    onChange={(val) => setProjectData({ ...projectData, department: val })}
                    options={[
                      { label: 'Engineering & Product', value: 'eng' },
                      { label: 'Legal & Compliance', value: 'legal' },
                      { label: 'Human Resources', value: 'hr' },
                      { label: 'Finance', value: 'finance' },
                      { label: 'Operations', value: 'ops' }
                    ]}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1.5 block">Project Manager (Lead)</label>
                    <Select
                      value={projectData.projectManager}
                      onChange={(val) => setProjectData({ ...projectData, projectManager: val })}
                      options={[
                        { label: 'Sarah Chen (You)', value: 'sarah' },
                        { label: 'Michael Scott', value: 'michael' },
                        { label: 'Jim Halpert', value: 'jim' }
                      ]}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1.5 block">Executive Sponsor</label>
                    <Select
                      value={projectData.sponsor}
                      onChange={(val) => setProjectData({ ...projectData, sponsor: val })}
                      options={[
                        { label: 'David Wallace', value: 'david' },
                        { label: 'Jan Levinson', value: 'jan' }
                      ]}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Expected Team Size</label>
                  <div className="flex gap-2">
                    {['1-5', '6-15', '16-50', '50+'].map(size => (
                      <button
                        key={size}
                        onClick={() => setProjectData({ ...projectData, teamSize: size })}
                        className={cn(
                          "px-4 py-2 rounded-xl border transition-all text-sm font-medium",
                          projectData.teamSize === size ? "bg-primary/10 border-primary text-primary" : "border-input bg-background/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Assign Core Team Members</label>
                  <Select
                    value=""
                    onChange={(val) => {
                      if (val && !projectData.members.includes(val)) {
                        setProjectData({ ...projectData, members: [...projectData.members, val] })
                      }
                    }}
                    options={[
                      { label: 'Select an employee...', value: '' },
                      { label: 'Sarah Chen (Engineering)', value: 'Sarah Chen' },
                      { label: 'Michael Scott (Management)', value: 'Michael Scott' },
                      { label: 'Jim Halpert (Sales)', value: 'Jim Halpert' },
                      { label: 'Pam Beesly (Design)', value: 'Pam Beesly' },
                      { label: 'Dwight Schrute (Operations)', value: 'Dwight Schrute' },
                    ]}
                    className="h-11 rounded-xl mb-3"
                  />
                  {projectData.members.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {projectData.members.map(member => (
                        <div key={member} className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full text-sm font-medium">
                          {member}
                          <button 
                            onClick={() => setProjectData({ ...projectData, members: projectData.members.filter(m => m !== member) })}
                            className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">Strategic Priority</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'high', label: 'High Priority' },
                      { id: 'medium', label: 'Medium' },
                      { id: 'low', label: 'Low' }
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => setProjectData({ ...projectData, priority: p.id })}
                        className={cn(
                          "px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold cursor-pointer",
                          projectData.priority === p.id 
                            ? "bg-primary/10 border-primary text-primary shadow-sm" 
                            : "border-transparent bg-background/50 hover:bg-muted text-muted-foreground"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1.5 block flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" /> Start Date
                    </label>
                    <DatePicker 
                      value={projectData.startDate}
                      onChange={(date) => setProjectData({ ...projectData, startDate: date || '' })}
                      placeholder="Select start date"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-foreground mb-1.5 block flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" /> Target End Date
                    </label>
                    <DatePicker 
                      value={projectData.dueDate}
                      onChange={(date) => setProjectData({ ...projectData, dueDate: date || '' })}
                      placeholder="Select target date"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Budget Estimate (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="$0.00"
                    value={projectData.budgetEstimate}
                    onChange={(e) => setProjectData({ ...projectData, budgetEstimate: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-input bg-background/50 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">External Stakeholder / Client (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Acme Corp or State Health Dept"
                    value={projectData.clientName}
                    onChange={(e) => setProjectData({ ...projectData, clientName: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-input bg-background/50 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground mb-3 block">Compliance & Regulatory Constraints</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'hipaa', label: 'HIPAA (Healthcare)' },
                      { id: 'soc2', label: 'SOC2 / ISO27001 (IT)' },
                      { id: 'sec', label: 'SEC / FINRA (Finance)' },
                      { id: 'gdpr', label: 'GDPR / CCPA (Data)' },
                      { id: 'osha', label: 'OSHA (Real Estate/Const.)' },
                      { id: 'internal', label: 'Internal Only (No external risk)' }
                    ].map(flag => {
                      const isSelected = projectData.regulatoryFlags.includes(flag.id)
                      return (
                        <button
                          key={flag.id}
                          onClick={() => {
                            if (isSelected) {
                              setProjectData({ ...projectData, regulatoryFlags: projectData.regulatoryFlags.filter(f => f !== flag.id) })
                            } else {
                              setProjectData({ ...projectData, regulatoryFlags: [...projectData.regulatoryFlags, flag.id] })
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium text-left cursor-pointer",
                            isSelected ? "bg-primary/10 border-primary text-primary" : "border-input bg-background/50 hover:bg-muted text-muted-foreground"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded-full border flex items-center justify-center shrink-0",
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                          )}>
                            {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          {flag.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl border border-border/50">
                  <p className="text-sm text-muted-foreground">
                    By finalizing this project, standard workspaces, repositories, and communication channels will be automatically provisioned based on the selected Domain and Compliance flags.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border/50 bg-card/50 flex items-center justify-between mt-auto">
          <Button variant="ghost" onClick={resetAndClose} className="text-muted-foreground hover:text-foreground">
            Cancel
          </Button>
          <div className="flex gap-3">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} className="rounded-xl px-6">
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={handleNext} className="rounded-xl px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 cursor-pointer">
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="rounded-xl px-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 cursor-pointer">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Finalize Project
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
