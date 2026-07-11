'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Tabs } from '@/components/business'
import { useAuth } from '@/hooks/use-auth'
import LeaveTypesTab from '@/components/hrit/leave-management/leave-configuration/components/LeaveTypesTab'
import ApprovalWorkflowTab from '@/components/hrit/leave-management/leave-configuration/components/ApprovalWorkflowTab'
import HolidayCalendarTab from '@/components/hrit/leave-management/leave-configuration/components/HolidayCalendarTab'
import RolesAccessTab from '@/components/hrit/leave-management/leave-configuration/components/RolesAccessTab'

const configTabs = [
  { id: 'leave-types', label: 'Leave Types' },
  { id: 'approval-workflow', label: 'Approval Workflow' },
  { id: 'holiday-calendar', label: 'Holiday Calendar' },
  { id: 'roles-access', label: 'Roles & Access' },
]

export default function LeaveConfigurationPage() {
  const { user, isLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('leave-types')

  if (isLoading) return null

  if (!user || !['admin', 'hr'].includes(user.role)) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center sm:min-h-[480px] sm:px-8 sm:py-16 md:min-h-[520px] lg:px-10">
        <div
          className="mb-5 flex size-14 items-center justify-center rounded-lg bg-danger/10 text-danger sm:mb-6 sm:size-16"
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
        <Tabs tabs={configTabs} active={activeTab} onChange={setActiveTab} />
      </div>

      <div className="px-4 pb-4 sm:px-0 sm:pb-0 md:pb-0 lg:pb-0">
        {activeTab === 'leave-types' && <LeaveTypesTab isLoading={isLoading} />}
        {activeTab === 'approval-workflow' && <ApprovalWorkflowTab />}
        {activeTab === 'holiday-calendar' && <HolidayCalendarTab isLoading={isLoading} />}
        {activeTab === 'roles-access' && <RolesAccessTab isLoading={isLoading} />}
      </div>
    </div>
  )
}
