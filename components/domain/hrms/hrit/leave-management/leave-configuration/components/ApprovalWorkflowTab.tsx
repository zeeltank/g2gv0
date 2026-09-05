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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorState } from '@/components/ui/error-state'
import { useLeaveWorkflow } from '@/hooks/use-leave'
import type { LeaveWorkflowSettings } from '@/services/hrms'

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

type WorkflowDraft = Omit<LeaveWorkflowSettings, 'id'>

export default function ApprovalWorkflowTab() {
  const { loading, processing, error, actionMessage, workflow, save, retry, clearMessages } = useLeaveWorkflow()
  const [draft, setDraft] = useState<WorkflowDraft | null>(null)
  const [syncedWorkflow, setSyncedWorkflow] = useState<LeaveWorkflowSettings | null>(null)

  // Adjust the editable draft during render when the server payload changes,
  // rather than in an effect - see https://react.dev/learn/you-might-not-need-an-effect
  if (workflow && workflow !== syncedWorkflow) {
    const { id: _id, ...rest } = workflow
    setSyncedWorkflow(workflow)
    setDraft(rest)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 sm:gap-6">
        <Skeleton className="h-48 w-full sm:h-64" />
        <Skeleton className="h-48 w-full sm:h-64" />
        <Skeleton className="h-48 w-full sm:h-64" />
      </div>
    )
  }

  if (!draft) {
    return (
      <ErrorState
        title="Unable to load the approval workflow"
        description={error ?? 'The approval workflow settings could not be loaded.'}
        retry={retry}
      />
    )
  }

  const update = <K extends keyof WorkflowDraft>(key: K, value: WorkflowDraft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const isDirty = workflow ? JSON.stringify({ ...workflow, id: undefined }) !== JSON.stringify({ ...draft, id: undefined }) : false
  const hasCircleSteps = draft.reporting_manager_enabled || draft.department_head_enabled || draft.hr_enabled

  /*
   * F-124. The chain these switches produce, mirroring
   * LeaveApprovalWorkflow::chainFor() on the server so the preview below
   * updates as they move. The server is authoritative; this is a preview.
   *
   * Multi-level OFF means one approval decides, which is what the switch has
   * always said and what the product now actually does.
   */
  const enabledStages = [
    draft.reporting_manager_enabled ? 'Reporting Manager' : null,
    draft.department_head_enabled ? 'Department Head' : null,
    draft.hr_enabled ? 'HR' : null,
  ].filter((stage): stage is string => stage !== null)

  const previewChain = draft.multi_level_enabled
    ? enabledStages.slice(0, Math.max(1, draft.multi_level_count))
    : enabledStages.slice(0, 1)

  const escalateToLabel =
    escalateToOptions.find((option) => option.value === draft.escalate_to)?.label ?? draft.escalate_to

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {(actionMessage || error) && (
        <Alert variant={error ? 'destructive' : undefined}>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error ?? actionMessage}</span>
            <Button variant="ghost" size="sm" onClick={clearMessages}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg md:text-xl">Approval Workflow</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Configure how leave requests move through the organization&apos;s approval hierarchy.
            </CardDescription>
          </div>
          <Button
            className="h-9 w-full gap-2 rounded-lg font-semibold sm:w-auto"
            onClick={() => save(draft)}
            disabled={processing || !isDirty}
          >
            {processing ? 'Saving...' : 'Save Workflow'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-b sm:border-border">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Reporting Manager Approval</p>
                <p className="text-xs text-muted-foreground">First-level approval from direct manager</p>
              </div>
              <Switch
                checked={draft.reporting_manager_enabled}
                onChange={(event) => update('reporting_manager_enabled', event.target.checked)}
              />
            </div>
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-b sm:border-border">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Department Head Approval</p>
                <p className="text-xs text-muted-foreground">Second-level approval from department head</p>
              </div>
              <Switch
                checked={draft.department_head_enabled}
                onChange={(event) => update('department_head_enabled', event.target.checked)}
              />
            </div>
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:border-b sm:border-border">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">HR Approval</p>
                <p className="text-xs text-muted-foreground">Final approval from HR department</p>
              </div>
              <Switch checked={draft.hr_enabled} onChange={(event) => update('hr_enabled', event.target.checked)} />
            </div>
            <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Multi-Level Approval</p>
                <p className="text-xs text-muted-foreground">Configure multiple approval levels</p>
              </div>
              <Switch
                checked={draft.multi_level_enabled}
                onChange={(event) => update('multi_level_enabled', event.target.checked)}
              />
            </div>
            {draft.multi_level_enabled && (
              <div className="pl-0 sm:pl-4 pt-2 sm:pt-0">
                <Label htmlFor="multiLevelCount">Number of Levels</Label>
                <Select
                  value={String(draft.multi_level_count)}
                  onChange={(value) => update('multi_level_count', Number(value))}
                  options={levelOptions}
                />
              </div>
            )}
          </div>
          {!hasCircleSteps && (
            <p className="mt-4 text-xs text-destructive">At least one approval stage must be enabled.</p>
          )}

          {/*
            F-124. What these switches now produce, before Save is pressed.

            Until this sprint the whole card was decorative: it saved to
            hrms_leave_workflow_settings and nothing in the product ever read
            that table, so a two-stage chain and a one-stage chain behaved
            identically. Showing the resulting chain is how an HR user can tell
            that it no longer does.

            The rule is mirrored from LeaveApprovalWorkflow::chainFor() so the
            preview updates as the switches move. The SERVER is authoritative —
            this is a preview, and the chain is frozen onto each request at the
            moment it is submitted, not read from here at approval time.
          */}
          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              A request submitted with these settings will need
            </p>
            {previewChain.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No approver is enabled, so HR decides by default — a leave request can never be
                left with nobody able to approve it.
              </p>
            ) : (
              <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                {previewChain.map((role, index) => (
                  <li key={role} className="flex items-center gap-2">
                    <span className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground">
                      {index + 1}. {role}
                    </span>
                    {index < previewChain.length - 1 && (
                      <span className="text-muted-foreground">→</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {previewChain.length > 1
                ? 'Every stage must approve. Nobody — including HR — can approve on behalf of a stage that has not been reached.'
                : 'One approval decides the request.'}
              {draft.escalation_enabled
                ? ` If a stage waits longer than ${draft.escalation_time} ${draft.escalation_unit}, ${escalateToLabel} can decide it as well.`
                : ' Overdue approvals are not escalated.'}
            </p>
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
              {hasCircleSteps && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
              {draft.reporting_manager_enabled && (
                <div className="text-center">
                  <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-1 sm:mb-2 sm:size-14 md:size-16">
                    <span className="text-xs font-semibold text-primary sm:text-sm md:text-sm">👨</span>
                  </div>
                  <span className="text-xs text-foreground sm:text-sm">Reporting Manager</span>
                </div>
              )}
              {draft.reporting_manager_enabled && draft.department_head_enabled && (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              {draft.department_head_enabled && (
                <div className="text-center">
                  <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-1 sm:mb-2 sm:size-14 md:size-16">
                    <span className="text-xs font-semibold text-primary sm:text-sm md:text-sm">👩</span>
                  </div>
                  <span className="text-xs text-foreground sm:text-sm">Department Head</span>
                </div>
              )}
              {draft.department_head_enabled && draft.hr_enabled && (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              {draft.hr_enabled && (
                <div className="text-center">
                  <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-1 sm:mb-2 sm:size-14 md:size-16">
                    <span className="text-xs font-semibold text-primary sm:text-sm md:text-sm">💻</span>
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
              <Switch
                checked={draft.escalation_enabled}
                onChange={(event) => update('escalation_enabled', event.target.checked)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 py-3 sm:grid-cols-2 sm:border-b sm:border-border">
              <div className="grid gap-2">
                <Label htmlFor="escalationTime">Escalate After</Label>
                <Input
                  id="escalationTime"
                  type="number"
                  min={1}
                  placeholder="24"
                  value={String(draft.escalation_time)}
                  onChange={(event) => update('escalation_time', Number(event.target.value) || 0)}
                  disabled={!draft.escalation_enabled}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="escalationUnit">Time Unit</Label>
                <Select
                  value={draft.escalation_unit}
                  onChange={(value) => update('escalation_unit', value as LeaveWorkflowSettings['escalation_unit'])}
                  options={timeUnitOptions}
                />
              </div>
            </div>
            <div className="grid gap-2 py-3">
              <Label htmlFor="escalateTo">Escalate To</Label>
              <Select
                value={draft.escalate_to}
                onChange={(value) => update('escalate_to', value as LeaveWorkflowSettings['escalate_to'])}
                options={escalateToOptions}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
