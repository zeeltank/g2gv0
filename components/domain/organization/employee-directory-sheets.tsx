'use client'

import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import { Briefcase, CheckCircle2, Shield, User, Loader2 } from 'lucide-react'
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
import {
  fetchEmployeeProfile,
  updateEmployeeProfile,
  uploadEmployeeDocument,
  fetchCompetencyProfile,
  updateSkillRating,
  type EmployeeProfileFullResponse
} from '@/services/organization/employee-profile-service'

const PersonalInfoTab = lazy(() =>
  import('@/domain/organization/edit-employee/personal-info-tab').then((m) => ({
    default: m.PersonalInfoTab,
  })),
)

const UploadDocTab = lazy(() =>
  import('@/domain/organization/edit-employee/upload-doc-tab').then((m) => ({
    default: m.UploadDocTab,
  })),
)

const JobroleSkillTab = lazy(() =>
  import('@/domain/organization/edit-employee/jobrole-skill-tab').then((m) => ({
    default: m.JobroleSkillTab,
  })),
)

const JobroleTasksTab = lazy(() =>
  import('@/domain/organization/edit-employee/jobrole-tasks-tab').then((m) => ({
    default: m.JobroleTasksTab,
  })),
)

const LorTab = lazy(() =>
  import('@/domain/organization/edit-employee/lor-tab').then((m) => ({
    default: m.LorTab,
  })),
)

const CompetencyRatingTab = lazy(() =>
  import('@/domain/organization/edit-employee/competency-rating-tab').then((m) => ({
    default: m.CompetencyRatingTab,
  })),
)

