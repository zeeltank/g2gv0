'use client'

/**
 * Sales & Marketing gap-closure, Wave 2 - the admin screen behind automated
 * lead scoring and round-robin assignment. Lives on the Master Fields
 * console as a third tab, same precedent crm-tax-rate-admin.tsx set for a
 * small admin-managed list. Two independent sections on one screen because
 * both are small and both answer "how does a new lead get routed."
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Loader2, Plus, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { EmptyState } from '@/components/ui/empty-state'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmLeadAssignmentSettings, CrmLeadScoringField, CrmLeadScoringOperator, CrmLeadScoringRule } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'
import { LEAD_SCORING_FIELD_LABEL as FIELD_LABEL, LEAD_SCORING_OPERATOR_LABEL as OPERATOR_LABEL } from './lead-scoring-labels'

function ruleSentence(rule: CrmLeadScoringRule): string {
  const field = FIELD_LABEL[rule.fieldKey] ?? rule.fieldKey
  const op = OPERATOR_LABEL[rule.operator] ?? rule.operator
  const value = rule.operator === 'is_not_empty' ? '' : ` "${rule.value}"`
  return `If ${field} ${op}${value}`
}

function AddRuleForm({ fields, operators, numericOperators, onAdded }: {
  fields: CrmLeadScoringField[]
  operators: CrmLeadScoringOperator[]
  numericOperators: CrmLeadScoringOperator[]
  onAdded: () => void
}) {
  const context = useMemo(() => getLaravelContext(), [])
  const [open, setOpen] = useState(false)
  const [fieldKey, setFieldKey] = useState<CrmLeadScoringField>(fields[0] ?? 'industry')
  const [operator, setOperator] = useState<CrmLeadScoringOperator>('equals')
  const [value, setValue] = useState('')
  const [points, setPoints] = useState('10')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const needsValue = operator !== 'is_not_empty'
  const isNumeric = (numericOperators as string[]).includes(operator)

  const submit = async () => {
    if (needsValue && !value.trim()) { setError('Enter a value for this condition.'); return }
    if (!points.trim() || Number.isNaN(Number(points))) { setError('Enter a points value.'); return }
    setSubmitting(true)
    setError('')
    try {
      await crmService.createLeadScoringRule(context, {
        fieldKey, operator, value: needsValue ? value.trim() : undefined, points: Number(points),
      })
      setValue(''); setPoints('10'); setOpen(false)
      onAdded()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add this rule.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
        Add rule
      </Button>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">If</span>
        <div className="w-40">
          <Select value={fieldKey} onChange={(v) => setFieldKey(v as CrmLeadScoringField)} options={fields.map((f) => ({ label: FIELD_LABEL[f] ?? f, value: f }))} />
        </div>
        <div className="w-44">
          <Select value={operator} onChange={(v) => setOperator(v as CrmLeadScoringOperator)} options={operators.map((o) => ({ label: OPERATOR_LABEL[o] ?? o, value: o }))} />
        </div>
        {needsValue && (
          <Input
            value={value} onChange={(e) => setValue(e.target.value)} placeholder={isNumeric ? 'e.g. 1000000' : 'e.g. Technology'}
            type={isNumeric ? 'number' : 'text'} className="h-9 w-40"
          />
        )}
        <span className="text-sm text-muted-foreground">add</span>
        <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="h-9 w-20" />
        <span className="text-sm text-muted-foreground">points</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={submitting} onClick={() => void submit()}>
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : 'Add'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError('') }}>Cancel</Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  )
}

function RuleRow({ rule, onChanged }: { rule: CrmLeadScoringRule; onChanged: () => void }) {
  const context = useMemo(() => getLaravelContext(), [])
  const [busy, setBusy] = useState(false)

  const toggleActive = async () => {
    setBusy(true)
    try {
      await crmService.updateLeadScoringRule(context, rule.id, { isActive: !rule.isActive })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm('Remove this scoring rule?')) return
    setBusy(true)
    try {
      await crmService.deleteLeadScoringRule(context, rule.id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${rule.isActive ? '' : 'opacity-50'}`}>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{ruleSentence(rule)}</span>
      <span className={`shrink-0 text-xs font-medium ${rule.points >= 0 ? 'text-success' : 'text-destructive'}`}>
        {rule.points >= 0 ? '+' : ''}{rule.points} pts
      </span>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={rule.isActive} disabled={busy} onChange={() => void toggleActive()} />
        Active
      </label>
      <Button size="sm" variant="ghost" className="h-7 shrink-0 text-destructive" disabled={busy} onClick={() => void remove()}>
        <Trash2 className="size-3.5" aria-hidden="true" />
      </Button>
    </li>
  )
}

function ScoringRulesSection() {
  const context = useMemo(() => getLaravelContext(), [])
  const [rules, setRules] = useState<CrmLeadScoringRule[]>([])
  const [fields, setFields] = useState<CrmLeadScoringField[]>([])
  const [operators, setOperators] = useState<CrmLeadScoringOperator[]>([])
  const [numericOperators, setNumericOperators] = useState<CrmLeadScoringOperator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const response = await crmService.getLeadScoringRules(context)
      setRules(response.data.rules)
      setFields(response.data.fields)
      setOperators(response.data.operators)
      setNumericOperators(response.data.numericOperators)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load scoring rules.')
    } finally {
      setLoading(false)
    }
  }, [context])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading scoring rules…</div>
  }
  if (error) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Every active rule that matches a lead adds its points. The total is a real, explainable number - never a human guess.</p>
        <AddRuleForm fields={fields} operators={operators} numericOperators={numericOperators} onAdded={() => void load()} />
      </div>
      {rules.length === 0 && <p className="px-2 text-sm text-muted-foreground">No scoring rules yet - every lead scores 0 until you add one.</p>}
      <ul className="divide-y divide-border">
        {rules.map((rule) => <RuleRow key={rule.id} rule={rule} onChanged={() => void load()} />)}
      </ul>
    </div>
  )
}

function AssignmentSection() {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)
  const [settings, setSettings] = useState<CrmLeadAssignmentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [addUserId, setAddUserId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const response = await crmService.getLeadAssignmentSettings(context)
      setSettings(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load assignment settings.')
    } finally {
      setLoading(false)
    }
  }, [context])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const toggleEnabled = async (next: boolean) => {
    setBusy(true)
    setNotice('')
    setError('')
    try {
      const response = await crmService.updateLeadAssignmentSettings(context, next)
      setNotice(response.message)
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change this setting.')
    } finally {
      setBusy(false)
    }
  }

  const addMember = async () => {
    if (!addUserId) return
    setBusy(true)
    setError('')
    try {
      await crmService.addLeadRotationMember(context, addUserId)
      setAddUserId('')
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add this person.')
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async (id: string) => {
    setBusy(true)
    try {
      await crmService.removeLeadRotationMember(context, id)
      void load()
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading assignment settings…</div>
  }
  if (error && !settings) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
  }
  if (!settings) return null

  const availableEmployees = employees.filter((e) => !settings.members.some((m) => m.userId === e.id))

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Auto-assign new leads</p>
          <p className="text-sm text-muted-foreground">
            A new lead with no one explicitly chosen is handed to the next person below, in order, looping back to the top - never to the same person twice in a row.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.isEnabled} disabled={busy} onChange={(e) => void toggleEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>

      {notice && <p className="text-xs text-success">{notice}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {settings.members.length === 0 ? (
        <EmptyState icon={<Users className="size-8" aria-hidden="true" />} title="No one in the rotation yet" description="Add at least one person before turning this on." />
      ) : (
        <ul className="divide-y divide-border">
          {settings.members.map((member, index) => (
            <li key={member.id} className={`flex items-center gap-3 px-2 py-1.5 ${member.userId === settings.lastAssignedUserId ? 'bg-primary/5' : ''}`}>
              <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{member.userName}</span>
              {member.userId === settings.lastAssignedUserId && <span className="shrink-0 text-xs text-muted-foreground">Last assigned</span>}
              <Button size="sm" variant="ghost" className="h-7 shrink-0 text-destructive" disabled={busy} onClick={() => void removeMember(member.id)}>
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1">
        <div className="w-56">
          <SearchableSelect value={addUserId} onChange={setAddUserId} options={availableEmployees.map((e) => ({ value: e.id, label: e.name }))} placeholder="Add a person…" />
        </div>
        <Button size="sm" disabled={busy || !addUserId} onClick={() => void addMember()}>
          <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
          Add
        </Button>
      </div>
    </div>
  )
}

export function CrmLeadRoutingAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Lead Scoring</h2>
        <ScoringRulesSection />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">Lead Assignment</h2>
        <AssignmentSection />
      </div>
    </div>
  )
}
