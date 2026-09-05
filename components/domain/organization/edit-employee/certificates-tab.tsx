'use client'

import { useCallback, useEffect, useState } from 'react'
import { Award, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { lmsCertificateService, type LearningCertificate } from '@/services/lms'

/**
 * The certificates an employee has earned.
 *
 * ── WHY THIS TAB EXISTS ─────────────────────────────────────────────────────
 *
 * Certificates were only ever visible on Certifications & Records, which shows
 * the SIGNED-IN person's own. So the one place an HR user looks at an
 * employee — this drawer — could show their skills, their tasks, their
 * competency ratings and their documents, and not one thing about what training
 * they had actually completed.
 *
 * ── HOW IT IS SCOPED ────────────────────────────────────────────────────────
 *
 * `scope: 'all'` is gated server-side on the authoring profile, and `userId`
 * narrows that set to this employee. An ordinary employee opening their own
 * record still gets their own certificates, because the endpoint falls back to
 * the caller when the scope is not granted.
 */
export function CertificatesTab({ employeeId }: { employeeId: number | null }) {
  const { user } = useAuth()
  const [certificates, setCertificates] = useState<LearningCertificate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context) || !employeeId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await lmsCertificateService.list(context, {
        scope: 'all',
        userId: employeeId,
        profileName: user?.profileName,
      })
      setCertificates(response.data ?? [])
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Could not load their certificates.',
      )
      setCertificates([])
    } finally {
      setLoading(false)
    }
  }, [employeeId, user])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-1">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorState title="Couldn't load certificates" description={error} retry={load} />
  }

  if (certificates.length === 0) {
    return (
      <EmptyState
        icon={<Award className="size-8" />}
        title="No certificates yet"
        description="Certificates appear here once this employee completes a course and passes its quiz."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {certificates.length} certificate{certificates.length === 1 ? '' : 's'} earned.
      </p>

      {certificates.map((certificate) => {
        const expired =
          certificate.expires_at !== null && new Date(certificate.expires_at) < new Date()

        return (
          <div
            key={certificate.id}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4"
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Award className="size-5" />
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm font-semibold text-foreground">
                {certificate.course_title ?? certificate.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {certificate.certificate_number}
                {certificate.issued_at &&
                  ` · issued ${new Date(certificate.issued_at).toLocaleDateString()}`}
              </span>
              {/*
                * An expiry is only shown when there is one. Most courses set no
                * validity period, and inventing "never expires" text for every
                * certificate would bury the ones that genuinely do lapse.
                */}
              {certificate.expires_at && (
                <span
                  className={
                    expired
                      ? 'text-xs font-semibold text-destructive'
                      : 'text-xs text-muted-foreground'
                  }
                >
                  {expired ? 'Expired' : 'Valid until'}{' '}
                  {new Date(certificate.expires_at).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <StatusBadge
                variant={expired ? 'inactive' : 'active'}
                size="sm"
                className="text-[10px] font-bold uppercase tracking-wider"
              >
                {expired ? 'Expired' : (certificate.status ?? 'issued')}
              </StatusBadge>

              <Button
                variant="ghost"
                size="icon"
                aria-label={`Download ${certificate.certificate_number}`}
                className="size-8 text-muted-foreground"
                onClick={() =>
                  window.open(
                    `/api/lms/learning/certificates/${certificate.id}/download`,
                    '_blank',
                    'noopener',
                  )
                }
              >
                <Download className="size-4" />
              </Button>

              {certificate.verification_code && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Verify this certificate"
                  className="size-8 text-muted-foreground"
                  onClick={() =>
                    window.open(
                      `/verify/certificate/${certificate.verification_code}`,
                      '_blank',
                      'noopener',
                    )
                  }
                >
                  <ExternalLink className="size-4" />
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
