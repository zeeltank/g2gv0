'use client'

/**
 * Sales & Marketing gap-closure, Wave 3 - the admin screen behind public
 * web-to-lead capture. Fourth tab on the Master Fields console, same
 * precedent Tax Rates and Lead Scoring & Assignment already set.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Globe, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { getLaravelContext, isLaravelContextReady } from '@/lib/laravel-context'
import { crmService } from '@/services/crm'
import type { CrmLeadCaptureSettings } from '@/types/crm'
import { useAssignableEmployees } from './lead-employees'

export function CrmLeadCaptureAdmin() {
  const context = useMemo(() => getLaravelContext(), [])
  const employees = useAssignableEmployees(context, true)
  const [settings, setSettings] = useState<CrmLeadCaptureSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!isLaravelContextReady(context)) { setError('Your ERP session is unavailable. Please sign in again.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const response = await crmService.getLeadCaptureSettings(context)
      setSettings(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load web-to-lead settings.')
    } finally {
      setLoading(false)
    }
  }, [context])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const update = async (payload: Parameters<typeof crmService.updateLeadCaptureSettings>[1]) => {
    setBusy(true)
    setNotice('')
    setError('')
    try {
      const response = await crmService.updateLeadCaptureSettings(context, payload)
      setSettings(response.data)
      setNotice(response.message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save that change.')
    } finally {
      setBusy(false)
    }
  }

  const regenerate = async () => {
    if (!window.confirm('Regenerate the form link? The current link will stop working immediately - update it anywhere it is embedded or shared.')) return
    setBusy(true)
    setError('')
    try {
      const response = await crmService.regenerateLeadCaptureKey(context)
      setSettings(response.data)
      setNotice(response.message)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to regenerate the link.')
    } finally {
      setBusy(false)
    }
  }

  const formUrl = settings?.publicKey && typeof window !== 'undefined'
    ? `${window.location.origin}/public/lead-capture/${settings.publicKey}`
    : ''

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard permission denied - the link is still visible on screen to select by hand */ }
  }

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Loading web-to-lead settings…</div>
  }
  if (error && !settings) {
    return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
  }
  if (!settings) return null

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Public lead capture form</p>
          <p className="text-sm text-muted-foreground">
            A public page anyone can submit, with no login - every submission becomes a Lead here, scored and assigned the same way as any other.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.isEnabled} disabled={busy} onChange={(e) => void update({ isEnabled: e.target.checked })} />
          Enabled
        </label>
      </div>

      {notice && <p className="text-xs text-success">{notice}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="capture-lead-source">Lead Source recorded on every submission</Label>
          <Input
            id="capture-lead-source" value={settings.defaultLeadSource} disabled={busy}
            onChange={(e) => setSettings((s) => (s ? { ...s, defaultLeadSource: e.target.value } : s))}
            onBlur={(e) => void update({ defaultLeadSource: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Default assignee {!settings.isEnabled && <span className="text-xs font-normal text-muted-foreground">(required to turn this on)</span>}</Label>
          <SearchableSelect
            value={settings.defaultAssignedTo ?? ''}
            onChange={(v) => void update({ defaultAssignedTo: v || null })}
            options={employees.map((e) => ({ value: e.id, label: e.name }))}
            placeholder="Choose who owns web leads by default…"
          />
          <p className="text-xs text-muted-foreground">
            Used whenever the lead-assignment rotation (above) is off, or has no one active in it.
          </p>
        </div>
      </div>

      {settings.isEnabled && formUrl && (
        <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
          <Label className="flex items-center gap-1.5"><Globe className="size-3.5" aria-hidden="true" />Your public form link</Label>
          <div className="flex items-center gap-2">
            <Input value={formUrl} readOnly className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => void copyLink()}>
              {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void regenerate()}>
              <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
              Regenerate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {settings.submissionsCount} submission{settings.submissionsCount === 1 ? '' : 's'}
            {settings.lastSubmissionAt ? ` · last on ${settings.lastSubmissionAt}` : ' yet'}
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Protected by rate limiting and a hidden spam trap - there is no CAPTCHA yet, since that needs a provider to be chosen first.
      </p>
    </div>
  )
}
