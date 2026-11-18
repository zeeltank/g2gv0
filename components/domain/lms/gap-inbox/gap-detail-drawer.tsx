'use client'

/**
 * The per-row drawer — one (tenant, competency) request, its affected
 * employees (worst gap first, per the API), and the three resolve actions.
 *
 * "Create a course" deep-links into Course Builder with `?competency_id=`;
 * "Map an existing course" opens the sync-safe dialog in this same folder;
 * "Dismiss" requires a reason and never fires without one. All three close
 * the drawer and ask the parent to reload — the backend does the rest of the
 * resolution itself (course-map POST flips the request row and assigns
 * everyone waiting; there is nothing else to call).
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, BookOpen, ExternalLink, Link2, Loader2, RotateCcw, XCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation'
import { LMS_COURSE_BUILDER_ACCESS_LINK } from '@/lib/gtg-navigation'
import {
  capabilityGapInboxService,
  type CapabilityCourseRequestDetail,
} from '@/services/lms/capability-gap'
import { CmCapabilityProgress } from '@/domain/competency/cm-capability-progress'
import { MapExistingCourseDialog } from './map-existing-course-dialog'
import { DismissReasonDialog } from './dismiss-reason-dialog'

const STATUS_LABEL: Record<CapabilityCourseRequestDetail['status'], string> = {
  open: 'Needs a course',
  course_created: 'Course mapped',
  dismissed: 'Dismissed',
  superseded: 'Resolved on its own',
}

const STATUS_VARIANT: Record<CapabilityCourseRequestDetail['status'], 'pending' | 'active' | 'inactive'> = {
  open: 'pending',
  course_created: 'active',
  dismissed: 'inactive',
  superseded: 'active',
}

export function GapDetailDrawer({
  requestId,
  onClose,
  onChanged,
}: {
  /** Null closes the drawer. */
  requestId: number | null
  onClose: () => void
  /** Called after dismiss, reopen, or a successful course mapping. */
  onChanged: () => void
}) {
  const { user } = useAuth()
  const router = useRouter()
  const { resolveAccessLink } = useSidebarNavigation()
  const resolveContext = useCallback(() => getLaravelContext(user), [user])

  const [detail, setDetail] = useState<CapabilityCourseRequestDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [dismissOpen, setDismissOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!requestId) return
    setLoading(true)
    setError(null)
    try {
      const response = await capabilityGapInboxService.get(resolveContext(), requestId)
      setDetail(response.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this request.')
    } finally {
      setLoading(false)
    }
  }, [requestId, resolveContext])

  useEffect(() => {
    queueMicrotask(() => {
      if (requestId) {
        void load()
      } else {
        setDetail(null)
        setExpandedUserId(null)
      }
    })
  }, [requestId, load])

  const handleCreateCourse = () => {
    if (!detail) return
    const route = resolveAccessLink(LMS_COURSE_BUILDER_ACCESS_LINK)
    router.push(`${route}?competency_id=${detail.competency_id}`)
  }

  const handleDismiss = async (reason: string) => {
    if (!detail) return
    setBusy(true)
    try {
      await capabilityGapInboxService.dismiss(resolveContext(), detail.id, reason)
      setDismissOpen(false)
      onChanged()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not dismiss this request.')
    } finally {
      setBusy(false)
    }
  }

  const handleReopen = async () => {
    if (!detail) return
    setBusy(true)
    try {
      await capabilityGapInboxService.reopen(resolveContext(), detail.id)
      onChanged()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reopen this request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Sheet open={requestId !== null} onOpenChange={(next) => !next && onClose()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {loading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {!loading && error && (
            <ErrorState title="Couldn't load this request" description={error} retry={load} />
          )}

          {!loading && !error && detail && (
            <div className="flex flex-col gap-5">
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{detail.competency_name}</SheetTitle>
                  {detail.is_mandatory && (
                    <Badge variant="destructive" className="text-[10px] font-bold uppercase">
                      Mandatory
                    </Badge>
                  )}
                  <StatusBadge variant={STATUS_VARIANT[detail.status]} className="text-[10px] font-bold uppercase">
                    {STATUS_LABEL[detail.status]}
                  </StatusBadge>
                </div>
                <SheetDescription>
                  Requires level {detail.required_proficiency}. Raised {detail.first_raised_at} · last
                  seen {detail.last_seen_at}
                  {detail.times_seen > 1 ? ` · re-raised ${detail.times_seen} times` : ''}.
                </SheetDescription>
              </SheetHeader>

              {detail.status === 'dismissed' && detail.dismissed_reason && (
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Dismissed{detail.dismissed_at ? ` on ${detail.dismissed_at}` : ''}
                  </p>
                  <p className="mt-1 text-foreground">{detail.dismissed_reason}</p>
                </div>
              )}

              {/* ── Affected employees — worst gap first, per the API ── */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Affected ({detail.affected.length})
                </h4>
                {detail.affected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nobody is currently below the requirement on this competency.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {detail.affected.map((person) => (
                      <li
                        key={person.user_id}
                        className="rounded-lg border border-border/60 bg-card"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                          onClick={() =>
                            setExpandedUserId((current) =>
                              current === person.user_id ? null : person.user_id,
                            )
                          }
                        >
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {person.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {person.department ?? '—'}
                            </span>
                          </div>
                          <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="size-3.5" />
                            {person.measured_level === null ? 'unmeasured' : person.measured_level}
                            {' / '}
                            {person.required_proficiency}
                            {person.gap !== null && <span className="ml-1">gap {person.gap}</span>}
                          </span>
                        </button>
                        {expandedUserId === person.user_id && (
                          <div className="border-t border-border/40 bg-muted/10 p-3">
                            <CmCapabilityProgress
                              userId={person.user_id}
                              competencyId={detail.competency_id}
                              title="This person's progress"
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <SheetFooter className="flex-col gap-2 sm:flex-col">
                {detail.status === 'open' && (
                  <>
                    <Button className="w-full gap-2 font-bold" onClick={handleCreateCourse}>
                      <BookOpen className="size-4" /> Create a course
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-2 font-bold"
                      onClick={() => setMapOpen(true)}
                    >
                      <Link2 className="size-4" /> Map an existing course
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-2 font-bold text-destructive border-destructive/20"
                      onClick={() => setDismissOpen(true)}
                    >
                      <XCircle className="size-4" /> Dismiss
                    </Button>
                  </>
                )}

                {(detail.status === 'dismissed' || detail.status === 'superseded') && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 font-bold"
                    disabled={busy}
                    onClick={() => void handleReopen()}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                    Reopen
                  </Button>
                )}

                {detail.status === 'course_created' && detail.created_course_id && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 font-bold"
                    onClick={() => {
                      const route = resolveAccessLink(LMS_COURSE_BUILDER_ACCESS_LINK)
                      router.push(`${route}?course_id=${detail.created_course_id}`)
                    }}
                  >
                    <ExternalLink className="size-4" /> View the mapped course
                  </Button>
                )}
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {detail && (
        <>
          <MapExistingCourseDialog
            open={mapOpen}
            onClose={() => setMapOpen(false)}
            competencyIds={[detail.competency_id]}
            competencyLabel={detail.competency_name}
            onMapped={() => {
              setMapOpen(false)
              onChanged()
              void load()
            }}
          />
          <DismissReasonDialog
            open={dismissOpen}
            onOpenChange={setDismissOpen}
            label={detail.competency_name}
            busy={busy}
            onConfirm={(reason) => void handleDismiss(reason)}
          />
        </>
      )}
    </>
  )
}
