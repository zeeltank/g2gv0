'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { LaravelContext } from '@/lib/laravel-context'
import { MESSAGE_PURPOSES, type MessageChannel, type MessageDraft } from '@/lib/crm/message-channels'
import { crmService } from '@/services/crm'

interface Props {
  context: LaravelContext
  channel: MessageChannel
  relatedType: 'lead' | 'organization' | 'contact'
  /** Records to draft for. Records with no contact for the channel are left out by the caller. */
  ids: string[]
  /** Text already in the composer, keyed by record id, so Regenerate improves it instead of starting over. */
  existing: Record<string, string>
  hasDrafts: boolean
  disabled?: boolean
  onDrafts: (drafts: MessageDraft[]) => void
}

/**
 * "Generate with AI" for the message composer. It only ever asks for drafts: the result goes back
 * to the composer for the person to read and edit, and nothing is sent from here.
 */
export function MessageDraftPanel({ context, channel, relatedType, ids, existing, hasDrafts, disabled, onDrafts }: Props) {
  const [purpose, setPurpose] = useState<string>(MESSAGE_PURPOSES[0].value)
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setBusy(true)
    setError('')
    try {
      const drafts = await crmService.draftMessages(context, {
        channel,
        relatedType,
        ids,
        purpose,
        instruction: instruction.trim() || undefined,
        existingDrafts: existing,
      })
      onDrafts(drafts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a draft.')
    } finally {
      setBusy(false)
    }
  }

  const many = ids.length > 1

  return (
    <div className="space-y-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
        Write with AI
      </div>
      <p className="text-xs text-muted-foreground">
        {many
          ? 'A separate message is drafted for each recipient from their own CRM details. You review and edit every one before sending.'
          : "The message is drafted from this record's CRM details. You review and edit it before sending."}
      </p>

      <div className="grid gap-2.5 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="ai-purpose">Purpose</Label>
          <Select
            id="ai-purpose"
            value={purpose}
            onChange={setPurpose}
            options={MESSAGE_PURPOSES.map((p) => ({ label: p.label, value: p.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-instruction">Anything specific? (optional)</Label>
          <Input
            id="ai-instruction"
            value={instruction}
            maxLength={1000}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. mention the follow-up call we discussed"
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="button" size="sm" variant="outline" onClick={() => void generate()} disabled={busy || disabled || ids.length === 0}>
        {busy ? (
          <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="mr-2 size-3.5" aria-hidden="true" />
        )}
        {busy ? 'Generating…' : hasDrafts ? 'Regenerate' : many ? `Generate ${ids.length} drafts` : 'Generate draft'}
      </Button>
    </div>
  )
}
