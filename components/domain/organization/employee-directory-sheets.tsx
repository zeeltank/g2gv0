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
  fetchKasbaRatings,
  type KasbaRatingResponse,
  type KasbaRatingItem,
  type EmployeeProfileFullResponse
} from '@/services/organization/employee-profile-service'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  employeeDirectoryService,
  type ReferenceData,
} from '@/services/organization/employee-directory'
import { rateKasbaItem, saveSkillConfirmations, type KasbaType } from '@/services/competency/kasba-rating-by-item'
import { competencyGapService, type CompetencyGap } from '@/services/competency/gap'
import {
  taskReadinessService,
  type TaskReadinessRow,
  type TaskReadinessCounts,
} from '@/services/competency/task-readiness'
import { kasbaRatingService } from '@/services/competency/kasba-rating'
import { AddEmployeeSheet } from './employee-directory-parts/add-employee-sheet'
import { useRouter } from 'next/navigation'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { useAuth } from '@/hooks/use-auth'
import { CAPABILITY_LIBRARY_ACCESS_LINK, COMPETENCY_LIBRARY_ACCESS_LINK } from '@/lib/gtg-navigation'

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

const CompetencyAssessmentTab = lazy(() =>
  import('@/domain/organization/edit-employee/competency-assessment-tab').then((m) => ({
    default: m.CompetencyAssessmentTab,
  })),
)

