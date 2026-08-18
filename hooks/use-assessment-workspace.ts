'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import {
  assessmentWorkspaceService,
  type AssessmentCycleMetrics,
  type AssessmentCycle,
  type AssessmentParticipant,
  type AssessmentRow,
} from '@/services/competency'

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function useLaravelContext() {
  const { user } = useAuth()
  return useCallback(() => getLaravelContext(user), [user])
}

export function useAssessmentWorkspace() {
  const resolveContext = useLaravelContext()

  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metrics, setMetrics] = useState<AssessmentCycleMetrics | null>(null)
  
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<AssessmentCycle[]>([])
  
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [participants, setParticipants] = useState<AssessmentParticipant[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Top-tab lists (Participant Ratings / Calibration / Approvals / Closed)
  const [tabLoading, setTabLoading] = useState(false)
  const [tabRows, setTabRows] = useState<AssessmentRow[]>([])
  const [closedCampaigns, setClosedCampaigns] = useState<AssessmentCycle[]>([])
  const [reviewing, setReviewing] = useState(false)

  const loadMetricsAndCampaigns = useCallback(async () => {
    setMetricsLoading(true)
    setCampaignsLoading(true)
    setError(null)
    
    try {
      const context = resolveContext()
      const [metricsRes, campaignsRes] = await Promise.all([
        assessmentWorkspaceService.getMetrics(context),
        assessmentWorkspaceService.getCampaigns(context)
      ])
      
      setMetrics(metricsRes.data)
      setCampaigns(campaignsRes.data)
    } catch (err) {
      setError(toMessage(err, 'Failed to load workspace data.'))
    } finally {
      setMetricsLoading(false)
      setCampaignsLoading(false)
    }
  }, [resolveContext])

  useEffect(() => {
    loadMetricsAndCampaigns()
  }, [loadMetricsAndCampaigns])

  const loadParticipants = useCallback(async (cycleId: string) => {
    setParticipantsLoading(true)
    try {
      const res = await assessmentWorkspaceService.getParticipants(resolveContext(), cycleId)
      setParticipants(res.data)
      setSelectedCycleId(cycleId)
    } catch (err) {
      setError(toMessage(err, 'Failed to load participants.'))
    } finally {
      setParticipantsLoading(false)
    }
  }, [resolveContext])

  const loadTab = useCallback(async (tab: string) => {
    setTabLoading(true)
    setError(null)
    try {
      const ctx = resolveContext()
      if (tab === 'closed') {
        const res = await assessmentWorkspaceService.getClosedCampaigns(ctx)
        setClosedCampaigns(res.data)
      } else {
        const res = tab === 'participant'
          ? await assessmentWorkspaceService.getParticipantRatings(ctx)
          : tab === 'calibration'
            ? await assessmentWorkspaceService.getCalibration(ctx)
            : await assessmentWorkspaceService.getApprovals(ctx)
        setTabRows(res.data)
      }
    } catch (err) {
      setError(toMessage(err, 'Failed to load data.'))
      setTabRows([])
      setClosedCampaigns([])
    } finally {
      setTabLoading(false)
    }
  }, [resolveContext])

  const reviewAssessment = useCallback(async (id: string, action: 'approve' | 'calibrate' | 'reject') => {
    setReviewing(true)
    try {
      await assessmentWorkspaceService.reviewAssessment(resolveContext(), id, action)
      return { ok: true }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to update assessment.') }
    } finally {
      setReviewing(false)
    }
  }, [resolveContext])

  const createCampaign = useCallback(async (payload: { name: string; type?: string; framework_id?: number; start_date?: string; end_date?: string }) => {
    setCreating(true)
    try {
      await assessmentWorkspaceService.createCampaign(resolveContext(), payload)
      await loadMetricsAndCampaigns()
      return { ok: true }
    } catch (err) {
      return { ok: false, message: toMessage(err, 'Failed to create campaign.') }
    } finally {
      setCreating(false)
    }
  }, [resolveContext, loadMetricsAndCampaigns])

  return {
    metricsLoading,
    metrics,
    campaignsLoading,
    campaigns,
    participantsLoading,
    participants,
    selectedCycleId,
    loadParticipants,
    createCampaign,
    creating,
    error,
    // Top-tab lists + review action
    tabLoading,
    tabRows,
    closedCampaigns,
    loadTab,
    reviewAssessment,
    reviewing,
    clearSelectedCycle: () => {
      setSelectedCycleId(null)
      setParticipants([])
    }
  }
}
