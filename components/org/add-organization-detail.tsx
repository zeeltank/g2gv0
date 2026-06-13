'use client'

import {
  Info,
  FileText,
  Phone,
  MapPin,
  GitBranch,
  Network,
  ImageIcon,
  Upload,
  Save,
  Send,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  SectionCard,
  FormField,
  TextInput,
  SelectInput,
  TextArea,
  AccessDenied,
  Badge,
} from './gtg-ui'
import { getAccess, roleLabel, type Role } from '@/lib/gtg-roles'

function SectionHeading({
  icon,
  step,
  title,
  description,
}: {
  icon: React.ReactNode
  step: number
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Step {step}
          </span>
        </div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function AddOrganizationDetail({ role }: { role: Role }) {
  const access = getAccess('add-organization-detail', role)

  if (access !== 'full') {
    return <AccessDenied role={roleLabel(role)} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="navy">Admin Only</Badge>
        <div className="flex items-center gap-2">
          <Button variant="ghost">
            <X aria-hidden="true" />
            Cancel
          </Button>
          <Button variant="outline">
            <Save aria-hidden="true" />
            Save Draft
          </Button>
          <Button>
            <Send aria-hidden="true" />
            Save &amp; Publish
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <SectionCard>
        <div className="flex flex-col gap-6">
          <SectionHeading
            icon={<Info className="size-5" />}
            step={1}
            title="Basic Information"
            description="Identify the new organization, branch, or subsidiary."
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Organization Name" htmlFor="b-name" required>
              <TextInput id="b-name" placeholder="e.g. GapstoGrowth Cloud Labs" />
            </FormField>
            <FormField label="Organization Code" htmlFor="b-code" required>
              <TextInput id="b-code" placeholder="e.g. GTG-CLD-004" />
            </FormField>
            <FormField label="Entity Type" htmlFor="b-type" required>
              <SelectInput
                id="b-type"
                options={[
                  { value: 'organization', label: 'New Organization' },
                  { value: 'branch', label: 'Branch' },
                  { value: 'subsidiary', label: 'Subsidiary' },
                ]}
              />
            </FormField>
            <FormField label="Industry" htmlFor="b-ind">
              <SelectInput
                id="b-ind"
                options={[
                  { value: 'it', label: 'Information Technology & Services' },
                  { value: 'mfg', label: 'Manufacturing' },
                  { value: 'fin', label: 'Finance' },
                  { value: 'health', label: 'Healthcare' },
                ]}
              />
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* Registration Details */}
      <SectionCard>
        <div className="flex flex-col gap-6">
          <SectionHeading
            icon={<FileText className="size-5" />}
            step={2}
            title="Registration Details"
            description="Legal registration and incorporation information."
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Registration Number" htmlFor="r-num" required>
              <TextInput id="r-num" placeholder="CIN / Registration No." />
            </FormField>
            <FormField label="Tax Identification Number" htmlFor="r-tax">
              <TextInput id="r-tax" placeholder="GSTIN / VAT / EIN" />
            </FormField>
            <FormField label="Date of Incorporation" htmlFor="r-date">
              <TextInput id="r-date" type="date" />
            </FormField>
            <FormField label="Organization Type" htmlFor="r-type">
              <SelectInput
                id="r-type"
                options={[
                  { value: 'pvt', label: 'Private Limited' },
                  { value: 'pub', label: 'Public Limited' },
                  { value: 'llp', label: 'LLP' },
                ]}
              />
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* Contact Information */}
      <SectionCard>
        <div className="flex flex-col gap-6">
          <SectionHeading
            icon={<Phone className="size-5" />}
            step={3}
            title="Contact Information"
            description="Primary contact channels for this organization."
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="Email Address" htmlFor="c-email" required>
              <TextInput id="c-email" type="email" placeholder="corporate@example.com" />
            </FormField>
            <FormField label="Phone Number" htmlFor="c-phone">
              <TextInput id="c-phone" placeholder="+91 80 0000 0000" />
            </FormField>
            <FormField label="Website" htmlFor="c-web">
              <TextInput id="c-web" placeholder="www.example.com" />
            </FormField>
            <FormField label="Fax" htmlFor="c-fax">
              <TextInput id="c-fax" placeholder="Optional" />
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* Address Information */}
      <SectionCard>
        <div className="flex flex-col gap-6">
          <SectionHeading
            icon={<MapPin className="size-5" />}
            step={4}
            title="Address Information"
            description="Registered office address."
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Address Line 1" htmlFor="ad-1" required>
                <TextInput id="ad-1" placeholder="Building, street" />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Address Line 2" htmlFor="ad-2">
                <TextInput id="ad-2" placeholder="Area, landmark" />
              </FormField>
            </div>
            <FormField label="City" htmlFor="ad-city" required>
              <TextInput id="ad-city" />
            </FormField>
            <FormField label="State / Province" htmlFor="ad-state">
              <TextInput id="ad-state" />
            </FormField>
            <FormField label="Postal Code" htmlFor="ad-zip">
              <TextInput id="ad-zip" />
            </FormField>
            <FormField label="Country" htmlFor="ad-country" required>
              <SelectInput
                id="ad-country"
                options={[
                  { value: 'in', label: 'India' },
                  { value: 'uk', label: 'United Kingdom' },
                  { value: 'sg', label: 'Singapore' },
                  { value: 'us', label: 'United States' },
                ]}
              />
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* Branch + Subsidiary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard>
          <div className="flex flex-col gap-6">
            <SectionHeading
              icon={<GitBranch className="size-5" />}
              step={5}
              title="Branch Details"
              description="Applicable when adding a branch."
            />
            <div className="grid grid-cols-1 gap-5">
              <FormField label="Parent Organization" htmlFor="br-parent">
                <SelectInput
                  id="br-parent"
                  options={[
                    { value: 'hq', label: 'GapstoGrowth Technologies (HQ)' },
                    { value: 'emea', label: 'GapstoGrowth EMEA' },
                  ]}
                />
              </FormField>
              <FormField label="Branch Manager" htmlFor="br-mgr">
                <TextInput id="br-mgr" placeholder="Assign a manager" />
              </FormField>
              <FormField label="Operational Notes" htmlFor="br-notes">
                <TextArea id="br-notes" placeholder="Optional details about this branch" />
              </FormField>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex flex-col gap-6">
            <SectionHeading
              icon={<Network className="size-5" />}
              step={6}
              title="Subsidiary Details"
              description="Applicable when adding a subsidiary."
            />
            <div className="grid grid-cols-1 gap-5">
              <FormField label="Ownership Percentage" htmlFor="sub-own">
                <TextInput id="sub-own" placeholder="e.g. 100%" />
              </FormField>
              <FormField label="Holding Company" htmlFor="sub-hold">
                <SelectInput
                  id="sub-hold"
                  options={[
                    { value: 'hq', label: 'GapstoGrowth Technologies (HQ)' },
                  ]}
                />
              </FormField>
              <FormField label="Governance Notes" htmlFor="sub-notes">
                <TextArea id="sub-notes" placeholder="Optional governance details" />
              </FormField>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Logo Upload */}
      <SectionCard>
        <div className="flex flex-col gap-6">
          <SectionHeading
            icon={<ImageIcon className="size-5" />}
            step={7}
            title="Logo Upload"
            description="Brand identity for the new organization."
          />
          <label
            htmlFor="logo-upload"
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-surface-muted px-6 py-10 text-center transition-colors duration-200 hover:border-ring"
          >
            <div
              className="flex size-12 items-center justify-center rounded-lg bg-accent text-accent-foreground"
              aria-hidden="true"
            >
              <Upload className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG or SVG up to 2MB (recommended 512×512)
              </p>
            </div>
            <input id="logo-upload" type="file" accept="image/*" className="sr-only" />
          </label>
        </div>
      </SectionCard>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
        <Button variant="ghost">
          <X aria-hidden="true" />
          Cancel
        </Button>
        <Button variant="outline">
          <Save aria-hidden="true" />
          Save Draft
        </Button>
        <Button>
          <Send aria-hidden="true" />
          Save &amp; Publish
        </Button>
      </div>
    </div>
  )
}
