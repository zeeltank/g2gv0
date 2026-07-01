'use client'

import React, { useState } from 'react'
import {
  ChevronRight,
  Clock,
  Image as ImageIcon,
  CheckCircle2,
  Circle,
  Search,
  Bell,
  Blocks,
  FileText,
  Video,
  FileBox,
  Users,
  Plus,
  GripVertical,
  Trash2,
  Award,
  Globe,
  Settings2,
  Calendar as CalendarIcon,
  PackageOpen
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, Radio } from '@/components/ui/radio-group'
import { FileUpload } from '@/components/ui/file-upload'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'

export function CreateCoursePage() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(1)

  const handleNext = () => {
    if (activeStep < steps.length) {
      setActiveStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (activeStep > 1) {
      setActiveStep((prev) => prev - 1)
    }
  }

  const handleCancel = () => {
    router.push('/module/m4/learning/learning-catalog')
  }

  const steps = [
    { id: 1, label: 'Basic Information' },
    { id: 2, label: 'Content & Modules' },
    { id: 3, label: 'Assessments' },
    { id: 4, label: 'Certification' },
    { id: 5, label: 'Publish Settings' },
  ]

  const checklist = [
    { id: 1, label: 'Basic information', completed: false },
    { id: 2, label: 'Add content modules', completed: false },
    { id: 3, label: 'Add assessments', completed: false },
    { id: 4, label: 'Configure certification', completed: false },
    { id: 5, label: 'Publish settings', completed: false },
  ]

  return (
    <div className="flex flex-col h-full w-full bg-background pb-10">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center text-xs text-muted-foreground gap-1.5 font-semibold uppercase tracking-wider">
            <span className="hover:text-foreground cursor-pointer transition-colors">LMS</span>
            <ChevronRight className="size-3" />
            <span className="hover:text-foreground cursor-pointer transition-colors">Course Builder</span>
            <ChevronRight className="size-3" />
            <span className="text-primary">Create New Course</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Course Builder</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="font-semibold gap-2 shadow-sm">
            Save as Draft
          </Button>
          <Button variant="outline" className="font-semibold gap-2 shadow-sm" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {/* Stepper Wizard Bar */}
      <Card className="mb-6 border-border/80 shadow-sm bg-card rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center flex-1">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-3 relative z-10 group cursor-pointer" onClick={() => setActiveStep(step.id)}>
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-200 border-2",
                        activeStep === step.id
                          ? "bg-primary border-primary text-primary-foreground shadow-md ring-4 ring-primary/10"
                          : activeStep > step.id
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-background border-muted-foreground/30 text-muted-foreground group-hover:border-muted-foreground/50"
                      )}
                    >
                      {activeStep > step.id ? <CheckCircle2 className="size-4" /> : step.id}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-bold hidden md:block whitespace-nowrap transition-colors",
                        activeStep === step.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "h-[2px] w-full max-w-[60px] lg:max-w-[100px] mx-4 transition-colors duration-300 rounded-full",
                      activeStep > step.id ? "bg-primary" : "bg-border"
                    )} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-border/60">
               <span className="text-sm font-bold text-muted-foreground">Step {activeStep} of 5</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left Column: Main Form */}
        <div className="flex-1 flex flex-col gap-6">
          <Card className="border-border/80 shadow-sm bg-card rounded-xl flex-1 flex flex-col min-h-[500px]">
            {activeStep === 1 && (
              <>
                <CardHeader className="pb-4 border-b border-border/40 px-6 pt-6">
                  <CardTitle className="text-lg font-bold">Basic Information</CardTitle>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Define the essential details and metadata about this course.</p>
                </CardHeader>
                <CardContent className="p-6 flex flex-col flex-1 gap-8">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex gap-1">Course Title <span className="text-destructive">*</span></label>
                  <Input placeholder="E.g. Introduction to Project Management" className="h-10 bg-muted/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Course Code</label>
                  <Input placeholder="E.g. PM-101" className="h-10 bg-muted/20" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-foreground flex gap-1">Short Description <span className="text-destructive">*</span></label>
                  <div className="relative">
                    <Textarea placeholder="Provide a brief overview of what learners will achieve..." className="resize-none h-24 pb-8 bg-muted/20" />
                    <span className="absolute bottom-2 right-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">0 / 200</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex gap-1">Course Type <span className="text-destructive">*</span></label>
                  <Select
                    options={[
                      { label: 'eLearning Module', value: 'eLearning' },
                      { label: 'Video Course', value: 'Video' },
                      { label: 'Blended Learning', value: 'Blended' },
                    ]}
                    value=""
                    onChange={() => {}}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Estimated Duration</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input placeholder="00:00" className="pl-9 h-10 bg-muted/20" />
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted px-2 py-1.5 rounded-md">HH:MM</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground flex gap-1">Category <span className="text-destructive">*</span></label>
                  <Select
                    options={[
                      { label: 'Compliance & Safety', value: 'Compliance' },
                      { label: 'Technical Skills', value: 'Technical' },
                      { label: 'Leadership', value: 'Leadership' },
                    ]}
                    value=""
                    onChange={() => {}}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Language</label>
                  <Select
                    options={[
                      { label: 'English (US)', value: 'English' },
                      { label: 'Spanish (ES)', value: 'Spanish' },
                    ]}
                    value=""
                    onChange={() => {}}
                  />
                </div>
              </div>

              {/* Separator */}
              <div className="h-px w-full bg-border/60" />

              <div>
                <h3 className="text-base font-bold mb-4">Configuration & Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Settings Boxes instead of full Cards to reduce visual noise */}
                  <div className="flex items-start gap-3 p-4 rounded-lg border border-border/60 bg-muted/10 hover:bg-muted/30 transition-colors">
                    <Checkbox id="mandatory" className="mt-0.5" />
                    <div className="flex flex-col gap-0.5 cursor-pointer">
                      <label htmlFor="mandatory" className="text-sm font-bold text-foreground cursor-pointer">Mandatory Course</label>
                      <span className="text-xs text-muted-foreground leading-snug">Automatically assign and enforce completion rules.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-lg border border-border/60 bg-muted/10 hover:bg-muted/30 transition-colors">
                    <Checkbox id="discussion" className="mt-0.5" />
                    <div className="flex flex-col gap-0.5 cursor-pointer">
                      <label htmlFor="discussion" className="text-sm font-bold text-foreground cursor-pointer">Enable Discussion</label>
                      <span className="text-xs text-muted-foreground leading-snug">Allow learners to ask questions in a course forum.</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 p-4 rounded-lg border border-border/60 bg-muted/10">
                    <span className="text-sm font-bold text-foreground">Course Visibility</span>
                    <RadioGroup value="visible" className="flex items-center gap-4">
                      <Radio value="visible" label="Visible to all" size="sm" />
                      <Radio value="restricted" label="Restricted" size="sm" />
                    </RadioGroup>
                  </div>

                  <div className="flex flex-col gap-2 p-4 rounded-lg border border-border/60 bg-muted/10">
                    <span className="text-sm font-bold text-foreground">Prerequisites</span>
                    <Button variant="outline" size="sm" className="w-full h-8 border-dashed bg-background hover:bg-muted text-xs font-bold">
                      + Add Prerequisite Rule
                    </Button>
                  </div>
                </div>
              </div>

              {/* Separator */}
              <div className="h-px w-full bg-border/60" />

              <div className="space-y-3 max-w-lg">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-foreground">Course Thumbnail</label>
                  <span className="text-xs text-muted-foreground">Upload a 16:9 image (1280x720) to display in the catalog.</span>
                </div>
                <FileUpload hint="JPEG, PNG or WebP up to 5MB" className="border-dashed bg-muted/10" />
              </div>
            </CardContent>
            </>
            )}


            {activeStep === 2 && (
              <>
                <CardHeader className="pb-4 border-b border-border/40 px-6 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Content & Modules</CardTitle>
                      <p className="text-sm text-muted-foreground font-medium mt-1">Structure your course by adding modules and content files.</p>
                    </div>
                    <Button size="sm" className="gap-2"><Plus className="size-4" /> Add Module</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex flex-col flex-1 gap-6 bg-muted/5">
                  {/* Sample Module Card */}
                  <div className="rounded-lg border border-border/60 bg-background shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 p-3 bg-muted/30 border-b border-border/40">
                      <GripVertical className="size-4 text-muted-foreground cursor-grab" />
                      <div className="flex flex-col flex-1">
                        <span className="text-sm font-bold text-foreground">Module 1: Introduction</span>
                      </div>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></Button>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      {/* Empty Content State */}
                      <div className="flex items-center justify-center py-8 border-2 border-dashed border-border/60 rounded-lg">
                        <div className="flex gap-3">
                          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-bold"><Video className="size-3.5" /> Video</Button>
                          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-bold"><FileText className="size-3.5" /> Document</Button>
                          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-bold"><FileBox className="size-3.5" /> SCORM</Button>
                          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-bold"><Users className="size-3.5" /> Live Session</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {activeStep === 3 && (
              <>
                <CardHeader className="pb-4 border-b border-border/40 px-6 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Assessments & Quizzes</CardTitle>
                      <p className="text-sm text-muted-foreground font-medium mt-1">Add tests to evaluate learner understanding.</p>
                    </div>
                    <Button size="sm" className="gap-2"><Plus className="size-4" /> Add Quiz</Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 flex flex-col flex-1 gap-6">
                  <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-border/80 rounded-lg bg-muted/10">
                    <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <FileText className="size-6 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-bold text-foreground">No assessments configured.</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">Courses without assessments will be marked complete when all modules are viewed.</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border/40">
                    <h3 className="text-sm font-bold">Global Assessment Rules</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground">Minimum Passing Score (%)</label>
                        <Input type="number" placeholder="80" className="h-9" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-foreground">Maximum Attempts Allowed</label>
                        <Input type="number" placeholder="Unlimited" className="h-9" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {activeStep === 4 && (
              <>
                <CardHeader className="pb-4 border-b border-border/40 px-6 pt-6">
                  <CardTitle className="text-lg font-bold">Certification Rules</CardTitle>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Configure compliance and certificate generation settings.</p>
                </CardHeader>
                <CardContent className="p-6 flex flex-col flex-1 gap-6">
                  <div className="flex items-start gap-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                    <Checkbox id="enable-cert" className="mt-1" defaultChecked />
                    <div className="flex flex-col gap-1">
                      <label htmlFor="enable-cert" className="text-sm font-bold text-foreground cursor-pointer">Issue Certificate upon Completion</label>
                      <span className="text-xs text-muted-foreground">Learners will receive a downloadable PDF certificate.</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Certificate Template</label>
                      <Select
                        options={[
                          { label: 'Standard Corporate Template', value: 'standard' },
                          { label: 'Compliance Template', value: 'compliance' },
                        ]}
                        value="standard"
                        onChange={() => {}}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">Certificate Validity</label>
                      <Select
                        options={[
                          { label: 'Never Expires', value: 'never' },
                          { label: 'Valid for 1 Year', value: '1yr' },
                          { label: 'Valid for 2 Years', value: '2yr' },
                        ]}
                        value="never"
                        onChange={() => {}}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/40">
                    <div className="flex items-start gap-3 p-3">
                      <Checkbox id="recert" className="mt-0.5" />
                      <div className="flex flex-col">
                        <label htmlFor="recert" className="text-sm font-bold text-foreground cursor-pointer">Enable Re-certification Alerts</label>
                        <span className="text-xs text-muted-foreground">Automatically notify learners 30 days before certificate expiry.</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {activeStep === 5 && (
              <>
                <CardHeader className="pb-4 border-b border-border/40 px-6 pt-6">
                  <CardTitle className="text-lg font-bold">Publish Settings</CardTitle>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Define who can see this course and how they enroll.</p>
                </CardHeader>
                <CardContent className="p-6 flex flex-col flex-1 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2"><Globe className="size-4" /> Enrollment Rules</h3>
                    <RadioGroup value="open" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3 p-4 border border-border/60 rounded-lg bg-background">
                        <Radio value="open" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">Open Enrollment</span>
                          <span className="text-xs text-muted-foreground">Anyone in the target audience can join instantly.</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-4 border border-border/60 rounded-lg bg-background">
                        <Radio value="approval" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">Approval Required</span>
                          <span className="text-xs text-muted-foreground">Manager or Admin approval required to join.</span>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2"><Users className="size-4" /> Target Audience</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Restrict to Departments</label>
                        <Select options={[{label: 'All Departments', value: 'all'}]} value="all" onChange={()=>{}} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Restrict to Roles</label>
                        <Select options={[{label: 'All Roles', value: 'all'}]} value="all" onChange={()=>{}} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border/40">
                    <h3 className="text-sm font-bold flex items-center gap-2"><CalendarIcon className="size-4" /> Availability Dates</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Available From</label>
                        <Input type="date" className="h-9" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Available Until</label>
                        <Input type="date" className="h-9" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}
            
            {/* Unified Bottom Action Bar */}
            <div className="p-6 border-t border-border/40 bg-muted/10 rounded-b-xl flex items-center justify-between mt-auto">
              <Button 
                variant="outline" 
                className="px-6 font-bold shadow-sm" 
                disabled={activeStep === 1}
                onClick={handleBack}
              >
                Back
              </Button>
              <Button className="px-8 font-bold shadow-sm gap-2" onClick={handleNext}>
                {activeStep === steps.length ? 'Publish Course' : `Continue to ${steps[activeStep]?.label || 'Next Step'}`} <ChevronRight className="size-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Summary Panels */}
        <div className="w-full xl:w-[340px] shrink-0 flex flex-col gap-6">
          {/* Live Preview Card */}
          <Card className="rounded-xl border border-border/80 shadow-sm bg-card overflow-hidden">
            <CardHeader className="px-5 pt-5 pb-3 border-b border-border/40 bg-muted/10">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Search className="size-4" /> Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col gap-4">
              <div className="w-full aspect-[16/9] bg-muted/50 rounded-lg flex items-center justify-center border border-border/60 shadow-inner">
                <ImageIcon className="size-10 text-muted-foreground/30" />
              </div>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-black text-lg leading-snug text-foreground tracking-tight line-clamp-2">New Course Title</h3>
                <StatusBadge variant="default" className="text-[10px] uppercase font-black tracking-widest shrink-0 shadow-sm">
                  Draft
                </StatusBadge>
              </div>
              <div className="flex flex-col gap-2.5 text-sm mt-1 p-3 rounded-lg bg-muted/30 border border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Category</span>
                  <span className="font-bold text-foreground">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Level</span>
                  <span className="font-bold text-foreground">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Duration</span>
                  <span className="font-bold text-foreground">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Language</span>
                  <span className="font-bold text-foreground">--</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Module Counter Card */}
          <Card className="rounded-xl border border-border/80 shadow-sm bg-card">
            <CardHeader className="px-5 py-4 border-b border-border/40 bg-muted/10">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-2"><PackageOpen className="size-4" /> Modules</div>
                <span className="bg-background border border-border text-foreground size-6 flex items-center justify-center rounded-md text-xs font-black shadow-sm">0</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex flex-col items-center justify-center py-6 px-4 bg-background border border-dashed border-border/80 rounded-lg text-center">
                <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-3">
                  <PackageOpen className="size-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-bold text-foreground">No modules yet.</p>
                <p className="text-[11px] font-semibold text-muted-foreground mt-1 uppercase tracking-wider">Configure in Step 2</p>
              </div>
            </CardContent>
          </Card>

          {/* Checklist Card */}
          <Card className="rounded-xl border border-border/80 shadow-sm bg-card">
            <CardHeader className="px-5 py-4 border-b border-border/40 bg-muted/10">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4" /> Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col gap-3.5">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-start gap-3 group">
                  <div className="mt-0.5">
                    {item.completed ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-bold transition-colors",
                    item.completed ? "text-muted-foreground line-through opacity-70" : "text-foreground"
                  )}>
                    {item.label}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
