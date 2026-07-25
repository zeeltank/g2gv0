'use client'

import type { ReactNode } from 'react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Globe, Mail, Network, Pencil, Phone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionCard, ReadField, AccessDenied } from './components'
import { ORG_PROFILE, SISTER_COMPANIES } from '@/lib/gtg-org-data'
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

function mapOrgProfile(data?: LaravelOrgDetail) {
  if (!data) return ORG_PROFILE
  return {
    name: data.legal_name || ORG_PROFILE.name,
    code: data.cin || ORG_PROFILE.code,
    registrationNumber: data.cin || ORG_PROFILE.registrationNumber,
    industry: data.industry || ORG_PROFILE.industry,
    organizationType: 'Private Limited',
    website: data.website || ORG_PROFILE.website,
    email: data.email || ORG_PROFILE.email,
    phone: `${data.country_code ?? ''} ${data.mobile_no ?? ''}`.trim() || ORG_PROFILE.phone,
    fax: ORG_PROFILE.fax,
    address: splitAddress(data.registered_address),
    founded: ORG_PROFILE.founded,
    totalEmployees: Number(data.employee_count) || ORG_PROFILE.totalEmployees,
  }
}

export function OrganizationInformation({ role }: { role: Role }) {
  const access = getAccess('organization-information', role)
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [orgData, setOrgData] = useState<LaravelOrgDetail>()
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

  if (access === 'none') {
    return <AccessDenied role={roleLabel(role)} />
  }

  const org = mapOrgProfile(orgData)
  const editData = {
    organizationName: org.name,
    organizationCode: org.code,
    organizationType: org.organizationType,
    businessType: '',
    industryType: org.industry,
    establishedDate: org.founded,
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
  const fullAddress = `${org.address.line1}, ${org.address.line2}, ${org.address.city}, ${org.address.state} ${org.address.postal}, ${org.address.country}`

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Company Logo" className="lg:col-span-1">
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex size-28 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground shadow-md"
              aria-hidden="true"
            >
              GTG
            </div>
            <div className="flex w-full flex-col gap-3 pt-2">
              <ViewReadField label="Founded" value={org.founded} />
              <ViewReadField label="Total Employees" value={org.totalEmployees.toLocaleString()} />
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
            <ViewReadField label="Fax" value={org.fax} />
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
            <Button variant="outline" size="sm">
              <Plus aria-hidden="true" />
              Add Sister Company
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(orgData?.sistersOrg ?? orgData?.sisters_org ?? SISTER_COMPANIES).map((sc) => (
            <div key={sc.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex size-10 items-center justify-center rounded-md bg-secondary text-sm font-bold text-secondary-foreground"
                  aria-hidden="true"
                >
                  {('name' in sc ? sc.name : sc.legal_name ?? 'SC').split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                </div>
                <Badge variant={'type' in sc && sc.type === 'Subsidiary' ? 'navy' : 'outline'}>{'type' in sc ? sc.type : 'Sister Company'}</Badge>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{'name' in sc ? sc.name : sc.legal_name}</p>
                <p className="text-xs text-muted-foreground">{'code' in sc ? sc.code : sc.cin}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>{'location' in sc ? sc.location : sc.registered_address}</span>
                <span className="font-semibold text-foreground">{'employees' in sc ? sc.employees : sc.employee_count ?? 0} staff</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Organization Structure Preview"
        description="A high-level view of the reporting structure."
      >
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-surface-muted p-6">
          <div className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            {org.name}
          </div>
          <div className="h-5 w-px bg-border" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['Engineering', 'Human Resources', 'Sales & Marketing', 'Finance'].map((n) => (
              <div
                key={n}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-xs"
              >
                <Network className="size-4 text-muted-foreground" aria-hidden="true" />
                {n}
              </div>
            ))}
          </div>
          <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <Building2 className="size-3.5" aria-hidden="true" />
            Full interactive view available under Department Hierarchy.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}
