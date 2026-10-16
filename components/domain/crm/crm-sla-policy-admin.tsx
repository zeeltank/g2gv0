'use client'

/**
 * Sales & Marketing gap-closure, Wave 4 - the admin screen behind support
 * SLA timers. Fifth tab on the Master Fields console, same precedent every
 * prior admin-config screen in this effort set.
 *
 * One row per real ticket priority (fetched from the same picklist Tickets
 * itself uses, not a hardcoded list) - a priority with no row is shown as
 * genuinely "Not configured," never defaulted to a guessed number of hours.
 *
 * Wave 6 adds, once a priority HAS an hours policy, who to escalate a
 * breach to and whether that reassigns the ticket - same "never guess,
 * never silently widen what the system does" rule as every prior wave's
 * own admin config (Web-to-Lead's required default assignee, Wave 2's
 * auto-assignment rotation toggle).
 */

import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Switch } from '@/components/ui/switch'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmSlaPolicy } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

export function CrmSlaPolicyAdmin() {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)
  const [policies, setPolicies] = useState<CrmSlaPolicy[]>([])
  const [priorities, setPriorities] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyPriority, setBusyPriority] = useState<string | null>(null)

  const load = async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const response = await crmService.getSlaPolicies(context)
      setPolicies(response.data.policies)
      setPriorities(response.data.priorities)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load SLA policies.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { queueMicrotask(() => void load()) }, [context])

  const save = async (priority: string) => {
    const hours = Number(drafts[priority])
    if (!Number.isFinite(hours) || hours <= 0) return
    setBusyPriority(priority)
    setError('')
    try {
      await crmService.saveSlaPolicy(context, priority, hours)
      setDrafts((d) => { const next = { ...d }; delete next[priority]; return next })
      void load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that policy.')
    } finally {
      setBusyPriority(null)
    }
  }

  const remove = async (policy: CrmSlaPolicy) => {
    if (!window.confirm(`Remove the SLA for ${policy.priority}? Tickets at that priority will show "No SLA" until a new one is set.`)) return
    setBusyPriority(policy.priority)
    try {
      await crmService.deleteSlaPolicy(context, policy.id)
      void load()
    } finally {
      setBusyPriority(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading SLA policies…</div>
  }
  if (error && policies.length === 0 && priorities.length === 0) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
  }

  const byPriority = new Map(policies.map((p) => [p.priority, p]))

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm text-muted-foreground">
        How many hours staff have to post the first response on a ticket, by priority. A priority with no policy set shows no SLA at all - never a guessed number.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ul className="divide-y divide-border">
        {priorities.map((priority) => {
          const policy = byPriority.get(priority)
          const draft = drafts[priority] ?? ''
          const busy = busyPriority === priority
          return (
            <li key={priority} className="space-y-2 px-2 py-2">
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium text-foreground">{priority}</span>
                {policy ? (
                  <>
                    <span className="text-sm text-foreground">{policy.responseHours} hour{policy.responseHours === 1 ? '' : 's'} to first response</span>
                    <Button size="sm" variant="ghost" className="ml-auto h-7 text-destructive" disabled={busy} onClick={() => void remove(policy)}>
                      <X className="mr-1 size-3.5" aria-hidden="true" />
                      Remove
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground">Not configured - no SLA</span>
                    <div className="ml-auto flex items-center gap-2">
                      <Input
                        type="number" min="0.25" step="0.25" value={draft} placeholder="hours"
                        className="h-8 w-24" disabled={busy}
                        onChange={(e) => setDrafts((d) => ({ ...d, [priority]: e.target.value }))}
                      />
                      <Button size="sm" className="h-8" disabled={busy || !draft.trim()} onClick={() => void save(priority)}>
                        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : 'Set'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
              {policy && <EscalationRow key={policy.id} policy={policy} employees={employees} onSaved={load} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Wave 6's own sub-row - a SEPARATE save action from the hours Set/Remove
 * above, deliberately: PATCH .../escalation never touches responseHours,
 * so the two can never clobber each other.
 */
function EscalationRow({ policy, employees, onSaved }: { policy: CrmSlaPolicy; employees: ReturnType<typeof useAssignableEmployees>; onSaved: () => void }) {
  const context = useMemo(() => getLaravelContext(), [])
  const [escalateTo, setEscalateTo] = useState(policy.escalateToUserId ?? '')
  const [autoReassign, setAutoReassign] = useState(policy.autoReassignOnBreach)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Clearing the contact must also drop auto-reassign - the backend refuses
  // that combination (nowhere for a reassignment to go), and silently
  // leaving the toggle on would just surface as a confusing 422 on Save.
  const setEscalateToAndGuard = (value: string) => {
    setEscalateTo(value)
    if (!value) setAutoReassign(false)
  }

  const dirty = escalateTo !== (policy.escalateToUserId ?? '') || autoReassign !== policy.autoReassignOnBreach

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await crmService.updateSlaEscalation(context, policy.id, escalateTo || null, autoReassign)
      onSaved()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save escalation settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ml-24 flex flex-wrap items-center gap-3 rounded-md bg-muted/30 px-2 py-1.5">
      <span className="text-xs text-muted-foreground">Escalate to</span>
      <SearchableSelect
        value={escalateTo}
        onChange={setEscalateToAndGuard}
        options={employees.map((e) => ({ value: e.id, label: e.name }))}
        placeholder="No escalation contact"
        className="w-56"
        aria-label={`Escalation contact for ${policy.priority}`}
      />
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Switch checked={autoReassign} onChange={(e) => setAutoReassign(e.target.checked)} disabled={!escalateTo} />
        Auto-reassign the ticket on breach
      </label>
      {dirty && (
        <Button size="sm" variant="outline" className="h-7" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : 'Save'}
        </Button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
