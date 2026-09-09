'use client'

import type { ReactNode } from 'react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Globe, Mail, Network, Pencil, Phone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SectionCard, ReadField, AccessDenied } from './components'
import { getAccess, roleLabel, type Role } from '@/lib/gtg-roles'
import { useAuth } from '@/components/auth/gtg-auth'
import { getLaravelContext } from '@/lib/laravel-context'
import { organizationService, type LaravelOrgDetail } from '@/services/organization'

const LazyOrganizationInformationEditPanel = lazy(() =>
  import('@/domain/organization/organization-information-edit-panel').then((module) => ({
    default: module.OrganizationInformationEditPanel,
  })),
)

function ViewReadField({ label, value }: { label: string; value: ReactNode }) {
  return <ReadField label={label} value={value} />
}

function splitAddress(address?: string | null) {
  const parts = (address ?? '').split(',').map((part) => part.trim())
  return {
    line1: parts[0] ?? '',
    line2: parts[1] ?? '',
    city: parts[2] ?? '',
    state: parts[3] ?? '',
    postal: parts[4] ?? '',
    country: parts[5] ?? '',
  }
}

/**
 * The organisation, from the organisation's own record. Nothing invented.
 *
 * ── WHAT THIS USED TO DO ────────────────────────────────────────────────────
 *
 * Every field fell back to the `ORG_PROFILE` fixture — "GapstoGrowth
 * Technologies", CIN-U72900KA2014PTC076543, a Bengaluru address, 1,284
 * employees — so a blank field rendered another company's data as though it
 * were this one's. It was per FIELD, which is the dangerous part: dev tenant
 * `xyz` has six fields filled and nine blank, so that screen showed its own
 * name and email beside a different company's registration number, industry,
 * address and headcount, with nothing to tell them apart.
 *
 * Blank now stays blank. `ReadField` renders an em dash for an empty value, and
 * the screen says plainly when the profile has not been filled in.
 *
 * `fax` and `founded` are gone entirely rather than blanked: `org_details` has
 * no such columns, so those two fields could ONLY ever have shown the fixture.
 */
function mapOrgProfile(data?: LaravelOrgDetail) {
  const employeeCount = Number(data?.employee_count)

  return {
    name: data?.legal_name ?? '',
    code: data?.cin ?? '',
    registrationNumber: data?.cin ?? '',
    industry: data?.industry ?? '',
    // Not a stored column either, but unlike fax/founded it is a fixed fact
    // about how these tenants are constituted rather than a borrowed value.
    organizationType: 'Private Limited',
    website: data?.website ?? '',
    email: data?.email ?? '',
    phone: `${data?.country_code ?? ''} ${data?.mobile_no ?? ''}`.trim(),
    address: splitAddress(data?.registered_address),
    totalEmployees: Number.isFinite(employeeCount) && employeeCount > 0 ? employeeCount : null,
  }
}

/**
 * Has anybody actually filled this profile in?
 *
 * Signup records a legal name, an email and a phone number and nothing else, so
 * "we have a row" is not the same as "the profile is set up". The identity
 * fields below are the ones a person has to enter deliberately.
 */
function isProfileIncomplete(org: ReturnType<typeof mapOrgProfile>) {
  return !org.registrationNumber || !org.industry || !org.address.line1
}

/**
 * @param role Whose access to render as. OPTIONAL, and it must stay optional.
 *
 * ── WHY THIS DEFAULTS TO THE SIGNED-IN USER ─────────────────────────────────
 *
 * This was a REQUIRED prop, and the only caller that ever passed it was the
 * developer showcase page. The real mount — GtgAppShell, via the content map —
 * renders `<ContentComponent />` with no props at all, so `role` arrived
 * `undefined`, `getAccess()` fell through to its `?? 'none'` default, and this
 * screen returned "Access Restricted" to EVERY user including the
 * administrator. The same was true of DepartmentList.
 *
 * Nothing caught it: `use-content-map-utils.ts` types a lazy screen as
 * `ComponentType<any>`, which erases required props, so `tsc` and `next build`
 * both passed while two finished screens were unreachable in the browser.
 *
 * The role was available the whole time — `useAuth()` is called on the very
 * next line. It is read from there now, and the prop survives only so the
 * showcase can preview the screen as somebody else.
 */
