'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  X,
  Mail,
  Phone,
  CalendarDays,
  MoreHorizontal,
  Star,
  Download,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Maximize2,
  Eye,
  MapPin,
  Briefcase,
  GraduationCap,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Candidate, CandidateStage } from './recruitment-data'
import { canProgressCandidate, PIPELINE_STAGES } from './recruitment-data'
import { recruitmentService } from '@/services/talent'
import type { FeedbackApi, TalentOfferApi } from '@/types/recruitment'
import { useCandidateScreeningResult } from '@/hooks/use-recruitment'
import { ResumeReviewBlock } from './resume-review-block'
import { CandidateAssessmentBlock } from './candidate-assessment-block'

interface CandidateDetailPanelProps {
  candidate: Candidate | null
  onClose: () => void
  onViewProfile?: () => void
  onSaved?: () => void
  onSchedule?: (candidate: Candidate) => void
  /** Opens the offer drawer for THIS candidate, so the form pre-fills. */
  onCreateOffer?: (candidate: Candidate) => void
}

const stageOptions = PIPELINE_STAGES.map((s) => ({ label: s.label, value: s.id }))

const stageVariantMap: Record<CandidateStage, string> = {
  Applied: 'default',
  Screened: 'processing',
  Assessment: 'pending',
  Interview: 'processing',
  Offer: 'active',
  Hired: 'active',
  Rejected: 'error',
}

const timelineIconMap: Record<string, React.ElementType> = {
  stage_change: ArrowRight,
  interview: CalendarDays,
  assessment: CheckCircle2,
  note: MessageSquare,
  email: Mail,
}

