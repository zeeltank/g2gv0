'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, Check, Copy, Info, ShieldCheck, UserPlus } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WizardLayout } from '@/components/shared/wizard/wizard-layout'
import { WizardFooter } from '@/components/shared/wizard/wizard-footer'
import type { StepperStep } from '@/components/shared/wizard/setup-stepper'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { ApiError } from '@/services/core'
import {
  platformOrganizationsService,
  type CreateOrganizationResponse,
  type PlatformOrganization,
} from '@/services/platform/organizations'

/**
 * CREATE AN ORGANISATION — the internal operator's screen.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PRODUCT COULD NOT DO THIS FROM A SCREEN AT ALL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `POST /api/school-setup` has existed the whole time, has never had a frontend
 * anywhere, and until now carried no authentication either. Every organisation
 * on live was created by somebody calling it by hand and then calling
 * `/api/user-signup` separately to make an account that could sign in.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE STEPS, AND THE THIRD IS THE HONEST ONE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   1. The organisation   its name and how to reach it
 *   2. Its administrator  the one account that can then do everything else
 *   3. Review             read it back before anything is written
 *
 * Nothing is saved until Review. That is deliberate and it is the opposite of
 * the save-as-you-go pattern used elsewhere in this product: an abandoned
 * department is a draft somebody can finish, whereas an abandoned ORGANISATION
 * is a row in a table carrying 96 inbound foreign keys that nothing in the
 * product can delete. Half a tenant is not a draft; it is litter that cannot be
 * swept up.
 *
 * ── THE EMAIL RULE IS SURFACED, NOT DISCOVERED ──────────────────────────────
 *
 * `tbluser.email` is UNIQUE across every organisation, so an address already
 * used elsewhere cannot be an administrator here. The form says so before you
 * type, and the server's 422 lands on the field rather than in a banner.
 */

type Step = 'organisation' | 'administrator' | 'review'

const STEP_ORDER: Step[] = ['organisation', 'administrator', 'review']

const STEP_LABEL: Record<Step, string> = {
  organisation: 'The organisation',
  administrator: 'Its administrator',
  review: 'Review & create',
}

type FormState = {
  name: string
  contact_person: string
  email: string
  mobile: string
  industry: string
  admin_first_name: string
  admin_last_name: string
  admin_email: string
  admin_mobile: string
  admin_password: string
}

const EMPTY: FormState = {
  name: '',
  contact_person: '',
  email: '',
  mobile: '',
  industry: '',
  admin_first_name: '',
  admin_last_name: '',
  admin_email: '',
  admin_mobile: '',
  admin_password: '',
}

