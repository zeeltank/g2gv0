'use client'

import { useState } from 'react'
import { Building2, Search, Plus, SlidersHorizontal, Edit2, Trash2, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SearchInput } from '@/components/ui/search-input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { SectionCard, ReadField, FormField, SelectInput } from '@/components/org/gtg-ui'
import { SISTER_COMPANIES, type SisterCompany } from '@/lib/gtg-org-data'
import { cn } from '@/lib/utils'

export interface OrganizationForm {
  organizationName: string
  organizationCode: string
  organizationType: string
  businessType: string
  industryType: string
  email: string
  phone: string
  website: string
  country: string
  state: string
  city: string
  registrationNumber: string
  gstNumber: string
  panNumber: string
  establishedDate: string
  addressLine1: string
  addressLine2: string
  postalCode: string
  companyDescription: string
}

export type SisterCompanyMode = 'none' | 'create' | 'edit'

const departmentSuggestions: Record<string, string[]> = {
  'Information Technology': [
    'Engineering',
    'Product Management',
    'Quality Assurance',
    'DevOps',
    'UI/UX Design',
    'Human Resources',
    'Finance',
    'Sales',
    'Marketing',
    'Customer Support',
    'Administration',
  ],
  Manufacturing: [
    'Production',
    'Quality Control',
    'Maintenance',
    'Procurement',
    'Warehouse',
    'Human Resources',
    'Finance',
    'Sales',
  ],
  Healthcare: [
    'Clinical Operations',
    'Nursing',
    'Patient Support',
    'Compliance',
    'Human Resources',
    'Finance',
    'Administration',
  ],
}

const initialOrganization: OrganizationForm = {
  organizationName: 'ABC Technologies Pvt. Ltd.',
  organizationCode: 'ABC123',
  organizationType: 'Company',
  businessType: 'Private Limited',
  industryType: 'Information Technology',
  email: 'info@abctech.com',
  phone: '079-12345678',
  website: 'www.abctech.com',
  country: 'India',
  state: 'Gujarat',
  city: 'Ahmedabad',
  registrationNumber: '',
  gstNumber: '',
  panNumber: '',
  establishedDate: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  companyDescription: '',
}

const initialNewSisterCompany: OrganizationForm = {
  ...initialOrganization,
  organizationName: '',
  organizationCode: '',
  organizationType: 'Company',
  businessType: 'Subsidiary',
  email: '',
  phone: '',
  website: '',
  country: '',
  state: '',
  city: '',
  registrationNumber: '',
  gstNumber: '',
  panNumber: '',
  establishedDate: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  companyDescription: '',
}

function getLocationParts(location: string) {
  const [city = '', country = ''] = location.split(',').map((part) => part.trim())
  return { city, country }
}

function getSisterCompanyOrganization(
  company: SisterCompany,
): OrganizationForm {
  const { city, country } = getLocationParts(company.location)

  return {
    ...initialOrganization,
    organizationName: company.name,
    organizationCode: company.code,
    organizationType: 'Company',
    businessType: company.type,
    email: '',
    phone: '',
    website: '',
    country: country || initialOrganization.country,
    state: '',
    city,
    registrationNumber: '',
    gstNumber: '',
    panNumber: '',
    establishedDate: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    companyDescription: `${company.name} is a ${company.type.toLowerCase()} of ${initialOrganization.organizationName}.`,
  }
}

function getOrganizationInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return initials.slice(0, 3) || 'ORG'
}

function getEstablishedYear(value: string) {
  const year = value.slice(0, 4)
  return /^\d{4}$/.test(year) ? year : value || 'Pending'
}

interface OrganizationProfileStepProps {
  organization: OrganizationForm
  updateOrganization: (field: keyof OrganizationForm, value: string) => void
  isOrganizationReady: boolean
  saveOrganization: () => void
  employeeCount: number
  timeZone: string
  currency: string
  financialYear: string
  language: string
  updateTimeZone: (value: string) => void
  updateCurrency: (value: string) => void
  updateFinancialYear: (value: string) => void
  updateLanguage: (value: string) => void
  sisterCompanyMode?: SisterCompanyMode
  onSisterCompanyCreate?: () => void
  onSisterCompanyEdit?: (company: SisterCompany) => void
  onSisterCompanyDelete?: (id: string) => void
  editingSisterCompany?: SisterCompany | null
  sisterCompanyForms?: Record<string, OrganizationForm>
  newSisterOrganization?: OrganizationForm
}

