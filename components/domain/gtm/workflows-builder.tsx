'use client'

import { useState } from 'react'
import { Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/services/core'
import {
  workflowsService,
  type CatalogAction,
  type CatalogField,
  type GtmWorkflow,
  type WorkflowAction,
  type WorkflowCatalog,
  type WorkflowCondition,
} from '@/services/gtm/workflows'
import { errMsg } from './gtm-shared'

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm'
const TEXTAREA = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
export const pretty = (s: string) => s.replace(/_/g, ' ')

/** Every message the server gave: field errors and the per-definition list. */
function errLines(e: unknown): string[] {
  if (e instanceof ApiError && e.status !== 403 && e.errors) {
    const lines = Object.values(e.errors).flat().filter(Boolean)
    if (lines.length) return lines
  }
  return [errMsg(e, 'Could not save the workflow')]
}

/**
 * The catalog describes each action parameter in words ("note | task", "whole number 0-365, optional",
 * "true | false (default true)", "object: ..."). The form is derived from those words.
 */
type ParamKind = { kind: 'text' | 'int' | 'bool' | 'json' } | { kind: 'enum'; options: string[] }
function paramKind(desc: string): ParamKind {
  const d = desc.trim()
  if (d.startsWith('object')) return { kind: 'json' }
  if (d.startsWith('whole number') || d.startsWith('id ')) return { kind: 'int' }
  const base = d.replace(/\(.*?\)/g, '').split(',')[0].trim()
  if (base.includes(' | ')) {
    const options = base.split('|').map((s) => s.trim())
    if (options.length === 2 && options.includes('true') && options.includes('false')) return { kind: 'bool' }
    return { kind: 'enum', options }
  }
  return { kind: 'text' }
}
const isRequired = (desc: string) => /\brequired\b/.test(desc) && !/\boptional\b/.test(desc)

interface CondRow { field: string; op: string; value: string }
interface ActionRow { type: string; params: Record<string, string> }

const toStr = (v: unknown): string => (v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

function condFromApi(c: WorkflowCondition): CondRow {
  return { field: c.field, op: c.op, value: Array.isArray(c.value) ? c.value.join(', ') : toStr(c.value) }
}

function condToApi(c: CondRow, f: CatalogField | undefined): WorkflowCondition {
  if (c.op === 'empty' || c.op === 'not_empty') return { field: c.field, op: c.op }
  const one = (s: string): unknown => (f?.type === 'number' && s.trim() !== '' && !Number.isNaN(Number(s)) ? Number(s) : f?.type === 'bool' ? s === 'true' : s)
  if (c.op === 'in' || c.op === 'not_in') return { field: c.field, op: c.op, value: c.value.split(',').map((s) => s.trim()).filter(Boolean).map(one) }
  return { field: c.field, op: c.op, value: one(c.value.trim()) }
}

function actionToApi(a: ActionRow, def: CatalogAction | undefined): WorkflowAction {
  const params: Record<string, unknown> = {}
  for (const [k, desc] of Object.entries(def?.params ?? {})) {
    const raw = (a.params[k] ?? '').trim()
    if (raw === '') continue
    const kind = paramKind(desc).kind
    if (kind === 'int') params[k] = Number.isNaN(Number(raw)) ? raw : Number(raw)
    else if (kind === 'bool') params[k] = raw === 'true'
    else if (kind === 'json') {
      try { params[k] = JSON.parse(raw) } catch { params[k] = raw }
    } else params[k] = raw
  }
  return { type: a.type, params }
}

function actionFromApi(a: WorkflowAction): ActionRow {
  return { type: a.type, params: Object.fromEntries(Object.entries(a.params ?? {}).map(([k, v]) => [k, toStr(v)])) }
}

export function WorkflowBuilder({
  open, workflow, catalog, onClose, onSaved,
}: { open: boolean; workflow: GtmWorkflow | null; catalog: WorkflowCatalog; onClose: () => void; onSaved: () => void }) {
  const editing = workflow !== null
  const triggerKeys = Object.keys(catalog.triggers)
  const [name, setName] = useState(workflow?.name ?? '')
  const [description, setDescription] = useState(workflow?.description ?? '')
  const [trigger, setTrigger] = useState(workflow?.trigger_event ?? triggerKeys[0] ?? '')
  const [conds, setConds] = useState<CondRow[]>((workflow?.conditions ?? []).map(condFromApi))
  const [acts, setActs] = useState<ActionRow[]>((workflow?.actions ?? []).map(actionFromApi))
  const [requiresApproval, setRequiresApproval] = useState(Boolean(workflow?.requires_approval))
  const [maxRuns, setMaxRuns] = useState(String(workflow?.max_runs_per_day ?? 100))
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const t = catalog.triggers[trigger]
  const fields = t?.fields ?? {}
  const actionKeys = Object.keys(catalog.actions)
  const hasConsequential = acts.some((a) => catalog.actions[a.type]?.consequential)

  const changeTrigger = (v: string) => {
    setTrigger(v)
    setConds([]) // facts differ per trigger
    setActs((prev) => prev.filter((a) => (catalog.actions[a.type]?.needs ?? []).every((n) => catalog.triggers[v]?.provides.includes(n))))
  }

  const save = async () => {
    setBusy(true)
    setErrors([])
    const base = {
      name: name.trim(),
      description: description.trim() || null,
      conditions: conds.map((c) => condToApi(c, fields[c.field])),
      actions: acts.map((a) => actionToApi(a, catalog.actions[a.type])),
      requires_approval: requiresApproval,
      max_runs_per_day: Number(maxRuns) || 100,
    }
    try {
      if (editing) await workflowsService.update(workflow.id, base)
      else await workflowsService.create({ ...base, trigger_event: trigger })
      onSaved()
      onClose()
    } catch (e) {
      setErrors(errLines(e))
    } finally {
      setBusy(false)
    }
  }

  const setCond = (i: number, patch: Partial<CondRow>) => setConds((p) => p.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const setAct = (i: number, patch: Partial<ActionRow>) => setActs((p) => p.map((a, j) => (j === i ? { ...a, ...patch } : a)))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit workflow` : 'New workflow'}</DialogTitle>
          <DialogDescription>
            When the trigger happens, if every condition holds, the actions run in order. A new workflow starts as a draft and does nothing until it is activated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Name
              <Input value={name} maxLength={191} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flag stalled deals" />
            </label>
            <label className="text-sm">Trigger (when this happens)
              <select className={`${SELECT} w-full`} value={trigger} disabled={editing} onChange={(e) => changeTrigger(e.target.value)}>
                {triggerKeys.map((k) => <option key={k} value={k}>{catalog.triggers[k].label}</option>)}
              </select>
              {editing && <span className="mt-1 block text-xs text-muted-foreground">The trigger cannot be changed after creation.</span>}
            </label>
          </div>
          <label className="block text-sm">Description (optional)
            <textarea className={TEXTAREA} rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">Conditions <span className="font-normal text-muted-foreground">(all must hold; none = every event)</span></h3>
              <Button size="sm" variant="outline" disabled={conds.length >= 10 || Object.keys(fields).length === 0}
                onClick={() => setConds((p) => [...p, { field: Object.keys(fields)[0], op: catalog.operators[0] ?? 'eq', value: '' }])}>
                <Plus className="mr-1 size-3.5" />Add condition
              </Button>
            </div>
            {conds.length === 0 && <p className="text-sm text-muted-foreground">No conditions - the workflow applies to every {t?.label.toLowerCase() ?? 'event'}.</p>}
            <div className="space-y-2">
              {conds.map((c, i) => {
                const f = fields[c.field]
                const noValue = c.op === 'empty' || c.op === 'not_empty'
                const multi = c.op === 'in' || c.op === 'not_in'
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select className={SELECT} value={c.field} onChange={(e) => setCond(i, { field: e.target.value, value: '' })}>
                      {Object.entries(fields).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select className={SELECT} value={c.op} onChange={(e) => setCond(i, { op: e.target.value })}>
                      {catalog.operators.map((o) => <option key={o} value={o}>{pretty(o)}</option>)}
                    </select>
                    {!noValue && (f?.type === 'bool' && !multi ? (
                      <select className={SELECT} value={c.value} onChange={(e) => setCond(i, { value: e.target.value })}>
                        <option value="">Choose...</option><option value="true">yes</option><option value="false">no</option>
                      </select>
                    ) : f?.type === 'enum' && f.options?.length && !multi ? (
                      <select className={SELECT} value={c.value} onChange={(e) => setCond(i, { value: e.target.value })}>
                        <option value="">Choose...</option>
                        {f.options.map((o) => <option key={o} value={o}>{pretty(o)}</option>)}
                      </select>
                    ) : (
                      <Input className="h-9 w-56" value={c.value} onChange={(e) => setCond(i, { value: e.target.value })}
                        placeholder={multi ? (f?.options?.length ? `comma-separated: ${f.options.slice(0, 3).join(', ')}` : 'comma-separated values') : f?.type === 'number' ? 'number' : 'value'} />
                    ))}
                    <Button size="icon" variant="ghost" aria-label="Remove condition" onClick={() => setConds((p) => p.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">Actions <span className="font-normal text-muted-foreground">(run in order, up to 6)</span></h3>
              <Button size="sm" variant="outline" disabled={acts.length >= 6 || actionKeys.length === 0}
                onClick={() => setActs((p) => [...p, { type: actionKeys[0], params: {} }])}>
                <Plus className="mr-1 size-3.5" />Add action
              </Button>
            </div>
            {acts.length === 0 && <p className="text-sm text-muted-foreground">Add at least one action.</p>}
            <div className="space-y-3">
              {acts.map((a, i) => {
                const def = catalog.actions[a.type]
                const unavailable = (def?.needs ?? []).filter((n) => !t?.provides.includes(n))
                return (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
                      <select className={SELECT} value={a.type} onChange={(e) => setAct(i, { type: e.target.value, params: {} })}>
                        {actionKeys.map((k) => <option key={k} value={k}>{catalog.actions[k].label}</option>)}
                      </select>
                      {def?.consequential && <span className="inline-flex items-center gap-1 text-xs text-amber-700"><ShieldAlert className="size-3.5" />Needs administrator approval per run</span>}
                      <Button size="icon" variant="ghost" className="ml-auto" aria-label="Remove action" onClick={() => setActs((p) => p.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                    </div>
                    {def && <p className="mt-1 text-xs text-muted-foreground">{def.description}</p>}
                    {unavailable.length > 0 && <p className="mt-1 text-xs text-destructive">This action needs a {unavailable.join(', ')}, which the chosen trigger does not provide.</p>}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {Object.entries(def?.params ?? {}).map(([k, desc]) => {
                        const pk = paramKind(desc)
                        const v = a.params[k] ?? ''
                        const set = (val: string) => setAct(i, { params: { ...a.params, [k]: val } })
                        return (
                          <label key={k} className={`text-xs ${pk.kind === 'json' || k === 'body' || k === 'text' ? 'sm:col-span-2' : ''}`}>
                            <span className="font-medium">{pretty(k)}{isRequired(desc) ? ' *' : ''}</span>
                            {pk.kind === 'enum' ? (
                              <select className={`${SELECT} mt-1 w-full`} value={v} onChange={(e) => set(e.target.value)}>
                                <option value="">Choose...</option>
                                {pk.options.map((o) => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : pk.kind === 'bool' ? (
                              <select className={`${SELECT} mt-1 w-full`} value={v} onChange={(e) => set(e.target.value)}>
                                <option value="">Default</option><option value="true">yes</option><option value="false">no</option>
                              </select>
                            ) : pk.kind === 'json' ? (
                              <textarea className={`${TEXTAREA} mt-1 font-mono text-xs`} rows={3} value={v} onChange={(e) => set(e.target.value)} placeholder={'{"account_id": "@account.id"}'} />
                            ) : k === 'body' || k === 'text' ? (
                              <textarea className={`${TEXTAREA} mt-1`} rows={2} value={v} onChange={(e) => set(e.target.value)} />
                            ) : (
                              <Input className="mt-1 h-9" type={pk.kind === 'int' ? 'number' : 'text'} value={v} onChange={(e) => set(e.target.value)} />
                            )}
                            <span className="mt-0.5 block text-muted-foreground">{desc}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            {Object.keys(fields).length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Placeholders such as {'{{'}{Object.keys(fields)[0]}{'}}'} insert a fact from the record. Available for this trigger: {Object.keys(fields).join(', ')}.
              </p>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={requiresApproval || hasConsequential} disabled={hasConsequential} onChange={(e) => setRequiresApproval(e.target.checked)} />
              <span>Require administrator approval for every run
                <span className="block text-xs text-muted-foreground">
                  {hasConsequential ? 'Always on: this workflow contains a consequential action.' : 'Runs wait in the Approvals queue until approved.'}
                </span>
              </span>
            </label>
            <label className="text-sm">Daily run limit
              <Input type="number" min={1} max={1000} value={maxRuns} onChange={(e) => setMaxRuns(e.target.value)} />
            </label>
          </section>

          {errors.length > 0 && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-destructive" role="alert">
              <ul className="list-disc pl-5">{errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim() || acts.length === 0}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Create draft'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
