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
  fetchKasbaRatings,
  type KasbaRatingResponse,
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

/**
 * Maps GET /competency/kasba-rating into the five buckets the tab renders.
 *
 * ── WHAT THIS REPLACED, AND WHY ────────────────────────────────────────────
 *
 * The previous mapper read /get-kaba, and had to guess at eight different key
 * names for a title and two payload shapes, because that endpoint walks
 * `s_library_map` — a NAME-keyed side table that is not the competency model.
 * This one reads the real chain, so every field has exactly one name:
 *
 *   jobrole_competency_map -> competency_kasba_item -> competency
 *
 * ── UNMEASURED IS NOT ZERO, AND NOT FIVE ───────────────────────────────────
 *
 * `rating` is null until somebody assesses this person, and it stays null
 * here. The old endpoint defaulted `proficiency_level` to "5", so an
 * unassessed competency rendered with all five dots filled — the worst
 * possible default, because it reads as a completed assessment.
 *
 * `required_proficiency` is what the ROLE asks for and is kept separate. It is
 * never rendered as a score.
 */
function mapCompetencyChain(response: KasbaRatingResponse | null): CompetencyRatings {
  const ratings: CompetencyRatings = {
    Skill: [], Knowledge: [], Ability: [], Attitude: [], Behaviour: [],
  }

  const items = response?.data?.items ?? []
  const maxLevel = numericRating(response?.rating_range?.max) ?? 5

  for (const item of items) {
    if (!item) continue

    const category = competencyCategory(item.kasba_type)

    /*
     * A missing title is NAMED, not blanked.
     *
     * `title_missing` means the item points at a library row that no longer
     * exists — one such row on live, a behaviour item holding an id from the
     * skill library's id-space. KASBA is five separate id-spaces, so an id
     * from the wrong one resolves to nothing. Printing an empty cell would
     * hide a data fault that somebody has to fix; printing the id shows them
     * where to look.
     */
    const title = item.title
      ?? (item.title_missing
        ? `Missing ${item.kasba_type} item #${item.item_id}`
        : item.item_label)

    ratings[category].push({
      id: String(item.kasba_item_id),
      title: title ? String(title) : `Item #${item.kasba_item_id}`,
      // The competency this item belongs to is the useful context here: the
      // tab groups by dimension, so without it there is nothing on screen
      // saying WHY the item is being asked for.
      description: item.competency_name
        ? `Required by ${item.competency_name}${item.is_mandatory ? ' (mandatory)' : ''}`
        : '',
      current_level: numericRating(item.rating),
      required_level: numericRating(item.required_proficiency),
      max_level: maxLevel,
    })
  }

  return ratings
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
  /** The endpoint's own words for WHICH empty this is. Not reworded here. */
  const [kabaEmptyReason, setKabaEmptyReason] = useState<string | null>(null)

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

  /*
   * THE ROLE IS RESOLVED SERVER-SIDE NOW, so there is no jobRoleId here.
   *
   * This used to compute one in the browser by reading six possible fields off
   * the employee and, failing that, matching the role NAME against a list. The
   * endpoint resolves it from `jobtitle_id` with a fallback to the legacy text
   * column, inside the tenant, in one place - so the client guessing at it was
   * a second answer to a question that already had one.
   *
   * It also means "this person has no job role" is now reported BY the endpoint
   * rather than inferred from a failed lookup, which is why the not-mapped card
   * below prints the server's own reason.
   */
  const loadKaba = useCallback(async () => {
    if (!employee?.id) {
      setKabaRatings(EMPTY_COMPETENCY_RATINGS)
      setHasLoadedKaba(true)
      return
    }

    setIsKabaLoading(true)
    setKabaError(null)
    setKabaNotMapped(false)
    setKabaEmptyReason(null)
    try {
      const response = await fetchKasbaRatings(employee.id, getLaravelContext())
      setKabaRatings(mapCompetencyChain(response))

      // AN EXPECTED EMPTY IS NOT AN ERROR. The endpoint distinguishes "no job
      // role" from "role has no competencies mapped" and says which; both are
      // ordinary states for a new organisation, and neither deserves a Retry
      // button or a status code.
      if (response?.empty_is_expected) {
        setKabaNotMapped(true)
        setKabaEmptyReason(response.empty_reason ?? null)
      }
      setHasLoadedKaba(true)
    } catch (error) {
      setKabaRatings(EMPTY_COMPETENCY_RATINGS)
      setKabaError(error instanceof Error ? error.message : 'Unable to load competency data.')
      setHasLoadedKaba(true)
    } finally {
      setIsKabaLoading(false)
    }
  }, [employee?.id])

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
                   * Not an error card, and not one message either.
                   *
                   * There are TWO ordinary empties here and they need different
                   * fixes: the employee has no job role, or the role has no
                   * competencies mapped to it. The endpoint knows which and
                   * says so in `empty_reason`, so this prints the server's
                   * words rather than asserting the second one every time -
                   * which is what it used to do, sending people to map a role
                   * the employee did not have.
                   */
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-6 text-center">
                    <Briefcase className="size-8 text-muted-foreground opacity-50" aria-hidden="true" />
                    <p className="text-sm font-medium text-foreground">
                      {kabaEmptyReason ?? 'There is nothing to rate for this employee yet.'}
                    </p>
                    <p className="max-w-md text-xs text-muted-foreground">
                      {mergedEmployee.jobRole
                        ? `Nothing has been mapped for "${mergedEmployee.jobRole}", so this tab has nothing to show.`
                        : 'Once a role is assigned and competencies are attached to it, they appear here.'}
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
