'use client'

import React, { useState } from 'react'
import {
  ArrowLeft, Briefcase, MapPin, Mail, Phone, User, GraduationCap, Calendar,
  FileText, Download, Eye, Sparkles, TrendingUp, AlertTriangle, IndianRupee,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useCandidateScreeningResult } from '@/hooks/use-recruitment'
import { CandidateAssessmentBlock } from '../recruitment/candidate-assessment-block'

/**
 * One person's profile, from their real record.
 *
 * ── WHAT THIS REPLACES, AND WHY IT MATTERED ─────────────────────────────────
 *
 * This screen used to render `mockProfileData` and ignore `profileId` entirely
 * (`const profile = mockProfileData`), so EVERY user saw the same invented
 * person — "Priya Sharma" — complete with an **Aadhaar number, a PAN, a PF
 * number**, blood group, date of birth, personal phone, a salary-revision
 * history and an "Aadhaar Card.pdf" attachment, under a green "Active Employee"
 * badge. It was reachable in three clicks from Recruitment, and nothing on it
 * told a recruiter it was fake.
 *
 * That is worse than a broken screen: fabricated identity documents presented as
 * a real HR record are the kind of thing someone acts on. All of it is gone —
 * not hidden behind a flag, deleted — along with the 17 dead controls that came
 * with the mockup.
 *
 * ── ONLY FIELDS THAT EXIST ──────────────────────────────────────────────────
 *
 * Everything rendered here comes from `talent_job_applications` and the AI
 * screening result. There is NO Aadhaar, PAN, PF or blood group anywhere in the
 * schema, so there is none on the screen. Where a real field is empty it says
 * so; nothing is padded with a plausible-looking default, because a default
 * that looks like data is indistinguishable from data.
 *
 * ── WHAT `profileId` ACTUALLY IS ────────────────────────────────────────────
 *
 * A `talent_job_applications.id`, NOT a `tbluser.id` — recruitment passes
 * `candidate.id` straight through. That is why this fetches the candidate
 * profile rather than the employee one; conflating the two would show a
 * different person's record, since the two id spaces overlap.
 */

/**
 * A labelled value that admits when it has nothing.
 *
 * Declared at module scope, not inside TalentProfileView: a component created
 * during render is a new type on every pass, which remounts its subtree and is
 * an error under this repo's React lint.
 */
function Field({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ElementType
  label: string
  value?: string | null
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
        {value?.toString().trim() ? value : <span className="font-normal text-muted-foreground">Not recorded</span>}
      </span>
    </div>
  )
}

interface TalentProfileViewProps {
  profileId?: string
  onBack?: () => void
}

type ProfileTab = 'overview' | 'screening' | 'assessment' | 'documents'

