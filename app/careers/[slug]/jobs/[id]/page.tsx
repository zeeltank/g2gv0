'use client'

import { useEffect, useMemo, useRef, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Clock, Users, GraduationCap, BadgeCheck, CalendarDays, CheckCircle2, Paperclip,
} from 'lucide-react'
import {
  careersApi,
  CareersError,
  formatDeadline,
  formatSalaryRange,
  type CareersOrganisation,
  type CareersPosting,
} from '@/lib/careers-api'

/**
 * One role, and the form that applies for it. Public: no login required.
 *
 * The form follows the module's dialog conventions even though it is not in a
 * dialog: the form-level error renders ABOVE the fields rather than as a toast,
 * and each field carries its own message underneath. Server-side validation
 * errors are mapped back onto the fields they belong to, so a candidate is told
 * which answer to change rather than "Request failed".
 */
export default function CareersJobPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = use(params)

  const [org, setOrg] = useState<CareersOrganisation | null>(null)
  const [posting, setPosting] = useState<CareersPosting | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // `loading` already starts true and this page remounts on a route-param
    // change, so setting it synchronously here only triggers a cascading render.
    careersApi
      .posting(slug, id)
      .then((data) => {
        if (cancelled) return
        setOrg(data.organisation)
        setPosting(data.posting)
        setLoadError(null)
      })
      .catch((cause) => {
        if (cancelled) return
        setLoadError(cause instanceof Error ? cause.message : 'This role could not be loaded.')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [slug, id])

  const salary = useMemo(
    () => (posting ? formatSalaryRange(posting.salary_min, posting.salary_max) : null),
    [posting],
  )
  const closes = useMemo(() => (posting ? formatDeadline(posting.deadline) : null), [posting])

  return (
    <div className="@container/job mx-auto w-full max-w-5xl px-4 py-8 @2xl/job:px-6 @2xl/job:py-12">
      <Link
        href={`/careers/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All roles
      </Link>

      {loading ? (
        <div className="mt-6 animate-pulse space-y-3">
          <div className="h-32 rounded-xl bg-muted/50" />
          <div className="h-80 rounded-xl bg-muted/40" />
        </div>
      ) : loadError ? (
        <div
          className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
          role="alert"
        >
          <p className="text-sm font-semibold text-destructive">This role is not available</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{loadError}</p>
        </div>
      ) : posting && org ? (
        <>
          <header className="mt-4 rounded-xl border border-border bg-card p-6 @2xl/job:p-8">
            {posting.department && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {posting.department}
              </span>
            )}
            <h1 className="mt-1 text-2xl font-bold text-foreground @2xl/job:text-3xl">
              {posting.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{org.name}</p>

            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 @2xl/job:grid-cols-4">
              <Fact icon={MapPin} label="Location" value={posting.location} />
              <Fact icon={Clock} label="Type" value={posting.employment_type} />
              <Fact icon={Users} label="Openings" value={posting.positions?.toString() ?? null} numeric />
              <Fact icon={BadgeCheck} label="Experience" value={posting.experience} />
            </dl>

            {(salary || closes) && (
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-3.5 py-2.5">
                {salary && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Salary
                    </span>
                    <p className="text-sm font-semibold tabular-nums text-foreground">{salary}</p>
                  </div>
                )}
                {closes && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Applications close
                    </span>
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-foreground">
                      <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {closes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </header>

          <div className="mt-4 grid grid-cols-1 gap-4 @4xl/job:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-4">
              {posting.description && (
                <Section title="About this role">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {posting.description}
                  </p>
                </Section>
              )}

              {posting.skills.length > 0 && (
                <Section title="Skills we are looking for">
                  <ul className="flex flex-wrap gap-1.5">
                    {posting.skills.map((skill) => (
                      <li
                        key={skill}
                        className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {(posting.education || posting.certifications) && (
                <Section title="Qualifications">
                  <dl className="space-y-2 text-sm">
                    {posting.education && (
                      <div className="flex gap-2">
                        <GraduationCap className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <dt className="font-medium text-foreground">Education</dt>
                          <dd className="text-muted-foreground">{posting.education}</dd>
                        </div>
                      </div>
                    )}
                    {posting.certifications && (
                      <div className="flex gap-2">
                        <BadgeCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <dt className="font-medium text-foreground">Certifications</dt>
                          <dd className="text-muted-foreground">{posting.certifications}</dd>
                        </div>
                      </div>
                    )}
                  </dl>
                </Section>
              )}

              {posting.benefits && (
                <Section title="What we offer">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {posting.benefits}
                  </p>
                </Section>
              )}
            </div>

            <div className="@4xl/job:sticky @4xl/job:top-6 @4xl/job:self-start">
              <ApplyForm slug={slug} postingId={posting.id} roleTitle={posting.title} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 @2xl/job:p-6">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Fact({
  icon: Icon,
  label,
  value,
  numeric = false,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  value: string | null
  numeric?: boolean
}) {
  if (!value) return null
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden={true} />
        <span className={numeric ? 'tabular-nums' : undefined}>{value}</span>
      </dd>
    </div>
  )
}

/* ─────────────────────────── the application form ────────────────────────── */

type FieldKey =
  | 'first_name' | 'last_name' | 'email' | 'mobile' | 'current_location'
  | 'experience' | 'education' | 'expected_salary' | 'skills' | 'resume'

const REQUIRED: FieldKey[] = ['first_name', 'last_name', 'email', 'mobile', 'resume']

function ApplyForm({
  slug,
  postingId,
  roleTitle,
}: {
  slug: string
  postingId: number
  roleTitle: string
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [resume, setResume] = useState<File | null>(null)
  /** Consent to retain, off by default. Never assumed from the application itself. */
  const [keepOnFile, setKeepOnFile] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const errorRef = useRef<HTMLDivElement | null>(null)

  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }))

  /** Mirrors the server rules exactly, and adds nothing to them. */
  function whatIsMissing(): Partial<Record<FieldKey, string>> {
    const missing: Partial<Record<FieldKey, string>> = {}
    for (const key of REQUIRED) {
      if (key === 'resume') continue
      if (!(values[key] ?? '').trim()) missing[key] = 'This is required.'
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      missing.email = 'Enter a valid email address.'
    }
    if (!resume) missing.resume = 'Please attach your CV.'
    else if (!/\.(pdf|doc|docx)$/i.test(resume.name)) missing.resume = 'CV must be a PDF, DOC or DOCX.'
    else if (resume.size > 5 * 1024 * 1024) missing.resume = 'CV must be smaller than 5MB.'
    return missing
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    const missing = whatIsMissing()
    if (Object.keys(missing).length > 0) {
      setErrors(missing)
      setFormError('Please check the highlighted fields.')
      errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }

    setErrors({})
    setSubmitting(true)
    try {
      const form = new FormData()
      Object.entries(values).forEach(([key, value]) => value && form.append(key, value))
      form.append('consent_to_retain', keepOnFile ? '1' : '0')
      if (resume) form.append('resume', resume)
      await careersApi.apply(slug, postingId, form)
      setDone(true)
    } catch (cause) {
      if (cause instanceof CareersError && cause.fieldErrors) {
        // Map the server's per-field messages back onto the fields they belong to.
        const mapped: Partial<Record<FieldKey, string>> = {}
        Object.entries(cause.fieldErrors).forEach(([field, messages]) => {
          mapped[field as FieldKey] = messages[0]
        })
        setErrors(mapped)
      }
      setFormError(cause instanceof Error ? cause.message : 'Your application could not be sent.')
      errorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <section className="rounded-xl border border-success/30 bg-success/5 p-6 text-center" role="status">
        <CheckCircle2 className="mx-auto mb-3 size-8 text-success" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">Application received</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          Thank you for applying for <span className="font-medium text-foreground">{roleTitle}</span>.
          The hiring team will be in touch by email.
        </p>
        <Link
          href={`/careers/${slug}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to all roles
        </Link>
      </section>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-xl border border-border bg-card p-5 @2xl/job:p-6">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground">Apply for this role</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        No account needed. Fields marked <span aria-hidden="true">*</span> are required.
      </p>

      {/* Inside the form and above the fields, never a toast. */}
      <div ref={errorRef}>
        {formError && (
          <div
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {formError}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 @md/job:grid-cols-2">
        <Field label="First name" required error={errors.first_name}>
          <Input value={values.first_name ?? ''} onChange={(v) => set('first_name', v)} autoComplete="given-name" />
        </Field>
        <Field label="Last name" required error={errors.last_name}>
          <Input value={values.last_name ?? ''} onChange={(v) => set('last_name', v)} autoComplete="family-name" />
        </Field>
        <Field label="Email" required error={errors.email} span2>
          <Input type="email" value={values.email ?? ''} onChange={(v) => set('email', v)} autoComplete="email" />
        </Field>
        <Field label="Mobile" required error={errors.mobile}>
          <Input value={values.mobile ?? ''} onChange={(v) => set('mobile', v)} autoComplete="tel" />
        </Field>
        <Field label="Current location" error={errors.current_location}>
          <Input value={values.current_location ?? ''} onChange={(v) => set('current_location', v)} />
        </Field>
        <Field label="Experience" error={errors.experience}>
          <Input value={values.experience ?? ''} onChange={(v) => set('experience', v)} placeholder="e.g. 4 years" />
        </Field>
        <Field label="Highest education" error={errors.education}>
          <Input value={values.education ?? ''} onChange={(v) => set('education', v)} />
        </Field>
        <Field label="Expected salary" error={errors.expected_salary} span2>
          <Input
            value={values.expected_salary ?? ''}
            onChange={(v) => set('expected_salary', v)}
            placeholder="Annual, in rupees"
            inputMode="numeric"
          />
        </Field>
        <Field label="Your skills" error={errors.skills} span2>
          <Input
            value={values.skills ?? ''}
            onChange={(v) => set('skills', v)}
            placeholder="Comma separated, e.g. PHP, Laravel, MySQL"
          />
        </Field>

        <Field label="CV" required error={errors.resume} span2>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/40">
            <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={resume ? 'truncate text-foreground' : 'text-muted-foreground'}>
              {resume ? resume.name : 'Attach a PDF, DOC or DOCX (max 5MB)'}
            </span>
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setResume(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>
      </div>

      {/*
        Keeping a CV for roles the candidate has not applied for is a different
        thing from processing this application, so it is asked separately and
        defaults to no. The application works either way.
      */}
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
        <input
          type="checkbox"
          checked={keepOnFile}
          onChange={(e) => setKeepOnFile(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-input accent-[var(--color-primary)]"
        />
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Keep my details for future roles.</span>{' '}
          We will hold your CV and contact details so the team can consider you for other openings.
          Leave this unticked and they are used only for this application.
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {submitting ? 'Sending…' : 'Submit application'}
      </button>
    </form>
  )
}

function Field({
  label,
  required,
  error,
  span2,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  span2?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={span2 ? '@md/job:col-span-2' : undefined}>
      <span className="mb-1.5 block text-xs font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
      </span>
      {children}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  )
}

function Input({
  value,
  onChange,
  type = 'text',
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  inputMode?: 'numeric'
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      {...rest}
    />
  )
}
