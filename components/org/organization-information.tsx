'use client'

import { useState } from 'react'
import {
  Pencil,
  X,
  Save,
  Building2,
  Plus,
  ImageIcon,
  Network,
  Upload,
  Globe,
  Mail,
  Phone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  SectionCard,
  ReadField,
  FormField,
  TextInput,
  SelectInput,
  TextArea,
  Badge,
  AccessDenied,
} from './gtg-ui'
import { ORG_PROFILE, SISTER_COMPANIES } from '@/lib/gtg-org-data'
import { getAccess, roleLabel, type Role } from '@/lib/gtg-roles'

export function OrganizationInformation({ role }: { role: Role }) {
  const access = getAccess('organization-information', role)
  const [editing, setEditing] = useState(false)
  const canEdit = access === 'full'

  if (access === 'none') {
    return <AccessDenied role={roleLabel(role)} />
  }

  const org = ORG_PROFILE
  const fullAddress = `${org.address.line1}, ${org.address.line2}, ${org.address.city}, ${org.address.state} ${org.address.postal}, ${org.address.country}`

  return (
    <div className="flex flex-col gap-6">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="navy">
            <Building2 className="size-3.5" aria-hidden="true" />
            {org.organizationType}
          </Badge>
          {access === 'view' && <Badge tone="outline">View Only</Badge>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  <X aria-hidden="true" />
                  Cancel
                </Button>
                <Button onClick={() => setEditing(false)}>
                  <Save aria-hidden="true" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Edit Information
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Logo + quick facts */}
        <SectionCard title="Company Logo" className="lg:col-span-1">
          <div className="flex flex-col items-center gap-4">
            <div
              className="g2g-brand-gradient flex size-28 items-center justify-center rounded-2xl text-3xl font-bold text-brand-foreground shadow-md"
              aria-hidden="true"
            >
              GTG
            </div>
            {editing ? (
              <Button variant="outline" className="w-full">
                <Upload aria-hidden="true" />
                Upload New Logo
              </Button>
            ) : (
              <div className="flex w-full flex-col gap-3 pt-2">
                <ReadField label="Founded" value={org.founded} />
                <ReadField
                  label="Total Employees"
                  value={org.totalEmployees.toLocaleString()}
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* Company details */}
        <SectionCard
          title="Company Details"
          description="Core registration and identity information."
          className="lg:col-span-2"
        >
          {editing ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label="Company Name" htmlFor="cn" required>
                <TextInput id="cn" defaultValue={org.name} />
              </FormField>
              <FormField label="Company Code" htmlFor="cc" required>
                <TextInput id="cc" defaultValue={org.code} />
              </FormField>
              <FormField label="Registration Number" htmlFor="rn">
                <TextInput id="rn" defaultValue={org.registrationNumber} />
              </FormField>
              <FormField label="Industry" htmlFor="ind">
                <SelectInput
                  id="ind"
                  defaultValue={org.industry}
                  options={[
                    { value: org.industry, label: org.industry },
                    { value: 'Manufacturing', label: 'Manufacturing' },
                    { value: 'Healthcare', label: 'Healthcare' },
                    { value: 'Finance', label: 'Finance' },
                  ]}
                />
              </FormField>
              <FormField label="Organization Type" htmlFor="ot">
                <SelectInput
                  id="ot"
                  defaultValue={org.organizationType}
                  options={[
                    { value: 'Private Limited', label: 'Private Limited' },
                    { value: 'Public Limited', label: 'Public Limited' },
                    { value: 'LLP', label: 'LLP' },
                    { value: 'Partnership', label: 'Partnership' },
                  ]}
                />
              </FormField>
              <FormField label="Website" htmlFor="web">
                <TextInput id="web" defaultValue={org.website} />
              </FormField>
            </div>
          ) : (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              <ReadField label="Company Name" value={org.name} />
              <ReadField label="Company Code" value={org.code} />
              <ReadField
                label="Registration Number"
                value={org.registrationNumber}
              />
              <ReadField label="Industry" value={org.industry} />
              <ReadField label="Organization Type" value={org.organizationType} />
              <ReadField
                label="Website"
                value={
                  <span className="inline-flex items-center gap-1.5 text-brand">
                    <Globe className="size-3.5" aria-hidden="true" />
                    {org.website}
                  </span>
                }
              />
            </dl>
          )}
        </SectionCard>
      </div>

      {/* Contact + address */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Contact Information">
          {editing ? (
            <div className="grid grid-cols-1 gap-5">
              <FormField label="Email Address" htmlFor="em">
                <TextInput id="em" type="email" defaultValue={org.email} />
              </FormField>
              <FormField label="Phone Number" htmlFor="ph">
                <TextInput id="ph" defaultValue={org.phone} />
              </FormField>
              <FormField label="Fax" htmlFor="fx">
                <TextInput id="fx" defaultValue={org.fax} />
              </FormField>
            </div>
          ) : (
            <dl className="flex flex-col gap-5">
              <ReadField
                label="Email Address"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {org.email}
                  </span>
                }
              />
              <ReadField
                label="Phone Number"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {org.phone}
                  </span>
                }
              />
              <ReadField label="Fax" value={org.fax} />
            </dl>
          )}
        </SectionCard>

        <SectionCard title="Registered Address">
          {editing ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField label="Address Line 1" htmlFor="a1">
                  <TextInput id="a1" defaultValue={org.address.line1} />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Address Line 2" htmlFor="a2">
                  <TextInput id="a2" defaultValue={org.address.line2} />
                </FormField>
              </div>
              <FormField label="City" htmlFor="ct">
                <TextInput id="ct" defaultValue={org.address.city} />
              </FormField>
              <FormField label="State" htmlFor="st">
                <TextInput id="st" defaultValue={org.address.state} />
              </FormField>
              <FormField label="Postal Code" htmlFor="pc">
                <TextInput id="pc" defaultValue={org.address.postal} />
              </FormField>
              <FormField label="Country" htmlFor="cy">
                <TextInput id="cy" defaultValue={org.address.country} />
              </FormField>
            </div>
          ) : (
            <dl className="flex flex-col gap-5">
              <ReadField label="Full Address" value={fullAddress} />
              <div className="grid grid-cols-2 gap-5">
                <ReadField label="City" value={org.address.city} />
                <ReadField label="State" value={org.address.state} />
                <ReadField label="Postal Code" value={org.address.postal} />
                <ReadField label="Country" value={org.address.country} />
              </div>
            </dl>
          )}
        </SectionCard>
      </div>

      {/* Sister companies */}
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
            <div
              key={sc.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex size-10 items-center justify-center rounded-md bg-secondary text-sm font-bold text-secondary-foreground"
                  aria-hidden="true"
                >
                  {sc.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                </div>
                <Badge tone={sc.type === 'Subsidiary' ? 'navy' : 'outline'}>
                  {sc.type}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{sc.name}</p>
                <p className="text-xs text-muted-foreground">{sc.code}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>{sc.location}</span>
                <span className="font-semibold text-foreground">
                  {sc.employees} staff
                </span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Org structure preview */}
      <SectionCard
        title="Organization Structure Preview"
        description="A high-level view of the reporting structure."
      >
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-surface-muted p-6">
          <div className="g2g-brand-gradient rounded-md px-4 py-2 text-sm font-semibold text-brand-foreground">
            {org.name}
          </div>
          <div className="h-5 w-px bg-border" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['Engineering', 'Human Resources', 'Sales & Marketing', 'Finance'].map(
              (n) => (
                <div
                  key={n}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-xs"
                >
                  <Network className="size-4 text-muted-foreground" aria-hidden="true" />
                  {n}
                </div>
              ),
            )}
          </div>
          <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <ImageIcon className="size-3.5" aria-hidden="true" />
            Full interactive view available under Department Hierarchy.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}