const ExpectedCompetencyTab = lazy(() =>
  import('@/domain/organization/edit-employee/expected-competency-tab').then((m) => ({
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
    <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
    Loading tab content...
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
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {addStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input placeholder="e.g. Sarah" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input placeholder="e.g. Jenkins" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Corporate Email</Label>
                <Input type="email" placeholder="sarah.j@company.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input type="tel" placeholder="+1 (555) 000-0000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <RadioGroup defaultValue="M">
                    <Radio value="M" label="Male" />
                    <Radio value="F" label="Female" />
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <DatePicker />
                </div>
              </div>
            </div>
          )}

          {addStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select placeholder="Select Department" options={[{ label: 'Engineering', value: 'eng' }, { label: 'Product', value: 'prod' }]} />
              </div>
              <div className="space-y-2">
                <Label>Job Role / Designation</Label>
                <Select placeholder="Select Job Role" options={[{ label: 'Senior Full Stack Engineer', value: 'se' }, { label: 'Product Designer', value: 'pd' }]} />
              </div>
              <div className="space-y-2">
                <Label>Level of Responsibility (LOR)</Label>
                <Select placeholder="Select LOR Level" options={[{ label: 'Level 1 - Follow', value: 'l1' }, { label: 'Level 4 - Enable', value: 'l4' }, { label: 'Level 5 - Ensure/Advise', value: 'l5' }]} />
              </div>
              <div className="space-y-2">
                <Label>User Profile / Role</Label>
                <Select placeholder="Select User Profile" options={[{ label: 'Employee', value: 'emp' }, { label: 'Manager', value: 'mgr' }, { label: 'Admin', value: 'admin' }]} />
              </div>
            </div>
          )}

          {addStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Street Address</Label>
                <Input placeholder="123 Corporate Blvd, Suite 400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input placeholder="San Francisco" />
                </div>
                <div className="space-y-2">
                  <Label>State / Province</Label>
                  <Input placeholder="California" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pincode / Postal Code</Label>
                <Input placeholder="94105" />
              </div>
            </div>
          )}

          {addStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reporting Manager</Label>
                <Select placeholder="Select Reporting Manager" options={[{ label: 'Alex Mercer (CTO)', value: '1' }]} />
              </div>
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input placeholder="Silicon Valley Bank" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input placeholder="••••••••9842" />
                </div>
                <div className="space-y-2">
                  <Label>IFSC / Routing Code</Label>
                  <Input placeholder="SVBK0001234" />
                </div>
              </div>
            </div>
          )}

          {addStep === 5 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Working Days</Label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <label key={d} className="flex items-center gap-2 text-sm">
                      <Checkbox defaultChecked={d !== 'Sat'} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Default In-Time</Label>
                  <TimePicker value="09:00" />
                </div>
                <div className="space-y-2">
                  <Label>Default Out-Time</Label>
                  <TimePicker value="18:00" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-border/40 bg-surface/50 px-6 py-4">
          <Button
            variant="ghost"
            disabled={addStep === 1}
            onClick={() => setAddStep(s => Math.max(1, s - 1))}
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            {addStep < 5 ? (
              <Button onClick={() => setAddStep(s => Math.min(5, s + 1))}>
                Next Step
              </Button>
            ) : (
              <Button onClick={() => onOpenChange(false)} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Finish Onboarding
              </Button>
            )}
          </div>
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
  const [isLoading, setIsLoading] = useState(true)
  const [profileData, setProfileData] = useState<EmployeeProfileFullResponse | null>(null)
  const [competencyProfile, setCompetencyProfile] = useState<any | null>(null)

  const loadData = useCallback(async () => {
    if (!employee?.id) return
    setIsLoading(true)
    try {
      const [resProfile, resCompetency] = await Promise.allSettled([
        fetchEmployeeProfile(employee.id),
        fetchCompetencyProfile(employee.id),
      ])

      if (resProfile.status === 'fulfilled') {
        setProfileData(resProfile.value)
      }
      if (resCompetency.status === 'fulfilled') {
        setCompetencyProfile(resCompetency.value)
      }
    } catch (err) {
      console.error('Failed to fetch profile details:', err)
    } finally {
      setIsLoading(false)
    }
  }, [employee?.id])

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, loadData])

  const handleSavePersonalInfo = async (formData: any) => {
    if (!employee?.id) return
    await updateEmployeeProfile(employee.id, formData)
    await loadData()
  }

  const handleUploadDocument = async (formData: FormData) => {
    if (!employee?.id) return
    await uploadEmployeeDocument(employee.id, formData)
    await loadData()
  }

  const handleSaveRating = async (category: string, matrixId: string, level: number) => {
    if (!employee?.id) return
    await updateSkillRating(employee.id, matrixId, level)
    await loadData()
  }

  const mergedEmployee = {
    ...employee,
    ...(profileData?.data || {}),
    full_name: profileData?.data
      ? `${profileData.data.first_name || ''} ${profileData.data.last_name || ''}`.trim() || employee.full_name
      : employee.full_name,
    jobRole: profileData?.data?.userJobrole || employee.jobRole,
    department_name: profileData?.data?.userDepartment || employee.department_name,
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-[95vw] flex-col gap-0 border-l border-border/80 p-0 sm:max-w-4xl">
        <div className="flex h-full flex-col bg-background">
          <div className="flex items-center justify-between border-b bg-surface px-6 py-5">
            <div className="flex items-center gap-4">
              {mergedEmployee.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- External URLs may not work with next/image
                <img src={mergedEmployee.image} alt={mergedEmployee.full_name} className="size-14 rounded-full border-2 border-background object-cover shadow-sm" />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-primary shadow-sm">
                  <User className="size-6" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-foreground">{mergedEmployee.full_name}</h2>
                <p className="text-sm font-medium text-muted-foreground">{mergedEmployee.jobRole} {mergedEmployee.department_name ? `• ${mergedEmployee.department_name}` : ''}</p>
              </div>
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading live API data...
              </div>
            )}
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
                <PersonalInfoTab
                  employee={mergedEmployee}
                  departments={profileData?.departments || []}
                  jobRoles={profileData?.jobroleList || []}
                  userProfiles={profileData?.user_profiles || []}
                  employeesList={profileData?.employees || []}
                  onSave={handleSavePersonalInfo}
                />
              </Suspense>
            )}
            {activeTopTab === 'upload-docs' && (
              <Suspense fallback={tabFallback}>
                <UploadDocTab
                  employee={mergedEmployee}
                  documentTypes={profileData?.documentTypeLists || [
                    { id: 1, document_type: 'Resume' },
                    { id: 2, document_type: 'Offer Letter' },
                    { id: 3, document_type: 'ID Proof' },
                    { id: 4, document_type: 'Address Proof' },
                  ]}
                  documentLists={profileData?.documentLists || []}
                  onUpload={handleUploadDocument}
                />
              </Suspense>
            )}
            {activeTopTab === 'jobrole-skill' && (
              <Suspense fallback={tabFallback}>
                <JobroleSkillTab
                  employee={mergedEmployee}
                  skills={
                    (profileData?.jobroleSkills && profileData.jobroleSkills.length > 0)
                      ? profileData.jobroleSkills
                      : (profileData?.skills && profileData.skills.length > 0)
                      ? profileData.skills
                      : (profileData?.data?.jobroleSkills && profileData.data.jobroleSkills.length > 0)
                      ? profileData.data.jobroleSkills
                      : (profileData?.data?.skills && profileData.data.skills.length > 0)
                      ? profileData.data.skills
                      : []
                  }
                />
              </Suspense>
            )}
            {activeTopTab === 'jobrole-tasks' && (
              <Suspense fallback={tabFallback}>
                <JobroleTasksTab
                  tasks={
                    (profileData?.jobroleTasks && profileData.jobroleTasks.length > 0)
                      ? profileData.jobroleTasks
                      : [
                          { id: 1, critical_work_function: 'System Architecture', task: 'Design scalable backend systems to support high concurrency.' },
                          { id: 2, critical_work_function: 'System Architecture', task: 'Ensure high availability and fault tolerance in database clusters.' },
                          { id: 3, critical_work_function: 'Frontend Development', task: 'Develop modern, responsive user interfaces using React and Tailwind CSS.' },
                          { id: 4, critical_work_function: 'Frontend Development', task: 'Implement accessibility standards (WCAG) across all web applications.' },
                          { id: 5, critical_work_function: 'Code Quality & Testing', task: 'Write comprehensive unit and integration tests for critical business logic.' },
                        ]
                  }
                />
              </Suspense>
            )}
            {activeTopTab === 'responsibility' && (
              <Suspense fallback={tabFallback}>
                <LorTab
                  data={
                    profileData?.userLevelOfResponsibility && Object.keys(profileData.userLevelOfResponsibility).length > 0
                      ? profileData.userLevelOfResponsibility
                      : {
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
                        }
                  }
                />
              </Suspense>
            )}
            {activeTopTab === 'skill-rating' && (
              <Suspense fallback={tabFallback}>
                <CompetencyRatingTab
                  onSave={(category, id, level) => handleSaveRating(category, id, level)}
                  data={
                    competencyProfile?.currentSkills && competencyProfile.currentSkills.length > 0
                      ? {
                          Skill: competencyProfile.currentSkills.map((s: any) => ({
                            id: String(s.skill_id),
                            title: s.title,
                            description: s.description || s.title,
                            current_level: s.level || s.proficiency_level || 3,
                            max_level: 5,
                          })),
                          Knowledge: [],
                          Ability: [],
                          Attitude: [],
                          Behaviour: [],
                        }
                      : {
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
                        }
                  }
                />
              </Suspense>
            )}
            {activeTopTab === 'expected-competency' && (
              <Suspense fallback={tabFallback}>
                <ExpectedCompetencyTab
                  data={
                    competencyProfile?.requiredSkills && competencyProfile.requiredSkills.length > 0
                      ? {
                          Skill: competencyProfile.requiredSkills.map((s: any) => ({
                            id: String(s.skill_id || s.id),
                            title: s.skill || s.title,
                            description: s.description || s.skill || 'Required competency level',
                            expectedLevel: s.proficiency_level || 4,
                            actualLevel: s.current_level || 3,
                          })),
                          Knowledge: [],
                          Ability: [],
                          Attitude: [],
                          Behaviour: [],
                        }
                      : {
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
                        }
                  }
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
