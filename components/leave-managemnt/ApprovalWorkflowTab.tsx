'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

const levelOptions = [
  { label: '2 Levels', value: '2' },
  { label: '3 Levels', value: '3' },
  { label: '4 Levels', value: '4' },
]

const timeUnitOptions = [
  { label: 'Hours', value: 'hours' },
  { label: 'Days', value: 'days' },
]

const escalateToOptions = [
  { label: 'Department Head', value: 'department-head' },
  { label: 'HR', value: 'hr' },
  { label: 'Admin', value: 'admin' },
]

export default function ApprovalWorkflowTab() {
  const [workflowLoading, setWorkflowLoading] = useState(false)
  const [reportingManagerEnabled, setReportingManagerEnabled] = useState(true)
  const [departmentHeadEnabled, setDepartmentHeadEnabled] = useState(true)
  const [hrEnabled, setHrEnabled] = useState(false)
  const [multiLevelEnabled, setMultiLevelEnabled] = useState(false)
  const [multiLevelCount, setMultiLevelCount] = useState('2')
  const [escalationEnabled, setEscalationEnabled] = useState(true)
  const [escalationTime, setEscalationTime] = useState('24')
  const [escalationUnit, setEscalationUnit] = useState('hours')
  const [escalateTo, setEscalateTo] = useState('hr')
  const [workflowEdit, setWorkflowEdit] = useState(false)

  const hasCircleSteps = reportingManagerEnabled || departmentHeadEnabled || hrEnabled

  if (workflowLoading) {
    return (
      <div className="flex flex-col gap-5 sm:gap-6">
        <Skeleton className="h-48 w-full sm:h-64" />
        <Skeleton className="h-48 w-full sm:h-64" />
        <Skeleton className="h-48 w-full sm:h-64" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg md:text-xl">Approval Workflow</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Configure how leave requests move through the organization's approval hierarchy.</CardDescription>
          </div>
          <Button className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto" onClick={() => setWorkflowEdit(!workflowEdit)}>
            {workflowEdit ? 'Save Workflow' : 'Edit Workflow'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-b sm:border-border">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Reporting Manager Approval</p>
                <p className="text-xs text-muted-foreground">First-level approval from direct manager</p>
              </div>
              <Switch checked={reportingManagerEnabled} onChange={(e) => setReportingManagerEnabled(e.target.checked)} />
            </div>
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-b sm:border-border">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Department Head Approval</p>
                <p className="text-xs text-muted-foreground">Second-level approval from department head</p>
              </div>
              <Switch checked={departmentHeadEnabled} onChange={(e) => setDepartmentHeadEnabled(e.target.checked)} />
            </div>
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-b sm:border-border">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">HR Approval</p>
                <p className="text-xs text-muted-foreground">Final approval from HR department</p>
              </div>
              <Switch checked={hrEnabled} onChange={(e) => setHrEnabled(e.target.checked)} />
            </div>
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Multi-Level Approval</p>
                <p className="text-xs text-muted-foreground">Configure multiple approval levels</p>
              </div>
              <Switch checked={multiLevelEnabled} onChange={(e) => setMultiLevelEnabled(e.target.checked)} />
            </div>
            {multiLevelEnabled && (
              <div className="pl-0 sm:pl-4 pt-2 sm:pt-0">
                <Label htmlFor="multiLevelCount">Number of Levels</Label>
                <Select
                  value={multiLevelCount}
                  onChange={setMultiLevelCount}
                  options={levelOptions}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg md:text-xl">Approval Sequence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4 py-4 sm:space-y-6 sm:py-6">
            <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-6 md:gap-8">
              <div className="text-center">
                <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-1 sm:mb-2 sm:size-14 md:size-16">
                  <span className="text-xs font-semibold text-primary sm:text-sm md:text-sm">👤</span>
                </div>
                <span className="text-xs text-foreground sm:text-sm">Employee</span>
              </div>
              {hasCircleSteps && (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              {reportingManagerEnabled && (
                <div className="text-center">
                  <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-1 sm:mb-2 sm:size-14 md:size-16">
                    <span className="text-xs font-semibold text-primary sm:text-sm md:text-sm">👨</span>
                  </div>
                  <span className="text-xs text-foreground sm:text-sm">Reporting Manager</span>
                </div>
              )}
              {reportingManagerEnabled && departmentHeadEnabled && (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              {departmentHeadEnabled && (
                <div className="text-center">
                  <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-1 sm:mb-2 sm:size-14 md:size-16">
                    <span className="text-xs font-semibold text-primary sm:text-sm md:text-sm">👩</span>
                  </div>
                  <span className="text-xs text-foreground sm:text-sm">Department Head</span>
                </div>
              )}
              {departmentHeadEnabled && hrEnabled && (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              {hrEnabled && (
                <div className="text-center">
                  <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-1 sm:mb-2 sm:size-14 md:size-16">
                    <span className="text-xs font-semibold text-primary sm:text-sm md:text-sm">👩\u200D💻</span>
                  </div>
                  <span className="text-xs text-foreground sm:text-sm">HR</span>
                </div>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
            <div className="text-center">
              <div className="mx-auto size-12 rounded-full bg-success/10 flex items-center justify-center mb-1 sm:mb-2 sm:size-14 md:size-16">
                <span className="text-xs font-semibold text-success sm:text-sm md:text-sm">✓</span>
              </div>
              <span className="text-xs text-foreground sm:text-sm">Final Approval</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg md:text-xl">Escalation Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-b sm:border-border">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Escalation Enabled</p>
                <p className="text-xs text-muted-foreground">Auto-escalate pending approvals</p>
              </div>
              <Switch checked={escalationEnabled} onChange={(e) => setEscalationEnabled(e.target.checked)} />
            </div>
            <div className="grid grid-cols-1 gap-4 py-3 sm:grid-cols-2 sm:border-b sm:border-border">
              <div className="grid gap-2">
                <Label htmlFor="escalationTime">Escalate After</Label>
                <Input
                  id="escalationTime"
                  type="number"
                  placeholder="24"
                  value={escalationTime}
                  onChange={(e) => setEscalationTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="escalationUnit">Time Unit</Label>
                <Select
                  value={escalationUnit}
                  onChange={setEscalationUnit}
                  options={timeUnitOptions}
                />
              </div>
            </div>
            <div className="grid gap-2 py-3">
              <Label htmlFor="escalateTo">Escalate To</Label>
              <Select
                value={escalateTo}
                onChange={setEscalateTo}
                options={escalateToOptions}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