export function CandidateDetailPanel({ candidate, onClose, onViewProfile, onSaved, onSchedule, onCreateOffer }: CandidateDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'interviews' | 'assessments' | 'offer' | 'notes'>('timeline')
  const [feedback, setFeedback] = useState<FeedbackApi | null>(null)
  const [offer, setOffer] = useState<TalentOfferApi | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  /** Widens the drawer. Drives the dead Maximize button in the header. */
  const [expanded, setExpanded] = useState(false)
  const profileQuery = useCandidateScreeningResult(candidate?.id ?? null)
  const application = profileQuery.data?.application ?? null
  const screening = profileQuery.data?.screening ?? null

  useEffect(() => {
    if (candidate?.stage === 'Screened') setActiveTab('assessments')
  }, [candidate?.id, candidate?.stage])

  useEffect(() => {
    if (!candidate) return
    queueMicrotask(() => {
      setLoadingDetails(true)
      void Promise.allSettled([
        recruitmentService.getCandidateFeedback(candidate.id),
        recruitmentService.getOffers(),
      ]).then(([feedbackResult, offersResult]) => {
        if (feedbackResult.status === 'fulfilled') setFeedback(feedbackResult.value.data ?? null)
        if (offersResult.status === 'fulfilled') setOffer(offersResult.value.find((item) => String(item.application_id) === candidate.id) ?? null)
      }).finally(() => setLoadingDetails(false))
    })
  }, [candidate])

  const timeline = useMemo(() => {
    if (!candidate) return []
    const events = [
      { id: 'applied', type: 'stage_change', title: 'Application received', description: candidate.jobOpening, timestamp: candidate.appliedOn },
    ]
    if (screening) events.push({ id: 'screening', type: 'assessment', title: 'Screening completed', description: `Competency match: ${screening.competency_match ?? '—'}`, timestamp: candidate.lastUpdated })
    if (feedback) events.push({ id: 'feedback', type: 'note', title: 'Interview feedback submitted', description: feedback.recommendation ?? 'Feedback recorded', timestamp: feedback.updated_at ?? feedback.created_at ?? candidate.lastUpdated })
    if (offer) events.push({ id: 'offer', type: 'email', title: 'Offer created', description: offer.status, timestamp: offer.created_at ?? candidate.lastUpdated })
    return events
  }, [candidate, feedback, offer, screening])

  if (!candidate) return null

  const tabs = [
    { id: 'timeline' as const, label: 'Timeline' },
    { id: 'interviews' as const, label: 'Interviews' },
    { id: 'assessments' as const, label: 'Screening' },
    { id: 'offer' as const, label: 'Offer' },
    { id: 'notes' as const, label: 'Notes' },
  ]

  const detailRows = [
    { label: 'Current Stage', value: candidate.stage, isStage: true },
    { label: 'Recruiter', value: candidate.recruiter },
    { label: 'Source', value: candidate.source },
    { label: 'Location', value: application?.current_location ?? candidate.location },
    { label: 'Experience', value: application?.experience ?? candidate.experience },
    { label: 'Qualification', value: application?.qualification ?? application?.education ?? '—' },
    { label: 'Notice Period', value: candidate.noticePeriod },
    { label: 'Expected CTC', value: candidate.expectedCtc },
    { label: 'Resume', value: application?.resume_path ?? candidate.resume, isResume: true },
  ]
  const screeningMetrics = [
    { label: 'Skills Match', value: screening?.scoringPipeline?.detailed_matches?.skills_match, color: 'bg-primary' },
    { label: 'Experience', value: screening?.scoringPipeline?.detailed_matches?.experience_match, color: 'bg-success' },
    { label: 'Education', value: screening?.scoringPipeline?.detailed_matches?.education_match, color: 'bg-warning' },
    {
      label: 'Cultural Fit',
      value: screening?.scoringPipeline?.competency_scoring?.culturalFitIndex ?? screening?.cultural_fit,
      color: 'bg-purple-500',
    },
  ]
  const candidateSkills = (application?.skills ?? '').split(/[,;|\n]/).map((skill) => skill.trim()).filter(Boolean)
  const resumeUrl = application?.resume_path ?? candidate.resume

  const downloadResume = () => {
    if (!resumeUrl) return
    const link = document.createElement('a')
    link.href = resumeUrl
    link.download = `${candidate.name.replace(/\s+/g, '-')}-resume`
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l border-border/80 h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 border-b border-border/40">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">{candidate.name}</h3>
              <div className="size-2 rounded-full bg-success" title="Active" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">{candidate.role}</p>
            <p className="text-xs text-muted-foreground">Applied on {candidate.appliedOn}</p>
          </div>
          {/* SheetContent has its own close button, but we can keep Maximize if we want. For now just removing the custom close button */}
          <div className="flex items-center gap-1 mr-6">
            {/* WAS A DEAD MAXIMIZE BUTTON. It now does what its icon promises -
                widens the drawer, which is genuinely useful on the Screening tab
                where the résumé review and assessment answers are cramped. */}
            <Button
              size="icon"
              variant="ghost"
              className="p-1.5 text-muted-foreground"
              title={expanded ? 'Shrink panel' : 'Expand panel'}
              aria-pressed={expanded}
              onClick={() => setExpanded((prev) => !prev)}
            >
              <Maximize2 className="size-4" />
            </Button>
            {/* `loadingDetails` was set true and false around the feedback and
                offer fetches and then read nowhere, so the tabs below showed
                empty sections while data was still in flight - indistinguishable
                from a candidate with no history. */}
            {loadingDetails && (
              <span className="text-[10px] text-muted-foreground">Loading…</span>
            )}
          </div>
        </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-around px-5 py-3 border-b border-border/40">
        {[
          { icon: Mail, label: 'Email', href: `mailto:${candidate.email}` },
          { icon: Phone, label: 'Call', href: `tel:${candidate.phone}` },
          { icon: CalendarDays, label: 'Schedule' },
          { icon: MoreHorizontal, label: 'More' },
        ].filter((action) => action.label !== 'Schedule' || canProgressCandidate(candidate)).map((action) => (
          <a
            key={action.label}
            href={action.href}
            onClick={(event) => {
              if (action.label !== 'Schedule') return
              event.preventDefault()
              onSchedule?.(candidate)
            }}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer group"
          >
            <div className="p-2 rounded-lg group-hover:bg-primary/5 transition-colors">
              <action.icon className="size-4" />
            </div>
            <span className="text-[10px] font-semibold">{action.label}</span>
          </a>
        ))}
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-3">
          {detailRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{row.label}</span>
              {'isStage' in row && row.isStage ? (
                <Select
                  value={candidate.stage}
                  onChange={(stage) => {
                    void recruitmentService.moveCandidate(candidate.id, stage).then(() => onSaved?.())
                  }}
                  options={stageOptions}
                  size="sm"
                  className="w-32"
                />
              ) : 'isResume' in row && row.isResume ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-primary font-medium truncate max-w-[160px]">{row.value as string}</span>
                  <button onClick={() => row.value && window.open(row.value as string, '_blank', 'noopener,noreferrer')} className="text-muted-foreground hover:text-primary transition-colors">
                    <Download className="size-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-sm text-foreground font-medium text-right truncate max-w-[180px]">{row.value as string}</span>
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-t border-border/40">
          <div className="flex gap-0 px-5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {activeTab === 'timeline' && (
            <div className="relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/60" />
              <div className="flex flex-col gap-5">
                {timeline.map((event) => {
                  const EventIcon = timelineIconMap[event.type] || Clock
                  return (
                    <div key={event.id} className="flex gap-3 relative">
                      <div className={cn(
                        'size-6 rounded-full flex items-center justify-center shrink-0 z-10 border',
                        event.type === 'stage_change' ? 'bg-primary/10 border-primary/30 text-primary' :
                        event.type === 'assessment' ? 'bg-success/10 border-success/30 text-success' :
                        'bg-muted border-border/60 text-muted-foreground'
                      )}>
                        <EventIcon className="size-3" />
                      </div>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{event.title}</span>
                        <span className="text-xs text-muted-foreground">{event.description}</span>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">{event.timestamp}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {activeTab === 'interviews' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarDays className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">{application?.status ?? candidate.stage}</p>
              <p className="text-xs text-muted-foreground">Use the Interviews tab to schedule or manage rounds.</p>
            </div>
          )}
          {activeTab === 'assessments' && (
            <div className="py-2">
              {profileQuery.isPending ? (
                <div className="w-full space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : screening ? (
                <div className="space-y-4 text-left text-sm">
                  <div className="flex items-start gap-3">
                    <div className="size-10 shrink-0 overflow-hidden rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      {(application?.candidate_photo ?? application?.photo) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={application?.candidate_photo ?? application?.photo ?? ''} alt={candidate.name} className="size-full object-cover" />
                      ) : <User className="size-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-foreground">{candidate.name}</span>
                        <span className="font-black text-primary">{screening.competency_match ?? 0}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Applied for {candidate.jobOpening}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="size-3" />{application?.current_location ?? candidate.location}</span>
                        <span className="flex items-center gap-1"><Briefcase className="size-3" />{application?.experience ?? candidate.experience}</span>
                        <span className="flex items-center gap-1"><GraduationCap className="size-3" />{application?.qualification ?? application?.education ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {screeningMetrics.map((metric) => {
                      const numericValue = typeof metric.value === 'number' ? metric.value : Number(metric.value)
                      const percentage = Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue)) : 0
                      return <div key={metric.label} className="text-center">
                        <div className="font-bold">{metric.value ?? '—'}{typeof metric.value === 'number' ? '%' : ''}</div>
                        <div className="my-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', metric.color)} style={{ width: `${percentage}%` }} /></div>
                        <div className="text-[10px] text-muted-foreground">{metric.label}</div>
                      </div>
                    })}
                  </div>
                  <div className="flex gap-6">
                    <div><strong>{screening.predicted_success ?? '—'}</strong><p className="text-xs text-muted-foreground">Predicted Success</p></div>
                    <div><strong>{screening.ranking_score ?? screening.scoringPipeline?.competency_scoring?.rankingScore ?? '—'}/100</strong><p className="text-xs text-muted-foreground">Ranking Score</p></div>
                  </div>
                  {!!screening.skill_gaps?.length && <div><p className="mb-2 font-semibold">Skill Gaps</p><div className="flex flex-wrap gap-1.5">{screening.skill_gaps.map((gap, index) => <span key={`${gap}-${index}`} className="rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive">{gap}</span>)}</div></div>}
                  {!!screening.strengths?.length && <div><p className="mb-2 font-semibold">Key Strengths</p><div className="flex flex-wrap gap-1.5">{screening.strengths.map((strength, index) => <span key={`${strength}-${index}`} className="rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">{strength}</span>)}</div></div>}
                  {!!candidateSkills.length && <div><p className="mb-2 font-semibold">Candidate Key Skills</p><div className="flex flex-wrap gap-1.5">{candidateSkills.map((skill, index) => <span key={`${skill}-${index}`} className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">{skill}</span>)}</div></div>}
                  {/* The assessment is the third input to the same decision as
                      the CV match above and the resume review below it, so it
                      lives here rather than in a tab of its own. */}
                  <CandidateAssessmentBlock applicationId={candidate.id} candidateStage={candidate.stage} />
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border/40 pt-3">
                    {application?.profile_url && <Button size="sm" variant="outline" onClick={() => window.open(application.profile_url!, '_blank', 'noopener,noreferrer')}><Eye className="mr-1.5 size-3.5" />View Profile</Button>}
                    <Button size="sm" variant="outline" disabled={!resumeUrl} onClick={() => resumeUrl && window.open(resumeUrl, '_blank', 'noopener,noreferrer')}><Eye className="mr-1.5 size-3.5" />View Resume</Button>
                    <Button size="sm" variant="outline" disabled={!resumeUrl} onClick={downloadResume}><Download className="mr-1.5 size-3.5" />Download Resume</Button>
                  </div>
                </div>
              ) : <p className="py-8 text-center text-sm text-muted-foreground font-medium">{profileQuery.error instanceof Error ? profileQuery.error.message : 'No screening result found'}</p>}

              {/* The recruiter's own review, below the AI analysis. Rendered
                  outside the `screening` branch on purpose: a person can review
                  a CV whether or not the model ever produced a verdict. */}
              {!profileQuery.isPending && <ResumeReviewBlock applicationId={application?.id ? Number(application.id) : null} />}
            </div>
          )}
          {activeTab === 'offer' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="size-8 text-muted-foreground/40 mb-2" />
              {offer ? (
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{offer.position}</p>
                  <p>{offer.salary ?? '—'}</p>
                  <StatusBadge variant="processing">{offer.status}</StatusBadge>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm font-medium text-muted-foreground">No offer found</p>
                  {/* This tab used to be a dead end - it reported the absence of an
                      offer and gave no way to make one, so HR left the drawer,
                      opened a global menu and re-selected the same candidate. */}
                  {onCreateOffer && (
                    <Button size="sm" onClick={() => onCreateOffer(candidate)}>
                      Create offer for {candidate.name.split(' ')[0]}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          {activeTab === 'notes' && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="size-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground font-medium">{feedback?.additional_comments ?? feedback?.notes ?? 'No feedback notes found'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/40">
        <Button className="w-full bg-background text-foreground border border-input shadow-sm hover:bg-muted font-bold py-5" onClick={onViewProfile}>
          View Full Profile
        </Button>
      </div>
      </SheetContent>
    </Sheet>
  )
}