const TOP_TABS = [
  { id: 'personal-info', label: 'Personal Information' },
  { id: 'upload-docs', label: 'Upload Document' },
  { id: 'jobrole-skill', label: 'Jobrole Skill' },
  { id: 'jobrole-tasks', label: 'Jobrole Tasks' },
  { id: 'responsibility', label: 'Level of Responsibility' },
  /*
   * ONE COMPETENCY TAB, NOT TWO.
   *
   * "Competency Rating" was built from /competency/kasba-rating and "Expected
   * Competency" from EmployeeCompetencyProfileController - two different
   * controllers answering the same question, side by side, neither of them the
   * gap engine. That is why they never agreed.
   */
  { id: 'competency', label: 'Competency' },
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
  // Role only gates what is RENDERED; the server gates what is allowed.
  const { user } = useAuth()

  /** Where a job role gets its competencies attached. */
  const openCapabilityLibrary = () => router.push(resolveAccessLink(CAPABILITY_LIBRARY_ACCESS_LINK))

  const [activeTopTab, setActiveTopTab] = useState<(typeof TOP_TABS)[number]['id']>('personal-info')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState('')
  const [profileData, setProfileData] = useState<EmployeeProfileFullResponse | null>(null)
  const [isKabaLoading, setIsKabaLoading] = useState(false)
  const [kabaError, setKabaError] = useState<string | null>(null)
  const [hasLoadedKaba, setHasLoadedKaba] = useState(false)
  /* The RAW items, kept alongside the dimension-grouped view. The new tab
     groups them by competency instead, which is the direction the model runs. */
  const [kabaItems, setKabaItems] = useState<KasbaRatingItem[]>([])
  const [kabaRange, setKabaRange] = useState<{ min: number; max: number }>({ min: 1, max: 5 })
  /* The rolled-up level, state and coverage per competency - computed by
     ProficiencyService on the server and never recomputed here. */
  const [gapData, setGapData] = useState<CompetencyGap | null>(null)
  const [kabaNotMapped, setKabaNotMapped] = useState(false)
  /** The endpoint's own words for WHICH empty this is. Not reworded here. */
  const [kabaEmptyReason, setKabaEmptyReason] = useState<string | null>(null)

  /*
   * TASK READINESS — the Jobrole Tasks tab's second dimension.
   *
   * Loaded ON ITS OWN TAB, like the competency data, rather than with the
   * profile: a drawer opened to read a phone number should not pay for a
   * readiness computation nobody asked for.
   *
   * Kept in its own state and NOT merged into `profileData.jobroleTasks`,
   * because the two have different failure modes. The task list failing means
   * the tab has nothing to show; readiness failing means the tab shows tasks
   * without verdicts, which is still useful. Merged, one failure would look
   * like the other.
   */
  const [readiness, setReadiness] = useState<Map<number, TaskReadinessRow> | undefined>(undefined)
  const [readinessCounts, setReadinessCounts] = useState<TaskReadinessCounts | null>(null)
  const [readinessNote, setReadinessNote] = useState<string | null>(null)
  const [readinessError, setReadinessError] = useState<string | null>(null)
  const [isReadinessLoading, setIsReadinessLoading] = useState(false)
  const [hasLoadedReadiness, setHasLoadedReadiness] = useState(false)

  const loadReadiness = useCallback(async () => {
    if (!employee?.id) return
    setIsReadinessLoading(true)
    setReadinessError(null)
    try {
      const res = await taskReadinessService.forEmployee(getLaravelContext(), Number(employee.id))
      setReadiness(new Map((res.data?.tasks ?? []).map((t) => [t.user_jobrole_task_id, t])))
      setReadinessCounts(res.counts ?? null)
      setReadinessNote(res.note ?? null)
    } catch (error) {
      /*
       * A REFUSAL IS NOT AN EMPTY RESULT. The endpoint returns 422 for an
       * employee with no job role and 403 for a caller without the rights, and
       * both are things the tab should say rather than render as "no tasks
       * needing readiness". `readiness` stays undefined so every task renders
       * without a verdict instead of picking one up by default.
       */
      setReadiness(undefined)
      setReadinessCounts(null)
      setReadinessError(error instanceof Error ? error.message : 'Unable to load task readiness.')
    } finally {
      setIsReadinessLoading(false)
      setHasLoadedReadiness(true)
    }
  }, [employee?.id])

  const loadData = useCallback(async () => {
    if (!employee?.id) return
    setIsLoading(true)
    setLoadError('')
    try {
      /*
       * ONE PROFILE CALL, NOT TWO.
       *
       * `fetchCompetencyProfile` (EmployeeCompetencyProfileController) was the
       * second competency opinion in this drawer - a different controller
       * answering the same question as /competency/kasba-rating, and neither of
       * them the gap engine. The Competency tab now reads the gap engine, so
       * this call has no consumer and is gone rather than left fetching data
       * nothing renders.
       */
      const [resProfile] = await Promise.allSettled([
        fetchEmployeeProfile(employee.id),
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
      setKabaItems([])
      setGapData(null)
      setHasLoadedKaba(true)
      return
    }

    setIsKabaLoading(true)
    setKabaError(null)
    setKabaNotMapped(false)
    setKabaEmptyReason(null)
    try {
      const response = await fetchKasbaRatings(employee.id, getLaravelContext())
      setKabaItems(response?.data?.items ?? [])
      setKabaRange(response?.rating_range ?? { min: 1, max: 5 })

      /*
       * The gap is a SEPARATE call on purpose.
       *
       * Averaging the item ratings here would be four lines and would be a
       * second implementation of ProficiencyService::rollUp - the weighted
       * average that EXCLUDES unmeasured items rather than scoring them zero.
       * Two numbers that disagree are worse than one that is wrong, because
       * nobody knows which to trust. So the server computes it.
       *
       * A failure here does not fail the tab: the items still render, the
       * rolled-up column simply says nothing rather than guessing.
       */
      try {
        const gapRes = await competencyGapService.mine(getLaravelContext(), Number(employee.id))
        setGapData(gapRes?.data ?? null)
      } catch {
        setGapData(null)
      }

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
      setKabaItems([])
      setGapData(null)
      setKabaError(error instanceof Error ? error.message : 'Unable to load competency data.')
      setHasLoadedKaba(true)
    } finally {
      setIsKabaLoading(false)
    }
  }, [employee?.id])

  useEffect(() => {
    if (open && activeTopTab === 'competency' && !isLoading && !hasLoadedKaba) {
      loadKaba()
    }
  }, [activeTopTab, hasLoadedKaba, isLoading, loadKaba, open])

  useEffect(() => {
    if (open && activeTopTab === 'jobrole-tasks' && !isLoading && !hasLoadedReadiness) {
      loadReadiness()
    }
  }, [activeTopTab, hasLoadedReadiness, isLoading, loadReadiness, open])

  /*
   * A DIFFERENT EMPLOYEE MUST NOT INHERIT THE LAST ONE'S VERDICTS.
   *
   * The drawer is reused across rows, so without this the readiness of whoever
   * was open before stays on screen until the new fetch lands - showing one
   * person's "not cleared" against another person's tasks. Cleared on identity
   * change rather than on close, because the sheet can switch employees while
   * it is open.
   */
  useEffect(() => {
    setReadiness(undefined)
    setReadinessCounts(null)
    setReadinessNote(null)
    setReadinessError(null)
    setHasLoadedReadiness(false)
  }, [employee?.id])

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
  /**
   * Rate one KASBA atom for this employee.
   *
   * TWO PATHS, AND THE ITEM DECIDES WHICH.
   *
   * A resolved atom (`item_id` set) is written by (kasba_type, item_id) so the
   * rating counts in EVERY competency that bundles it - knowing "Anatomy of the
   * airway" is one fact about a person, not three different facts. Writing by
   * `kasba_item_id` would let the same atom hold different scores in different
   * competencies, which cannot be true.
   *
   * A held label (`item_id` null) resolves to no library row, so it is only
   * addressable by its bundle-entry id.
   */
  const handleSaveCompetencyRating = async (item: KasbaRatingItem, rating: number, note?: string) => {
    if (!employee?.id) return

    const label = item.title ?? item.item_label ?? 'item'

    /*
     * THE NOTE MUST BE RE-SENT, NOT OMITTED.
     *
     * My first version omitted `note` when none was passed, on the assumption
     * that the server would leave the stored one alone. It does the opposite:
     * both write paths put `note` inside the `updateOrInsert` VALUES, so a
     * request without it writes NULL. Proved by running it — save a note, then
     * click a rating number, and the note is gone.
     *
     * So the three cases are made explicit:
     *   note === undefined  -> a rating click: carry the existing note through
     *   note is non-empty   -> the user wrote one: send it
     *   note is ''          -> the user cleared it: send nothing, server NULLs
     */
    const withNote = note === undefined
      ? (item.note ? { note: item.note } : {})
      : (note.length > 0 ? { note } : {})

    if (item.item_id != null) {
      const result = await rateKasbaItem(
        {
          userId: employee.id,
          kasbaType: item.kasba_type.toLowerCase() as KasbaType,
          itemId: item.item_id,
          rating,
          ...withNote,
        },
        context,
      )
      setNotice(result.notice || `Saved "${result.title}".`)
    } else {
      await kasbaRatingService.save(
        {
          user_id: Number(employee.id),
          kasba_item_id: item.kasba_item_id,
          rating,
          ...withNote,
        },
        context,
      )
      setNotice(`Saved "${label}".`)
    }

    // Re-read so the roll-up and gap reflect the new rating.
    await loadKaba()
  }

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
                <JobroleTasksTab
                  tasks={profileData?.jobroleTasks ?? []}
                  readiness={readiness}
                  readinessCounts={readinessCounts}
                  readinessLoading={isReadinessLoading || !hasLoadedReadiness}
                  readinessError={readinessError}
                  readinessNote={readinessNote}
                />
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
            {activeTopTab === 'competency' && (
              <Suspense fallback={tabFallback}>
                {/*
                  * COMPETENCY FIRST, ATOMS UNDERNEATH.
                  *
                  * This replaces two tabs that answered the same question from
                  * different controllers - "Competency Rating" from
                  * /competency/kasba-rating and "Expected Competency" from
                  * EmployeeCompetencyProfileController - neither of which was
                  * the gap engine. Both listed atoms grouped by KASBA
                  * dimension, which is backwards: a person is assessed against
                  * a COMPETENCY, and the atoms are how that number was reached.
                  *
                  * `gapData` carries the server-computed roll-up; `kabaItems`
                  * carries the atoms. The roll-up is never recomputed here.
                  */}
                <CompetencyAssessmentTab
                  gap={gapData}
                  items={kabaItems}
                  isLoading={isKabaLoading || !hasLoadedKaba}
                  error={kabaError}
                  onRetry={loadKaba}
                  onSave={handleSaveCompetencyRating}
                  /* ⚠ HIDES UI ONLY. The route is `profile:admin,hr` matched on
                     exact role_key server-side; this value is derived by
                     substring from a profile display name, which is the very
                     matching the server stopped doing. Good enough to decide
                     whether to render a button, never good enough to authorise. */
                  canEditDefinition={user?.role === 'admin' || user?.role === 'hr'}
                  /* A weight change re-scores the roll-up, so the gap and the
                     atoms are both re-read - otherwise the tab shows the old
                     level beside the new weights. */
                  onDefinitionSaved={() => { void loadKaba() }}
                  /* Out to the screen that OWNS the definition. A competency's
                     bundle and scale are shared by everyone assessed against
                     it, so it is edited in one place, not from inside one
                     person's drawer. resolveAccessLink also checks the caller
                     can open the target, so someone without rights degrades
                     instead of landing on an empty shell. */
                  onEditDefinition={(competencyId) =>
                    router.push(
                      `${resolveAccessLink(COMPETENCY_LIBRARY_ACCESS_LINK)}?competency_id=${competencyId}`,
                    )
                  }
                  emptyIsExpected={kabaNotMapped}
                  emptyReason={kabaEmptyReason}
                  ratingRange={kabaRange}
                />
              </Suspense>
            )}
            {activeTopTab !== 'personal-info' && activeTopTab !== 'upload-docs' && activeTopTab !== 'jobrole-skill' && activeTopTab !== 'jobrole-tasks' && activeTopTab !== 'responsibility' && activeTopTab !== 'competency' && (
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
