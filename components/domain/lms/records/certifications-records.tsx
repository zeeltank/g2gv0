'use client'

import React, { useState } from 'react'
import {
  AlertCircle,
  Award,
  Clock,
  Download,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Progress } from '@/components/ui/progress'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useCertifications } from '@/hooks/use-certifications'
import type { CertificateVerification, LearningCertificate } from '@/services/lms'

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : format(parsed, 'dd MMM yyyy')
}

const STATE_VARIANT: Record<string, 'active' | 'pending' | 'error'> = {
  active: 'active',
  expiring: 'pending',
  expired: 'error',
}

const STATE_LABEL: Record<string, string> = {
  active: 'Active',
  expiring: 'Expiring Soon',
  expired: 'Expired',
}

/** Reads naturally in both directions: "in 44 days" / "Expired 42 days ago". */
function expiryHint(certificate: LearningCertificate) {
  if (certificate.days_to_expiry === null) return 'Never expires'
  if (certificate.days_to_expiry < 0) {
    return `Expired ${Math.abs(certificate.days_to_expiry)} days ago`
  }
  return `in ${certificate.days_to_expiry} days`
}

function toCsv(rows: string[][], filename: string) {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const blob = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  label: string
  value: number
  sub: string
  icon: React.ElementType
  loading: boolean
}) {
  return (
    <Card className="rounded-xl border-border/80 shadow-sm">
      <CardContent className="p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Icon className="size-4" /> {label}
        </p>
        {loading ? (
          <Skeleton className="mt-1.5 h-7 w-12" />
        ) : (
          <h3 className="mt-1 text-2xl font-black tracking-tight text-foreground">{value}</h3>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

/* ─── Shared certificate table ─────────────────────────────────────────────── */

function CertificateTable({
  certificates,
  loading,
  showLearner,
  onSelect,
  emptyTitle = 'No certificates yet',
  emptyDescription = 'Certificates appear here once a course is completed.',
}: {
  certificates: LearningCertificate[]
  loading: boolean
  showLearner: boolean
  onSelect: (certificate: LearningCertificate) => void
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 rounded-lg" />
        ))}
      </div>
    )
  }

  if (certificates.length === 0) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
        <EmptyState icon={<Award className="size-8" />} title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Certificate</TableHead>
            {showLearner && <TableHead>Learner</TableHead>}
            <TableHead>Credential ID</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead>Valid Until</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certificates.map((certificate) => (
            <TableRow
              key={certificate.id}
              className="cursor-pointer"
              onClick={() => onSelect(certificate)}
            >
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Award
                    className={cn(
                      'size-4 shrink-0',
                      certificate.expiry_state === 'expired'
                        ? 'text-destructive'
                        : certificate.expiry_state === 'expiring'
                          ? 'text-warning'
                          : 'text-success',
                    )}
                  />
                  <span className="font-semibold text-foreground">
                    {certificate.course_title ?? 'Certificate'}
                  </span>
                </div>
              </TableCell>
              {showLearner && (
                <TableCell>
                  {certificate.learner_name || '—'}
                  {certificate.employee_no && (
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      ({certificate.employee_no})
                    </span>
                  )}
                </TableCell>
              )}
              <TableCell className="font-mono text-xs">{certificate.certificate_number}</TableCell>
              <TableCell>{formatDate(certificate.issued_at)}</TableCell>
              <TableCell>
                {certificate.expires_at ? (
                  <div className="flex flex-col">
                    <span>{formatDate(certificate.expires_at)}</span>
                    <span
                      className={cn(
                        'text-[11px]',
                        certificate.expiry_state === 'expired'
                          ? 'text-destructive'
                          : 'text-muted-foreground',
                      )}
                    >
                      {expiryHint(certificate)}
                    </span>
                  </div>
                ) : (
                  'Never'
                )}
              </TableCell>
              <TableCell>
                <StatusBadge
                  variant={STATE_VARIANT[certificate.expiry_state] ?? 'active'}
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  {STATE_LABEL[certificate.expiry_state] ?? certificate.expiry_state}
                </StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function CertificationsRecords() {
  const {
    certificates, transcript, history, renewals,
    kpis, warningDays, isOrgWide,
    loading, error, reload,
    search, setSearch, statusFilter, setStatusFilter,
    filteredCertificates,
    canReissue, certificateUrl, reissue, verify,
    busy, message, actionError, dismiss,
  } = useCertifications()

  const [activeTab, setActiveTab] = useState('certificates')
  const [selected, setSelected] = useState<LearningCertificate | null>(null)
  const [confirmReissue, setConfirmReissue] = useState<LearningCertificate | null>(null)
  const [verification, setVerification] = useState<CertificateVerification | null>(null)

  const tabs = [
    { id: 'certificates', label: 'Certificates', badge: certificates.length },
    { id: 'transcript', label: 'Learning Transcript', badge: transcript.length },
    { id: 'history', label: 'Completion History', badge: history.length },
    { id: 'renewals', label: 'Renewals Due', badge: renewals.length },
  ]

  const exportCertificates = () =>
    toCsv(
      [
        ['Credential ID', ...(isOrgWide ? ['Learner'] : []), 'Course', 'Issued', 'Valid Until', 'Status'],
        ...filteredCertificates.map((certificate) => [
          certificate.certificate_number,
          ...(isOrgWide ? [certificate.learner_name ?? ''] : []),
          certificate.course_title ?? '',
          formatDate(certificate.issued_at),
          certificate.expires_at ? formatDate(certificate.expires_at) : 'Never',
          STATE_LABEL[certificate.expiry_state] ?? certificate.expiry_state,
        ]),
      ],
      `certificates-${new Date().toISOString().slice(0, 10)}.csv`,
    )

  const exportTranscript = () =>
    toCsv(
      [
        ['Course', 'Category', 'Started', 'Completed'],
        ...transcript.map((course) => [
          course.display_name ?? '',
          course.subject_category ?? '',
          formatDate(course.start_date),
          formatDate(course.end_date),
        ]),
      ],
      `transcript-${new Date().toISOString().slice(0, 10)}.csv`,
    )

  if (error && !loading && certificates.length === 0) {
    return (
      <div className="p-6">
        <ErrorState title="Couldn't load records" description={error} retry={reload} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Certifications &amp; Records
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOrgWide
              ? 'Certificates and completion records across your organisation.'
              : 'Your certificates and completed learning.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={exportCertificates}
            disabled={filteredCertificates.length === 0}
          >
            <Download className="size-4" /> Export
          </Button>
          <Button className="gap-2" onClick={exportTranscript} disabled={transcript.length === 0}>
            <Download className="size-4" /> Download Transcript
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Active Certificates" value={kpis.active} sub="Currently valid" icon={Award} loading={loading} />
        <KpiCard
          label="Expiring Soon"
          value={kpis.expiring}
          sub={`Within ${warningDays} days`}
          icon={Clock}
          loading={loading}
        />
        <KpiCard label="Expired" value={kpis.expired} sub="Require renewal" icon={AlertCircle} loading={loading} />
        <KpiCard label="Total Earned" value={kpis.total} sub="All time" icon={Award} loading={loading} />
      </div>

      <div className="flex items-center gap-6 overflow-x-auto border-b border-border/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'relative flex items-center gap-2 whitespace-nowrap pb-3 text-sm font-semibold outline-none transition-colors',
              activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              {tab.badge}
            </span>
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-t-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'certificates' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-72">
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  isOrgWide
                    ? 'Search by course, credential or learner...'
                    : 'Search by course or credential...'
                }
              />
            </div>
            <div className="w-44">
              <Select
                value={statusFilter}
                onChange={(value) => setStatusFilter(String(value))}
                aria-label="Filter by status"
                options={[
                  { label: 'All statuses', value: '' },
                  { label: 'Active', value: 'active' },
                  { label: 'Expiring soon', value: 'expiring' },
                  { label: 'Expired', value: 'expired' },
                ]}
              />
            </div>
          </div>

          <CertificateTable
            certificates={filteredCertificates}
            loading={loading}
            showLearner={isOrgWide}
            onSelect={setSelected}
          />
        </>
      )}

      {activeTab === 'transcript' && (
        <div className="rounded-xl border border-border/80 bg-card shadow-sm">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : transcript.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<GraduationCap className="size-8" />}
                title="No completed courses"
                description="Courses you finish appear on your transcript."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transcript.map((course) => (
                  <TableRow key={course.enrollment_id ?? course.id}>
                    <TableCell className="font-semibold text-foreground">
                      {course.display_name ?? 'Untitled course'}
                    </TableCell>
                    <TableCell>{course.subject_category || '—'}</TableCell>
                    <TableCell>{formatDate(course.start_date)}</TableCell>
                    <TableCell>{formatDate(course.end_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="rounded-xl border border-border/80 bg-card shadow-sm">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<GraduationCap className="size-8" />}
                title="No learning history"
                description="Courses you are enrolled in appear here with their progress."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Lessons</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-semibold text-foreground">
                      {course.display_name ?? 'Untitled course'}
                    </TableCell>
                    <TableCell>
                      {course.completed_content}/{course.total_content}
                    </TableCell>
                    <TableCell>
                      <div className="flex w-28 flex-col gap-1">
                        <span className="text-[11px] font-bold text-foreground">
                          {course.progress_percent}%
                        </span>
                        <Progress
                          value={course.progress_percent}
                          className="h-1.5 bg-muted-foreground/20 [&>div]:bg-primary"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={course.enrollment_status === 'completed' ? 'active' : 'processing'}
                        className="text-[10px] font-bold uppercase tracking-wider"
                      >
                        {course.enrollment_status ?? '—'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{formatDate(course.end_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {activeTab === 'renewals' && (
        <>
          <p className="text-sm text-muted-foreground">
            Certificates expiring within {warningDays} days, or already expired — soonest first.
          </p>
          <CertificateTable
            certificates={renewals}
            loading={loading}
            showLearner={isOrgWide}
            onSelect={setSelected}
            emptyTitle="Nothing to renew"
            emptyDescription={`No certificate expires within ${warningDays} days.`}
          />
        </>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.course_title ?? 'Certificate'}</SheetTitle>
                <SheetDescription className="font-mono text-xs">
                  {selected.certificate_number}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 pt-2">
                <StatusBadge
                  variant={STATE_VARIANT[selected.expiry_state] ?? 'active'}
                  className="w-fit text-[10px] font-bold uppercase tracking-wider"
                >
                  {STATE_LABEL[selected.expiry_state] ?? selected.expiry_state}
                </StatusBadge>

                <div className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                  {isOrgWide && (
                    <>
                      <span className="font-medium text-muted-foreground">Learner</span>
                      <span className="font-semibold text-foreground">
                        {selected.learner_name || '—'}
                        {selected.employee_no ? ` (${selected.employee_no})` : ''}
                      </span>
                    </>
                  )}
                  <span className="font-medium text-muted-foreground">Issued on</span>
                  <span className="font-semibold text-foreground">{formatDate(selected.issued_at)}</span>
                  <span className="font-medium text-muted-foreground">Valid until</span>
                  <span className="font-semibold text-foreground">
                    {selected.expires_at ? formatDate(selected.expires_at) : 'Never expires'}
                  </span>
                  <span className="font-medium text-muted-foreground">Expiry</span>
                  <span className="font-semibold text-foreground">{expiryHint(selected)}</span>
                  {selected.subject_category && (
                    <>
                      <span className="font-medium text-muted-foreground">Category</span>
                      <span className="font-semibold text-foreground">{selected.subject_category}</span>
                    </>
                  )}
                  {selected.verification_code && (
                    <>
                      <span className="font-medium text-muted-foreground">Verify code</span>
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {selected.verification_code}
                      </span>
                    </>
                  )}
                  {/* Renewal lineage: only shown once a chain exists. */}
                  {selected.supersedes && (
                    <>
                      <span className="font-medium text-muted-foreground">Replaces</span>
                      <span className="font-semibold text-foreground">
                        certificate #{selected.supersedes}
                      </span>
                    </>
                  )}
                  {selected.superseded_by && (
                    <>
                      <span className="font-medium text-muted-foreground">Replaced by</span>
                      <span className="font-semibold text-foreground">
                        certificate #{selected.superseded_by}
                      </span>
                    </>
                  )}
                </div>

                {selected.description && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {selected.description}
                  </p>
                )}

                {selected.tags && selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selected.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* The competency link is what makes a certificate more than a document. */}
                {selected.skill_title && (
                  <p className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    Counts towards{' '}
                    <span className="font-semibold text-foreground">{selected.skill_title}</span> in
                    the competency framework.
                  </p>
                )}

                {verification && (
                  <div
                    className={cn(
                      'rounded-lg border p-3 text-xs',
                      verification.valid
                        ? 'border-success/40 bg-success/10 text-success'
                        : 'border-destructive/40 bg-destructive/10 text-destructive',
                    )}
                  >
                    <p className="font-semibold">
                      {verification.valid ? 'Valid credential' : 'Not valid'}
                    </p>
                    <p className="mt-0.5 opacity-90">{verification.message}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {/* A navigation, not a fetch: the browser's download manager
                      handles the binary body and keeps the server's filename. */}
                  <Button asChild variant="outline" className="gap-2">
                    <a
                      href={certificateUrl(selected.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="size-4" /> Download PDF
                    </a>
                  </Button>

                  {selected.verification_code && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={busy}
                      onClick={() => {
                        void verify(selected.verification_code as string).then(setVerification)
                      }}
                    >
                      <ShieldCheck className="size-4" /> Verify
                    </Button>
                  )}

                  {/* Re-issue is non-destructive — it supersedes rather than
                      replaces — but it still creates a credential, so it is
                      confirmed and admin/HR only. */}
                  {canReissue && !selected.superseded_by && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={busy}
                      onClick={() => setConfirmReissue(selected)}
                    >
                      <RefreshCw className="size-4" /> Re-issue
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={confirmReissue !== null}
        onOpenChange={(open) => !open && setConfirmReissue(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-issue this certificate?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmReissue?.certificate_number} will be marked superseded and kept on
              record. A new credential is issued with a fresh validity period —{' '}
              {confirmReissue?.learner_name || 'the learner'}&apos;s course progress is not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmReissue(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                const target = confirmReissue
                if (!target) return
                void reissue(target.id).then((result) => {
                  setConfirmReissue(null)
                  // The open sheet still holds the superseded row; close it so the
                  // user is not looking at a credential that is no longer current.
                  if (result.ok) {
                    setSelected(null)
                    setVerification(null)
                  }
                })
              }}
            >
              {busy ? 'Re-issuing…' : 'Re-issue'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(message || actionError) && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
            actionError
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-success/40 bg-success/10 text-success',
          )}
        >
          <span className="font-medium">{actionError ?? message}</span>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-bold uppercase tracking-wide opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
