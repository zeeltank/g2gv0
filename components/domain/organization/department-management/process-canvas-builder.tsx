'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { History, LayoutGrid, PanelLeftClose, PanelLeftOpen, Save, Trash2, Upload, Wand2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { SelectInput } from '../components'
import { Notice } from './signals-ui'
import type { Department } from '@/lib/gtg-org-data'
import type { LaravelContext } from '@/lib/laravel-context'
import { organizationService } from '@/services/organization'
import type {
  DepartmentProcess,
  DepartmentProcessEdge,
  DepartmentProcessStep,
  DepartmentProcessTemplates,
  DepartmentProcessVersion,
} from '@/services/organization'
import { ROLES } from '@/hooks/use-roles'
import { ProcessStepNode, stepLabel, type ProcessStepNodeData } from './process-step-node'
import { extractErrorMessages } from './use-department-processes'
import { genId, tidyLayout, buildLinearGraph } from './process-graph-utils'
import { ProcessSourcePanel } from './process-source-panel'
import type { ProcessConversionResult, ProcessConversionSpec } from '@/services/organization'

type ConversionExtras = Pick<
  ProcessConversionSpec,
  'preconditions' | 'inputs' | 'outputs' | 'handoffs' | 'business_rules' | 'tasks'
>

const ASSIGNEE_TYPES = [
  { value: '', label: 'Unassigned' },
  { value: 'role', label: 'Role' },
  { value: 'specific_user', label: 'Specific person' },
  { value: 'department_head', label: 'Department Head' },
  { value: 'dynamic_field', label: 'Dynamic (from context)' },
]

const SLA_UNITS = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
]

const ROLE_OPTIONS = [{ value: '', label: 'Select a role...' }, ...ROLES.map((r) => ({ value: r.id, label: r.label }))]

type LinkOption = { id: string; title: string }
type LinkOptions = { sops: LinkOption[]; policies: LinkOption[]; rules: LinkOption[] }

function buildInitialGraph(
  process: DepartmentProcess,
  stepTypes: Record<string, { label: string; color: string }>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (process.steps ?? []).map((step, index) => {
    const data: ProcessStepNodeData = {
      node_key: step.node_key,
      step_type: step.step_type,
      title: step.title,
      description: step.description,
      assignee_type: step.assignee_type,
      assignee_value: step.assignee_value,
      sla_value: step.sla_value,
      sla_unit: step.sla_unit,
      linked_sop_id: step.linked_sop_id,
      linked_policy_id: step.linked_policy_id,
      linked_rule_id: step.linked_rule_id,
      is_required: step.is_required ?? true,
      stepTypes,
      interactive: true,
    }
    return {
      id: step.node_key,
      type: 'step',
      position: { x: step.position_x ?? 0, y: step.position_y ?? index * 120 },
      data,
    }
  })

  const edges: Edge[] = (process.edges ?? []).map((edge, index) => ({
    id: `e-${index}-${edge.source_node_key}-${edge.target_node_key}`,
    source: edge.source_node_key,
    target: edge.target_node_key,
    label: edge.label ?? undefined,
    type: 'smoothstep',
    animated: process.status === 'active',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    style: { stroke: 'var(--primary)', strokeWidth: 2 },
    labelStyle: { fontSize: 11, fill: 'var(--muted-foreground)' },
    labelBgStyle: { fill: 'var(--card)' },
  }))

  return { nodes, edges }
}

/**
 * The Process tab's canvas builder: a full-screen, editable graph of a
 * department's process. Drag a step type in from the palette, connect steps
 * by dragging between their handles, click a step or connection to edit it in
 * the side panel. Save Draft persists the graph as-is; Publish saves then
 * asks the backend to validate it (see DepartmentProcessController::publish)
 * and snapshot it as the next version.
 */
