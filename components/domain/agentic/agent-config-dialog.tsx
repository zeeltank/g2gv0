'use client'

/**
 * One-time setup for an agent, per organisation.
 *
 * Kept separate from the launch form because the two have different lifetimes:
 * setup answers "which account do I work against?" and is asked once, launch
 * answers "what should I work on?" and is asked every run.
 *
 * Secret fields are write-only. The server reports which ones hold a value but
 * never the value, so this shows "already saved" rather than pretending to
 * round-trip a credential it cannot read back.
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { isLaravelContextReady } from '@/lib/laravel-context'
import { useLaravelContext } from '@/hooks/use-agentic'
import { agentService } from '@/services/agentic'
import type { AgentConfigState, AgentInputValues } from '@/services/agentic'
import { AgentInputForm, defaultsFor, validateAgainstSchema } from './agent-input-form'

interface AgentConfigDialogProps {
  agentId: number
  agentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fires after a successful save so the caller can refresh `configured`. */
  onSaved: () => void
}

export function AgentConfigDialog({ agentId, agentName, open, onOpenChange, onSaved }: AgentConfigDialogProps) {
  const resolveContext = useLaravelContext()

  const [state, setState] = useState<AgentConfigState | null>(null)
  const [values, setValues] = useState<AgentInputValues>({})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null)

  const load = useCallback(async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    setLoading(true)
    setNotice(null)

    try {
      const response = await agentService.getConfig(context, agentId)
      const config = response.data

      setState(config)
      // Saved answers win over schema defaults; a first-time setup falls back
      // to the defaults so the form is not empty.
      setValues({ ...defaultsFor(config.schema), ...config.values })
      setFiles({})
      setErrors({})
    } catch (error) {
      setNotice({ ok: false, message: error instanceof Error ? error.message : 'Could not load configuration.' })
    } finally {
      setLoading(false)
    }
  }, [agentId, resolveContext])

  useEffect(() => {
    if (!open) return
    // Deferred so the fetch's first setState lands after this render rather
    // than cascading out of the effect body.
    queueMicrotask(() => {
      load()
    })
  }, [open, load])

  const set = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  const setFile = (name: string, file: File | null) => {
    setFiles((current) => {
      const next = { ...current }
      if (file) next[name] = file
      else delete next[name]
      return next
    })
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  const save = async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context) || !state) return

    const found = validateAgainstSchema(state.schema, values, files, state.secrets_set)

    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }

    setSaving(true)
    setNotice(null)

    try {
      // Files are excluded from the value map — they travel as real uploads.
      const plain: Record<string, unknown> = {}
      for (const field of state.schema) {
        if (field.type === 'file') continue
        if (values[field.name] !== undefined) plain[field.name] = values[field.name]
      }

      await agentService.saveConfig(context, agentId, plain, files)

      setNotice({ ok: true, message: 'Connected. This agent is ready to run.' })
      onSaved()
      await load()
    } catch (error) {
      setNotice({ ok: false, message: error instanceof Error ? error.message : 'Could not save configuration.' })
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async () => {
    const context = resolveContext()
    if (!isLaravelContextReady(context)) return

    setSaving(true)

    try {
      await agentService.clearConfig(context, agentId)
      onSaved()
      await load()
      setNotice({ ok: true, message: 'Disconnected.' })
    } catch (error) {
      setNotice({ ok: false, message: error instanceof Error ? error.message : 'Could not disconnect.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure {agentName}</DialogTitle>
          <DialogDescription>
            Connect this agent to your organisation&apos;s own account. Saved for everyone here, and kept separate
            from other organisations using the same agent.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : state && state.schema.length > 0 ? (
            <>
              <AgentInputForm
                schema={state.schema}
                values={values}
                errors={errors}
                onChange={set}
                onFileChange={setFile}
                files={files}
                alreadySet={state.secrets_set}
                disabled={saving}
                columns={1}
              />

              {state.secrets_set.length > 0 && (
                <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  Stored credentials are encrypted and never shown again. Leave those fields untouched to keep them.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This agent needs no setup.</p>
          )}

          {notice && (
            <p
              className={
                notice.ok
                  ? 'rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground'
                  : 'rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive'
              }
            >
              {notice.message}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {state?.configured && state.schema.length > 0 && (
            <Button
              variant="outline"
              onClick={disconnect}
              disabled={saving}
              className="mr-auto h-9 gap-2 rounded-lg border-destructive/30 font-semibold text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Disconnect
            </Button>
          )}

          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="h-9 rounded-lg font-semibold">
            Cancel
          </Button>

          {state && state.schema.length > 0 && (
            <Button onClick={save} disabled={saving || loading} className="h-9 gap-2 rounded-lg font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save & Connect'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
