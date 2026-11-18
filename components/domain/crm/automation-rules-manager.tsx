'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Loader2, Power, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getLaravelContext } from '@/lib/laravel-context'
import { cn } from '@/lib/utils'
import { crmService } from '@/services/crm'
import type { AutomationRule, AutomationRulePayload } from '@/types/crm'

const MODULES = ['lead', 'contact', 'opportunity', 'signal', 'campaign']
const EVENTS = ['created', 'updated', 'status_changed', 'score_changed', 'signal_received']

const ACTION_TYPES = [
  'assign_lead', 'send_notification', 'create_task', 'update_field',
  'add_to_campaign', 'create_opportunity', 'send_email',
]

function formatDate(s: string | null) {
  if (!s) return 'Never'
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface NewRuleForm {
  name: string
  description: string
  triggerModule: string
  triggerEvent: string
  actionType: string
  actionParams: string
}

const emptyForm: NewRuleForm = {
  name: '', description: '', triggerModule: 'lead', triggerEvent: 'created',
  actionType: 'assign_lead', actionParams: '{}',
}

export function AutomationRulesManager() {
  const context = getLaravelContext()
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewRuleForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await crmService.getAutomationRules(context)
      if (res.status === 1) setRules(res.data)
    } finally {
      setLoading(false)
    }
  }, [context])

  useEffect(() => { void load() }, [load])

  async function handleToggle(rule: AutomationRule) {
    try {
      const res = await crmService.toggleAutomationRule(context, rule.id)
      if (res.status === 1) {
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: res.data.is_active } : r))
      }
    } catch { /* silent */ }
  }

  async function handleCreate() {
    setFormError('')
    let parsedParams: Record<string, unknown>
    try {
      parsedParams = JSON.parse(form.actionParams || '{}')
    } catch {
      setFormError('Action params must be valid JSON.')
      return
    }

    const payload: AutomationRulePayload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      triggerModule: form.triggerModule,
      triggerEvent: form.triggerEvent,
      actions: [{ actionType: form.actionType, params: parsedParams }],
    }

    setSaving(true)
    try {
      const res = await crmService.createAutomationRule(context, payload)
      if (res.status === 1) {
        setRules(prev => [res.data, ...prev])
        setShowForm(false)
        setForm(emptyForm)
      } else {
        setFormError('Failed to create rule.')
      }
    } catch {
      setFormError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Automation Rules</h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)} className="h-8 gap-1 text-xs">
          <Plus className="size-3.5" /> New Rule
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Rule</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Name *</label>
              <input
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Auto-assign new leads"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <input
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Trigger Module *</label>
              <select
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
                value={form.triggerModule}
                onChange={e => setForm(f => ({ ...f, triggerModule: e.target.value }))}
              >
                {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Trigger Event *</label>
              <select
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
                value={form.triggerEvent}
                onChange={e => setForm(f => ({ ...f, triggerEvent: e.target.value }))}
              >
                {EVENTS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Action Type *</label>
              <select
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background"
                value={form.actionType}
                onChange={e => setForm(f => ({ ...f, actionType: e.target.value }))}
              >
                {ACTION_TYPES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Action Params (JSON)</label>
              <input
                className="w-full mt-1 px-2 py-1.5 text-sm border rounded bg-background font-mono"
                value={form.actionParams}
                onChange={e => setForm(f => ({ ...f, actionParams: e.target.value }))}
                placeholder='{}'
              />
            </div>
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={saving || !form.name.trim()} className="h-8 text-xs">
              {saving && <Loader2 className="size-3.5 mr-1 animate-spin" />} Create Rule
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm(emptyForm) }} className="h-8 text-xs">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}

      {!loading && rules.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No automation rules yet. Create one to get started.
        </div>
      )}

      {!loading && rules.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Rule</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Trigger</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Actions</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Runs</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Last Run</th>
                <th className="text-left px-4 py-2 font-medium text-xs text-muted-foreground">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{rule.name}</div>
                    {rule.description && <div className="text-xs text-muted-foreground">{rule.description}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-muted rounded px-2 py-0.5 font-mono">
                      {rule.triggerModule}.{rule.triggerEvent}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums">{rule.runCount}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(rule.lastRunAt)}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors',
                        rule.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200',
                      )}
                      title={rule.isActive ? 'Click to deactivate' : 'Click to activate'}
                    >
                      {rule.isActive
                        ? <><Power className="size-3" /> On</>
                        : <><PowerOff className="size-3" /> Off</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