/** A field, its label, and the server's complaint about it if there is one. */
function Field({
  id,
  label,
  hint,
  required,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
        {!required && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{value || '—'}</dd>
    </div>
  )
}

export function CreateOrganizationForm() {
  const router = useRouter()
  const { user } = useAuth()

  const [step, setStep] = useState<Step>('organisation')
  const [form, setForm] = useState<FormState>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<CreateOrganizationResponse['data'] | null>(null)
  const [existing, setExisting] = useState<PlatformOrganization[]>([])

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    // The server's complaint about this field is about the OLD value.
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  /*
   * The roster is loaded so the operator can see what already exists, which is
   * the cheapest possible guard against creating the same customer twice — the
   * server enforces the unique name, but finding out at submit is worse than
   * seeing the list.
   */
  const loadExisting = useCallback(async () => {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) return

    try {
      const response = await platformOrganizationsService.list(context)
      setExisting(response.data?.organizations ?? [])
    } catch {
      // A roster that will not load is not a reason to block creation.
      setExisting([])
    }
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void loadExisting()
    })
  }, [loadExisting])

  const duplicateName = useMemo(() => {
    const name = form.name.trim().toLowerCase()

    if (!name) return null

    return existing.find((org) => org.name?.trim().toLowerCase() === name) ?? null
  }, [existing, form.name])

  const canLeaveOrganisation = form.name.trim().length > 0 && !duplicateName
  const canLeaveAdministrator =
    form.admin_first_name.trim().length > 0 &&
    form.admin_email.trim().length > 0 &&
    form.admin_password.length >= 8

  const steps: StepperStep[] = STEP_ORDER.map((key, index) => {
    const currentIndex = STEP_ORDER.indexOf(step)

    return {
      key,
      label: STEP_LABEL[key],
      state: created
        ? 'complete'
        : key === step
          ? 'current'
          : index < currentIndex
            ? 'complete'
            : 'upcoming',
    }
  })

  async function create() {
    const context = getLaravelContext(user)

    if (!isLaravelContextReady(context)) {
      setError('Your session is unavailable. Sign in again.')
      return
    }

    setBusy(true)
    setError(null)
    setFieldErrors({})

    try {
      const response = await platformOrganizationsService.create(context, {
        name: form.name.trim(),
        contact_person: form.contact_person.trim() || undefined,
        email: form.email.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        industry: form.industry.trim() || undefined,
        admin_first_name: form.admin_first_name.trim(),
        admin_last_name: form.admin_last_name.trim() || undefined,
        admin_email: form.admin_email.trim(),
        admin_mobile: form.admin_mobile.trim() || undefined,
        admin_password: form.admin_password,
      })

      setCreated(response.data)
      await loadExisting()
    } catch (reason) {
      if (reason instanceof ApiError && reason.errors) {
        /*
         * 422 lands on the field, not in a banner. The two rules that actually
         * bite — a duplicate organisation name, and an admin email already used
         * in ANOTHER organisation — are both things the person can fix in place,
         * and both are impossible to guess from a generic failure.
         */
        setFieldErrors(
          Object.fromEntries(
            Object.entries(reason.errors).map(([field, messages]) => [field, messages[0]]),
          ),
        )
        // Send them back to the step that owns the first bad field.
        const bad = Object.keys(reason.errors)[0] ?? ''
        setStep(bad.startsWith('admin_') ? 'administrator' : 'organisation')
        setError('Some details need changing before this can be created.')
      } else {
        setError(reason instanceof Error ? reason.message : 'The organisation could not be created.')
      }
    } finally {
      setBusy(false)
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (created) {
    return (
      <WizardLayout
        title={created.name}
        subtitle="Created and ready to use."
        steps={steps}
        exitLabel="Done"
        exitHref="/platform/organizations/new"
      >
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                {created.name} is ready
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Organisation <span className="font-medium text-foreground">#{created.tenant_id}</span>,
                short code <span className="font-medium text-foreground">{created.short_code}</span>.
                Nine roles were created and {created.rights_granted} permissions granted.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Give these to the administrator
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded bg-background px-2 py-1 text-sm text-foreground">
                {created.admin_email}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void navigator.clipboard?.writeText(created.admin_email)}
              >
                <Copy className="size-4" aria-hidden="true" />
                Copy
              </Button>
            </div>
            {/*
              The password is NOT echoed back. It was typed on this screen and it
              is hashed on the server; reprinting it here would put a live
              credential into a page somebody may leave open, and the operator
              already has it.
            */}
            <p className="mt-2 text-xs text-muted-foreground">
              The password is the one you just set. It is stored hashed and cannot be shown again.
            </p>
          </div>

          <Alert variant="info">
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle>What happens next</AlertTitle>
            <AlertDescription>
              When their administrator signs in, they land on a setup checklist that reads their
              own records — organisation details, departments, people and capabilities. Nothing
              was invented on their behalf.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setCreated(null)
                setForm(EMPTY)
                setStep('organisation')
              }}
            >
              Create another
            </Button>
            <Button onClick={() => router.push('/dashboard')}>
              Back to dashboard
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </WizardLayout>
    )
  }

  // ── The three steps ───────────────────────────────────────────────────────
  const aside = (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Already on the platform
      </p>
      {existing.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {existing.slice(0, 8).map((org) => (
            <li key={org.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-foreground">{org.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {org.people} {org.people === 1 ? 'person' : 'people'}
              </span>
            </li>
          ))}
          {existing.length > 8 && (
            <li className="text-xs text-muted-foreground">
              and {existing.length - 8} more
            </li>
          )}
        </ul>
      )}
    </div>
  )

  return (
    <WizardLayout
      title="Create an organisation"
      subtitle="Nothing is saved until you confirm on the last step."
      steps={steps}
      aside={aside}
      footer={
        <WizardFooter
          onBack={step === 'organisation' ? undefined : () => setStep(STEP_ORDER[STEP_ORDER.indexOf(step) - 1])}
          onNext={
            step === 'review'
              ? create
              : () => setStep(STEP_ORDER[STEP_ORDER.indexOf(step) + 1])
          }
          nextLabel={
            step === 'organisation'
              ? 'Continue to the administrator'
              : step === 'administrator'
                ? 'Review before creating'
                : 'Create the organisation'
          }
          busy={busy}
          nextDisabled={
            step === 'organisation'
              ? !canLeaveOrganisation
              : step === 'administrator'
                ? !canLeaveAdministrator
                : false
          }
          note={
            step === 'review'
              ? 'This creates the organisation, its nine roles, its permissions and its first administrator in one go.'
              : undefined
          }
        />
      }
    >
      {error && (
        <Alert variant="destructive" className="mb-5">
          <Info className="size-4" aria-hidden="true" />
          <AlertTitle>Not created</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 'organisation' && (
        <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
          <header className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">The organisation</h2>
              <p className="text-sm text-muted-foreground">
                Its legal details come later — this is what it is called and how to reach it.
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                id="org-name"
                label="Organisation name"
                required
                error={fieldErrors.name ?? (duplicateName ? `“${duplicateName.name}” already exists.` : undefined)}
                hint="Shown throughout the product. It has to be unique."
              >
                <Input id="org-name" value={form.name} onChange={set('name')} placeholder="Aqua Solutions" />
              </Field>
            </div>

            <Field id="org-contact" label="Contact person" error={fieldErrors.contact_person}>
              <Input id="org-contact" value={form.contact_person} onChange={set('contact_person')} />
            </Field>

            <Field id="org-industry" label="Industry" error={fieldErrors.industry}>
              <Input id="org-industry" value={form.industry} onChange={set('industry')} placeholder="Information Technology" />
            </Field>

            <Field id="org-email" label="Organisation email" error={fieldErrors.email}>
              <Input id="org-email" type="email" value={form.email} onChange={set('email')} />
            </Field>

            <Field id="org-mobile" label="Phone" error={fieldErrors.mobile}>
              <Input id="org-mobile" value={form.mobile} onChange={set('mobile')} />
            </Field>
          </div>

          <p className="text-xs text-muted-foreground">
            A short code is derived from the name and made unique automatically.
          </p>
        </section>
      )}

      {step === 'administrator' && (
        <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
          <header className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">Its first administrator</h2>
              <p className="text-sm text-muted-foreground">
                The one account that can then set everything else up.
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="admin-first" label="First name" required error={fieldErrors.admin_first_name}>
              <Input id="admin-first" value={form.admin_first_name} onChange={set('admin_first_name')} />
            </Field>

            <Field id="admin-last" label="Last name" error={fieldErrors.admin_last_name}>
              <Input id="admin-last" value={form.admin_last_name} onChange={set('admin_last_name')} />
            </Field>

            <div className="sm:col-span-2">
              <Field
                id="admin-email"
                label="Email address"
                required
                error={fieldErrors.admin_email}
                hint="This is how they sign in. Every account on the platform needs its own address — one already used in another organisation cannot be reused here."
              >
                <Input id="admin-email" type="email" value={form.admin_email} onChange={set('admin_email')} />
              </Field>
            </div>

            <Field id="admin-mobile" label="Phone" error={fieldErrors.admin_mobile}>
              <Input id="admin-mobile" value={form.admin_mobile} onChange={set('admin_mobile')} />
            </Field>

            <Field
              id="admin-password"
              label="Temporary password"
              required
              error={fieldErrors.admin_password}
              hint="At least 8 characters. Stored hashed — it cannot be shown again afterwards."
            >
              <Input
                id="admin-password"
                type="password"
                value={form.admin_password}
                onChange={set('admin_password')}
              />
            </Field>
          </div>
        </section>
      )}

      {step === 'review' && (
        <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:p-6">
          <header className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">Review</h2>
              <p className="text-sm text-muted-foreground">
                Nothing has been written yet. Check it, then create.
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Organisation
              </p>
              <dl className="divide-y divide-border/60">
                <ReviewRow label="Name" value={form.name} />
                <ReviewRow label="Contact" value={form.contact_person} />
                <ReviewRow label="Industry" value={form.industry} />
                <ReviewRow label="Email" value={form.email} />
                <ReviewRow label="Phone" value={form.mobile} />
              </dl>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Administrator
              </p>
              <dl className="divide-y divide-border/60">
                <ReviewRow
                  label="Name"
                  value={[form.admin_first_name, form.admin_last_name].filter(Boolean).join(' ')}
                />
                <ReviewRow label="Email" value={form.admin_email} />
                <ReviewRow label="Phone" value={form.admin_mobile} />
                <ReviewRow label="Password" value={form.admin_password ? 'Set' : ''} />
              </dl>
            </div>
          </div>

          <Alert variant="info">
            <Info className="size-4" aria-hidden="true" />
            <AlertTitle>What this creates</AlertTitle>
            <AlertDescription>
              The organisation, its nine standard roles, the permissions its administrator and HR
              need to get started, an organisation profile seeded with what you entered above, and
              the administrator account. All in one transaction — if any part fails, none of it is
              created.
            </AlertDescription>
          </Alert>
        </section>
      )}
    </WizardLayout>
  )
}
