'use client'

import { lazy, Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { Briefcase, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Employee } from '@/types/employee'
import {
  fetchEmployeeProfile,
  uploadEmployeeDocument,
  fetchCompetencyProfile,
  fetchJobRoleKaba,
  JobRoleNotMappedError,
  type EmployeeProfileFullResponse
} from '@/services/organization/employee-profile-service'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  employeeDirectoryService,
  type ReferenceData,
} from '@/services/organization/employee-directory'
import { rateKasbaItem, saveSkillConfirmations } from '@/services/competency/kasba-rating-by-item'
import { AddEmployeeSheet } from './employee-directory-parts/add-employee-sheet'
import { useRouter } from 'next/navigation'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { CAPABILITY_LIBRARY_ACCESS_LINK } from '@/lib/gtg-navigation'

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
  /** Departments, job roles, profiles, LOR levels and managers, loaded once by the list. */
  referenceData: ReferenceData | null
  /** Called after any write, so the list behind the drawer reflects it. */
  onEmployeeChanged: (message?: string) => void | Promise<void>
}

type CompetencyCategory = 'Skill' | 'Knowledge' | 'Ability' | 'Attitude' | 'Behaviour'
type CompetencyRatings = Record<CompetencyCategory, Array<{
  id: string
  title: string
  description: string
  /** What this person was assessed at. Null means nobody has assessed them. */
  current_level: number | null
  /** What the ROLE asks for. Not a rating, and never rendered as one. */
  required_level: number | null
  max_level: number
}>>

const EMPTY_COMPETENCY_RATINGS: CompetencyRatings = {
  Skill: [], Knowledge: [], Ability: [], Attitude: [], Behaviour: [],
}

function competencyCategory(value: unknown): CompetencyCategory {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized.includes('knowledge')) return 'Knowledge'
  if (normalized.includes('ability')) return 'Ability'
  if (normalized.includes('attitude')) return 'Attitude'
  if (normalized.includes('behavio')) return 'Behaviour'
  return 'Skill'
}

function numericRating(value: unknown): number | null {
  const rating = Number(value)
  return Number.isFinite(rating) && rating >= 0 ? Math.min(5, rating) : null
}

/** Normalises the KABA response while accepting the API's object- or array-shaped payloads. */
function mapKabaRatings(payload: any): CompetencyRatings {
  const ratings: CompetencyRatings = {
    Skill: [], Knowledge: [], Ability: [], Attitude: [], Behaviour: [],
  }
  const source = Array.isArray(payload)
    ? payload
    : payload?.data ?? payload?.result ?? payload?.kaba ?? payload ?? []

  const groupedSource = !Array.isArray(source) && typeof source === 'object' ? source : null
  if (groupedSource) {
    for (const [categoryName, items] of Object.entries(groupedSource)) {
      if (!Array.isArray(items)) continue
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const title = item.competency ?? item.competency_name ?? item.title ?? item.name ?? item.skill ?? item.kaba ?? item.sub_category ?? item.category
        if (!title) continue
        const category = competencyCategory(categoryName)
        ratings[category].push({
          id: String(item.id ?? item.kaba_id ?? item.competency_id ?? `${category}-${title}`),
          title: String(title),
          description: String(item.description ?? item.competency_description ?? item.details ?? title),
          /*
           * proficiency_level is NOT this person's rating.
           *
           * It used to be third in this chain, and /get-kaba defaults it to
           * "5" (SkillMatrixController: `$item->proficiency_level ?? "5"`), so
           * every unassessed competency rendered with all five dots filled and
           * a "Lvl 5" badge. What it actually describes is what the ROLE
           * requires. It is kept, separately, as required_level.
           */
          current_level: numericRating(item.current_level ?? item.rating),
          required_level: numericRating(item.proficiency_level ?? item.required_level),
          max_level: numericRating(item.max_level ?? item.maximum_level) ?? 5,
        })
      }
    }
    return ratings
  }

  for (const item of source) {
    if (!item || typeof item !== 'object') continue
    const category = competencyCategory(item.category ?? item.competency_category ?? item.kaba_type ?? item.type)
    const title = item.competency ?? item.competency_name ?? item.title ?? item.name ?? item.skill ?? item.kaba ?? item.sub_category ?? item.category
    if (!title) continue
    ratings[category].push({
      id: String(item.id ?? item.kaba_id ?? item.competency_id ?? `${category}-${title}`),
      title: String(title),
      description: String(item.description ?? item.competency_description ?? item.details ?? title),
      // Same separation as the grouped branch above: proficiency_level is the
      // role's requirement, not this person's rating, and /get-kaba defaults
      // it to "5" when unset.
      current_level: numericRating(item.current_level ?? item.rating),
      required_level: numericRating(item.proficiency_level ?? item.required_level),
      max_level: numericRating(item.max_level ?? item.maximum_level) ?? 5,
    })
  }

  return ratings
}

