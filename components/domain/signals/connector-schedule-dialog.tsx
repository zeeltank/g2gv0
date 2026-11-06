'use client'

import { useEffect, useState } from 'react'
import { Clock, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { LaravelContext } from '@/lib/laravel-context'
import { apiErrorText } from '@/lib/api-messages'
import { opportunitiesService, type DataConnectorInfo } from '@/services/signals/opportunities'

export interface ConnectorScheduleDialogProps {
  context: LaravelContext
  open: boolean
  connector: DataConnectorInfo | null
  onClose: () => void
  onSaved: (updated: DataConnectorInfo) => void
}

export function ConnectorScheduleDialog({
  context,
  open,
  connector,
  onClose,
  onSaved,
}: ConnectorScheduleDialogProps) {
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [scheduleEnabled, setScheduleEnabled] = useState(true)
  const [intervalMinutes, setIntervalMinutes] = useState(60)
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !connector) return
    setSyncEnabled(connector.sync_enabled)
    setScheduleEnabled(connector.schedule_enabled)
    setIntervalMinutes(connector.schedule_interval_minutes || 60)
    setTimezone(connector.schedule_timezone || 'Asia/Kolkata')
    setError(null)
  }, [open, connector])

  if (!connector) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)

    try {
      const res = await opportunitiesService.saveConnectorSchedule(context, connector.id, {
        sync_enabled: syncEnabled,
        schedule_enabled: scheduleEnabled,
        schedule_interval_minutes: intervalMinutes,
        schedule_timezone: timezone.trim() || 'Asia/Kolkata',
      })
      onSaved(res.data)
      onClose()
    } catch (err) {
      setError(apiErrorText(err, 'Failed to update schedule.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose() }}>
      <DialogContent className="max-w-md sm:rounded-2xl p-6">
        <DialogHeader className="space-y-1 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Clock className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Sync Schedule
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate max-w-xs">
                {connector.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <p className="flex-1">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40">
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary size-4"
              />
              <div>
                <span className="text-xs font-semibold text-foreground block">Connector Enabled</span>
                <span className="text-[11px] text-muted-foreground">Allows manual & scheduled signal ingestion</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary size-4"
              />
              <div>
                <span className="text-xs font-semibold text-foreground block">Automated Background Polling</span>
                <span className="text-[11px] text-muted-foreground">Runs periodic sync automatically in background</span>
              </div>
            </label>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Sync Interval</label>
              <select
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                disabled={!scheduleEnabled}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every 1 hour (Default)</option>
                <option value={360}>Every 6 hours</option>
                <option value={720}>Every 12 hours</option>
                <option value={1440}>Every 24 hours (Daily)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Timezone (IANA)</label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
                className="bg-background"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Save Schedule
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

