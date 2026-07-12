'use client'

import type { ReactNode } from 'react'
import { Building2, Globe, Mail, Network, Phone, Plus, Save, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  SectionCard,
  FormField,
  TextInput,
  SelectInput,
  TextArea,
} from './components'
import { SISTER_COMPANIES } from '@/lib/gtg-org-data'

type OrganizationData = {
  organizationName: string
  organizationCode: string
  organizationType: string
  businessType: string
  industryType: string
  establishedDate: string
  registrationNo: string
  gstNo: string
  panNo: string
  website: string
  companyDescription: string
  email: string
  phone: string
  alternatePhone: string
  addressLine1: string
  addressLine2: string
  country: string
  state: string
  city: string
  postalCode: string
  brandName: string
  tagline: string
  brandDescription: string
  timeZone: string
  currency: string
  financialYear: string
  dateFormat: string
  language: string
  numberFormat: string
  workingDays: string[]
  status: 'Active' | 'Inactive' | 'Draft'
}

interface OrganizationInformationEditPanelProps {
  data: OrganizationData
  onCancel: () => void
  onSave: () => void
}

const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ReadField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value || '—'}</dd>
    </div>
  )
}

export function OrganizationInformationEditPanel({
  data,
  onCancel,
  onSave,
}: OrganizationInformationEditPanelProps) {
  const org = data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Editing Organization</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="size-4" aria-hidden="true" />
            Cancel
          </Button>
          <Button variant="outline" onClick={onSave}>
            <Save className="size-4" aria-hidden="true" />
            Save Draft
          </Button>
          <Button onClick={onSave}>
            <Save className="size-4" aria-hidden="true" />
            Save &amp; Publish
          </Button>
        </div>
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
            <Button variant="outline" className="w-full">
              <Upload aria-hidden="true" />
              Upload New Logo
            </Button>
            <div className="flex w-full flex-col gap-3 pt-2">
              <ReadField label="Founded" value={org.establishedDate || 'Pending'} />
              <ReadField
                label="Total Employees"
                value="Pending"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Company Details"
          description="Core registration and identity information."
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Company Name" htmlFor="cn" required>
              <TextInput id="cn" defaultValue={org.organizationName} />
            </FormField>
            <FormField label="Company Code" htmlFor="cc" required>
              <TextInput id="cc" defaultValue={org.organizationCode} />
            </FormField>
            <FormField label="Registration Number" htmlFor="rn">
              <TextInput id="rn" defaultValue={org.registrationNo} />
            </FormField>
            <FormField label="Industry" htmlFor="ind">
              <SelectInput
                id="ind"
                defaultValue={org.industryType}
                options={[
                  { value: org.industryType, label: org.industryType },
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
            <div className="sm:col-span-2">
              <FormField label="Company Description" required>
                <TextArea defaultValue={org.companyDescription} rows={3} />
              </FormField>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Contact Information">
          <div className="grid grid-cols-1 gap-5">
            <FormField label="Email Address" htmlFor="em">
              <TextInput id="em" type="email" defaultValue={org.email} />
            </FormField>
            <FormField label="Phone Number" htmlFor="ph">
              <TextInput id="ph" defaultValue={org.phone} />
            </FormField>
            <FormField label="Alternate Phone" htmlFor="aph">
              <TextInput id="aph" defaultValue={org.alternatePhone} />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Registered Address">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Address Line 1" htmlFor="a1">
                <TextInput id="a1" defaultValue={org.addressLine1} />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Address Line 2" htmlFor="a2">
                <TextInput id="a2" defaultValue={org.addressLine2} />
              </FormField>
            </div>
            <FormField label="City" htmlFor="ct">
              <TextInput id="ct" defaultValue={org.city} />
            </FormField>
            <FormField label="State" htmlFor="st">
              <TextInput id="st" defaultValue={org.state} />
            </FormField>
            <FormField label="Postal Code" htmlFor="pc">
              <TextInput id="pc" defaultValue={org.postalCode} />
            </FormField>
            <FormField label="Country" htmlFor="cy">
              <TextInput id="cy" defaultValue={org.country} />
            </FormField>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Sister Companies"
        description="Subsidiaries and branches linked to this organization."
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
                <Badge variant={sc.type === 'Subsidiary' ? 'navy' : 'outline'}>
                  {sc.type}
                </Badge>
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
            {org.organizationName}
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
            <Building2 className="size-3.5" aria-hidden="true" />
            Full interactive view available under Department Hierarchy.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}