export function ProcessCanvasBuilder({
  department,
  process,
  templates,
  context,
  canManage,
  onClose,
  onChanged,
}: {
  department: Department
  process: DepartmentProcess
  templates: DepartmentProcessTemplates
  context: LaravelContext
  canManage: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const nodeTypes = useMemo(() => ({ step: ProcessStepNode }), [])
  const flowRef = useRef<ReactFlowInstance | null>(null)

  const initialGraph = useMemo(
    () => buildInitialGraph(process, templates.step_types),
    // Intentionally built once, from the process this builder opened with -
    // reloading it after every local edit would wipe the very changes being made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>(initialGraph.nodes)
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(initialGraph.edges)

  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [errorMessages, setErrorMessages] = useState<string[]>([])
  const [successMessage, setSuccessMessage] = useState('')
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<DepartmentProcessVersion[]>([])

  const [showSourcePanel, setShowSourcePanel] = useState(true)
  const [conversionExtras, setConversionExtras] = useState<ConversionExtras | null>(null)

  const [linkOptions, setLinkOptions] = useState<LinkOptions>({ sops: [], policies: [], rules: [] })
  const [candidates, setCandidates] = useState<SearchableOption[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      organizationService.getDepartmentSops(context, String(department.id)),
      organizationService.getDepartmentPolicies(context, String(department.id)),
      organizationService.getDepartmentRules(context, String(department.id)),
      organizationService.getDepartmentCandidates(context, { departmentId: department.id }),
    ])
      .then(([sops, policies, rules, employees]) => {
        if (cancelled) return
        setLinkOptions({
          sops: (sops?.data ?? []).map((r) => ({ id: String(r.id), title: r.title })),
          policies: (policies?.data ?? []).map((r) => ({ id: String(r.id), title: r.title })),
          rules: (rules?.data ?? []).map((r) => ({ id: String(r.id), title: r.title })),
        })
        setCandidates(
          (employees?.data ?? []).map((e) => ({
            value: String(e.id),
            label: e.name || e.full_name || [e.first_name, e.last_name].filter(Boolean).join(' ') || `#${e.id}`,
            hint: e.employee_no,
          })),
        )
      })
      .catch(() => {
        /* the pickers just stay empty - not fatal to the builder */
      })
    return () => {
      cancelled = true
    }
  }, [context, department.id])

  const markDirty = useCallback(() => setIsDirty(true), [])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeBase(changes)
      if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) markDirty()
    },
    [onNodesChangeBase, markDirty],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChangeBase(changes)
      if (changes.some((c) => c.type !== 'select')) markDirty()
    },
    [onEdgesChangeBase, markDirty],
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: genId(),
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: { stroke: 'var(--primary)', strokeWidth: 2 },
          },
          eds,
        ),
      )
      markDirty()
    },
    [setEdges, markDirty],
  )

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const stepType = event.dataTransfer.getData('application/x-step-type')
      if (!stepType || !flowRef.current) return

      const position = flowRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const nodeKey = genId()
      const data: ProcessStepNodeData = {
        node_key: nodeKey,
        step_type: stepType,
        title: stepLabel(stepType, templates.step_types),
        is_required: true,
        stepTypes: templates.step_types,
        interactive: true,
      }
      setNodes((nds) => [...nds, { id: nodeKey, type: 'step', position, data }])
      setSelectedNodeId(nodeKey)
      setSelectedEdgeId(null)
      markDirty()
    },
    [setNodes, templates.step_types, markDirty],
  )

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId)

  const updateSelectedNode = useCallback(
    (patch: Partial<ProcessStepNodeData>) => {
      if (!selectedNodeId) return
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
      )
      markDirty()
    },
    [selectedNodeId, setNodes, markDirty],
  )

  const updateSelectedEdge = useCallback(
    (patch: Partial<Edge>) => {
      if (!selectedEdgeId) return
      setEdges((eds) => eds.map((e) => (e.id === selectedEdgeId ? { ...e, ...patch } : e)))
      markDirty()
    },
    [selectedEdgeId, setEdges, markDirty],
  )

  function deleteSelectedNode() {
    if (!selectedNodeId) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId))
    setSelectedNodeId(null)
    markDirty()
  }

  function deleteSelectedEdge() {
    if (!selectedEdgeId) return
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId))
    setSelectedEdgeId(null)
    markDirty()
  }

  async function saveCanvas(options: { silent?: boolean } = {}): Promise<boolean> {
    setIsSaving(true)
    setErrorMessages([])
    if (!options.silent) setSuccessMessage('')
    try {
      const steps: DepartmentProcessStep[] = nodes.map((n) => {
        const d = n.data as ProcessStepNodeData
        return {
          node_key: d.node_key,
          step_type: d.step_type,
          title: d.title,
          description: d.description ?? null,
          assignee_type: d.assignee_type || null,
          assignee_value: d.assignee_value || null,
          sla_value: d.sla_value ?? null,
          sla_unit: d.sla_unit ?? null,
          linked_sop_id: d.linked_sop_id ?? null,
          linked_policy_id: d.linked_policy_id ?? null,
          linked_rule_id: d.linked_rule_id ?? null,
          position_x: n.position.x,
          position_y: n.position.y,
          is_required: d.is_required ?? true,
        }
      })
      const edgePayload: DepartmentProcessEdge[] = edges.map((e) => ({
        source_node_key: e.source,
        target_node_key: e.target,
        label: typeof e.label === 'string' ? e.label : null,
        order: 0,
      }))

      await organizationService.updateDepartmentProcessCanvas(context, String(process.id), {
        steps,
        edges: edgePayload,
      })

      // The converter's extra fields (preconditions/inputs/outputs/handoffs/
      // business rule citations/task drafts) ride along in canvas_meta, a
      // separate call because updateDepartmentProcessCanvas only ever
      // touches steps/edges. Only sent when a conversion actually happened -
      // a plain drag-and-drop edit has nothing here to save.
      if (conversionExtras) {
        await organizationService.saveDepartmentProcess(context, { canvas_meta: conversionExtras }, String(process.id))
      }

      setIsDirty(false)
      if (!options.silent) setSuccessMessage('Draft saved.')
      return true
    } catch (cause) {
      const details = extractErrorMessages(cause)
      setErrorMessages(details.length > 0 ? details : [cause instanceof Error ? cause.message : 'Failed to save the canvas.'])
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublish() {
    setErrorMessages([])
    setSuccessMessage('')
    const saved = await saveCanvas({ silent: true })
    if (!saved) return

    setIsPublishing(true)
    try {
      const response = await organizationService.publishDepartmentProcess(context, String(process.id))
      setSuccessMessage(response?.message || 'Process published.')
      onChanged()
    } catch (cause) {
      const details = extractErrorMessages(cause)
      setErrorMessages(details.length > 0 ? details : [cause instanceof Error ? cause.message : 'Process is not ready to publish.'])
    } finally {
      setIsPublishing(false)
    }
  }

  function handleTidyLayout() {
    setNodes((nds) => tidyLayout(nds, edges))
    markDirty()
    window.requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.3, duration: 300 }))
  }

  /**
   * The K12 panel's "real-time filling" - called the instant a conversion
   * succeeds (not behind a separate Apply button), so the canvas on the
   * right fills in as the Source section is worked. The panel itself gates
   * this behind its own confirm-replace dialog when the canvas already has
   * steps; by the time this runs that choice has already been made.
   */
  function handleApplyFromSource(result: ProcessConversionResult) {
    const { spec } = result
    if (spec.steps.length === 0) return

    const graph = buildLinearGraph(
      spec.steps.map((step) => ({
        actor: step.actor,
        actor_type: step.actor_type,
        is_approval: step.is_approval,
        title: step.user_action || step.system_action,
      })),
      templates.step_types,
    )

    setNodes(graph.nodes)
    setEdges(graph.edges)
    setConversionExtras({
      preconditions: spec.preconditions,
      inputs: spec.inputs,
      outputs: spec.outputs,
      handoffs: spec.handoffs,
      business_rules: spec.business_rules,
      tasks: spec.tasks,
    })
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    markDirty()
    window.requestAnimationFrame(() => flowRef.current?.fitView({ padding: 0.3, duration: 300 }))
  }

  function handleClose() {
    if (isDirty) {
      setConfirmCloseOpen(true)
      return
    }
    onClose()
  }

  async function loadHistory() {
    setHistoryOpen(true)
    const response = await organizationService.getDepartmentProcessHistory(context, String(process.id))
    setVersions(response?.data ?? [])
  }

  async function restoreVersion(version: number) {
    try {
      await organizationService.restoreDepartmentProcessVersion(context, String(process.id), version)
      const fresh = await organizationService.getDepartmentProcess(context, String(process.id))
      if (fresh?.data) {
        const rebuilt = buildInitialGraph(fresh.data, templates.step_types)
        setNodes(rebuilt.nodes)
        setEdges(rebuilt.edges)
        setIsDirty(false)
      }
      setHistoryOpen(false)
      setSuccessMessage(`Version ${version} restored into the draft.`)
      onChanged()
    } catch (cause) {
      setErrorMessages([cause instanceof Error ? cause.message : 'Failed to restore that version.'])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{process.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {department.name}
            <Badge variant={process.status === 'active' ? 'success' : 'muted'} className="text-[10px]">
              {process.status === 'active' ? `Active · v${process.current_version}` : 'Draft'}
            </Badge>
            {isDirty && <span className="text-[10px] font-medium text-warning">Unsaved changes</span>}
          </p>
          {process.description && (
            <p className="mt-0.5 max-w-xl truncate text-xs text-muted-foreground">{process.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setShowSourcePanel((v) => !v)}>
              {showSourcePanel ? (
                <PanelLeftClose className="size-4" aria-hidden="true" />
              ) : (
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              )}
              {showSourcePanel ? 'Hide Source' : 'Convert from Text'}
            </Button>
          )}
          {canManage && (
            <Button variant="outline" size="sm" onClick={handleTidyLayout} disabled={nodes.length === 0}>
              <Wand2 className="size-4" aria-hidden="true" />
              Tidy Layout
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => flowRef.current?.fitView({ padding: 0.3, duration: 300 })}
          >
            <LayoutGrid className="size-4" aria-hidden="true" />
            Fit View
          </Button>
          <Button variant="outline" size="sm" onClick={() => void loadHistory()}>
            <History className="size-4" aria-hidden="true" />
            History
          </Button>
          {canManage && (
            <>
              <Button variant="outline" size="sm" disabled={isSaving || !isDirty} onClick={() => void saveCanvas()}>
                <Save className="size-4" aria-hidden="true" />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button size="sm" disabled={isPublishing || nodes.length === 0} onClick={() => void handlePublish()}>
                <Upload className="size-4" aria-hidden="true" />
                {isPublishing ? 'Publishing...' : 'Publish'}
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon-sm" onClick={handleClose}>
            <X className="size-4" />
            <span className="sr-only">Close builder</span>
          </Button>
        </div>
      </div>

      {errorMessages.length > 0 && (
        <div className="border-b border-border px-4 py-2">
          <Notice tone="error">
            {errorMessages.length === 1 ? (
              errorMessages[0]
            ) : (
              <ul className="list-disc space-y-0.5 pl-4">
                {errorMessages.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            )}
          </Notice>
        </div>
      )}
      {successMessage && errorMessages.length === 0 && (
        <div className="border-b border-border px-4 py-2 text-xs font-medium text-success">{successMessage}</div>
      )}

      <div className="flex min-h-0 flex-1">
        {canManage && showSourcePanel && (
          <div className="flex-[3] min-w-0 overflow-y-auto border-r border-border">
            <ProcessSourcePanel
              department={department}
              context={context}
              categories={templates.categories}
              canManage={canManage}
              hasExistingSteps={nodes.length > 0}
              processId={String(process.id)}
              canPublishTasks={!isDirty}
              onApply={handleApplyFromSource}
            />
          </div>
        )}

        {canManage && (
          <div className="w-44 shrink-0 overflow-y-auto border-r border-border p-2">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Drag a step onto the canvas
            </p>
            <div className="space-y-1">
              {Object.entries(templates.step_types).map(([key, meta]) => (
                <div
                  key={key}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-step-type', key)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  className="flex cursor-grab items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted active:cursor-grabbing"
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
                  {meta.label}
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className={`relative min-w-0 ${canManage && showSourcePanel ? 'flex-[2]' : 'flex-1'}`}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={canManage ? onConnect : undefined}
            onInit={(instance) => {
              flowRef.current = instance
            }}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id)
              setSelectedEdgeId(null)
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id)
              setSelectedNodeId(null)
            }}
            onPaneClick={() => {
              setSelectedNodeId(null)
              setSelectedEdgeId(null)
            }}
            nodesDraggable={canManage}
            nodesConnectable={canManage}
            elementsSelectable
            deleteKeyCode={canManage ? ['Backspace', 'Delete'] : null}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={1.5}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} className="opacity-30" />
            <Controls showInteractive={false} />
          </ReactFlow>

          {nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-md border border-dashed border-border bg-card/90 px-4 py-2 text-sm text-muted-foreground">
                Drag a step from the left to start building this process.
              </p>
            </div>
          )}
        </div>

        {(selectedNode || selectedEdge) && (
          <div className="w-72 shrink-0 overflow-y-auto border-l border-border p-4">
            {selectedNode && (
              <StepPanel
                data={selectedNode.data as ProcessStepNodeData}
                stepTypes={templates.step_types}
                linkOptions={linkOptions}
                candidates={candidates}
                canManage={canManage}
                onChange={updateSelectedNode}
                onDelete={deleteSelectedNode}
                onClose={() => setSelectedNodeId(null)}
              />
            )}
            {selectedEdge && (
              <EdgePanel
                edge={selectedEdge}
                canManage={canManage}
                onChange={updateSelectedEdge}
                onDelete={deleteSelectedEdge}
                onClose={() => setSelectedEdgeId(null)}
              />
            )}
          </div>
        )}
      </div>

      {historyOpen && (
        <HistoryDrawer
          versions={versions}
          canManage={canManage}
          onClose={() => setHistoryOpen(false)}
          onRestore={(version) => void restoreVersion(version)}
        />
      )}

      <Dialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have changes to this process that have not been saved. Closing now will discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCloseOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmCloseOpen(false)
                onClose()
              }}
            >
              Discard & close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StepPanel({
  data,
  stepTypes,
  linkOptions,
  candidates,
  canManage,
  onChange,
  onDelete,
  onClose,
}: {
  data: ProcessStepNodeData
  stepTypes: Record<string, { label: string; color: string }>
  linkOptions: LinkOptions
  candidates: SearchableOption[]
  canManage: boolean
  onChange: (patch: Partial<ProcessStepNodeData>) => void
  onDelete: () => void
  onClose: () => void
}) {
  const showLinkField =
    data.step_type === 'sop_reference' || data.step_type === 'policy_reference' || data.step_type === 'rule_reference'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {stepTypes[data.step_type]?.label ?? data.step_type}
        </p>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Title</label>
        <Input
          value={data.title}
          disabled={!canManage}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Description</label>
        <Textarea
          rows={3}
          value={data.description ?? ''}
          disabled={!canManage}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </div>

      {(data.step_type === 'task' || data.step_type === 'approval') && (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Assignee</label>
            <SelectInput
              value={data.assignee_type ?? ''}
              onChange={(value) => onChange({ assignee_type: value || null })}
              options={ASSIGNEE_TYPES}
              disabled={!canManage}
            />
          </div>
          {data.assignee_type === 'role' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Role</label>
              <SelectInput
                value={data.assignee_value ?? ''}
                onChange={(value) => onChange({ assignee_value: value || null })}
                options={ROLE_OPTIONS}
                disabled={!canManage}
              />
            </div>
          )}
          {data.assignee_type === 'specific_user' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Person</label>
              <SearchableSelect
                value={data.assignee_value ?? ''}
                onChange={(value) => onChange({ assignee_value: value || null })}
                options={candidates}
                placeholder="Select a person..."
                searchPlaceholder="Search employees..."
                emptyMessage="No employees found"
                disabled={!canManage}
              />
            </div>
          )}
          {data.assignee_type === 'dynamic_field' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Field key</label>
              <Input
                placeholder="e.g. requester.manager_id"
                value={data.assignee_value ?? ''}
                disabled={!canManage}
                onChange={(event) => onChange({ assignee_value: event.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                Resolved from the run&apos;s context when this step becomes active.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">SLA</label>
              <Input
                type="number"
                min={0}
                value={data.sla_value ?? ''}
                disabled={!canManage}
                onChange={(event) =>
                  onChange({ sla_value: event.target.value === '' ? null : Number(event.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Unit</label>
              <SelectInput
                value={data.sla_unit ?? 'days'}
                onChange={(value) => onChange({ sla_unit: value })}
                options={SLA_UNITS}
                disabled={!canManage}
              />
            </div>
          </div>
        </>
      )}

      {showLinkField && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">
            Linked {data.step_type === 'sop_reference' ? 'SOP' : data.step_type === 'policy_reference' ? 'Policy' : 'Rule'}
          </label>
          <SelectInput
            value={
              data.step_type === 'sop_reference'
                ? String(data.linked_sop_id ?? '')
                : data.step_type === 'policy_reference'
                  ? String(data.linked_policy_id ?? '')
                  : String(data.linked_rule_id ?? '')
            }
            onChange={(value) => {
              const id = value ? Number(value) : null
              if (data.step_type === 'sop_reference') onChange({ linked_sop_id: id })
              else if (data.step_type === 'policy_reference') onChange({ linked_policy_id: id })
              else onChange({ linked_rule_id: id })
            }}
            options={[
              { value: '', label: 'Select...' },
              ...(data.step_type === 'sop_reference'
                ? linkOptions.sops
                : data.step_type === 'policy_reference'
                  ? linkOptions.policies
                  : linkOptions.rules
              ).map((o) => ({ value: o.id, label: o.title })),
            ]}
            disabled={!canManage}
          />
        </div>
      )}

      {canManage && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete step
        </Button>
      )}
    </div>
  )
}

function EdgePanel({
  edge,
  canManage,
  onChange,
  onDelete,
  onClose,
}: {
  edge: Edge
  canManage: boolean
  onChange: (patch: Partial<Edge>) => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Connection</p>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Branch label</label>
        <Input
          placeholder="e.g. Approved, Rejected, Yes, No"
          value={typeof edge.label === 'string' ? edge.label : ''}
          disabled={!canManage}
          onChange={(event) => onChange({ label: event.target.value })}
        />
        <p className="text-[11px] text-muted-foreground">
          Required on both branches out of a Decision step before publishing.
        </p>
      </div>

      {canManage && (
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Remove connection
        </Button>
      )}
    </div>
  )
}

function HistoryDrawer({
  versions,
  canManage,
  onClose,
  onRestore,
}: {
  versions: DepartmentProcessVersion[]
  canManage: boolean
  onClose: () => void
  onRestore: (version: number) => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-80 overflow-y-auto border-l border-border bg-background p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Version history</p>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {versions.length === 0 && <p className="text-sm text-muted-foreground">No published versions yet.</p>}

        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-foreground">Version {v.version_number}</p>
              <p className="text-xs text-muted-foreground">
                {v.published_at ? new Date(v.published_at).toLocaleString() : '-'}
                {v.published_by_name ? ` · ${v.published_by_name}` : ''}
              </p>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full justify-center"
                  onClick={() => onRestore(v.version_number)}
                >
                  Restore into draft
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
