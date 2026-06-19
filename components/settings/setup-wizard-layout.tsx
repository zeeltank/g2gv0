'use client'

import { HelpCircle } from 'lucide-react'
import { GtgBrandMark } from '@/components/shell/gtg-brand-mark'
import { SetupProgressTracker, type SetupStep } from '@/components/settings/setup-progress-tracker'

interface SetupWizardLayoutProps {
  currentStep: number
  steps: SetupStep[]
  children: React.ReactNode
}

export function SetupWizardLayout({ currentStep, steps, children }: SetupWizardLayoutProps) {
  return (
    <div className="flex h-screen w-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <GtgBrandMark />
        <div className="flex items-center gap-4">
          <SetupProgressTracker currentStep={currentStep} steps={steps} />
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="size-4" />
            Need Help?
          </a>
        </div>
      </div>
      <div className="g2g-page-scroll g2g-scrollbar flex-1">
        <div className="w-full px-4 py-6 sm:px-6 sm:py-3">{children}</div>
      </div>
    </div>
  )
}