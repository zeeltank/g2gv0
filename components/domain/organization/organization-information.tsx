'use client'

import type { ReactNode } from 'react'
import { lazy, Suspense, useState } from 'react'
import { Building2, Globe, Mail, Network, Pencil, Phone, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionCard, ReadField, AccessDenied } from './components'
import { ORG_PROFILE, SISTER_COMPANIES } from '@/lib/gtg-org-data'
import { getAccess, roleLabel, type Role } from '@/lib/gtg-roles'

const LazyOrganizationInformationEditPanel = lazy(() =>
  import('@/domain/organization/organization-information-edit-panel').then((module) => ({
    default: module.OrganizationInformationEditPanel,
  })),
)

function ViewReadField({ label, value }: { label: string; value: ReactNode }) {
  return <ReadField label={label} value={value} />
}

export function OrganizationInformation({ role }: { role: Role }) {
  const access = getAccess('organization-information', role)
  const [editing, setEditing] = useState(false)

  if (access === 'none') {
    return <AccessDenied role={roleLabel(role)} />
  }

  if (editing) {
    return (
      <Suspense fallback={<div className="h-[960px] rounded-2xl bg-muted/30" />}>
        <LazyOrganizationInformationEditPanel
          data={{ ...ORG_PROFILE } as any}
          onCancel={() => setEditing(false)}
          onSave={() => setEditing(false)}
        />
      </Suspense>
    )
  }

  const org = ORG_PROFILE
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
          {SISTER_COMPANIES.map((sc) => (
            <div key={sc.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-4">
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex size-10 items-center justify-center rounded-md bg-secondary text-sm font-bold text-secondary-foreground"
                  aria-hidden="true"
                >
                  {sc.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                </div>
                <Badge variant={sc.type === 'Subsidiary' ? 'navy' : 'outline'}>{sc.type}</Badge>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{sc.name}</p>
                <p className="text-xs text-muted-foreground">{sc.code}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>{sc.location}</span>
                <span className="font-semibold text-foreground">{sc.employees} staff</span>
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
