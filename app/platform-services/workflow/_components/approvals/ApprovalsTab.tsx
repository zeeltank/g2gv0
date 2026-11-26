'use client'

/**
 * The Approvals tab of the Workflows page.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SCREEN IS A LIST OF APPROVALS, NOT A LIST OF FLOWS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The obvious design is a table of the approval flows an organisation has set up. It answers the wrong question. What an administrator comes here to find out is which
 * approvals have NOBODY signing them off, and a list of the configured ones cannot show an absence. So every approval the platform declares is listed, most of them
 * with no flow, and the empty ones are the finding rather than the filler.
 *
 * The headline counts approvals with a flow turned ON. A draft governs nothing, and counting drafts would produce exactly the flattering number that hides the gap.
 *
 * What it keeps from the page it replaces: the engine calls (`lib/platform/workflow.ts`), the flows' versions, the history and the "which flow applies" check. What it
 * changes is only how a person meets them: plain words, a drawer for the form, a question before a delete, a word for each status.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ListChecks, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useConfirm } from '@/components/shared/scaffolds'
import { isDecentralizedModule, MODULE_LABEL, type DecentralizedModuleKey } from '@/lib/platform/access-links'
import { describePlatformError } from '@/lib/platform/client'
import { deleteWorkflow, fetchWorkflowHistory, type WorkflowChain, type WorkflowPoint } from '@/lib/platform/workflow'
import {
  approvalsSummary,
  editFlowForm,
  moduleLabelFor,
  newFlowForm,
  orderedModuleKeys,
  pointCoverage,
  type FlowForm,
} from '@/lib/platform/workflow-approvals'
import { workflowHref } from '@/lib/platform/workflow-tabs'

import { FlowDrawer } from './FlowDrawer'
import { ApprovalsSkeleton, CoverageBar, LoadFailed, Notice } from './parts'
import { PointRow, type HistoryState } from './PointRow'
import { useApprovals } from './use-approvals'

interface DrawerState {
  open: boolean
  /** A new number for each opening, so the form is remounted and nothing typed or refused the last time is still there. */
  session: number
  point: WorkflowPoint
  initial: FlowForm
}

