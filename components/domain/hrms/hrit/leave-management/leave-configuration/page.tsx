'use client'

import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Tabs } from '@/shared/business'
import { useAuth } from '@/hooks/use-auth'
import { HR_ADMIN_ROLES } from '@/types/role'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'

const LeaveTypesTab = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-configuration/components/LeaveTypesTab').then((module) => ({
    default: module.default,
  })),
)

const ApprovalWorkflowTab = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-configuration/components/ApprovalWorkflowTab').then((module) => ({
    default: module.default,
  })),
)

const HolidayCalendarTab = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-configuration/components/HolidayCalendarTab').then((module) => ({
    default: module.default,
  })),
)

const EntitlementsTab = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-configuration/components/EntitlementsTab').then((module) => ({
    default: module.default,
  })),
)

const RolesAccessTab = lazy(() =>
  import('@/domain/hrms/hrit/leave-management/leave-configuration/components/RolesAccessTab').then((module) => ({
    default: module.default,
  })),
)

const configTabs = [
  { id: 'leave-types', label: 'Leave Types' },
  /*
   * F-96. Entitlement is what every leave balance is computed from, and it had
   * no screen anywhere in the product - hrms_leave_allocation held one row for
   * the whole platform. Placed second, right after Leave Types, because a leave
   * type without an entitlement grants nobody anything.
   */
  { id: 'entitlements', label: 'Entitlements' },
  { id: 'approval-workflow', label: 'Approval Workflow' },
  { id: 'holiday-calendar', label: 'Holiday Calendar' },
  { id: 'roles-access', label: 'Roles & Access' },
]

export default function LeaveConfigurationPage() {
  const searchParams = useSearchParams()
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get('tab')
    return configTabs.some((tab) => tab.id === requested) ? requested! : 'leave-types'
  })

  /*
   * F-191. Switching tabs silently threw away unsaved edits.
   *
   * Each tab is conditionally rendered, so leaving one UNMOUNTS it and its
   * draft state goes with it. Three tabs hold drafts - Roles & Access (a
   * permissions matrix), Entitlements (a quota grid) and Holiday Calendar (the
   * weekday pattern) - and Entitlements even renders the words "Unsaved
   * changes" while letting you navigate away from them.
   *
   * An admin could tick twenty permission boxes, click Holiday Calendar to
   * check something, come back, and find every tick gone with no warning.
   *
   * A ref rather than state: the child reports its dirty flag from an effect,
   * and storing it in state would re-render the page on every keystroke in the
   * grid. Nothing here needs to re-render when it changes - it is only read at
   * the moment a tab switch is attempted.
   */
  const dirtyTabs = useRef<Record<string, boolean>>({})
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  const reportDirty = useCallback((tabId: string, dirty: boolean) => {
    dirtyTabs.current[tabId] = dirty
  }, [])

  const requestTabChange = useCallback(
    (next: string) => {
      if (next !== activeTab && dirtyTabs.current[activeTab]) {
        setPendingTab(next)
        return
      }
      setActiveTab(next)
    },
    [activeTab],
  )

  const discardAndSwitch = useCallback(() => {
    if (!pendingTab) return
    dirtyTabs.current[activeTab] = false
    setActiveTab(pendingTab)
    setPendingTab(null)
  }, [activeTab, pendingTab])

  /*
   * F-190. This read `if (!user || !HR_ADMIN_ROLES.includes(user.role))`.
   *
   * `isLoading` was destructured on line 56 and never used. gtg-auth
   * deliberately returns { user: null, isLoading: true } on the first render to
   * avoid a hydration mismatch and restores the session in an effect - so the
   * FIRST PAINT of this screen was always the full-page red lock, on every
   * load, for a perfectly valid HR admin.
   *
   * Both payroll siblings already got this right (payroll-shell.tsx:28,
   * payroll-type/page.tsx:103); this screen was the one left.
   */
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-full flex flex-col gap-4 p-4 sm:gap-5 sm:p-0 md:gap-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!user || !HR_ADMIN_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center sm:min-h-[480px] sm:px-8 sm:py-16 md:min-h-[520px] lg:px-10">
        <div
          className="mb-5 flex size-14 items-center justify-center rounded-lg bg-destructive/10 text-destructive sm:mb-6 sm:size-16"
          aria-hidden="true"
        >
          <Lock className="size-7 sm:size-8" />
        </div>
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Access Restricted</h2>
        <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:text-base lg:max-w-lg">
          The Configuration page is accessible to HR Manager and Administrator roles only.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-full flex flex-col gap-4 sm:gap-5 md:gap-6 lg:max-w-10xl">
      <div className="px-4 sm:px-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl lg:text-3xl">Configuration</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">Manage leave policies, approval workflows, and organizational settings.</p>
      </div>

      <div className="px-4 sm:px-0">
        <Tabs tabs={configTabs} active={activeTab} onChange={requestTabChange} />
      </div>

      <div className="px-4 pb-4 sm:px-0 sm:pb-0 md:pb-0 lg:pb-0">
        <Suspense fallback={<div className="h-96 rounded-2xl bg-muted/40" />}>
          {activeTab === 'leave-types' && <LeaveTypesTab isLoading={isLoading} />}
          {activeTab === 'entitlements' && (
            <EntitlementsTab onDirtyChange={(dirty) => reportDirty('entitlements', dirty)} />
          )}
          {activeTab === 'approval-workflow' && <ApprovalWorkflowTab />}
          {activeTab === 'holiday-calendar' && (
            <HolidayCalendarTab
              isLoading={isLoading}
              onDirtyChange={(dirty) => reportDirty('holiday-calendar', dirty)}
            />
          )}
          {activeTab === 'roles-access' && (
            <RolesAccessTab
              isLoading={isLoading}
              onDirtyChange={(dirty) => reportDirty('roles-access', dirty)}
            />
          )}
        </Suspense>

        {/* F-191. The warning that used to be absent entirely. */}
        <AlertDialog open={pendingTab !== null} onOpenChange={(open) => !open && setPendingTab(null)}>
          <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes on this tab. Moving to another tab discards them, because
                each tab loads its own settings fresh.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setPendingTab(null)}>
                Stay and save
              </Button>
              <Button
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                onClick={discardAndSwitch}
              >
                Discard changes
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
