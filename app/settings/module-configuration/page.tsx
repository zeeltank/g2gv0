'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { ModuleCard, type Module } from '@/components/settings/module-card'
import { ProtectedLayout } from '@/components/auth/protected-layout'
import { SetupWizardIllustration } from '@/components/illustration/setup-wizard-illustration'
import { SetupWizardLayout } from '@/components/settings/setup-wizard-layout'
import type { SetupStep } from '@/components/settings/setup-progress-tracker'
import { Info } from 'lucide-react'
import { useAuth } from '@/lib/gtg-auth'
import { updateOnboarding } from '@/lib/onboarding'

const SETUP_STEPS: SetupStep[] = [
  { id: 'profile', label: 'Profile Setup' },
  { id: 'modules', label: 'Module Selection' },
  { id: 'organization', label: 'Organization Details' },
  { id: 'department', label: 'Department Setup' },
  { id: 'employee', label: 'Employee Import' },
  { id: 'additional', label: 'Additional Module Setup' },
  { id: 'review', label: 'Portal Review' },
  { id: 'golive', label: 'Go Live' },
]

const INITIAL_MODULES: Module[] = [
  {
    id: 'organization',
    title: 'Organization Management',
    mandatory: true,
    duration: '5–7 mins',
    selected: true,
    description: 'Manage organization details, departments, policies and compliance settings.',
    screens: 15,
    features: 48,
  },
  {
    id: 'competency',
    title: 'Competency Management',
    mandatory: false,
    duration: '6–8 mins',
    selected: false,
    description: 'Define skills, job roles, competencies and manage competency framework.',
    screens: 12,
    features: 36,
  },
  {
    id: 'talent',
    title: 'Talent Management',
    mandatory: false,
    duration: '4–6 mins',
    selected: false,
    description: 'Manage employees, roles, performance and talent development.',
    screens: 10,
    features: 30,
  },
  {
    id: 'lms',
    title: 'LMS',
    mandatory: false,
    duration: '5–7 mins',
    selected: false,
    description: 'Create and manage courses, learning paths, assessments and certifications.',
    screens: 14,
    features: 42,
  },
  {
    id: 'hrit',
    title: 'HRIT Solutions',
    mandatory: false,
    duration: '6–10 mins',
    selected: false,
    description: 'Manage HR processes, workflows, leave, payroll integrations and more.',
    screens: 18,
    features: 55,
  },
]

export default function ModuleConfigurationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [modules, setModules] = useState<Module[]>(INITIAL_MODULES)
  const [modulesCompleted, setModulesCompleted] = useState(false)

  const completedSteps = modulesCompleted ? new Set(['profile', 'modules']) : new Set(['profile'])
  const currentStep = modulesCompleted ? 3 : 2

  useEffect(() => {
    if (!user) return
    fetch(`/api/onboarding?userId=${encodeURIComponent(user.id)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.selectedModules?.length) return
        const selected = new Set<string>(data.selectedModules.map((module: { id: string }) => module.id))
        setModules((current) => current.map((module) => ({ ...module, selected: selected.has(module.id) })))
      })
      .catch(() => undefined)
  }, [user])

  const handleToggle = (id: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, selected: !m.selected } : m,
      ),
    )
  }

  const handleViewOrganization = () => {
    router.push('/module/m1/org-setup/org-profile')
  }

  return (
    <ProtectedLayout>
      <SetupWizardLayout currentStep={currentStep} steps={SETUP_STEPS} completedSteps={completedSteps}>
        <div className="mb-7 flex flex-col gap-4 sm:mb-6 sm:gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
              STEP 1 OF 5
            </span>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Welcome to Module Configuration! 👋
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Let&apos;s set up your portal step by step. You can complete, skip, or mark
              modules as not needed. You can always come back and update them anytime.
            </p>

            <div className="mt-6">
              <h2 className="text-lg font-semibold text-foreground">
                Select Modules to Setup
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose the modules you want to set up now.
              </p>
            </div>
          </div>

          <div
            className="aspect-[960/604] w-56 shrink-0 overflow-hidden rounded-lg bg-white sm:w-72 md:w-96"
            aria-hidden="true"
          >
            <SetupWizardIllustration />
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {modules.map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              onToggle={handleToggle}
              onViewOrganization={mod.id === 'organization' ? handleViewOrganization : undefined}
            />
          ))}
        </div>

        <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-y-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">☑</span>
            <span className="text-xs text-muted-foreground">Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs">☐</span>
            <span className="text-xs text-muted-foreground">Not Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex size-2.5 items-center justify-center">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            </span>
            <span className="text-xs text-muted-foreground">Mandatory</span>
            <span className="text-xs text-muted-foreground">Required Module</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex size-2.5 items-center justify-center">
              <span className="size-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
            </span>
            <span className="text-xs text-muted-foreground">Optional</span>
            <span className="text-xs text-muted-foreground">Optional Module</span>
          </div>
        </div>

        <Alert variant="info" className="mt-4 sm:mt-6">
          <Info className="size-4" aria-hidden="true" />
          <AlertTitle>Why are some modules mandatory?</AlertTitle>
          <AlertDescription>
            These modules are essential for the basic functioning of your portal. You can skip optional modules and set them up later.
          </AlertDescription>
        </Alert>

        <div className="mt-4 sm:mt-6 flex flex-col gap-2 sm:gap-3 sm:flex-row sm:justify-end sm:items-center">
          <Button
            size="lg"
            onClick={async () => {
              setModulesCompleted(true)
              const selectedModules = modules.filter((module) => module.selected).map((module) => ({ id: module.id, name: module.title }))
              if (user) await updateOnboarding(user.id, { selectedModules })
              router.push('/organization/setup')
            }}
          >
            Continue Setup →
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground sm:text-right">
          You can skip any module in the next step.
        </p>
      </SetupWizardLayout>
    </ProtectedLayout>
  )
}
