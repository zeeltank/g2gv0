'use client'

import type { ReactNode } from 'react'
import { Crop, Save, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImageCropper } from '@/components/settings/image-cropper'
import { Badge } from '@/components/ui/badge'
import {
  SectionCard,
  FormField,
  TextInput,
  SelectInput,
  TextArea,
} from './components'

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
  /**
   * Counted from `org_details.employee_count`, or null when nobody has
   * recorded it. The panel rendered the literal string "Pending" here for
   * every organisation - see the note beside the field.
   */
  totalEmployees: number | null
}

interface OrganizationInformationEditPanelProps {
  data: OrganizationData
  onCancel: () => void
  onSave: (data: OrganizationData & { logoFile?: File }) => void
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
  const [org, setOrg] = useState(data)

  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * THE LOGO UPLOAD SHOWED YOU NOTHING
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `setLogoFile(event.target.files?.[0])` was the whole of it. The file was
   * stored and correctly sent - `saveOrganizationProfile` builds a FormData, so
   * the upload itself worked - but the monogram stayed on screen either way. You
   * picked a logo, the square kept showing your initials, and you found out what
   * had actually been stored on the next page load.
   *
   * Nothing told you whether the right file had been chosen, and nothing let you
   * decide which part of a wide logo would survive being put in a square. The
   * cropper answers both: a preview that is exactly what will be saved, and
   * control over the framing.
   *
   * `logoFile` is now the CROPPED file. `pending` is the one waiting to be framed.
   */
  const [logoFile, setLogoFile] = useState<File>()
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [pendingLogo, setPendingLogo] = useState<File | null>(null)
  /** As picked, so "Reposition" reframes at full resolution instead of recropping a crop. */
  const [originalLogo, setOriginalLogo] = useState<File | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)

  // Without this every logo somebody previews leaks for the life of the tab.
  useEffect(() => {
    if (!logoPreview) return

    return () => URL.revokeObjectURL(logoPreview)
  }, [logoPreview])

  /*
   * The organisation's OWN initials, from the name being edited - so it updates
   * as you type, and it is never somebody else's brand.
   *
   * Falls back to the organisation code, then to a dash. It never falls back to
   * a company name, because the whole bug was a company name standing in for
   * every customer's.
   */
  const monogram =
    org.organizationName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || org.organizationCode.slice(0, 3).toUpperCase() || '—'

  function updateField<K extends keyof OrganizationData>(field: K, value: OrganizationData[K]) {
    setOrg((current) => ({ ...current, [field]: value }))
  }

  function save() {
    onSave({ ...org, logoFile })
  }

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
          <Button variant="outline" onClick={save}>
            <Save className="size-4" aria-hidden="true" />
            Save Draft
          </Button>
          <Button onClick={save}>
            <Save className="size-4" aria-hidden="true" />
            Save &amp; Publish
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Company Logo" className="lg:col-span-1">
          <div className="flex flex-col items-center gap-4">
            {/*
              * WAS THE LITERAL STRING "GTG".
              *
              * Every organisation on the platform saw GapstoGrowth's initials
              * as its own logo placeholder - on the screen whose entire job is
              * recording who the customer is.
              */}
            {/*
              THE PICKED LOGO, not the monogram, once one has been chosen.
              The monogram is the placeholder for "no logo", and it was being
              shown as the answer to "which logo did I just pick".
            */}
            {logoPreview ? (
              <img
                src={logoPreview}
                alt=""
                className="size-28 rounded-2xl border border-border object-cover shadow-md"
              />
            ) : (
              <div
                className="flex size-28 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground shadow-md"
                aria-hidden="true"
              >
                {monogram}
              </div>
            )}
            <Button variant="outline" className="relative w-full overflow-hidden">
              <Upload aria-hidden="true" />
              Upload New Logo
              <input
                type="file"
                /*
                 * The server's list, not `image/*`. The old value offered every
                 * format the operating system can produce against a backend that
                 * accepts four, so the most likely file on a phone - an iPhone's
                 * HEIC - was one that could not be stored.
                 */
                accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
                aria-label="Upload organization logo"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  // So picking the same file twice in a row still fires onChange.
                  event.target.value = ''

                  if (!file) return

                  const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

                  if (!ALLOWED.includes(file.type)) {
                    setLogoError('That kind of image cannot be used. JPG, PNG, GIF or WEBP.')
                    return
                  }

                  // Generous: what gets uploaded is the cropper's small export,
                  // so the only thing this guards is the memory cost of decoding.
                  if (file.size > 25 * 1024 * 1024) {
                    setLogoError(
                      `That image is ${(file.size / 1024 / 1024).toFixed(0)}MB, which is too large to open here.`,
                    )
                    return
                  }

                  setLogoError(null)
                  setPendingLogo(file)
                }}
              />
            </Button>

            {logoFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setPendingLogo(originalLogo ?? logoFile)}
              >
                <Crop aria-hidden="true" />
                Reposition
              </Button>
            )}

            {logoError && (
              <p role="alert" className="w-full text-xs text-destructive">
                {logoError}
              </p>
            )}

            {logoFile && !logoError && (
              <p className="w-full text-xs text-muted-foreground">
                {logoFile.name} — saved when you press Save.
              </p>
            )}

            {/*
              THE CROPPER. `shape="rounded"` because that is how the logo is shown
              here and on the read view - a circular frame would promise a crop
              the product does not apply.

              Keyed on the file so a second pick opens centred rather than at the
              previous logo's framing.
            */}
            {pendingLogo && (
              <ImageCropper
                key={`${pendingLogo.name}-${pendingLogo.size}-${pendingLogo.lastModified}`}
                file={pendingLogo}
                shape="rounded"
                title="Position the logo"
                onCancel={() => setPendingLogo(null)}
                onApply={({ file, preview }) => {
                  setOriginalLogo(pendingLogo)
                  setLogoFile(file)
                  setLogoPreview(preview)
                  setPendingLogo(null)
                }}
              />
            )}
            {/*
              * "Founded" IS GONE, and "Total Employees" IS REAL.
              *
              * Founded was `org.establishedDate || 'Pending'` against a field
              * this screen always passes as '' - `org_details` has no founded
              * column, so it could only ever read "Pending". It is removed for
              * the same reason `fax` and `founded` were removed from the read
              * view: a field that can never hold anything is not a blank field,
              * it is a promise the schema cannot keep.
              *
              * Total Employees was the LITERAL STRING "Pending" - not a
              * fallback, not a null check, just the word - while the parent
              * already had the number.
              */}
            <div className="flex w-full flex-col gap-3 pt-2">
              <ReadField
                label="Total Employees"
                value={
                  org.totalEmployees !== null
                    ? org.totalEmployees.toLocaleString()
                    : 'Not recorded yet'
                }
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
              <TextInput id="cn" value={org.organizationName} onChange={(event) => updateField('organizationName', event.target.value)} />
            </FormField>
            <FormField label="Company Code" htmlFor="cc" required>
              <TextInput id="cc" value={org.organizationCode} onChange={(event) => updateField('organizationCode', event.target.value)} />
            </FormField>
            <FormField label="Registration Number" htmlFor="rn">
              <TextInput id="rn" value={org.registrationNo} onChange={(event) => updateField('registrationNo', event.target.value)} />
            </FormField>
            <FormField label="Industry" htmlFor="ind">
              <SelectInput
                id="ind"
                value={org.industryType}
                onChange={(value) => updateField('industryType', value)}
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
                value={org.organizationType}
                onChange={(value) => updateField('organizationType', value)}
                options={[
                  { value: 'Private Limited', label: 'Private Limited' },
                  { value: 'Public Limited', label: 'Public Limited' },
                  { value: 'LLP', label: 'LLP' },
                  { value: 'Partnership', label: 'Partnership' },
                ]}
              />
            </FormField>
            <FormField label="Website" htmlFor="web">
              <TextInput id="web" value={org.website} onChange={(event) => updateField('website', event.target.value)} />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Company Description" required>
                <TextArea value={org.companyDescription} rows={3} onChange={(event) => updateField('companyDescription', event.target.value)} />
              </FormField>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Contact Information">
          <div className="grid grid-cols-1 gap-5">
            <FormField label="Email Address" htmlFor="em">
              <TextInput id="em" type="email" value={org.email} onChange={(event) => updateField('email', event.target.value)} />
            </FormField>
            <FormField label="Phone Number" htmlFor="ph">
              <TextInput id="ph" value={org.phone} onChange={(event) => updateField('phone', event.target.value)} />
            </FormField>
            <FormField label="Alternate Phone" htmlFor="aph">
              <TextInput id="aph" value={org.alternatePhone} onChange={(event) => updateField('alternatePhone', event.target.value)} />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Registered Address">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Address Line 1" htmlFor="a1">
                <TextInput id="a1" value={org.addressLine1} onChange={(event) => updateField('addressLine1', event.target.value)} />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Address Line 2" htmlFor="a2">
                <TextInput id="a2" value={org.addressLine2} onChange={(event) => updateField('addressLine2', event.target.value)} />
              </FormField>
            </div>
            <FormField label="City" htmlFor="ct">
              <TextInput id="ct" value={org.city} onChange={(event) => updateField('city', event.target.value)} />
            </FormField>
            <FormField label="State" htmlFor="st">
              <TextInput id="st" value={org.state} onChange={(event) => updateField('state', event.target.value)} />
            </FormField>
            <FormField label="Postal Code" htmlFor="pc">
              <TextInput id="pc" value={org.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} />
            </FormField>
            <FormField label="Country" htmlFor="cy">
              <TextInput id="cy" value={org.country} onChange={(event) => updateField('country', event.target.value)} />
            </FormField>
          </div>
        </SectionCard>
      </div>

      {/*
        * ── TWO DECORATIVE BLOCKS REMOVED ─────────────────────────────────────
        *
        * This edit form ended with a "Sister Companies" grid built from the
        * SISTER_COMPANIES fixture and an "Organization Structure Preview"
        * built from the literal list ['Engineering', 'Human Resources',
        * 'Sales & Marketing', 'Finance'].
        *
        * Neither was editable — they were read-only decoration on a form,
        * showing three subsidiaries and four departments that belong to no
        * customer. Somebody editing their real organisation profile saw
        * another company's structure underneath it.
        *
        * The real subsidiaries, and the real departments, are on the view
        * screen where they can be read and added.
        */}
    </div>
  )
}