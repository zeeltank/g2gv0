'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Mail, MessageCircle, MessageSquare, Send, Trash2, UserCog, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select'
import { Spinner } from '@/components/ui/spinner'
import { toastSlideUp } from '@/lib/motion/variants'

interface Props {
  count: number
  busy: boolean
  people: SearchableOption[]
  onReassign: (assigneeId: string, cascade: boolean) => void
  onDelete: () => void
  onClear: () => void
  /** When set, shows a checkbox with this label next to Reassign (e.g. "Also transfer contacts") - omit for a module with nothing to cascade to. */
  cascadeLabel?: string
  /** When set, shows a "Send SMS" button - omit for a module with no phone-bearing records (e.g. Campaigns). */
  onSendSms?: () => void
  /** Multi-channel messaging: Email, SMS, WhatsApp */
  onSendMessage?: (channel: 'email' | 'sms' | 'whatsapp') => void
  /** The words on the delete button; "Delete" when omitted. The Product Portfolio says what Delete does ("Delete (to the Recycle Bin)"). */
  deleteLabel?: string
}

/**
 * The shared bulk-action surface for all 4 CRM list views (Leads, Contacts,
 * Organizations, Campaigns) - same fixed-bottom-bar shape as Task
 * Management's WorkspaceBulkActionBar, modeled on it rather than imported:
 * that bar is still hand-rolled per its own two callers too, so there's no
 * existing generic actions-array convention in this app to adopt instead.
 */
export function CrmBulkActionBar({ count, busy, people, onReassign, onDelete, onClear, cascadeLabel, onSendSms, onSendMessage, deleteLabel = 'Delete' }: Props) {
  const [assigneeId, setAssigneeId] = useState('')
  const [cascade, setCascade] = useState(false)

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="crm-bulk-action-bar"
          variants={toastSlideUp}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-2xl"
        >
          <span className="whitespace-nowrap text-sm font-semibold">{count} selected</span>
          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <SearchableSelect
              value={assigneeId}
              onChange={setAssigneeId}
              options={people}
              placeholder="Change owner to…"
              searchPlaceholder="Search people…"
              className="w-56"
              aria-label="Change owner to"
            />
            <Button
              size="sm"
              disabled={!assigneeId || busy}
              onClick={() => { onReassign(assigneeId, cascade); setAssigneeId(''); setCascade(false) }}
            >
              <UserCog className="mr-2 size-4" />Reassign
            </Button>
          </div>

          {cascadeLabel && (
            <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
              <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} disabled={busy} />
              {cascadeLabel}
            </label>
          )}

          {(onSendMessage || onSendSms) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={busy}>
                  <Send className="mr-2 size-4" />Send Message
                  <ChevronDown className="ml-1.5 size-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-44">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => (onSendMessage ? onSendMessage('email') : onSendSms?.())}
                >
                  <Mail className="mr-2 size-4 text-blue-600" />
                  <span>Email</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => (onSendMessage ? onSendMessage('sms') : onSendSms?.())}
                >
                  <MessageSquare className="mr-2 size-4 text-purple-600" />
                  <span>SMS</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => (onSendMessage ? onSendMessage('whatsapp') : onSendSms?.())}
                >
                  <MessageCircle className="mr-2 size-4 text-emerald-600" />
                  <span>WhatsApp</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={onDelete}>
            <Trash2 className="mr-2 size-4" />{deleteLabel}
          </Button>

          {busy && <Spinner className="size-4" />}

          <Button size="sm" variant="ghost" aria-label="Clear selection" onClick={onClear} disabled={busy}>
            <X className="size-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
