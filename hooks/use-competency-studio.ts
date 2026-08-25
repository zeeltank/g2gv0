'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  competencyStudioService,
  type Framework,
  type FrameworkPayload,
  type FrameworkStructureNode,
  type FrameworkStructureMeta,
  type RequirementsMatrix,
  type RequirementsMatrixMeta,
  type Reconciliation,
  type ReconciliationMeta,
  type MappingReview,
  type Matrix,
  type ProficiencyLevelPayload,
  type ProficiencyScale,
  type ReviewCounts,
  type RoleRow,
  type StudioSummary,
  type WeightRow,
} from '@/services/competency'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** The Laravel context is rebuilt per call - it reads live storage, not React state. */
function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

export interface MutationResult {
  ok: boolean
  message: string
}

export interface UseCompetencyStudioState {
  // Overview bundle
  loading: boolean
  error: string | null
  summary: StudioSummary | null
  structure: FrameworkStructureNode[]
  /**
   * What the tree does NOT contain: competencies filed under no framework, and
   * target rows whose framework the competency does not claim. Both are broken
   * links, and the screen is expected to show them rather than present a tidy
   * tree with most of the library missing from it.
   */
  structureMeta: FrameworkStructureMeta | null
  proficiency: ProficiencyScale | null
  weights: WeightRow[]
  frameworks: Framework[]
  roles: RoleRow[]
  retry: () => void

  // Matrix (loaded on demand by category + roles)
  matrix: Matrix | null
  matrixLoading: boolean
  matrixError: string | null
  loadMatrix: (category: string | null, jobroles: string[]) => Promise<void>

  // Requirements grid — competencies x roles, loaded on demand like the matrix
  requirements: RequirementsMatrix | null
  requirementsMeta: RequirementsMatrixMeta | null
  requirementsLoading: boolean
  requirementsError: string | null
  loadRequirements: (params?: { department?: string; framework_id?: number }) => Promise<void>

  // Reconciliation — the broken links between frameworks and roles
  reconciliation: Reconciliation | null
  reconciliationMeta: ReconciliationMeta | null
  reconciliationLoading: boolean
  reconciliationError: string | null
  loadReconciliation: () => Promise<void>

  // Reviews (loaded on demand by status)
  reviews: MappingReview[]
  reviewCounts: ReviewCounts
  reviewsLoading: boolean
  reviewsError: string | null
  loadReviews: (status: string) => Promise<void>

  // Action state
  saving: boolean
  actionMessage: string | null
  actionError: string | null
  clearMessages: () => void

  // Actions
  saveCell: (jobrole: string, skill: string, level: string) => Promise<MutationResult>
  clearCell: (jobrole: string, skill: string) => Promise<MutationResult>
  saveWeights: (rows: WeightRow[]) => Promise<MutationResult>
  createFramework: (payload: FrameworkPayload) => Promise<MutationResult>
  updateFramework: (id: number, payload: FrameworkPayload) => Promise<MutationResult>
  cloneFramework: (id: number, name?: string) => Promise<MutationResult>
  deleteFramework: (id: number) => Promise<MutationResult>
  approveReview: (id: number, note?: string) => Promise<MutationResult>
  rejectReview: (id: number, note?: string) => Promise<MutationResult>
  bulkApproveReviews: (ids?: number[]) => Promise<MutationResult>
  submitReview: (payload: { jobrole: string; department?: string; framework_id?: number; changes_count?: number; changes?: string }) => Promise<MutationResult>
  createLevel: (payload: ProficiencyLevelPayload) => Promise<MutationResult>
  updateLevel: (id: number, payload: ProficiencyLevelPayload) => Promise<MutationResult>
  deleteLevel: (id: number) => Promise<MutationResult>
}

const EMPTY_COUNTS: ReviewCounts = { pending: 0, approved: 0, rejected: 0 }