export function ApprovalsTab({ moduleKey }: { moduleKey: DecentralizedModuleKey | null }) {
  const { data, registry, loading, error, reload } = useApprovals(moduleKey)
  const { confirm, confirmDialog } = useConfirm()

  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  const [history, setHistory] = useState<HistoryState | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const modules = registry?.modules ?? []
  const scopeLabel = moduleKey ? MODULE_LABEL[moduleKey] : null

  const toggle = (key: string) => {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)

      return next
    })
  }

  const openDrawer = (point: WorkflowPoint, initial: FlowForm) => {
    setNotice(null)
    setProblem(null)
    setDrawer((current) => ({ open: true, session: (current?.session ?? 0) + 1, point, initial }))
  }

  const closeDrawer = () => setDrawer((current) => (current ? { ...current, open: false } : current))

  const showHistory = async (flow: WorkflowChain) => {
    if (history?.flowId === flow.id) {
      setHistory(null)
      return
    }

    setHistory({ flowId: flow.id, versions: null, loading: true, error: null })

    try {
      const { versions } = await fetchWorkflowHistory(flow.id)
      setHistory((current) => (current?.flowId === flow.id ? { flowId: flow.id, versions, loading: false, error: null } : current))
    } catch (cause: unknown) {
      setHistory((current) =>
        current?.flowId === flow.id ? { flowId: flow.id, versions: null, loading: false, error: describePlatformError(cause, 'The history could not be loaded. Try again in a moment.') } : current,
      )
    }
  }

  const remove = async (flow: WorkflowChain) => {
    const confirmed = await confirm({
      title: `Delete “${flow.name}”?`,
      description: 'Requests already waiting for a decision are not affected. The flow is removed from this approval.',
      confirmLabel: 'Delete approval flow',
    })
    if (!confirmed) return

    setNotice(null)
    setProblem(null)

    try {
      await deleteWorkflow(flow.id)
      setNotice('Approval flow deleted.')
      reload()
    } catch (cause: unknown) {
      setProblem(describePlatformError(cause, 'The approval flow could not be deleted. Try again in a moment.'))
    }
  }

  if (!data && loading) return <ApprovalsSkeleton />
  if (!data) return <LoadFailed message={error ?? 'The approvals could not be loaded.'} onRetry={reload} withData={false} />

  const points = data.points
  const inUse = points.filter((point) => point.enforced)

  const row = (point: WorkflowPoint) => (
    <PointRow
      key={point.key}
      point={point}
      moduleLabel={moduleLabelFor(point.module, modules)}
      expanded={open.has(point.key)}
      history={history && point.workflows.some((flow) => flow.id === history.flowId) ? history : null}
      onToggle={() => toggle(point.key)}
      onAdd={() => openDrawer(point, newFlowForm(point))}
      onEdit={(flow) => openDrawer(point, editFlowForm(flow))}
      onDelete={(flow) => void remove(flow)}
      onHistory={(flow) => void showHistory(flow)}
    />
  )

  return (
    <div className="space-y-4">
      {error && <LoadFailed message={error} onRetry={reload} withData />}
      {notice && <Notice tone="success">{notice}</Notice>}
      {problem && <Notice tone="error">{problem}</Notice>}

      {registry && registry.problems.length > 0 && (
        <Notice tone="caution">
          <p className="font-medium">The approvals setup needs attention ({registry.problems.length})</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {registry.problems.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <p className="mt-1">Share these details with your platform administrator.</p>
        </Notice>
      )}

      {points.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-8" aria-hidden="true" />}
          title={`No approvals are set for ${scopeLabel ?? 'this view'} yet`}
          description="Approvals appear here once an approval flow is declared for this module."
          className="py-12"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 basis-64 space-y-2">
              {/* The headline is what has a flow turned ON, not what is saved: a draft governs nothing. */}
              <p className="text-sm text-foreground" data-approvals-summary>
                {approvalsSummary(points, scopeLabel)}
              </p>
              <CoverageBar covered={inUse.map((point) => pointCoverage(point) === 'on')} />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin motion-reduce:animate-none' : undefined} aria-hidden="true" />
              Refresh
            </Button>
          </div>

          {moduleKey ? (
            // A tab pinned to one module: the server returned only that module's approvals, so a module heading would only repeat the page header.
            <section aria-labelledby="approvals-scope" className="space-y-2">
              <h2 id="approvals-scope" className="text-sm font-semibold text-balance text-foreground">
                Approvals in {scopeLabel} <span className="font-normal text-muted-foreground">({points.length})</span>
              </h2>
              {points.map(row)}
            </section>
          ) : (
            <div className="space-y-6">
              {orderedModuleKeys(points, modules).map((key) => {
                const group = points.filter((point) => point.module === key)
                const label = moduleLabelFor(key, modules)

                return (
                  <section key={key} aria-labelledby={`approvals-group-${key}`} className="space-y-2">
                    <h2 id={`approvals-group-${key}`} className="text-sm font-semibold text-balance text-foreground">
                      {isDecentralizedModule(key) ? (
                        <Link href={workflowHref(key)} className="touch-manipulation rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                          {label}
                        </Link>
                      ) : (
                        label
                      )}{' '}
                      <span className="font-normal text-muted-foreground">({group.length})</span>
                    </h2>
                    {group.map(row)}
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}

      {drawer && registry && (
        <FlowDrawer
          key={drawer.session}
          open={drawer.open}
          point={drawer.point}
          moduleLabel={moduleLabelFor(drawer.point.module, modules)}
          initial={drawer.initial}
          registry={registry}
          onClose={closeDrawer}
          onSaved={(message) => {
            closeDrawer()
            setNotice(message)
            reload()
          }}
        />
      )}

      {confirmDialog}
    </div>
  )
}
