'use client'

import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AccessDeniedPage } from '@/components/auth/access-denied-page'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { SetupWizardLayout } from '@/components/settings/setup-wizard-layout'
import { SISTER_COMPANIES, type SisterCompany } from '@/lib/gtg-org-data'
import { useAuth } from '@/components/auth/gtg-auth'
import { updateOnboarding } from '@/lib/onboarding'
import type { SetupStep } from '@/components/settings/setup-progress-tracker'
import type { OrganizationForm, SisterCompanyMode } from '@/domain/organizationanization-setup/organization-profile-step'
import type { EmployeeRow } from '@/domain/organizationanization-setup/employee-import-step'

const LazySetupProgressRail = lazy(() =>
  import('@/domain/organizationanization-setup/setup-progress-rail').then((module) => ({ default: module.SetupProgressRail })),
)

const LazyOrganizationProfileStep = lazy(() =>
  import('@/domain/organizationanization-setup/organization-profile-step').then((module) => ({ default: module.OrganizationProfileStep })),
)

const LazyDepartmentSelectionStep = lazy(() =>
  import('@/domain/organizationanization-setup/department-selection-step').then((module) => ({ default: module.DepartmentSelectionStep })),
)

const LazyEmployeeImportStep = lazy(() =>
  import('@/domain/organizationanization-setup/employee-import-step').then((module) => ({ default: module.EmployeeImportStep })),
)

const LazySetupCompletionStep = lazy(() =>
  import('@/domain/organizationanization-setup/setup-completion-step').then((module) => ({ default: module.SetupCompletionStep })),
)

const sampleEmployees: EmployeeRow[] = [
  {
    id: '1',
    employeeId: 'EMP-001',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@abctech.com',
    department: 'Engineering',
    designation: 'Senior Software Engineer',
    joiningDate: '2024-04-15',
    status: 'Ready',
  },
  {
    id: '2',
    employeeId: 'EMP-002',
    name: 'Nisha Shah',
    email: 'nisha.shah@abctech.com',
    department: 'Human Resources',
    designation: 'HR Manager',
    joiningDate: '2023-11-01',
    status: 'Ready',
  },
  {
    id: '3',
    employeeId: 'EMP-003',
    name: 'Rohan Iyer',
    email: '',
    department: 'Quality Assurance',
    designation: 'QA Analyst',
    joiningDate: '2025-01-20',
    status: 'Needs Review',
  },
]

const SETUP_STEPS: SetupStep[] = [
  { id: 'modules', label: 'Module Selection' },
  { id: 'organization', label: 'Organization Details' },
  { id: 'department', label: 'Department Setup' },
  { id: 'employee', label: 'Employee Import' },
  { id: 'review', label: 'Portal Review' },
  { id: 'golive', label: 'Go Live' },
]

type WizardStep = 'organization' | 'departments' | 'employees'

const steps = [
  {
    id: 'organization',
    label: 'Organization Details',
    description: 'Manage your organization information and preferences',
  },
  {
    id: 'departments',
    label: 'Department Selection',
    description: 'Choose departments suggested for your industry.',
  },
  {
    id: 'employees',
    label: 'Employee Import',
    description: 'Upload, validate, and review employee records.',
  },
]

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