export function useCompetencyStudio(structureSearch = ''): UseCompetencyStudioState {
  const resolveContext = useLaravelContext()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<StudioSummary | null>(null)
  const [structure, setStructure] = useState<FrameworkStructureNode[]>([])
  const [structureMeta, setStructureMeta] = useState<FrameworkStructureMeta | null>(null)
  const [proficiency, setProficiency] = useState<ProficiencyScale | null>(null)
  const [weights, setWeights] = useState<WeightRow[]>([])
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])

  const [matrix, setMatrix] = useState<Matrix | null>(null)
  const [matrixLoading, setMatrixLoading] = useState(false)
  const [matrixError, setMatrixError] = useState<string | null>(null)

  const [requirements, setRequirements] = useState<RequirementsMatrix | null>(null)
  const [requirementsMeta, setRequirementsMeta] = useState<RequirementsMatrixMeta | null>(null)
  const [requirementsLoading, setRequirementsLoading] = useState(false)
  const [requirementsError, setRequirementsError] = useState<string | null>(null)

  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null)
  const [reconciliationMeta, setReconciliationMeta] = useState<ReconciliationMeta | null>(null)
  const [reconciliationLoading, setReconciliationLoading] = useState(false)
  const [reconciliationError, setReconciliationError] = useState<string | null>(null)

  const [reviews, setReviews] = useState<MappingReview[]>([])
  const [reviewCounts, setReviewCounts] = useState<ReviewCounts>(EMPTY_COUNTS)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  /* -- Overview loader ------------------------------------------------ */
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const context = resolveContext()
      const [summaryRes, structureRes, proficiencyRes, weightsRes, frameworksRes, rolesRes] = await Promise.all([
        competencyStudioService.getSummary(context),
        competencyStudioService.getFrameworkStructure(context, structureSearch || undefined),
        competencyStudioService.getProficiencyScale(context),
        competencyStudioService.getWeights(context),
        competencyStudioService.listFrameworks(context, { per_page: 100 }),
        competencyStudioService.getRoles(context, { per_page: 6 }),
      ])
      setSummary(summaryRes.data ?? null)
      setStructure(structureRes.data ?? [])
      setStructureMeta(structureRes.meta ?? null)
      setProficiency(proficiencyRes.data ?? null)
      setWeights(weightsRes.data ?? [])
      setFrameworks(frameworksRes.data ?? [])
      setRoles(rolesRes.data ?? [])
    } catch (loadError) {
      setError(toMessage(loadError, 'Failed to load the studio.'))
    } finally {
      setLoading(false)
    }
  }, [resolveContext, structureSearch])

  useEffect(() => {
    queueMicrotask(() => {
      load()
    })
  }, [load])

  /* -- Matrix loader (on demand) -------------------------------------- */
  const loadMatrix = useCallback(
    async (category: string | null, jobroles: string[]) => {
      if (jobroles.length === 0) {
        setMatrix(null)
        return
      }
      setMatrixLoading(true)
      setMatrixError(null)
      try {
        const res = await competencyStudioService.getMatrix(resolveContext(), {
          category: category ?? undefined,
          jobroles,
        })
        setMatrix(res.data ?? null)
      } catch (err) {
        setMatrixError(toMessage(err, 'Failed to load the matrix.'))
        setMatrix(null)
      } finally {
        setMatrixLoading(false)
      }
    },
    [resolveContext],
  )

  /* -- Requirements grid loader (on demand) --------------------------- */
  const loadRequirements = useCallback(
    async (params: { department?: string; framework_id?: number } = {}) => {
      setRequirementsLoading(true)
      setRequirementsError(null)
      try {
        const res = await competencyStudioService.getRequirementsMatrix(resolveContext(), params)
        setRequirements(res.data ?? null)
        setRequirementsMeta(res.meta ?? null)
      } catch (err) {
        setRequirementsError(toMessage(err, 'Failed to load the requirements grid.'))
        setRequirements(null)
        setRequirementsMeta(null)
      } finally {
        setRequirementsLoading(false)
      }
    },
    [resolveContext],
  )

  /* -- Reconciliation loader (on demand) ------------------------------ */
  const loadReconciliation = useCallback(async () => {
    setReconciliationLoading(true)
    setReconciliationError(null)
    try {
      const res = await competencyStudioService.getReconciliation(resolveContext())
      setReconciliation(res.data ?? null)
      setReconciliationMeta(res.meta ?? null)
    } catch (err) {
      setReconciliationError(toMessage(err, 'Failed to load reconciliation.'))
      setReconciliation(null)
      setReconciliationMeta(null)
    } finally {
      setReconciliationLoading(false)
    }
  }, [resolveContext])

  /* -- Reviews loader (on demand) ------------------------------------- */
  const loadReviews = useCallback(
    async (status: string) => {
      setReviewsLoading(true)
      setReviewsError(null)
      try {
        const res = await competencyStudioService.listReviews(resolveContext(), status)
        setReviews(res.data ?? [])
        setReviewCounts(res.counts ?? EMPTY_COUNTS)
      } catch (err) {
        setReviewsError(toMessage(err, 'Failed to load reviews.'))
        setReviews([])
      } finally {
        setReviewsLoading(false)
      }
    },
    [resolveContext],
  )

  /* -- Mutation runner ------------------------------------------------ */
  const runMutation = useCallback(
    async (
      action: () => Promise<{ message: string }>,
      fallback: string,
      afterSuccess?: () => Promise<void> | void,
    ): Promise<MutationResult> => {
      setSaving(true)
      setActionError(null)
      setActionMessage(null)
      try {
        const response = await action()
        setActionMessage(response.message)
        if (afterSuccess) await afterSuccess()
        return { ok: true, message: response.message }
      } catch (mutationError) {
        const message = toMessage(mutationError, fallback)
        setActionError(message)
        return { ok: false, message }
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  const saveCell = useCallback(
    (jobrole: string, skill: string, level: string) =>
      runMutation(
        () => competencyStudioService.saveCell(resolveContext(), jobrole, skill, level),
        'Failed to save the mapping.',
      ),
    [runMutation, resolveContext],
  )

  const clearCell = useCallback(
    (jobrole: string, skill: string) =>
      runMutation(
        () => competencyStudioService.clearCell(resolveContext(), jobrole, skill),
        'Failed to clear the mapping.',
      ),
    [runMutation, resolveContext],
  )

  const saveWeights = useCallback(
    (rows: WeightRow[]) =>
      runMutation(
        () => competencyStudioService.saveWeights(resolveContext(), rows),
        'Failed to save weighting.',
        () => setWeights(rows),
      ),
    [runMutation, resolveContext],
  )

  const createFramework = useCallback(
    (payload: FrameworkPayload) =>
      runMutation(
        () => competencyStudioService.createFramework(resolveContext(), payload),
        'Failed to create the framework.',
        load,
      ),
    [runMutation, resolveContext, load],
  )

  const updateFramework = useCallback(
    (id: number, payload: FrameworkPayload) =>
      runMutation(
        () => competencyStudioService.updateFramework(resolveContext(), id, payload),
        'Failed to update the framework.',
        load,
      ),
    [runMutation, resolveContext, load],
  )

  const cloneFramework = useCallback(
    (id: number, name?: string) =>
      runMutation(
        () => competencyStudioService.cloneFramework(resolveContext(), id, name),
        'Failed to clone the framework.',
        load,
      ),
    [runMutation, resolveContext, load],
  )

  const deleteFramework = useCallback(
    (id: number) =>
      runMutation(
        () => competencyStudioService.deleteFramework(resolveContext(), id),
        'Failed to delete the framework.',
        load,
      ),
    [runMutation, resolveContext, load],
  )

  const approveReview = useCallback(
    (id: number, note?: string) =>
      runMutation(
        () => competencyStudioService.reviewAction(resolveContext(), id, 'approve', note),
        'Failed to approve the review.',
      ),
    [runMutation, resolveContext],
  )

  const rejectReview = useCallback(
    (id: number, note?: string) =>
      runMutation(
        () => competencyStudioService.reviewAction(resolveContext(), id, 'reject', note),
        'Failed to reject the review.',
      ),
    [runMutation, resolveContext],
  )

  const bulkApproveReviews = useCallback(
    (ids?: number[]) =>
      runMutation(
        () => competencyStudioService.bulkApprove(resolveContext(), ids),
        'Failed to bulk approve.',
      ),
    [runMutation, resolveContext],
  )

  const submitReview = useCallback(
    (payload: { jobrole: string; department?: string; framework_id?: number; changes_count?: number; changes?: string }) =>
      runMutation(
        () => competencyStudioService.submitReview(resolveContext(), payload),
        'Failed to submit for review.',
      ),
    [runMutation, resolveContext],
  )

  const createLevel = useCallback(
    (payload: ProficiencyLevelPayload) =>
      runMutation(
        () => competencyStudioService.createLevel(resolveContext(), payload),
        'Failed to add the level.',
        load,
      ),
    [runMutation, resolveContext, load],
  )

  const updateLevel = useCallback(
    (id: number, payload: ProficiencyLevelPayload) =>
      runMutation(
        () => competencyStudioService.updateLevel(resolveContext(), id, payload),
        'Failed to update the level.',
        load,
      ),
    [runMutation, resolveContext, load],
  )

  const deleteLevel = useCallback(
    (id: number) =>
      runMutation(
        () => competencyStudioService.deleteLevel(resolveContext(), id),
        'Failed to delete the level.',
        load,
      ),
    [runMutation, resolveContext, load],
  )

  return {
    loading,
    error,
    summary,
    structure,
    structureMeta,
    proficiency,
    weights,
    frameworks,
    roles,
    retry: load,

    matrix,
    matrixLoading,
    matrixError,
    loadMatrix,

    requirements,
    requirementsMeta,
    requirementsLoading,
    requirementsError,
    loadRequirements,
    reconciliation,
    reconciliationMeta,
    reconciliationLoading,
    reconciliationError,
    loadReconciliation,
    reviews,
    reviewCounts,
    reviewsLoading,
    reviewsError,
    loadReviews,

    saving,
    actionMessage,
    actionError,
    clearMessages: () => {
      setActionMessage(null)
      setActionError(null)
    },

    saveCell,
    clearCell,
    saveWeights,
    createFramework,
    updateFramework,
    cloneFramework,
    deleteFramework,
    approveReview,
    rejectReview,
    bulkApproveReviews,
    submitReview,
    createLevel,
    updateLevel,
    deleteLevel,
  }
}