export function TalentProfileView({ profileId, onBack }: TalentProfileViewProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')
  const query = useCandidateScreeningResult(profileId ?? null)

  const application = query.data?.application ?? null
  const screening = query.data?.screening ?? null

  const fullName = application
    ? [application.first_name, application.middle_name, application.last_name].filter(Boolean).join(' ')
    : ''

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

  /** Comma or pipe separated in the column; empty means empty, not "none listed". */
  const listOf = (raw?: string | null) =>
    (raw ?? '')
      .split(/[,|;]/)
      .map((s) => s.trim())
      .filter(Boolean)

  const skills = listOf(application?.skills)
  const certifications = listOf(application?.certifications)

  const resumeUrl = application?.resume_path ?? null
  const photo = application?.candidate_photo ?? application?.photo ?? null

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'screening', label: 'Screening' },
    { id: 'assessment', label: 'Assessment' },
    { id: 'documents', label: 'Documents' },
  ]

  if (query.isPending) {
    return (
      <div className="@container/profile flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-center">
        <User className="size-8 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-lg font-semibold">That profile could not be opened</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {query.error instanceof Error
            ? query.error.message
            : 'The record may have been removed, or it belongs to another organisation.'}
        </p>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1.5 size-4" /> Back
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="@container/profile flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-surface/50 px-6 py-5">
        {onBack && (
          <Button variant="ghost" size="sm" className="mb-3 -ml-2 gap-1.5" onClick={onBack}>
            <ArrowLeft className="size-4" /> Back to Recruitment
          </Button>
        )}

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-primary/10 text-lg font-bold text-primary">
            {photo ? (
              <img src={photo} alt={fullName} className="size-full object-cover" />
            ) : (
              initials
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{fullName || 'Unnamed candidate'}</h1>
              {/* The REAL pipeline status. The old screen showed a green
                  "Active Employee" badge on a person who was not one. */}
              <StatusBadge variant="processing" size="sm">{application.status}</StatusBadge>
            </div>

            <p className="text-sm text-muted-foreground">
              {application.job_title || application.position || 'No role recorded'}
              {application.applied_date ? ` · applied ${application.applied_date}` : ''}
            </p>

            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {application.email && (
                <span className="flex items-center gap-1"><Mail className="size-3" />{application.email}</span>
              )}
              {application.mobile && (
                <span className="flex items-center gap-1"><Phone className="size-3" />{application.mobile}</span>
              )}
              {application.current_location && (
                <span className="flex items-center gap-1"><MapPin className="size-3" />{application.current_location}</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!resumeUrl}
              title={resumeUrl ? 'Open the résumé' : 'No résumé on file'}
              onClick={() => resumeUrl && window.open(resumeUrl, '_blank', 'noopener,noreferrer')}
            >
              <Eye className="mr-1.5 size-3.5" /> Résumé
            </Button>
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-surface/50 px-6">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-1 py-3 text-sm font-semibold transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-4 @3xl/profile:grid-cols-2">
            <Card className="shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5">
                <h3 className="text-sm font-bold">Application</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field icon={Briefcase} label="Experience" value={application.experience} />
                  <Field icon={GraduationCap} label="Education" value={application.qualification ?? application.education} />
                  <Field icon={Calendar} label="Applied" value={application.applied_date} />
                  <Field icon={User} label="Source" value={application.source} />
                  <Field icon={Briefcase} label="Employment type" value={application.employment_type} />
                  <Field icon={User} label="Recruiter" value={application.recruiter_name} />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5">
                <h3 className="text-sm font-bold">Compensation</h3>
                {/* Two real columns. The old screen showed an invented
                    salary-revision history with dated increments. */}
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    icon={IndianRupee}
                    label="Current"
                    value={application.current_salary ? String(application.current_salary) : null}
                  />
                  <Field
                    icon={IndianRupee}
                    label="Expected"
                    value={application.expected_salary ? String(application.expected_salary) : null}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  As stated on the application. Nothing is inferred from it.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm @3xl/profile:col-span-2">
              <CardContent className="flex flex-col gap-4 p-5">
                <h3 className="text-sm font-bold">Skills &amp; certifications</h3>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Skills</span>
                    {skills.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">None listed on the application.</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Certifications</span>
                    {certifications.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {certifications.map((c) => (
                          <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">None listed on the application.</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'screening' && (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-5 p-5">
              <h3 className="flex items-center gap-1.5 text-sm font-bold">
                <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
                AI screening
              </h3>

              {!screening ? (
                <p className="text-sm text-muted-foreground">
                  This candidate has not been screened yet.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Competency match</span>
                      <span className="text-2xl font-bold tabular-nums">{screening.competency_match ?? '—'}%</span>
                    </div>
                    <Progress value={Number(screening.competency_match) || 0} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field icon={TrendingUp} label="Predicted success" value={screening.predicted_success?.toString()} />
                    <Field label="Ranking score" value={screening.ranking_score ? `${screening.ranking_score}/100` : null} />
                  </div>

                  {!!screening.strengths?.length && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Strengths</span>
                      <div className="flex flex-wrap gap-1.5">
                        {screening.strengths.map((s, i) => (
                          <Badge key={`${s}-${i}`} className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {!!screening.skill_gaps?.length && (
                    <div className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <AlertTriangle className="size-3" aria-hidden="true" /> Skill gaps
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {screening.skill_gaps.map((g, i) => (
                          <span key={`${g}-${i}`} className="rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'assessment' && profileId && (
          /* The same block the recruiter sees on the Screening tab of the
             candidate drawer, not a second implementation of it. */
          <CandidateAssessmentBlock applicationId={profileId} candidateStage={application.status} />
        )}

        {activeTab === 'documents' && (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5">
              <h3 className="text-sm font-bold">Documents</h3>
              {/* The résumé is the only document this record actually has.
                  The old screen listed an "Aadhaar Card.pdf" that never existed. */}
              {resumeUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs font-semibold text-foreground">Résumé</span>
                    <span className="truncate text-[10px] text-muted-foreground">{resumeUrl.split('/').pop()}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(resumeUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <Download className="mr-1.5 size-3.5" /> Open
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No documents on file. A résumé is attached when the candidate applies.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