function getSisterCompanyOrganization(
  company: SisterCompany,
): OrganizationForm {
  const locationParts = company.location
    .split(',')
    .map((part) => part.trim())
  const city = locationParts[0] || ''
  const country = locationParts[1] || ''

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
    city: city || '',
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

const initialSisterCompanyForms = SISTER_COMPANIES.reduce<
  Record<string, OrganizationForm>
>((forms, company) => {
  forms[company.id] = getSisterCompanyOrganization(company)
  return forms
}, {})

const initialSisterCompany = SISTER_COMPANIES.reduce<Record<string, OrganizationForm>>(
  (forms, company) => {
    forms[company.id] = getSisterCompanyOrganization(company)
    return forms
  },
  {},
)

const requiredOrganizationFields: Array<keyof OrganizationForm> = [
  'organizationName',
  'organizationCode',
  'organizationType',
  'businessType',
  'industryType',
  'email',
  'phone',
  'country',
  'state',
  'city',
  'registrationNumber',
  'gstNumber',
  'panNumber',
  'establishedDate',
  'addressLine1',
  'postalCode',
  'companyDescription',
]

export default function OrganizationSetupPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  const [activeStep, setActiveStep] = useState<WizardStep>('organization')
  const [completed, setCompleted] = useState<Record<WizardStep, boolean>>({
    organization: false,
    departments: false,
    employees: false,
  })
  const [mainOrganization, setMainOrganization] =
    useState<OrganizationForm>(initialOrganization)
  const [organization, setOrganization] =
    useState<OrganizationForm>(initialOrganization)
  const [timeZone, setTimeZone] = useState('(IST) Asia/Kolkata')
  const [currency, setCurrency] = useState('INR - Indian Rupee (₹)')
  const [financialYear, setFinancialYear] = useState('April - March')
  const [language, setLanguage] = useState('English')
  const [newSisterOrganization, setNewSisterOrganization] =
    useState<OrganizationForm>(initialNewSisterCompany)
  const [sisterCompanyForms, setSisterCompanyForms] = useState<
    Record<string, OrganizationForm>
  >(initialSisterCompanyForms)
  const [departmentSearch, setDepartmentSearch] = useState('')
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [customDepartment, setCustomDepartment] = useState('')
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sisterCompanyMode, setSisterCompanyMode] =
    useState<SisterCompanyMode>('none')
  const [editingSisterCompany, setEditingSisterCompany] = useState<SisterCompany | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mainCompletedSteps = useMemo(() => {
    const completedIds: string[] = []
    if (completed.organization) completedIds.push('organization')
    if (completed.departments) completedIds.push('department')
    if (completed.employees) completedIds.push('employee')
    return new Set(['modules', ...completedIds])
  }, [completed])
  const currentStep = mainCompletedSteps.size + 1
  const completionCount = steps.filter((step) => completed[step.id as WizardStep]).length
  const isComplete = completionCount === steps.length

  if (!user || !['admin', 'hr'].includes(user.role)) {
    return (
      <AccessDeniedPage reason="Organization setup is accessible to Admin and HR roles only." />
    )
  }

  const updateOrganization = (field: keyof OrganizationForm, value: string) => {
    setOrganization((current) => {
      const next = { ...current, [field]: value }

      if (sisterCompanyMode === 'none') {
        setMainOrganization(next)
      } else if (sisterCompanyMode === 'create') {
        setNewSisterOrganization(next)
      } else if (editingSisterCompany) {
        setSisterCompanyForms((currentForms) => ({
          ...currentForms,
          [editingSisterCompany.id]: next,
        }))
      }

      return next
    })
  }

  const saveOrganization = async () => {
    const hasMissing = requiredOrganizationFields.some(
      (field) => !organization[field].trim(),
    )
    if (hasMissing) return

    if (sisterCompanyMode !== 'none') {
      if (sisterCompanyMode === 'create') {
        setNewSisterOrganization(organization)
      } else if (editingSisterCompany) {
        setSisterCompanyForms((currentForms) => ({
          ...currentForms,
          [editingSisterCompany.id]: organization,
        }))
      }
      return
    }

    if (user) {
      await updateOnboarding(user.id, {
        organization: {
          companyName: organization.organizationName,
          timeZone,
          currency,
          financialYear,
          country: organization.country,
          industry: organization.industryType,
        },
      })
    }
    completeStep('organization', 'departments')
  }

  const toggleDepartment = (department: string) => {
    setSelectedDepartments((current) =>
      current.includes(department)
        ? current.filter((item) => item !== department)
        : [...current, department],
    )
  }

  const addCustomDepartment = () => {
    const value = customDepartment.trim()
    if (!value || selectedDepartments.includes(value)) return
    setSelectedDepartments((current) => [...current, value])
    setCustomDepartment('')
  }

  const importEmployees = () => {
    setEmployees(sampleEmployees)
    setEmployeeSearch('')
    setPage(1)
  }

  const saveDepartments = async () => {
    if (user) await updateOnboarding(user.id, { departments: selectedDepartments })
    completeStep('departments', 'employees')
  }

  const saveEmployees = async () => {
    const warnings = employees.filter((employee) => employee.status === 'Needs Review').length
    if (user) {
      await updateOnboarding(user.id, {
        employees: {
          total: employees.length,
          successful: employees.length - warnings,
          warnings,
          errors: 0,
        },
      })
    }
    completeStep('employees')
  }

  const downloadTemplate = () => {
    const csv = [
      'Employee ID,Employee Name,Email,Department,Designation,Joining Date',
      'EMP-001,Aarav Mehta,aarav.mehta@abctech.com,Engineering,Software Engineer,2024-04-15',
    ].join('\n')
    const link = document.createElement('a')
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
    link.download = 'employee-import-template.csv'
    link.click()
  }

  const deleteEmployee = (id: string) => {
    setEmployees((current) => current.filter((employee) => employee.id !== id))
  }

  const markEmployeeReady = (id: string) => {
    setEmployees((current) =>
      current.map((employee) =>
        employee.id === id
          ? {
              ...employee,
              email:
                employee.email ||
                `${employee.name.toLowerCase().replace(/\s+/g, '.')}@abctech.com`,
              status: 'Ready',
            }
          : employee,
      ),
    )
  }

  const openSisterCompanyEditor = (company: SisterCompany) => {
    setEditingSisterCompany(company)
    setSisterCompanyMode('edit')
    setActiveStep('organization')
    setOrganization(sisterCompanyForms[company.id] ?? getSisterCompanyOrganization(company))
  }

  const openSisterCompanyCreator = () => {
    setEditingSisterCompany(null)
    setSisterCompanyMode('create')
    setActiveStep('organization')
    setOrganization(newSisterOrganization)
  }

  const openMainCompany = () => {
    setEditingSisterCompany(null)
    setSisterCompanyMode('none')
    setActiveStep('organization')
    setOrganization(mainOrganization)
  }

  const openCurrentSisterCompany = () => {
    if (sisterCompanyMode === 'create') {
      setOrganization(newSisterOrganization)
      return
    }

    if (editingSisterCompany) {
      setOrganization(
        sisterCompanyForms[editingSisterCompany.id] ??
          getSisterCompanyOrganization(editingSisterCompany),
      )
    }
  }

  const deleteSisterCompany = (id: string) => {
    setEditingSisterCompany(null)
    setSisterCompanyMode('none')
    setOrganization(mainOrganization)
  }

  const completeStep = (step: WizardStep, next?: WizardStep) => {
    setCompleted((current) => ({ ...current, [step]: true }))
    if (next) setActiveStep(next)
  }

  return (
    <ProtectedLayout>
      <SetupWizardLayout currentStep={currentStep} steps={SETUP_STEPS} completedSteps={mainCompletedSteps}>
        <div className="grid h-full min-h-0 gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="h-full min-h-0 p-4 lg:sticky lg:top-4">
            <Suspense fallback={<div className="h-[560px] rounded-lg border border-border bg-muted/30" />}>
              <LazySetupProgressRail activeStep={activeStep} completed={completed} steps={steps} />
            </Suspense>
          </aside>
          <section className="min-w-0 flex-1 overflow-y-auto g2g-scrollbar px-4 py-6 sm:px-6 sm:py-3">
            {!isComplete && (
              <div className="sticky top-0 z-20 mb-5 rounded-lg border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase text-primary">
                  Step {steps.findIndex((step) => step.id === activeStep) + 1}{' '}
                  of {steps.length}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">
                  {steps.find((step) => step.id === activeStep)?.label}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {steps.find((step) => step.id === activeStep)?.description}
                </p>
                {sisterCompanyMode !== 'none' && (
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={openMainCompany}
                    >
                      {mainOrganization.organizationName}
                    </button>
                    <span aria-hidden="true">/</span>
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={openCurrentSisterCompany}
                    >
                      {sisterCompanyMode === 'create'
                        ? 'New Sister Company'
                        : organization.organizationName || editingSisterCompany?.name}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isComplete && activeStep === 'organization' && (
              <Suspense fallback={<div className="h-[720px] rounded-lg border border-border bg-muted/30" />}>
                <LazyOrganizationProfileStep
                  organization={organization}
                  updateOrganization={updateOrganization}
                  isOrganizationReady={requiredOrganizationFields.every((field) =>
                    organization[field].trim(),
                  )}
                  saveOrganization={saveOrganization}
                  employeeCount={employees.length}
                  timeZone={timeZone}
                  currency={currency}
                  financialYear={financialYear}
                  language={language}
                  updateTimeZone={setTimeZone}
                  updateCurrency={setCurrency}
                  updateFinancialYear={setFinancialYear}
                  updateLanguage={setLanguage}
                  sisterCompanyMode={sisterCompanyMode}
                  onSisterCompanyCreate={openSisterCompanyCreator}
                  onSisterCompanyEdit={openSisterCompanyEditor}
                  onSisterCompanyDelete={deleteSisterCompany}
                  editingSisterCompany={editingSisterCompany}
                  sisterCompanyForms={sisterCompanyForms}
                  newSisterOrganization={newSisterOrganization}
                />
              </Suspense>
            )}

            {!isComplete && activeStep === 'departments' && (
              <Suspense fallback={<div className="h-[560px] rounded-lg border border-border bg-muted/30" />}>
                <LazyDepartmentSelectionStep
                  industryType={organization.industryType}
                  departmentSearch={departmentSearch}
                  setDepartmentSearch={setDepartmentSearch}
                  selectedDepartments={selectedDepartments}
                  toggleDepartment={toggleDepartment}
                  customDepartment={customDepartment}
                  setCustomDepartment={setCustomDepartment}
                  addCustomDepartment={addCustomDepartment}
                  saveDepartments={saveDepartments}
                />
              </Suspense>
            )}

            {!isComplete && activeStep === 'employees' && (
              <Suspense fallback={<div className="h-[620px] rounded-lg border border-border bg-muted/30" />}>
                <LazyEmployeeImportStep
                  employees={employees}
                  setEmployees={setEmployees}
                  employeeSearch={employeeSearch}
                  setEmployeeSearch={setEmployeeSearch}
                  page={page}
                  setPage={setPage}
                  importEmployees={importEmployees}
                  saveEmployees={saveEmployees}
                  markEmployeeReady={markEmployeeReady}
                  deleteEmployee={deleteEmployee}
                  downloadTemplate={downloadTemplate}
                />
              </Suspense>
            )}

            {isComplete && (
              <Suspense fallback={<div className="h-64 rounded-lg border border-border bg-muted/30" />}>
                <LazySetupCompletionStep router={router} />
              </Suspense>
            )}
          </section>
        </div>
      </SetupWizardLayout>
    </ProtectedLayout>
  )
}
