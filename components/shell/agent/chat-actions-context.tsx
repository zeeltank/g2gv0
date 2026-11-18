'use client'

import { createContext, useContext } from 'react'

import type { ActionRequest } from '@/lib/intelligence/ai-action-requests'
import type { ActionInput, ActionLabels, ActionOption, ActionValues, FlowState } from '@/lib/chat-actions/types'

/**
 * What the chat panel needs from the action layer, and nothing about how it is done.
 *
 * The panel renders a card for each proposal and reports what the user did; the controller
 * behind this (in the shell) owns the state, the registry and the rules. `null` means actions
 * are off, and the panel behaves exactly as it did before they existed.
 */
export interface ChatActionsApi {
  /** Actions that belong on the page the user is on. */
  available: Array<{ key: string; label: string; description: string }>
  start: (key: string) => void
  /** One proposal, by the id of the chat message that carries it. */
  entry: (messageId: string) => { label: string; inputs: ActionInput<never>[]; state: FlowState; requiresApproval: boolean } | null
  loadOptions: (input: ActionInput<never>) => Promise<ActionOption[]>
  submit: (messageId: string, values: ActionValues, labels: ActionLabels) => void
  confirm: (messageId: string) => void
  edit: (messageId: string) => void
  cancel: (messageId: string) => void
  /** Take the user to a page the chat offered; the application decides how. */
  navigate: (path: string) => void
  /** The approval ledger: what I can decide, and my own approved requests waiting to run. */
  approvals: {
    pending: ActionRequest[]
    mine: ActionRequest[]
    refresh: () => Promise<void>
    decide: (requestId: number, decision: 'approved' | 'rejected', note?: string) => Promise<void>
    resume: (request: ActionRequest) => void
  }
}

export const ChatActionsContext = createContext<ChatActionsApi | null>(null)

export function useChatActions(): ChatActionsApi | null {
  return useContext(ChatActionsContext)
}