/**
 * Add one subsidiary.
 *
 * Only the fields the card actually shows, plus the two the server needs to
 * store a usable row. Asking for eight fields to add a name nobody will read is
 * how a form stops being filled in.
 */
function AddSisterCompanyDialog({
  open,
  saving,
  onCancel,
  onSave,
}: {
  open: boolean
  saving: boolean
  onCancel: () => void
  onSave: (sister: {
    legal_name: string
    cin: string
    registered_address: string
    industry: string
    employee_count: string
  }) => void
}) {
  const [form, setForm] = useState({
    legal_name: '',
    cin: '',
    registered_address: '',
    industry: '',
    employee_count: '',
  })

  const set = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel()
          setForm({ legal_name: '', cin: '', registered_address: '', industry: '', employee_count: '' })
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a sister company</DialogTitle>
          <DialogDescription>
            A subsidiary or branch of this organisation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Legal name
            </span>
            <Input
              value={form.legal_name}
              onChange={(event) => set('legal_name', event.target.value)}
              placeholder="Registered name of the subsidiary"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Registration number
              </span>
              <Input value={form.cin} onChange={(event) => set('cin', event.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Industry
              </span>
              <Input
                value={form.industry}
                onChange={(event) => set('industry', event.target.value)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Registered address
            </span>
            <Input
              value={form.registered_address}
              onChange={(event) => set('registered_address', event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:w-1/2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Employees
            </span>
            <Input
              type="number"
              min={0}
              value={form.employee_count}
              onChange={(event) => set('employee_count', event.target.value)}
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          {/* A name is the one thing a card cannot be drawn without. */}
          <Button onClick={() => onSave(form)} disabled={saving || form.legal_name.trim() === ''}>
            {saving ? 'Adding…' : 'Add sister company'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function OrganizationInformation({ role }: { role?: Role }) {
  const { user } = useAuth()
  // An explicit prop wins (the showcase previews other roles); otherwise this is
  // the signed-in person, which is what every real mount means.
  const effectiveRole = role ?? user?.role
  const access = effectiveRole ? getAccess('organization-information', effectiveRole) : 'none'
  const [editing, setEditing] = useState(false)
  const [orgData, setOrgData] = useState<LaravelOrgDetail>()
  /**
   * The organisation's real departments, for the structure preview.
   *
   * That preview rendered the literal list ['Engineering', 'Human Resources',
   * 'Sales & Marketing', 'Finance'] for every tenant on the platform — a
   * picture of a company that does not exist, on a screen titled "Organization
   * Structure".
   */
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  /** The Add Sister Company dialog, and whether a save is in flight. */
  const [addingSister, setAddingSister] = useState(false)
  const [savingSister, setSavingSister] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const context = useMemo(() => getLaravelContext(user), [user])

  const loadOrganization = useCallback((activeRef: { active: boolean }) => {
    setIsLoading(true)
    organizationService.getOrganizationProfile(context)
      .then((response) => {
        if (activeRef.active) setOrgData(response.org_data?.[0])
      })
      .catch((error: Error) => {
        if (activeRef.active) setNotice(error.message)
      })
      .finally(() => {
        if (activeRef.active) setIsLoading(false)
      })
  }, [context])

  useEffect(() => {
    const activeRef = { active: true }
    queueMicrotask(() => loadOrganization(activeRef))
    return () => {
      activeRef.active = false
    }
  }, [loadOrganization])

  /*
   * The structure preview shows THIS organisation's departments.
   *
   * A failure here is deliberately silent: the preview is illustrative, and a
   * departments call falling over must not take down the profile beside it.
   * An empty list renders as "no departments yet", which is the truth.
   */
  useEffect(() => {
    let active = true

    queueMicrotask(() => {
      organizationService
        .getDepartmentsManagement(context)
        .then((response) => {
          if (!active) return
          // `departments` is the flat ordered list; `main_departments` is the
          // tree's top level and is always present.
          const rows = response.departments ?? response.main_departments ?? []
          setDepartments(
            rows
              .map((row) => ({ id: Number(row.id), name: String(row.department ?? '') }))
              .filter((row) => row.name !== ''),
          )
        })
        .catch(() => {
          if (active) setDepartments([])
        })
    })

    return () => {
      active = false
    }
  }, [context])

  if (access === 'none') {
    return <AccessDenied role={effectiveRole ? roleLabel(effectiveRole) : ''} />
  }

  const org = mapOrgProfile(orgData)
  const editData = {
    organizationName: org.name,
    organizationCode: org.code,
    organizationType: org.organizationType,
    businessType: '',
    industryType: org.industry,
    // establishedDate stays '' and is no longer read: org_details has no
    // founded column, so the panel's "Founded" field could only ever show
    // 'Pending'. The field was removed rather than left blank.
    establishedDate: '',
    registrationNo: org.registrationNumber,
    gstNo: orgData?.gstin ?? '',
    panNo: orgData?.pan ?? '',
    website: org.website,
    companyDescription: '',
    email: org.email,
    phone: orgData?.mobile_no ?? org.phone,
    alternatePhone: '',
    addressLine1: org.address.line1,
    addressLine2: org.address.line2,
    country: org.address.country,
    state: org.address.state,
    city: org.address.city,
    postalCode: org.address.postal,
    brandName: org.name,
    tagline: '',
    brandDescription: '',
    timeZone: '',
    currency: '',
    financialYear: '',
    dateFormat: '',
    language: '',
    numberFormat: '',
    workingDays: (orgData?.work_week ?? '').split(',').filter(Boolean),
    status: 'Active' as const,
    // The panel rendered the literal string "Pending" here while this value was
    // already sitting two lines up, mapped and ready.
    totalEmployees: org.totalEmployees,
  }

  async function saveOrganization(data: {
    organizationName: string
    organizationCode: string
    industryType: string
    registrationNo: string
    gstNo: string
    panNo: string
    website: string
    email: string
    phone: string
    addressLine1: string
    addressLine2: string
    city: string
    state: string
    postalCode: string
    country: string
    workingDays: string[]
    logoFile?: File
  }) {
    try {
      await organizationService.saveOrganizationProfile(context, {
        legal_name: data.organizationName,
        cin: data.registrationNo || data.organizationCode,
        gstin: data.gstNo,
        pan: data.panNo,
        registered_address: [
          data.addressLine1,
          data.addressLine2,
          data.city,
          data.state,
          data.postalCode,
          data.country,
        ].filter(Boolean).join(', '),
        industry: data.industryType,
        employee_count: String(org.totalEmployees),
        work_week: data.workingDays.join(','),
        mobile_no: data.phone,
        country_code: '+91',
        email: data.email,
        website: data.website,
        logo: data.logoFile,
      })
      const refreshed = await organizationService.getOrganizationProfile(context)
      setOrgData(refreshed.org_data?.[0])
      setEditing(false)
      setNotice('Organization profile updated successfully.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to save organization profile.')
    }
  }

  /**
   * Add one subsidiary.
   *
   * ── WHY THIS RESENDS EVERYTHING ─────────────────────────────────────────
   *
   * Two server behaviours force it, and getting either wrong destroys data:
   *
   *   1. organizationDetails::updateOrCreate writes EVERY organisation column
   *      from the request (organizationDetailsController.php:120-136). A field
   *      the payload omits is written as NULL. So posting only the sister list
   *      would blank the organisation's own name, address and registration.
   *   2. The sister write is a full replace — it deletes every row for this
   *      org and reinserts what was sent (`:169-172`). So the existing
   *      subsidiaries have to travel with the new one or they are deleted.
   *
   * Hence: the current org record, plus every existing sister, plus the new one.
   */
  async function addSisterCompany(sister: {
    legal_name: string
    cin: string
    registered_address: string
    industry: string
    employee_count: string
  }) {
    setSavingSister(true)

    try {
      const payload: Record<string, string | File | undefined> = {
        // The organisation's own record, unchanged. See (1) above.
        legal_name: org.name,
        cin: orgData?.cin ?? '',
        gstin: orgData?.gstin ?? '',
        pan: orgData?.pan ?? '',
        registered_address: orgData?.registered_address ?? '',
        industry: org.industry,
        employee_count: orgData?.employee_count ? String(orgData.employee_count) : '',
        work_week: orgData?.work_week ?? '',
        mobile_no: orgData?.mobile_no ?? '',
        country_code: orgData?.country_code ?? '+91',
        email: org.email,
        website: org.website,
      }

      // Existing subsidiaries first, then the new one. See (2) above.
      const all = [
        ...sisters.map((row) => ({
          legal_name: row.legal_name ?? '',
          cin: row.cin ?? '',
          registered_address: row.registered_address ?? '',
          industry: row.industry ?? '',
          employee_count: row.employee_count ? String(row.employee_count) : '',
          work_week: row.work_week ?? '',
        })),
        { ...sister, work_week: '' },
      ]

      all.forEach((row, index) => {
        Object.entries(row).forEach(([field, value]) => {
          payload[`sister_companies[${index}][${field}]`] = value
        })
      })

      await organizationService.saveOrganizationProfile(context, payload)

      const refreshed = await organizationService.getOrganizationProfile(context)
      setOrgData(refreshed.org_data?.[0])
      setAddingSister(false)
      setNotice(`${sister.legal_name} added.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not add the sister company.')
    } finally {
      setSavingSister(false)
    }
  }

  if (editing) {
    return (
      <Suspense fallback={<div className="h-[960px] rounded-2xl bg-muted/30" />}>
        <LazyOrganizationInformationEditPanel
          data={editData}
          onCancel={() => setEditing(false)}
          onSave={saveOrganization}
        />
      </Suspense>
    )
  }

  const canEdit = access === 'full'
  const sisters = orgData?.sistersOrg ?? orgData?.sisters_org ?? []
  // Up to three initials from the organisation's own name.
  const initials = org.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
  // Only the parts that exist. The template literal produced ", , , ,  ," for a
  // blank address, which reads as data rather than as absence.
  const fullAddress = [
    org.address.line1,
    org.address.line2,
    org.address.city,
    [org.address.state, org.address.postal].filter(Boolean).join(' '),
    org.address.country,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{org.organizationType}</Badge>
          {access === 'view' && <Badge variant="outline">View Only</Badge>}
        </div>
        {canEdit && (
          <Button onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit Information
          </Button>
        )}
      </div>
      {(isLoading || notice) && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {isLoading ? 'Loading organization profile...' : notice}
        </div>
      )}

      {/*
        * ── SAY WHEN THE PROFILE IS NOT SET UP ──────────────────────────────
        *
        * There was no such state, because there could not be: every blank field
        * was filled from a fixture, so an untouched profile looked complete and
        * belonged to somebody else. Now that blanks stay blank, the screen has
        * to say what the blanks mean and what to do about them.
        */}
      {!isLoading && isProfileIncomplete(org) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              Your organisation profile is not complete yet
            </span>
            <span className="text-xs text-muted-foreground">
              {org.name
                ? `We have ${org.name}'s name and contact details. The registration number, industry and registered address are still missing.`
                : 'Add your legal name, registration number, industry and registered address so the rest of the product can use them.'}
            </span>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden="true" />
              Complete it now
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Company Logo" className="lg:col-span-1">
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex size-28 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground shadow-md"
              aria-hidden="true"
            >
              {/*
                * The organisation's own initials. This was the literal string
                * "GTG" for every tenant on the platform, so every customer's
                * profile page was badged with our company's monogram.
                */}
              {initials || '—'}
            </div>
            <div className="flex w-full flex-col gap-3 pt-2">
              {/*
                * "Founded" is gone. org_details has no such column, so that
                * field could only ever have shown the fixture's date.
                */}
              <ViewReadField
                label="Total Employees"
                value={org.totalEmployees === null ? '' : org.totalEmployees.toLocaleString()}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Company Details"
          description="Core registration and identity information."
          className="lg:col-span-2"
        >
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <ViewReadField label="Company Name" value={org.name} />
            <ViewReadField label="Company Code" value={org.code} />
            <ViewReadField label="Registration Number" value={org.registrationNumber} />
            <ViewReadField label="Industry" value={org.industry} />
            <ViewReadField label="Organization Type" value={org.organizationType} />
            <ViewReadField
              label="Website"
              value={
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <Globe className="size-3.5" aria-hidden="true" />
                  {org.website}
                </span>
              }
            />
          </dl>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Contact Information">
          <dl className="flex flex-col gap-5">
            <ViewReadField
              label="Email Address"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {org.email}
                </span>
              }
            />
            <ViewReadField
              label="Phone Number"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {org.phone}
                </span>
              }
            />
          </dl>
        </SectionCard>

        <SectionCard title="Registered Address">
          <dl className="flex flex-col gap-5">
            <ViewReadField label="Full Address" value={fullAddress} />
            <div className="grid grid-cols-2 gap-5">
              <ViewReadField label="City" value={org.address.city} />
              <ViewReadField label="State" value={org.address.state} />
              <ViewReadField label="Postal Code" value={org.address.postal} />
              <ViewReadField label="Country" value={org.address.country} />
            </div>
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        title="Sister Companies"
        description="Subsidiaries and branches linked to this organization."
        actions={
          canEdit ? (
            <Button variant="outline" size="sm" onClick={() => setAddingSister(true)}>
              <Plus aria-hidden="true" />
              Add Sister Company
            </Button>
          ) : undefined
        }
      >
        {/*
          * ── REAL SUBSIDIARIES ONLY ──────────────────────────────────────────
          *
          * This fell back to the SISTER_COMPANIES fixture — three invented
          * subsidiaries — so an organisation with none appeared to own three.
          * And the button above had no onClick at all, while the controller's
          * write path (organizationDetailsController.php:168-214) sat there
          * unreachable.
          */}
        {sisters.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-6 text-center text-sm text-muted-foreground">
            No sister companies recorded.
            {canEdit && ' Add one if this organisation has subsidiaries or branches.'}
          </p>
        ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/*
            * The `'name' in sc ? … : …` narrowing that used to be on every line
            * here existed only because the fixture had a different shape from
            * the API row. With the fixture gone these are all LaravelSisterOrg.
            */}
          {sisters.map((sc) => (
            <div key={sc.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex size-10 items-center justify-center rounded-md bg-secondary text-sm font-bold text-secondary-foreground"
                  aria-hidden="true"
                >
                  {(sc.legal_name ?? '').trim().slice(0, 2).toUpperCase() || '—'}
                </div>
                <Badge variant="outline">Sister Company</Badge>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{sc.legal_name || '—'}</p>
                <p className="text-xs text-muted-foreground">{sc.cin || '—'}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="truncate">{sc.registered_address || '—'}</span>
                {/* Blank stays blank; "0 staff" is a claim nobody made. */}
                {sc.employee_count ? (
                  <span className="shrink-0 font-semibold text-foreground">
                    {sc.employee_count} staff
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        )}
      </SectionCard>

      <SectionCard
        title="Organization Structure Preview"
        description="A high-level view of the reporting structure."
      >
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-surface-muted p-6">
          {/*
            * ── THIS ORGANISATION'S DEPARTMENTS ─────────────────────────────
            *
            * This rendered the literal list ['Engineering', 'Human Resources',
            * 'Sales & Marketing', 'Finance'] for every tenant on the platform —
            * a picture of a company that does not exist, under the heading
            * "Organization Structure".
            */}
          <div className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            {org.name || 'Your organisation'}
          </div>
          <div className="h-5 w-px bg-border" aria-hidden="true" />

          {departments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No departments yet.
              {canEdit && ' Add them under Department Management to see the structure here.'}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {departments.slice(0, 8).map((department) => (
                  <div
                    key={department.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-xs"
                  >
                    <Network className="size-4 text-muted-foreground" aria-hidden="true" />
                    {department.name}
                  </div>
                ))}
              </div>
              {departments.length > 8 && (
                <p className="text-xs text-muted-foreground">
                  and {departments.length - 8} more
                </p>
              )}
              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <Building2 className="size-3.5" aria-hidden="true" />
                Full interactive view available under Department Management.
              </p>
            </>
          )}
        </div>
      </SectionCard>

      {canEdit && (
        <AddSisterCompanyDialog
          open={addingSister}
          saving={savingSister}
          onCancel={() => setAddingSister(false)}
          onSave={addSisterCompany}
        />
      )}
    </div>
  )
}