export function OrganizationProfileStep({
  organization,
  updateOrganization,
  isOrganizationReady,
  saveOrganization,
  employeeCount,
  timeZone,
  currency,
  financialYear,
  language,
  updateTimeZone,
  updateCurrency,
  updateFinancialYear,
  updateLanguage,
  sisterCompanyMode,
  onSisterCompanyCreate,
  onSisterCompanyEdit,
  onSisterCompanyDelete,
  editingSisterCompany,
  sisterCompanyForms,
  newSisterOrganization,
}: OrganizationProfileStepProps) {
  const [sisterCompanySearch, setSisterCompanySearch] = useState('')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [workingDays, setWorkingDays] = useState<string[]>([
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ])
  const logoText = getOrganizationInitials(organization.organizationName)
  const filteredSisterCompanies = SISTER_COMPANIES.filter((company) =>
    company.name.toLowerCase().includes(sisterCompanySearch.toLowerCase()),
  )
  const settingsSummary = [
    { label: 'Time Zone', value: timeZone, options: ['(IST) Asia/Kolkata', '(PST) America/Los_Angeles', '(CET) Europe/Paris'] },
    { label: 'Currency', value: currency, options: ['INR - Indian Rupee (₹)', 'USD - US Dollar ($)', 'EUR - Euro (€)'] },
    { label: 'Financial Year', value: financialYear, options: ['April - March', 'January - December', 'July - June'] },
    { label: 'Language', value: language, options: ['English', 'Hindi', 'Gujarati'] },
    { label: 'Number Format', value: '1,234.56' },
  ]
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const completeOrganization = () => {
    if (!isOrganizationReady) return
    saveOrganization()
  }

  const getCurrentSisterOrganization = (): OrganizationForm => {
    if (sisterCompanyMode === 'create' && newSisterOrganization) {
      return newSisterOrganization
    }
    if (sisterCompanyMode === 'edit' && editingSisterCompany) {
      return sisterCompanyForms?.[editingSisterCompany.id] ?? getSisterCompanyOrganization(editingSisterCompany)
    }
    return organization
  }

  const currentOrg = getCurrentSisterOrganization()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="secondary">
            <Building2 className="size-3.5" aria-hidden="true" />
            {currentOrg.organizationType}
          </Badge>
        </div>
        <Button
          type="button"
          disabled={!isOrganizationReady}
          onClick={completeOrganization}
        >
          {sisterCompanyMode === 'create'
            ? 'Create Sister Company'
            : sisterCompanyMode === 'edit'
              ? 'Save Sister Company'
              : 'Save & Continue'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Company Logo" className="lg:col-span-1">
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex size-28 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground shadow-md"
              aria-hidden="true"
            >
              {logoText}
            </div>
            <div className="flex w-full flex-col gap-3 pt-2">
              <ReadField
                label="Founded"
                value={getEstablishedYear(currentOrg.establishedDate)}
              />
              <ReadField
                label="Total Employees"
                value={
                  employeeCount > 0 ? employeeCount.toLocaleString() : 'Pending'
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Company Name" required>
              <Input
                value={currentOrg.organizationName}
                onChange={(event) =>
                  updateOrganization('organizationName', event.target.value)
                }
              />
            </FormField>
            <FormField label="Company Code" required>
              <Input
                value={currentOrg.organizationCode}
                onChange={(event) =>
                  updateOrganization('organizationCode', event.target.value)
                }
              />
            </FormField>
            <FormField label="Registration Number" required>
              <Input
                value={currentOrg.registrationNumber}
                onChange={(event) =>
                  updateOrganization('registrationNumber', event.target.value)
                }
              />
            </FormField>
            <FormField label="Industry" required>
              <SelectInput
                value={currentOrg.industryType}
                onChange={(value) => updateOrganization('industryType', value)}
                options={[
                  {
                    value: 'Information Technology',
                    label: 'Information Technology',
                  },
                  { value: 'Manufacturing', label: 'Manufacturing' },
                  { value: 'Healthcare', label: 'Healthcare' },
                ]}
              />
            </FormField>
            <FormField label="Organization Type" required>
              <SelectInput
                value={currentOrg.organizationType}
                onChange={(value) =>
                  updateOrganization('organizationType', value)
                }
                options={[
                  { value: 'Company', label: 'Company' },
                  { value: 'Partnership', label: 'Partnership' },
                  { value: 'LLP', label: 'LLP' },
                  { value: 'Public Limited', label: 'Public Limited' },
                ]}
              />
            </FormField>
            <FormField label="Business Type" required>
              <SelectInput
                value={currentOrg.businessType}
                onChange={(value) => updateOrganization('businessType', value)}
                options={[
                  { value: 'Private Limited', label: 'Private Limited' },
                  { value: 'Public Limited', label: 'Public Limited' },
                  { value: 'Partnership', label: 'Partnership' },
                  { value: 'Subsidiary', label: 'Subsidiary' },
                  { value: 'Branch', label: 'Branch' },
                ]}
              />
            </FormField>
            <FormField label="Established Date" required>
              <Input
                type="date"
                value={currentOrg.establishedDate}
                onChange={(event) =>
                  updateOrganization('establishedDate', event.target.value)
                }
              />
            </FormField>
            <FormField label="GST No." required>
              <Input
                value={currentOrg.gstNumber}
                onChange={(event) =>
                  updateOrganization('gstNumber', event.target.value)
                }
              />
            </FormField>
            <FormField label="PAN No." required>
              <Input
                value={currentOrg.panNumber}
                onChange={(event) =>
                  updateOrganization('panNumber', event.target.value)
                }
              />
            </FormField>
            <FormField label="Website">
              <Input
                value={currentOrg.website}
                onChange={(event) =>
                  updateOrganization('website', event.target.value)
                }
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Company Description" required>
                <Textarea
                  value={currentOrg.companyDescription}
                  onChange={(event) =>
                    updateOrganization('companyDescription', event.target.value)
                  }
                  rows={3}
                />
              </FormField>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Contact Information">
          <div className="grid grid-cols-1 gap-4">
            <FormField label="Email Address" required>
              <Input
                type="email"
                value={currentOrg.email}
                onChange={(event) =>
                  updateOrganization('email', event.target.value)
                }
              />
            </FormField>
            <FormField label="Phone Number" required>
              <Input
                value={currentOrg.phone}
                onChange={(event) =>
                  updateOrganization('phone', event.target.value)
                }
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Registered Address">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Address Line 1" required>
                <Input
                  value={currentOrg.addressLine1}
                  onChange={(event) =>
                    updateOrganization('addressLine1', event.target.value)
                  }
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Address Line 2">
                <Input
                  value={currentOrg.addressLine2}
                  onChange={(event) =>
                    updateOrganization('addressLine2', event.target.value)
                  }
                />
              </FormField>
            </div>
            <FormField label="City" required>
              <Input
                value={currentOrg.city}
                onChange={(event) =>
                  updateOrganization('city', event.target.value)
                }
              />
            </FormField>
            <FormField label="State" required>
              <Input
                value={currentOrg.state}
                onChange={(event) =>
                  updateOrganization('state', event.target.value)
                }
              />
            </FormField>
            <FormField label="Postal Code" required>
              <Input
                value={currentOrg.postalCode}
                onChange={(event) =>
                  updateOrganization('postalCode', event.target.value)
                }
              />
            </FormField>
            <FormField label="Country" required>
              <Input
                value={currentOrg.country}
                onChange={(event) =>
                  updateOrganization('country', event.target.value)
                }
              />
            </FormField>
          </div>
        </SectionCard>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground">
              <Building2 className="size-5 text-primary" aria-hidden="true" />
              Sister Companies
            </h3>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="self-start border-primary/40 text-primary md:self-auto"
              onClick={onSisterCompanyCreate}
            >
              <Plus aria-hidden="true" />
              Add Sister Company
            </Button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <SearchInput
              value={sisterCompanySearch}
              onChange={(event) => setSisterCompanySearch(event.target.value)}
              placeholder="Search companies..."
              size="sm"
              icon={<Search className="size-4" />}
            />
          </div>
            <Button variant="outline" size="sm" type="button">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filter
            </Button>
          </div>

          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 text-[11px] normal-case text-foreground" scope="col">
                    Company Name
                  </TableHead>
                  <TableHead className="h-10 text-[11px] normal-case text-foreground" scope="col">
                    Relationship Type
                  </TableHead>
                  <TableHead className="h-10 text-[11px] normal-case text-foreground" scope="col">
                    Status
                  </TableHead>
                  <TableHead className="h-10 text-center text-[11px] normal-case text-foreground" scope="col">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSisterCompanies.map((company, index) => {
                  const isActive = index < 2

                  return (
                    <TableRow key={company.id}>
                      <TableCell className="py-3 text-sm font-medium text-foreground">
                        {company.name}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        Sister Company
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          tone={isActive ? 'success' : 'destructive'}
                          className="rounded-md px-2 py-1 text-[11px]"
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            type="button"
                            aria-label={`Edit ${company.name}`}
                            onClick={() => onSisterCompanyEdit?.(company)}
                          >
                            <Edit2 className="size-4 text-primary" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            type="button"
                            aria-label={`Delete ${company.name}`}
                            onClick={() => onSisterCompanyDelete?.(company.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {filteredSisterCompanies.length > 0 ? 1 : 0} to{' '}
              {filteredSisterCompanies.length} of{' '}
              {filteredSisterCompanies.length} entries
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="outline"
                type="button"
                disabled
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="icon-sm" type="button" aria-label="Page 1">
                1
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                type="button"
                disabled
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="inline-flex items-center gap-2 text-base font-semibold leading-normal text-foreground">
              <Settings className="size-4 text-primary" aria-hidden="true" />
              Settings (Overview)
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
              {settingsSummary.map((item) => (
                <div key={item.label} className="min-w-0">
                  <label className="text-xs font-semibold text-foreground">
                    {item.label}
                  </label>
                  {item.label === 'Language' ? (
                    <Select
                      value={item.value}
                      onChange={(value) => updateLanguage(value)}
                      options={item.options?.map((opt) => ({ value: opt, label: opt }))}
                      size="sm"
                      className="mt-2"
                    />
                  ) : item.label === 'Time Zone' ? (
                    <Select
                      value={item.value}
                      onChange={(value) => updateTimeZone(value)}
                      options={item.options?.map((opt) => ({ value: opt, label: opt }))}
                      size="sm"
                      className="mt-2"
                    />
                  ) : item.label === 'Currency' ? (
                    <Select
                      value={item.value}
                      onChange={(value) => updateCurrency(value)}
                      options={item.options?.map((opt) => ({ value: opt, label: opt }))}
                      size="sm"
                      className="mt-2"
                    />
                  ) : item.label === 'Financial Year' ? (
                    <Select
                      value={item.value}
                      onChange={(value) => updateFinancialYear(value)}
                      options={item.options?.map((opt) => ({ value: opt, label: opt }))}
                      size="sm"
                      className="mt-2"
                    />
                  ) : (
                    <Input
                      defaultValue={item.value}
                      className="mt-2 h-9 text-sm"
                    />
                  )}
                </div>
              ))}
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Date Format
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Input
                    type="date"
                    className="h-9 w-40 text-sm"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Number Format
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Input
                    defaultValue="1,234.56"
                    className="h-9 w-32 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    Preview
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Working Days
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {allDays.map((day) => {
                    const isSelected = workingDays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          setWorkingDays((current) =>
                            current.includes(day)
                              ? current.filter((item) => item !== day)
                              : [...current, day],
                          )
                        }
                        className={cn(
                          'inline-flex h-7 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="self-start xl:-mt-1"
          >
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  )
}
