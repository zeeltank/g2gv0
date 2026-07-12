'use client'

import { lazy, Suspense, useState } from 'react'
import { Briefcase, CheckCircle2, Shield, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import { RadioGroup, Radio } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import type { Employee } from '@/types/employee'

const PersonalInfoTab = lazy(() =>
  import('@/components/org/edit-employee/personal-info-tab').then((m) => ({
    default: m.PersonalInfoTab,
  })),
)

const UploadDocTab = lazy(() =>
  import('@/components/org/edit-employee/upload-doc-tab').then((m) => ({
    default: m.UploadDocTab,
  })),
)

const JobroleSkillTab = lazy(() =>
  import('@/components/org/edit-employee/jobrole-skill-tab').then((m) => ({
    default: m.JobroleSkillTab,
  })),
)

const JobroleTasksTab = lazy(() =>
  import('@/components/org/edit-employee/jobrole-tasks-tab').then((m) => ({
    default: m.JobroleTasksTab,
  })),
)

const LorTab = lazy(() =>
  import('@/components/org/edit-employee/lor-tab').then((m) => ({
    default: m.LorTab,
  })),
)

const CompetencyRatingTab = lazy(() =>
  import('@/components/org/edit-employee/competency-rating-tab').then((m) => ({
    default: m.CompetencyRatingTab,
  })),
)

const ExpectedCompetencyTab = lazy(() =>
  import('@/components/org/edit-employee/expected-competency-tab').then((m) => ({
    default: m.ExpectedCompetencyTab,
  })),
)

const TOP_TABS = [
  { id: 'personal-info', label: 'Personal Information' },
  { id: 'upload-docs', label: 'Upload Document' },
  { id: 'jobrole-skill', label: 'Jobrole Skill' },
  { id: 'jobrole-tasks', label: 'Jobrole Tasks' },
  { id: 'responsibility', label: 'Level of Responsibility' },
  { id: 'skill-rating', label: 'Competency Rating' },
  { id: 'expected-competency', label: 'Expected Competency' },
] as const

type EmployeeDirectorySheetsProps = {
  isAddSheetOpen: boolean
  onAddSheetOpenChange: (open: boolean) => void
  activeEmployee: Employee | null
  onCloseEmployeeSheet: () => void
}

const tabFallback = (
  <div className="flex h-[420px] items-center justify-center rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground">
    Loading tab...
  </div>
)

function AddEmployeeSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [addStep, setAddStep] = useState(1)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-hidden border-l border-border/80 bg-card/95 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-xl">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-primary/5 via-transparent to-transparent" />

        <div className="relative z-10 border-b border-border/40 bg-surface/50 px-6 py-6">
          <SheetTitle className="text-xl">Onboard New Employee</SheetTitle>
          <SheetDescription className="mt-1">
            Step {addStep} of 5: {
              addStep === 1 ? 'Personal Details'
                : addStep === 2 ? 'Employment Structure'
                : addStep === 3 ? 'Address Information'
                : addStep === 4 ? 'Reporting & Deposit'
                : 'Attendance Setup'
            }
          </SheetDescription>

          <div className="mt-6 flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div className={cn(
                  'flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                  addStep === step ? 'scale-110 bg-primary text-primary-foreground shadow-md'
                    : addStep > step ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground',
                )}>
                  {addStep > step ? <CheckCircle2 className="size-4" /> : step}
                </div>
                {step < 5 && (
                  <div className={cn(
                    'h-1 flex-1 rounded-full transition-all duration-300',
                    addStep > step ? 'bg-primary/30' : 'bg-muted',
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="g2g-scrollbar relative z-10 flex-1 overflow-y-auto px-6 py-8">
          {addStep === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-300">
              <div className="mb-2 flex items-center gap-3 text-primary">
                <User className="size-5" />
                <h3 className="text-lg font-semibold">Personal Identity</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Suffix</Label>
                  <Select options={[{ label: 'Mr.', value: 'Mr.' }, { label: 'Ms.', value: 'Ms.' }, { label: 'Dr.', value: 'Dr.' }]} placeholder="Mr. / Ms. / Dr." />
                </div>
                <div className="space-y-2">
                  <Label required className="text-xs uppercase text-muted-foreground">First Name</Label>
                  <Input placeholder="First Name" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Middle Name</Label>
                  <Input placeholder="Middle Name" />
                </div>
                <div className="space-y-2">
                  <Label required className="text-xs uppercase text-muted-foreground">Last Name</Label>
                  <Input placeholder="Last Name" />
                </div>
                <div className="space-y-2">
                  <Label required className="text-xs uppercase text-muted-foreground">Email</Label>
                  <Input type="email" placeholder="example@domain.com" />
                </div>
                <div className="space-y-2">
                  <Label required className="text-xs uppercase text-muted-foreground">Password</Label>
                  <Input type="password" placeholder="Password" />
                </div>
                <div className="space-y-2">
                  <Label required className="text-xs uppercase text-muted-foreground">Mobile</Label>
                  <Input placeholder="Mobile Number" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Birthdate</Label>
                  <DatePicker />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Gender</Label>
                  <RadioGroup className="flex flex-row gap-4 pt-2" value="Male">
                    <Radio value="Male" label="Male" />
                    <Radio value="Female" label="Female" />
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">User Image</Label>
                  <Input type="file" className="py-1 text-xs" />
                </div>
              </div>
            </div>
          )}

          {addStep === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-300">
              <div className="mb-2 flex items-center gap-3 text-primary">
                <Briefcase className="size-5" />
                <h3 className="text-lg font-semibold">Employment Structure</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label required className="text-xs uppercase text-muted-foreground">Department</Label>
                  <Select options={[{ label: 'Administrative Support', value: 'Administrative Support' }]} placeholder="Select Department" />
                </div>
                <div className="space-y-2">
                  <Label required className="text-xs uppercase text-muted-foreground">Job Role</Label>
                  <Select options={[{ label: 'Select Job Role', value: '' }]} placeholder="Select Job Role" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Responsibility Level</Label>
                  <Select options={[{ label: '1', value: '1' }]} placeholder="Select Level" />
                </div>
                <div className="space-y-2">
                  <Label required className="text-xs uppercase text-muted-foreground">User Profile</Label>
                  <Select options={[{ label: 'Admin', value: 'Admin' }]} placeholder="Select Profile" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Joining Year</Label>
                  <Input placeholder="YYYY" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Status</Label>
                  <Select options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} placeholder="Active" />
                </div>
              </div>
            </div>
          )}

          {addStep === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-300">
              <div className="mb-2 flex items-center gap-3 text-primary">
                <Shield className="size-5" />
                <h3 className="text-lg font-semibold">Address Information</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Address</Label>
                  <Input placeholder="Enter Address" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Temporary Address</Label>
                  <Input placeholder="Enter Temporary Address" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">City</Label>
                  <Input placeholder="Enter City" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">State</Label>
                  <Input placeholder="Enter State" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Pincode</Label>
                  <Input placeholder="Enter Pincode" />
                </div>
              </div>
            </div>
          )}

          {addStep === 4 && (
            <div className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-300">
              <div className="mb-2 flex items-center gap-3 text-primary">
                <Briefcase className="size-5" />
                <h3 className="text-lg font-semibold">Reporting & Deposit</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-primary">Reporting Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Supervisor / Subordinate</Label>
                      <Select options={[{ label: 'Supervisor', value: 'Supervisor' }, { label: 'Subordinate', value: 'Subordinate' }]} placeholder="Select" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Employee Name</Label>
                      <Select options={[{ label: 'kalpesh . sheth', value: 'kalpesh' }]} placeholder="Select Employee" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Reporting Method</Label>
                      <Select options={[{ label: 'Direct', value: 'Direct' }, { label: 'Indirect', value: 'Indirect' }]} placeholder="Select Method" />
                    </div>
                  </div>
                </div>
                <div className="border-t border-border/40 pt-4">
                  <h4 className="mb-3 text-sm font-semibold text-primary">Deposit Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Bank Name</Label>
                      <Input placeholder="Enter Bank Name" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Branch Name</Label>
                      <Input placeholder="Enter Branch Name" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Account Number</Label>
                      <Input placeholder="Enter Account Number" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">IFSC Code</Label>
                      <Input placeholder="Enter IFSC Code" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Amount</Label>
                      <Input placeholder="Enter Amount" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-muted-foreground">Transfer Type</Label>
                      <Select options={[{ label: 'Select Type', value: '' }]} placeholder="Select Type" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {addStep === 5 && (
            <div className="animate-in fade-in slide-in-from-right-4 space-y-6 duration-300">
              <div className="mb-2 flex items-center gap-3 text-primary">
                <Shield className="size-5" />
                <h3 className="text-lg font-semibold">Attendance Setup</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Working Days</Label>
                  <div className="flex flex-wrap gap-4">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <label key={day} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <Checkbox defaultChecked /> {day}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-x-6 gap-y-3 rounded-xl border border-border/40 bg-surface-muted/30 p-4">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Day</div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">In Time</div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground">Out Time</div>

                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                    <div key={day} className="contents">
                      <div className="flex items-center text-sm font-medium text-foreground">{day}</div>
                      <TimePicker value="09:00" />
                      <TimePicker value="18:00" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-border/40 bg-surface/50 p-6">
          <Button variant="ghost" onClick={() => (addStep > 1 ? setAddStep(addStep - 1) : onOpenChange(false))} className="cursor-pointer">
            {addStep > 1 ? 'Back' : 'Cancel'}
          </Button>
          {addStep < 5 ? (
            <Button onClick={() => setAddStep(addStep + 1)} className="cursor-pointer rounded-md px-6 shadow-sm">
              Next
            </Button>
          ) : (
            <Button onClick={() => onOpenChange(false)} className="cursor-pointer rounded-md px-6 shadow-sm">
              Finish
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function EmployeeOverviewSheet({
  employee,
  open,
  onOpenChange,
}: {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [activeTopTab, setActiveTopTab] = useState<(typeof TOP_TABS)[number]['id']>('personal-info')

  const tabFallback = (
    <div className="flex h-[420px] items-center justify-center rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground">
      Loading tab...
    </div>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-[95vw] flex-col gap-0 border-l border-border/80 p-0 sm:max-w-4xl">
        <div className="flex h-full flex-col bg-background">
          <div className="flex items-center justify-between border-b bg-surface px-6 py-5">
            <div className="flex items-center gap-4">
              {employee.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- External URLs may not work with next/image
                <img src={employee.image} alt={employee.full_name} className="size-14 rounded-full border-2 border-background object-cover shadow-sm" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-primary shadow-sm">
                  <User className="size-6" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-foreground">{employee.full_name}</h2>
                <p className="text-sm font-medium text-muted-foreground">{employee.jobRole}</p>
              </div>
            </div>
          </div>

          <div className="scrollbar-hide overflow-x-auto border-b bg-surface-muted/30 px-6">
            <div className="flex space-x-1 py-2">
              {TOP_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTopTab(tab.id)}
                  className={cn(
                    'cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95',
                    activeTopTab === tab.id
                      ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div key={activeTopTab} className="animate-in fade-in slide-in-from-bottom-2 flex-1 overflow-hidden bg-surface p-6 duration-300">
            {activeTopTab === 'personal-info' && (
              <Suspense fallback={tabFallback}>
                <PersonalInfoTab employee={employee} departments={[]} jobRoles={[]} onSave={() => {}} />
              </Suspense>
            )}
            {activeTopTab === 'upload-docs' && (
              <Suspense fallback={tabFallback}>
                <UploadDocTab
                  employee={employee}
                  documentTypes={[
                    { id: 1, document_type: 'Resume' },
                    { id: 2, document_type: 'Offer Letter' },
                    { id: 3, document_type: 'ID Proof' },
                    { id: 4, document_type: 'Address Proof' },
                  ]}
                  documentLists={[]}
                />
              </Suspense>
            )}
            {activeTopTab === 'jobrole-skill' && (
              <Suspense fallback={tabFallback}>
                <JobroleSkillTab
                  employee={employee}
                  skills={[
                    {
                      skill_id: 1,
                      skill: 'Web Application Development',
                      knowledge: ['Understands React lifecycle', 'Familiar with state management (Redux/Zustand)', 'Understands REST APIs'],
                      ability: ['Can build responsive UI', 'Can integrate APIs effectively'],
                      attitude: ['Proactive problem solver', 'Eager to learn new technologies'],
                      behaviour: ['Collaborates well with backend engineers', 'Writes clean, self-documenting code'],
                    },
                    {
                      skill_id: 2,
                      skill: 'Database Design',
                      knowledge: ['Understands Normalization', 'Knows SQL indexing'],
                      ability: ['Can write complex joins', 'Can optimize slow queries'],
                      attitude: ['Detail-oriented with data structures'],
                      behaviour: ['Communicates schema changes clearly'],
                    },
                  ]}
                />
              </Suspense>
            )}
            {activeTopTab === 'jobrole-tasks' && (
              <Suspense fallback={tabFallback}>
                <JobroleTasksTab
                  tasks={[
                    { id: 1, critical_work_function: 'System Architecture', task: 'Design scalable backend systems to support high concurrency.' },
                    { id: 2, critical_work_function: 'System Architecture', task: 'Ensure high availability and fault tolerance in database clusters.' },
                    { id: 3, critical_work_function: 'Frontend Development', task: 'Develop modern, responsive user interfaces using React and Tailwind CSS.' },
                    { id: 4, critical_work_function: 'Frontend Development', task: 'Implement accessibility standards (WCAG) across all web applications.' },
                    { id: 5, critical_work_function: 'Code Quality & Testing', task: 'Write comprehensive unit and integration tests for critical business logic.' },
                  ]}
                />
              </Suspense>
            )}
            {activeTopTab === 'responsibility' && (
              <Suspense fallback={tabFallback}>
                <LorTab
                  data={{
                    level: '5',
                    guiding_phrase: 'Ensure, advise',
                    essence_level: 'Works under broad direction. Work is often self-initiated. Is fully responsible for meeting allocated technical and/or project/supervisory objectives. Establishes milestones and has a significant role in the assignment of tasks and/or responsibilities.',
                    guidance_note: 'Performs an extensive range and variety of complex technical and/or professional work activities. Undertakes work which requires the application of fundamental principles in a wide and often unpredictable range of contexts. Understands the relationship between own specialism and wider customer/organisational requirements.',
                    Attributes: {
                      Autonomy: { attribute_name: 'Autonomy', attribute_overall_description: 'Works under broad direction. Work is often self-initiated. Is fully responsible for meeting allocated technical and/or project/supervisory objectives.' },
                      Influence: { attribute_name: 'Influence', attribute_overall_description: 'Influences organisation, customers, suppliers, partners and peers on the contribution of own specialism. Builds appropriate and effective business relationships.' },
                      Complexity: { attribute_name: 'Complexity', attribute_overall_description: 'Performs an extensive range and variety of complex technical and/or professional work activities. Undertakes work which requires the application of fundamental principles.' },
                    },
                    Business_skills: {
                      Communication: { attribute_name: 'Communication', attribute_overall_description: 'Demonstrates leadership. Facilitates collaboration between stakeholders who have diverse objectives.' },
                      'Problem Solving': { attribute_name: 'Problem Solving', attribute_overall_description: 'Analyses requirements and advises on scope and options for continuous operational improvement. Demonstrates creativity, innovation and ethical thinking.' },
                    },
                  }}
                />
              </Suspense>
            )}
            {activeTopTab === 'skill-rating' && (
              <Suspense fallback={tabFallback}>
                <CompetencyRatingTab
                  data={{
                    Skill: [
                      { id: 's1', title: 'React Development', description: 'Ability to build responsive and performant user interfaces using React hooks, context, and state management libraries.', current_level: null, max_level: 5 },
                      { id: 's2', title: 'API Integration', description: 'Proficiency in consuming RESTful APIs, handling error states, and managing asynchronous data fetching.', current_level: 3, max_level: 5 },
                      { id: 's3', title: 'System Design', description: 'Ability to design scalable architecture for front-end and back-end services.', current_level: null, max_level: 5 },
                    ],
                    Knowledge: [
                      { id: 'k1', title: 'Web Accessibility (WCAG)', description: 'Understanding of ARIA roles, semantic HTML, and accessibility guidelines.', current_level: 4, max_level: 5 },
                      { id: 'k2', title: 'Security Best Practices', description: 'Knowledge of XSS, CSRF, and how to mitigate common web vulnerabilities.', current_level: null, max_level: 5 },
                    ],
                    Ability: [
                      { id: 'a1', title: 'Problem Solving', description: 'Ability to debug complex production issues and find root causes efficiently.', current_level: 5, max_level: 5 },
                    ],
                    Attitude: [
                      { id: 'at1', title: 'Continuous Learning', description: 'Proactively seeks to learn new technologies and methodologies.', current_level: null, max_level: 5 },
                    ],
                    Behaviour: [
                      { id: 'b1', title: 'Team Collaboration', description: 'Works effectively with cross-functional teams, product managers, and designers.', current_level: 4, max_level: 5 },
                      { id: 'b2', title: 'Mentorship', description: 'Willingness to guide and mentor junior developers in the team.', current_level: null, max_level: 5 },
                    ],
                  }}
                />
              </Suspense>
            )}
            {activeTopTab === 'expected-competency' && (
              <Suspense fallback={tabFallback}>
                <ExpectedCompetencyTab
                  data={{
                    Skill: [
                      { id: 's1', title: 'React Development', description: 'Build responsive and performant user interfaces.', expectedLevel: 4, actualLevel: 4 },
                      { id: 's2', title: 'API Integration', description: 'Consume RESTful APIs and manage asynchronous data fetching.', expectedLevel: 4, actualLevel: 3 },
                      { id: 's3', title: 'System Design', description: 'Design scalable architecture for web services.', expectedLevel: 3, actualLevel: 4 },
                    ],
                    Knowledge: [
                      { id: 'k1', title: 'Web Accessibility (WCAG)', description: 'Understanding of ARIA roles and semantic HTML.', expectedLevel: 3, actualLevel: 3 },
                      { id: 'k2', title: 'Security Best Practices', description: 'Knowledge of XSS, CSRF mitigation.', expectedLevel: 4, actualLevel: 2 },
                    ],
                    Ability: [
                      { id: 'a1', title: 'Problem Solving', description: 'Debug complex production issues.', expectedLevel: 4, actualLevel: 5 },
                    ],
                    Attitude: [
                      { id: 'at1', title: 'Continuous Learning', description: 'Proactively seeks to learn new technologies.', expectedLevel: 5, actualLevel: 5 },
                    ],
                    Behaviour: [
                      { id: 'b1', title: 'Team Collaboration', description: 'Works effectively with cross-functional teams.', expectedLevel: 4, actualLevel: 4 },
                      { id: 'b2', title: 'Mentorship', description: 'Willingness to guide junior developers.', expectedLevel: 3, actualLevel: 2 },
                    ],
                  }}
                />
              </Suspense>
            )}
            {activeTopTab !== 'personal-info' && activeTopTab !== 'upload-docs' && activeTopTab !== 'jobrole-skill' && activeTopTab !== 'jobrole-tasks' && activeTopTab !== 'responsibility' && activeTopTab !== 'skill-rating' && activeTopTab !== 'expected-competency' && (
              <div className="flex h-full flex-col items-center justify-center space-y-4 text-muted-foreground">
                <div className="rounded-full bg-muted/50 p-4">
                  <Briefcase className="size-8 opacity-50" />
                </div>
                <p>The &quot;{TOP_TABS.find((t) => t.id === activeTopTab)?.label}&quot; tab is under construction.</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function EmployeeDirectorySheets({
  isAddSheetOpen,
  onAddSheetOpenChange,
  activeEmployee,
  onCloseEmployeeSheet,
}: EmployeeDirectorySheetsProps) {
  return (
    <>
      <AddEmployeeSheet key={isAddSheetOpen ? 'open' : 'closed'} open={isAddSheetOpen} onOpenChange={onAddSheetOpenChange} />
      {activeEmployee && (
        <EmployeeOverviewSheet
          key={activeEmployee.id}
          employee={activeEmployee}
          open={!!activeEmployee}
          onOpenChange={(open) => !open && onCloseEmployeeSheet()}
        />
      )}
    </>
  )
}
