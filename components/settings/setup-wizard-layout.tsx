"use client";

import { HelpCircle } from "lucide-react";
import { GtgBrandMark } from "@/components/shell/gtg-brand-mark";
import {
  SetupProgressTracker,
  type SetupStep,
} from "@/components/settings/setup-progress-tracker";

interface SetupWizardLayoutProps {
  currentStep: number;
  steps: SetupStep[];
  completedSteps?: Set<string>;
  children: React.ReactNode;
}

export function SetupWizardLayout({
  currentStep,
  steps,
  completedSteps,
  children,
}: SetupWizardLayoutProps) {
  return (
    <div className="flex h-screen w-full flex-col">
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <GtgBrandMark />
        <div className="flex items-center gap-4">
          <SetupProgressTracker currentStep={currentStep} steps={steps} completedSteps={completedSteps} />
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="size-4" />
            Need Help?
          </a>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">{children}</div>
    </div>
  );
}
