'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  ClipboardCheck,
  Clock,
  FileText,
  Link2Off,
  MapPin,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { careersApi, type ApplicationTracking } from '@/lib/careers-api'

/**
 * A candidate following their OWN application. Public, no account.
 *
 * The token in the address is the whole credential, so this page sends nothing
 * else — no slug, no id, nothing a curious visitor could edit into somebody
 * else's application.
 *
 * ── WHAT IT SHOWS, AND WHAT IT WILL NOT ─────────────────────────────────────
 *
 * A coarse stage, never the internal status. Whether an assessment is waiting,
 * never its score. The hiring team's deliberation is theirs; this answers only
 * the question the candidate is actually asking, which is "where am I?".
 */

function formatDate(value: string | null) {
  if (!value) return null
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function TrackApplicationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [data, setData] = useState<ApplicationTracking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    careersApi
      .track(token)
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((cause) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : 'This tracking link could not be opened.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="@container/track min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 @3xl/track:px-6 @3xl/track:py-12">

        {loading && (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        )}

        {/* A dead link is the one thing this page must explain WELL - it is the
            only screen the candidate can reach, so "error" is not enough. */}
        {!loading && error && (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <Link2Off className="size-9 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-base font-semibold text-foreground">This link no longer works</p>
              <p className="max-w-md text-sm text-muted-foreground">{error}</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Tracking links last 90 days, and sending a new one replaces the last. If you still
                have the confirmation email, try the most recent link in it.
              </p>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* ── Header ───────────────────────────────────────────────── */}
            <Card className="shadow-sm">
              <CardContent className="flex flex-col gap-4 p-6 @2xl/track:p-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      Your application
                    </span>
                    <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
                      {data.application.job_title ?? 'Your application'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {data.organisation.name}
                      {data.application.applied_date &&
                        ` · applied ${formatDate(data.application.applied_date)}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {data.application.reference}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {data.application.department && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="size-4 shrink-0" aria-hidden="true" />
                      {data.application.department}
                    </span>
                  )}
                  {data.application.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4 shrink-0" aria-hidden="true" />
                      {data.application.location}
                    </span>
                  )}
                  {data.application.employment_type && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4 shrink-0" aria-hidden="true" />
                      {data.application.employment_type}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Where they are ───────────────────────────────────────── */}
            <Card className="shadow-sm">
              <CardContent className="flex flex-col gap-5 p-6 @2xl/track:p-8">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Progress
                  </h2>
                  {data.timeline.closed ? (
                    <Badge variant="secondary" className="gap-1.5">
                      <XCircle className="size-3.5" aria-hidden="true" />
                      Not taken forward
                    </Badge>
                  ) : (
                    <Badge className="gap-1.5">{data.timeline.current}</Badge>
                  )}
                </div>

                {/* Vertical on narrow screens, horizontal once there is room -
                    a five-step horizontal track is unreadable on a phone. */}
                <ol className="flex flex-col gap-0 @2xl/track:flex-row @2xl/track:gap-2">
                  {data.timeline.stages.map((stage, index) => {
                    const last = index === data.timeline.stages.length - 1
                    return (
                      <li
                        key={stage.name}
                        className="flex flex-1 items-start gap-3 @2xl/track:flex-col @2xl/track:items-stretch @2xl/track:gap-2"
                      >
                        <div className="flex flex-col items-center @2xl/track:w-full @2xl/track:flex-row">
                          <span
                            className={cn(
                              'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold',
                              stage.state === 'done' && 'border-success bg-success text-white',
                              stage.state === 'current' && 'border-primary bg-primary text-primary-foreground',
                              stage.state === 'upcoming' && 'border-border bg-card text-muted-foreground',
                            )}
                          >
                            {stage.state === 'done' ? (
                              <Check className="size-3.5" aria-hidden="true" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          {!last && (
                            <span
                              className={cn(
                                'w-0.5 flex-1 @2xl/track:h-0.5 @2xl/track:w-full',
                                'min-h-6 @2xl/track:min-h-0',
                                stage.state === 'done' ? 'bg-success' : 'bg-border',
                              )}
                            />
                          )}
                        </div>
                        <span
                          className={cn(
                            'pb-6 text-sm @2xl/track:pb-0',
                            stage.state === 'upcoming'
                              ? 'text-muted-foreground'
                              : 'font-semibold text-foreground',
                          )}
                        >
                          {stage.name}
                        </span>
                      </li>
                    )
                  })}
                </ol>

                <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                  {data.timeline.closed
                    ? `${data.organisation.name} is not taking this application forward. Thank you for the time you put into it — you are welcome to apply for other roles.`
                    : data.timeline.current === 'Applied' || data.timeline.current === 'Screening'
                      ? 'Your application is with the hiring team. You will hear from them by email, and this page updates as things move.'
                      : `You are at the ${data.timeline.current.toLowerCase()} stage. This page updates as things move, so there is no need to chase.`}
                </p>
              </CardContent>
            </Card>

            {/* ── Anything waiting on them ─────────────────────────────── */}
            {(data.assessment || data.offer) && (
              <div className="flex flex-col gap-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Next steps
                </h2>

                {data.assessment && (
                  <Card className={cn('shadow-sm', data.assessment.waiting && 'border-primary/50')}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="flex min-w-0 flex-col">
                          <span className="text-sm font-semibold text-foreground">Assessment</span>
                          <span className="text-xs text-muted-foreground">
                            {data.assessment.waiting
                              ? 'You have been sent an assessment to complete. The link is in your email.'
                              : data.assessment.submitted
                                ? 'Submitted. The hiring team will be in touch about the result.'
                                : 'An assessment has been recorded for this application.'}
                          </span>
                        </div>
                      </div>
                      {data.assessment.waiting ? (
                        <Badge className="shrink-0">Action needed</Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          {data.assessment.submitted ? 'Submitted' : 'Recorded'}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                )}

                {data.offer && (
                  <Card className={cn('shadow-sm', !data.offer.responded && 'border-primary/50')}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="flex min-w-0 flex-col">
                          <span className="text-sm font-semibold text-foreground">
                            Offer{data.offer.position ? ` — ${data.offer.position}` : ''}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {data.offer.responded
                              ? 'You have responded to this offer.'
                              : 'An offer has been sent to you. The letter and the accept or decline buttons are in your email.'}
                            {data.offer.start_date && ` Starting ${formatDate(data.offer.start_date)}.`}
                          </span>
                        </div>
                      </div>
                      {!data.offer.responded && <Badge className="shrink-0">Action needed</Badge>}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {data.organisation.slug ? (
                <Link href={`/careers/${data.organisation.slug}`}>
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="mr-1.5 size-4" aria-hidden="true" />
                    All open roles
                  </Button>
                </Link>
              ) : (
                <span />
              )}
              {data.expires_at && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" aria-hidden="true" />
                  This link works until {formatDate(data.expires_at)}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
