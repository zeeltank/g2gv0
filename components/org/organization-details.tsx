'use client'

import { useState } from 'react'
import {
  Pencil,
  X,
  Save,
  Send,
  Building2,
  Plus,
  Edit,
  Trash2,
  Eye,
  ChevronRight,
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
  StatusBadge,
} from './gtg-ui'
import { getAccess, roleLabel, type Role } from '@/lib/gtg-roles'

type Mode = 'view' | 'edit' | 'create'
type EntityType = 'organization' | 'sister-company'

interface OrganizationData {
  id: string
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
  companyLogo?: string
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

const defaultData: OrganizationData = {
  id: '1',
  organizationName: 'ABC Technologies Pvt. Ltd.',
  organizationCode: 'ABC123',
  organizationType: 'Company',
  businessType: 'Private Limited',
  industryType: 'Information Technology',
  establishedDate: '15/06/2010',
  registrationNo: 'U729OOL2010PTC061222',
  gstNo: '24AACCA1234A1Z5',
  panNo: 'AACCA1234A',
  website: 'www.abctech.com',
  companyDescription:
    'ABC Technologies Private Limited is a leading IT services and consulting company providing end-to-end business solutions.',
  email: 'info@abctech.com',
  phone: '079-12345678',
  alternatePhone: '079-87654321',
  addressLine1: '401, Dev City, Prahaladnagar,',
  addressLine2: 'Near Corporate Road',
  country: 'India',
  state: 'Gujarat',
  city: 'Ahmedabad',
  postalCode: '380015',
  brandName: 'ABC Technologies',
  tagline: 'Innovating Solutions, Delivering Excellence',
  brandDescription:
    'ABC Technologies Private Limited is a leading IT services and consulting company providing end-to-end business solutions.',
  timeZone: '(IST) Asia/Kolkata',
  currency: 'INR - Indian Rupee (₹)',
  financialYear: 'April - March',
  dateFormat: 'DD/MM/YYYY',
  language: 'English',
  numberFormat: '1,234.56',
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  status: 'Active',
}

export function OrganizationDetailsForm({
  mode = 'view',
  entityType = 'organization',
  data = defaultData,
  role = 'employee',
}: {
  mode?: Mode
  entityType?: EntityType
  data?: Partial<OrganizationData>
  role?: Role
}) {
  const [currentMode, setCurrentMode] = useState<Mode>(mode)
  const [formData, setFormData] = useState({ ...defaultData, ...data })
  const [drawerOpen, setDrawerOpen] = useState(false)

  const access = getAccess('organization-information', role)
  const canEdit = access === 'full'

  if (access === 'none') {
    return <AccessDenied role={roleLabel(role)} />
  }

  const handleEdit = () => setCurrentMode('edit')
  const handleCancel = () => setCurrentMode('view')
  const handleSave = () => setCurrentMode('view')

  const handleInputChange = (field: keyof OrganizationData, value: any) => {
    setFormData({ ...formData, [field]: value })
  }

  const toggleWorkingDay = (day: string) => {
    setFormData({
      ...formData,
      workingDays: formData.workingDays.includes(day)
        ? formData.workingDays.filter((d) => d !== day)
        : [...formData.workingDays, day],
    })
  }

  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="flex flex-col gap-6">
      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={formData.status} />
          {currentMode === 'view' && access === 'view' && (
            <Badge tone="outline">View Only</Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentMode === 'view' ? (
            canEdit && (
              <Button onClick={handleEdit}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            )
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="size-4" aria-hidden="true" />
                Cancel
              </Button>
              <Button variant="outline">
                <Save className="size-4" aria-hidden="true" />
                Save Draft
              </Button>
              <Button onClick={handleSave}>
                <Send className="size-4" aria-hidden="true" />
                {currentMode === 'create' ? 'Create' : 'Save'} &amp; Publish
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Organization Information Section */}
      <SectionCard title="Organization Information">
        {currentMode === 'view' ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ReadField label="Organization Name" value={formData.organizationName} />
            <ReadField label="Organization Code" value={formData.organizationCode} />
            <ReadField label="Organization Type" value={formData.organizationType} />
            <ReadField label="Business Type" value={formData.businessType} />
            <ReadField label="Industry Type" value={formData.industryType} />
            <ReadField label="Established Date" value={formData.establishedDate} />
            <ReadField label="Registration No." value={formData.registrationNo} />
            <ReadField label="GST No." value={formData.gstNo} />
            <ReadField label="PAN No." value={formData.panNo} />
            <ReadField label="Website" value={formData.website} />
            <div className="md:col-span-2">
              <ReadField label="Company Description" value={formData.companyDescription} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormField label="Organization Name" required>
              <TextInput
                value={formData.organizationName}
                onChange={(e) => handleInputChange('organizationName', e.target.value)}
              />
            </FormField>
            <FormField label="Organization Code" required>
              <TextInput
                value={formData.organizationCode}
                onChange={(e) => handleInputChange('organizationCode', e.target.value)}
              />
            </FormField>
            <FormField label="Organization Type" required>
              <SelectInput
                value={formData.organizationType}
                onChange={(value) => handleInputChange('organizationType', value)}
                options={[
                  { value: 'Company', label: 'Company' },
                  { value: 'Partnership', label: 'Partnership' },
                  { value: 'LLP', label: 'LLP' },
                ]}
              />
            </FormField>
            <FormField label="Business Type" required>
              <SelectInput
                value={formData.businessType}
                onChange={(value) => handleInputChange('businessType', value)}
                options={[
                  { value: 'Private Limited', label: 'Private Limited' },
                  { value: 'Public Limited', label: 'Public Limited' },
                  { value: 'Partnership', label: 'Partnership' },
                ]}
              />
            </FormField>
            <FormField label="Industry Type" required>
              <SelectInput
                value={formData.industryType}
                onChange={(value) => handleInputChange('industryType', value)}
                options={[
                  { value: 'Information Technology', label: 'Information Technology' },
                  { value: 'Manufacturing', label: 'Manufacturing' },
                  { value: 'Healthcare', label: 'Healthcare' },
                ]}
              />
            </FormField>
            <FormField label="Established Date">
              <TextInput
                type="date"
                value={formData.establishedDate}
                onChange={(e) => handleInputChange('establishedDate', e.target.value)}
              />
            </FormField>
            <FormField label="Registration No.">
              <TextInput
                value={formData.registrationNo}
                onChange={(e) => handleInputChange('registrationNo', e.target.value)}
              />
            </FormField>
            <FormField label="GST No.">
              <TextInput
                value={formData.gstNo}
                onChange={(e) => handleInputChange('gstNo', e.target.value)}
              />
            </FormField>
            <FormField label="PAN No.">
              <TextInput
                value={formData.panNo}
                onChange={(e) => handleInputChange('panNo', e.target.value)}
              />
            </FormField>
            <FormField label="Website">
              <TextInput
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Company Description">
                <TextArea
                  value={formData.companyDescription}
                  onChange={(e) => handleInputChange('companyDescription', e.target.value)}
                  rows={3}
                />
              </FormField>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Contact Information Section */}
      <SectionCard title="Contact Information">
        {currentMode === 'view' ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ReadField label="Email" value={formData.email} />
            <ReadField label="Phone" value={formData.phone} />
            <ReadField label="Alternate Phone" value={formData.alternatePhone} />
            <ReadField label="Address Line 1" value={formData.addressLine1} />
            <ReadField label="Address Line 2" value={formData.addressLine2} />
            <ReadField label="Country" value={formData.country} />
            <ReadField label="State" value={formData.state} />
            <ReadField label="City" value={formData.city} />
            <ReadField label="Postal Code" value={formData.postalCode} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormField label="Email" required>
              <TextInput
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </FormField>
            <FormField label="Phone" required>
              <TextInput
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
              />
            </FormField>
            <FormField label="Alternate Phone">
              <TextInput
                value={formData.alternatePhone}
                onChange={(e) => handleInputChange('alternatePhone', e.target.value)}
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Address Line 1" required>
                <TextInput
                  value={formData.addressLine1}
                  onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Address Line 2">
                <TextInput
                  value={formData.addressLine2}
                  onChange={(e) => handleInputChange('addressLine2', e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="Country" required>
              <SelectInput
                value={formData.country}
                onChange={(value) => handleInputChange('country', value)}
                options={[
                  { value: 'India', label: 'India' },
                  { value: 'United States', label: 'United States' },
                  { value: 'United Kingdom', label: 'United Kingdom' },
                ]}
              />
            </FormField>
            <FormField label="State" required>
              <TextInput
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
              />
            </FormField>
            <FormField label="City" required>
              <TextInput
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
              />
            </FormField>
            <FormField label="Postal Code" required>
              <TextInput
                value={formData.postalCode}
                onChange={(e) => handleInputChange('postalCode', e.target.value)}
              />
            </FormField>
          </div>
        )}
      </SectionCard>

      {/* Branding Section */}
      <SectionCard title="Branding">
        {currentMode === 'view' ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Company Logo</label>
              <div className="g2g-brand-gradient mt-2 flex size-32 items-center justify-center rounded-lg text-2xl font-bold text-brand-foreground">
                {formData.brandName?.slice(0, 3)}
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <ReadField label="Brand Name" value={formData.brandName} />
              <ReadField label="Tagline" value={formData.tagline} />
            </div>
            <div className="md:col-span-2">
              <ReadField label="Brand Description" value={formData.brandDescription} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Company Logo</label>
              <div className="g2g-brand-gradient mt-2 flex size-32 items-center justify-center rounded-lg text-2xl font-bold text-brand-foreground">
                {formData.brandName?.slice(0, 3)}
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                Change Logo
              </Button>
            </div>
            <div className="flex flex-col gap-5">
              <FormField label="Brand Name" required>
                <TextInput
                  value={formData.brandName}
                  onChange={(e) => handleInputChange('brandName', e.target.value)}
                />
              </FormField>
              <FormField label="Tagline">
                <TextInput
                  value={formData.tagline}
                  onChange={(e) => handleInputChange('tagline', e.target.value)}
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Brand Description">
                <TextArea
                  value={formData.brandDescription}
                  onChange={(e) => handleInputChange('brandDescription', e.target.value)}
                  rows={3}
                />
              </FormField>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Sister Companies Section */}
      <SectionCard
        title="Sister Companies"
        actions={
          currentMode === 'edit' && canEdit ? (
            <Button size="sm" variant="outline">
              <Plus className="size-4" aria-hidden="true" />
              Add Sister Company
            </Button>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  Company Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  Relationship Type
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  Status
                </th>
                {currentMode === 'edit' && (
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  id: 1,
                  name: 'ABC Infotech Pvt. Ltd.',
                  relationship: 'Sister Company',
                  status: 'Active' as const,
                },
                {
                  id: 2,
                  name: 'XYZ Solutions Pvt. Ltd.',
                  relationship: 'Sister Company',
                  status: 'Active' as const,
                },
                {
                  id: 3,
                  name: 'ABC Global Services LLP',
                  relationship: 'Sister Company',
                  status: 'Inactive' as const,
                },
              ].map((company) => (
                <tr key={company.id} className="border-b border-border hover:bg-surface-muted">
                  <td className="px-4 py-3 text-foreground">{company.name}</td>
                  <td className="px-4 py-3 text-foreground">{company.relationship}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={company.status} />
                  </td>
                  {currentMode === 'edit' && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost">
                          <Eye className="size-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Edit className="size-4" aria-hidden="true" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-danger hover:text-danger">
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Showing 1 to 3 of 3 entries</p>
      </SectionCard>

      {/* Settings (Overview) Section */}
      <SectionCard
        title="Settings (Overview)"
        actions={
          currentMode === 'view' ? (
            <Button size="sm" variant="outline">
              View &amp; Edit Settings
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          ) : undefined
        }
      >
        {currentMode === 'view' ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <ReadField label="Time Zone" value={formData.timeZone} />
            <ReadField label="Currency" value={formData.currency} />
            <ReadField label="Financial Year" value={formData.financialYear} />
            <ReadField label="Date Format" value={formData.dateFormat} />
            <ReadField label="Language" value={formData.language} />
            <ReadField label="Number Format" value={formData.numberFormat} />
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Working Days
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {allDays.map((day) => (
                  <Badge key={day} tone={formData.workingDays.includes(day) ? 'navy' : 'outline'}>
                    {day}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <FormField label="Time Zone">
              <SelectInput
                value={formData.timeZone}
                onChange={(value) => handleInputChange('timeZone', value)}
                options={[
                  { value: '(IST) Asia/Kolkata', label: '(IST) Asia/Kolkata' },
                  { value: '(GMT) Europe/London', label: '(GMT) Europe/London' },
                  { value: '(PST) America/Los_Angeles', label: '(PST) America/Los_Angeles' },
                ]}
              />
            </FormField>
            <FormField label="Currency">
              <SelectInput
                value={formData.currency}
                onChange={(value) => handleInputChange('currency', value)}
                options={[
                  { value: 'INR - Indian Rupee (₹)', label: 'INR - Indian Rupee (₹)' },
                  { value: 'USD - US Dollar ($)', label: 'USD - US Dollar ($)' },
                  { value: 'GBP - British Pound (£)', label: 'GBP - British Pound (£)' },
                ]}
              />
            </FormField>
            <FormField label="Financial Year">
              <SelectInput
                value={formData.financialYear}
                onChange={(value) => handleInputChange('financialYear', value)}
                options={[
                  { value: 'April - March', label: 'April - March' },
                  { value: 'January - December', label: 'January - December' },
                  { value: 'July - June', label: 'July - June' },
                ]}
              />
            </FormField>
            <FormField label="Date Format">
              <SelectInput
                value={formData.dateFormat}
                onChange={(value) => handleInputChange('dateFormat', value)}
                options={[
                  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                ]}
              />
            </FormField>
            <FormField label="Language">
              <SelectInput
                value={formData.language}
                onChange={(value) => handleInputChange('language', value)}
                options={[
                  { value: 'English', label: 'English' },
                  { value: 'Hindi', label: 'Hindi' },
                  { value: 'Spanish', label: 'Spanish' },
                ]}
              />
            </FormField>
            <FormField label="Number Format">
              <SelectInput
                value={formData.numberFormat}
                onChange={(value) => handleInputChange('numberFormat', value)}
                options={[
                  { value: '1,234.56', label: '1,234.56' },
                  { value: '1.234,56', label: '1.234,56' },
                  { value: '1234.56', label: '1234.56' },
                ]}
              />
            </FormField>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-sm font-medium text-foreground">Working Days</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {allDays.map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleWorkingDay(day)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      formData.workingDays.includes(day)
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border text-muted-foreground hover:border-input'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Footer actions */}
      {currentMode === 'edit' && (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-border bg-card px-6 py-4 shadow-sm">
          <Button variant="outline" onClick={handleCancel}>
            <X className="size-4" aria-hidden="true" />
            Cancel
          </Button>
          <Button variant="outline">
            <Save className="size-4" aria-hidden="true" />
            Save Draft
          </Button>
          <Button onClick={handleSave}>
            <Send className="size-4" aria-hidden="true" />
            Save &amp; Publish
          </Button>
        </div>
      )}
    </div>
  )
}