function getJobRoleId(employee: Record<string, any>, profile: EmployeeProfileFullResponse | null) {
  const profileEmployee = profile?.data ?? {}
  const directId = profileEmployee.allocated_standards ?? profileEmployee.jobrole_id ?? profileEmployee.job_role_id ??
    profileEmployee.userJobroleId ?? employee.allocated_standards ?? employee.jobrole_id ?? employee.job_role_id
  if (directId !== undefined && directId !== null && String(directId).trim()) return String(directId)

  const roleName = profileEmployee.userJobrole ?? employee.jobRole ?? employee.designation
  const match = (profile?.jobroleList ?? []).find((role: any) =>
    String(role.jobrole ?? role.name ?? role.title ?? '').trim().toLowerCase() === String(roleName ?? '').trim().toLowerCase(),
  )
  const matchedId = match?.id ?? match?.jobrole_id ?? match?.value
  return matchedId !== undefined && matchedId !== null ? String(matchedId) : null
}

const tabFallback = (
  <div className="flex h-[420px] items-center justify-center rounded-xl border border-border bg-muted/20 text-sm text-muted-foreground">
    <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
    Loading tab content...
  </div>
)


function EmployeeOverviewSheet({
  employee,
  open,
  onOpenChange,
  referenceData,
  onEmployeeChanged,
}: {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
  referenceData: ReferenceData | null
  onEmployeeChanged: (message?: string) => void | Promise<void>
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()

  /** Where a job role gets its competencies attached. */
  const openCapabilityLibrary = () => router.push(resolveAccessLink(CAPABILITY_LIBRARY_ACCESS_LINK))

  const [activeTopTab, setActiveTopTab] = useState<(typeof TOP_TABS)[number]['id']>('personal-info')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [profileData, setProfileData] = useState<EmployeeProfileFullResponse | null>(null)
  const [competencyProfile, setCompetencyProfile] = useState<any | null>(null)
  const [kabaRatings, setKabaRatings] = useState<CompetencyRatings>(EMPTY_COMPETENCY_RATINGS)
  const [isKabaLoading, setIsKabaLoading] = useState(false)
  const [kabaError, setKabaError] = useState<string | null>(null)
  const [hasLoadedKaba, setHasLoadedKaba] = useState(false)
  const [kabaNotMapped, setKabaNotMapped] = useState(false)

  const loadData = useCallback(async () => {
    if (!employee?.id) return
    setIsLoading(true)
    setLoadError('')
    try {
      const [resProfile, resCompetency] = await Promise.allSettled([
        fetchEmployeeProfile(employee.id),
        fetchCompetencyProfile(employee.id),
      ])

      if (resProfile.status === 'fulfilled') {
        setProfileData(resProfile.value)
      } else {
        // allSettled used to swallow this into a console line, so a failed
        // profile load rendered an empty drawer that looked like a real
        // employee with nothing filled in.
        setLoadError(
          resProfile.reason instanceof Error
            ? resProfile.reason.message
            : 'Could not load this employee.',
        )
      }

      if (resCompetency.status === 'fulfilled') {
        setCompetencyProfile(resCompetency.value)
      }
    } finally {
      setIsLoading(false)
    }
  }, [employee?.id])

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open, loadData])

  const jobRoleId = useMemo(() => getJobRoleId(employee, profileData), [employee, profileData])

  const loadKaba = useCallback(async () => {
    if (!jobRoleId) {
      setKabaRatings(EMPTY_COMPETENCY_RATINGS)
      setKabaError('This employee does not have a Job Role ID assigned.')
      setHasLoadedKaba(true)
      return
    }

    setIsKabaLoading(true)
    setKabaError(null)
    setKabaNotMapped(false)
    try {
      const response = await fetchJobRoleKaba(jobRoleId, getLaravelContext())
      setKabaRatings(mapKabaRatings(response))
      setHasLoadedKaba(true)
    } catch (error) {
      setKabaRatings(EMPTY_COMPETENCY_RATINGS)
      // "Not mapped yet" is a different answer from "the request failed", and
      // only one of them is worth a Retry button.
      if (error instanceof JobRoleNotMappedError) {
        setKabaNotMapped(true)
        setKabaError(null)
      } else {
        setKabaError(error instanceof Error ? error.message : 'Unable to load competency data.')
      }
      setHasLoadedKaba(true)
    } finally {
      setIsKabaLoading(false)
    }
  }, [jobRoleId])

  useEffect(() => {
    if (open && activeTopTab === 'skill-rating' && !isLoading && !hasLoadedKaba) {
      loadKaba()
    }
  }, [activeTopTab, hasLoadedKaba, isLoading, loadKaba, open])

  const handleSavePersonalInfo = async (formData: any) => {
    if (!employee?.id) return

    /*
     * PUT /api/employees-management/{id}, not POST /user/add_user/{id}.
     *
     * The old target had no route at all: Route::resource binds POST only to
     * the collection, so the {id} form is PUT/PATCH and every save came back
     * 405. Neither this handler nor the tab had a catch, so the spinner
     * stopped, the button went back to "Save Changes", and the edit was gone.
     */
    setNotice('')
    try {
      const response = await employeeDirectoryService.update(context, employee.id, formData)
      await loadData()
      await onEmployeeChanged()
      setNotice(response?.message || 'Changes saved.')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not save the changes.')
      // Rethrown so the tab's own submit state resolves as a failure and it
      // does not present the form as saved.
      throw cause
    }
  }

  const handleUploadDocument = async (formData: FormData) => {
    if (!employee?.id) return
    setNotice('')
    try {
      await uploadEmployeeDocument(employee.id, formData)
      await loadData()
      setNotice('Document uploaded.')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'The document could not be uploaded.')
      throw cause
    }
  }

  /**
   * Save one KASBA rating.
   *
   * `category` is finally used: it is the dimension, and the dimension is half
   * the key - an item id means nothing without knowing which of the five
   * library tables it belongs to.
   */
  const handleSaveRating = async (category: string, itemId: string, level: number) => {
    if (!employee?.id) return

    const result = await rateKasbaItem(
      {
        userId: employee.id,
        kasbaType: category.toLowerCase() as any,
        itemId,
        rating: level,
      },
      context,
    )

    setNotice(result.notice || `Saved "${result.title}".`)
    return result
  }

  /**
   * Level of responsibility, saved onto tbluser.subject_ids.
   *
   * The tab was read-only because there was nothing to write to - and it
   * showed a fabricated Level 5 for anyone unassigned, so it looked settled.
   */
  const handleSaveLevel = async (levelId: string) => {
    if (!employee?.id) return
    setNotice('')
    try {
      await employeeDirectoryService.update(context, employee.id, { subject_ids: levelId })
      await loadData()
      await onEmployeeChanged()
      setNotice('Level of responsibility updated.')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Could not save the level.')
      throw cause
    }
  }

  /**
   * What has already been confirmed per skill, to seed the Jobrole Skill ticks.
   *
   * Read back out of the same s_skill_matrix row the tab writes: the four
   * columns hold JSON arrays of s_skill_knowledge_ability ids. Legacy rows
   * hold prose, which does not parse - those are treated as "nothing
   * confirmed" rather than being guessed at.
   */
  const savedSkillConfirmations = useMemo(() => {
    const parse = (value: unknown): number[] => {
      if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite)
      if (typeof value !== 'string' || value.trim() === '') return []
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : []
      } catch {
        return []
      }
    }

    const bySkill: Record<string, { knowledge: number[]; ability: number[]; attitude: number[]; behaviour: number[] }> = {}

    for (const row of (profileData?.userRatedSkills ?? []) as any[]) {
      const skillId = String(row.skill_id ?? row.id ?? '')
      if (!skillId) continue
      bySkill[skillId] = {
        knowledge: parse(row.knowledge),
        ability: parse(row.ability),
        attitude: parse(row.attitude),
        behaviour: parse(row.behaviour),
      }
    }

    return bySkill
  }, [profileData])

  const handleSaveSkillConfirmations = async (skillId: string | number, confirmed: any) => {
    if (!employee?.id) return
    await saveSkillConfirmations(employee.id, skillId, confirmed, context)
    await loadData()
  }

  /**
   * Expected vs actual, from data.competencies[].items[].
   *
   * Each item already carries `required`, `current` and `gap`, computed
   * server-side, so nothing is inferred here - the categories are the
   * controller's own grouping and the numbers are its own.
   */
  const expectedCompetency = useMemo(() => {
    const groups = competencyProfile?.data?.competencies
    const mapped: Record<string, Array<{ id: string; title: string; description: string; expectedLevel: number; actualLevel: number }>> = {
      Skill: [], Knowledge: [], Ability: [], Attitude: [], Behaviour: [],
    }

    const source = Array.isArray(groups) ? groups : Object.values(groups ?? {})

    for (const group of source as any[]) {
      const bucket = competencyCategory(group?.category)
      for (const item of group?.items ?? []) {
        mapped[bucket].push({
          id: String(item.skill_id ?? item.matrix_id ?? item.name),
          title: String(item.name ?? 'Untitled'),
          description: String(item.description || item.name || ''),
          expectedLevel: Number(item.required ?? 0),
          actualLevel: Number(item.current ?? 0),
        })
      }
    }

    return mapped
  }, [competencyProfile])

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

          {(notice || loadError) && (
            <div className="border-b border-border bg-surface px-6 py-2">
              {loadError && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-destructive">{loadError}</p>
                  <Button variant="outline" size="sm" onClick={() => void loadData()}>
                    Retry
                  </Button>
                </div>
              )}
              {notice && !loadError && <p className="text-sm text-muted-foreground">{notice}</p>}
            </div>
          )}

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
                {/*
                  * documentTypes is the real list only. Four invented types
                  * with ids 1-4 used to stand in when the API returned none,
                  * and those ids would have been posted as document_type_id,
                  * pointing at whatever happens to occupy them.
                  */}
                <UploadDocTab
                  employee={mergedEmployee}
                  documentTypes={profileData?.documentTypeLists ?? []}
                  documentLists={profileData?.documentLists || []}
                  onUpload={handleUploadDocument}
                />
              </Suspense>
            )}
            {activeTopTab === 'jobrole-skill' && (
              <Suspense fallback={tabFallback}>
                <JobroleSkillTab
                  employee={mergedEmployee}
                  savedSelections={savedSkillConfirmations}
                  onSave={handleSaveSkillConfirmations}
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
                {/*
                  * The real list, empty when it is empty.
                  *
                  * Five invented software-engineering tasks used to be
                  * substituted whenever the API returned none, so a
                  * receptionist was shown "Design scalable backend systems"
                  * and the tab's own honest empty state was unreachable.
                  */}
                <JobroleTasksTab tasks={profileData?.jobroleTasks ?? []} />
              </Suspense>
            )}
            {activeTopTab === 'responsibility' && (
              <Suspense fallback={tabFallback}>
                {/*
                  * No fallback. A full SFIA Level 5 record used to be
                  * substituted when the API had nothing, so every employee
                  * with no level assigned was displayed as "Level 5 - Ensure,
                  * advise": the most senior individual-contributor band in the
                  * framework, shown as though it had been assessed.
                  */}
                <LorTab
                  data={profileData?.userLevelOfResponsibility ?? null}
                  levels={referenceData?.levels_of_responsibility ?? []}
                  currentLevelId={(mergedEmployee as any).subject_ids ?? null}
                  canEdit
                  onSave={handleSaveLevel}
                />
              </Suspense>
            )}
            {activeTopTab === 'skill-rating' && (
              <Suspense fallback={tabFallback}>
                {kabaNotMapped ? (
                  /*
                   * Not an error card. The role simply has no s_library_map
                   * row, which on some tenants is true of every role - so the
                   * screen has to name the fix rather than show a status code.
                   */
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-6 text-center">
                    <Briefcase className="size-8 text-muted-foreground opacity-50" aria-hidden="true" />
                    <p className="text-sm font-medium text-foreground">
                      This job role is not mapped to a competency library yet.
                    </p>
                    <p className="max-w-md text-xs text-muted-foreground">
                      {mergedEmployee.jobRole
                        ? `"${mergedEmployee.jobRole}" has no competencies attached, so there is nothing to rate.`
                        : 'The role has no competencies attached, so there is nothing to rate.'}{' '}
                      Map it in Capability Library and this tab will fill in.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={openCapabilityLibrary}>
                        Open Capability Library
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void loadKaba()}>
                        Check again
                      </Button>
                    </div>
                  </div>
                ) : (
                  <CompetencyRatingTab
                    onSave={(category, id, level) => handleSaveRating(category, id, level)}
                    onSaved={loadKaba}
                    data={kabaRatings}
                    isLoading={isKabaLoading || !hasLoadedKaba}
                    error={kabaError}
                    onRetry={loadKaba}
                  />
                )}
              </Suspense>
            )}
            {activeTopTab === 'expected-competency' && (
              <Suspense fallback={tabFallback}>
                {/*
                  * Built from the response the API actually returns.
                  *
                  * The old condition tested `competencyProfile.requiredSkills`
                  * - a key that does not exist. $requiredSkills is a local PHP
                  * variable in EmployeeCompetencyProfileController and is never
                  * serialised, so the test could never be true and the
                  * hardcoded array below it rendered for EVERY employee. Its
                  * four KPI cards were computed from those literals, which is
                  * why Role Match read 67% for every person in the company.
                  *
                  * The real shape is data.competencies[].items[], which already
                  * carries name, required, current and gap per item.
                  */}
                <ExpectedCompetencyTab data={expectedCompetency} />
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
  referenceData,
  onEmployeeChanged,
}: EmployeeDirectorySheetsProps) {
  const context = useMemo(() => getLaravelContext(), [])

  return (
    <>
      <AddEmployeeSheet
        key={isAddSheetOpen ? 'open' : 'closed'}
        open={isAddSheetOpen}
        onOpenChange={onAddSheetOpenChange}
        context={context}
        referenceData={referenceData}
        onCreated={onEmployeeChanged}
      />
      {activeEmployee && (
        <EmployeeOverviewSheet
          key={activeEmployee.id}
          employee={activeEmployee}
          open={!!activeEmployee}
          onOpenChange={(open) => !open && onCloseEmployeeSheet()}
          referenceData={referenceData}
          onEmployeeChanged={onEmployeeChanged}
        />
      )}
    </>
  )
}
