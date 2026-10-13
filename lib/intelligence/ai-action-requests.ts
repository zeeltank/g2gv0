'use client'

/**
 * Client for the approval ledger behind assistant-proposed actions - `/api/ai/action-requests`.
 *
 * The server holds the decision and the lifecycle; it never performs the action. Tenant, user
 * and administrator status come from the token, never from this file.
 */

import { aiRequest } from './client'

export type ActionRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ActionRequest {
  id: number
  module_key: string | null
  action_key: string
  requested_by: number
  payload: Record<string, string> | null
  preview: { title: string; lines: Array<{ label: string; value: string }> } | null
  status: ActionRequestStatus
  decided_by: number | null
  decided_at: string | null
  decision_note: string | null
  executed_at: string | null
  result: { ok: boolean; message: string | null } | null
  created_at: string
}

type One = { request: ActionRequest }

export async function createActionRequest(input: {
  actionKey: string
  moduleKey: string | null
  payload: Record<string, string>
  preview: ActionRequest['preview']
  /** The conversation that proposed it, so the audit trail reads end to end. */
  conversationId?: number | null
}): Promise<ActionRequest> {
  const data = await aiRequest<One>('/action-requests', 'POST', {
    action_key: input.actionKey,
    module_key: input.moduleKey ?? undefined,
    payload: input.payload,
    preview: input.preview ?? undefined,
    conversation_id: input.conversationId ?? undefined,
  })
  return data.request
}

export async function getActionRequest(id: number): Promise<ActionRequest> {
  return (await aiRequest<One>(`/action-requests/${id}`)).request
}

/** `mine` = requests I made; `pending` = awaiting a decision (administrators only). */
export async function listActionRequests(
  view: 'mine' | 'pending' | 'all',
  moduleKey?: string | null,
  rollup = false,
): Promise<ActionRequest[]> {
  const query = new URLSearchParams({ view })
  if (moduleKey) query.set('module_key', moduleKey)
  if (rollup) query.set('rollup', '1')
  return (await aiRequest<{ requests: ActionRequest[] }>(`/action-requests?${query.toString()}`)).requests
}

export async function resolveActionRequest(id: number, decision: 'approved' | 'rejected', note?: string): Promise<ActionRequest> {
  return (await aiRequest<One>(`/action-requests/${id}/resolve`, 'POST', { decision, note })).request
}

/** approved -> executing, once. A 409 means someone else already claimed it. */
export async function claimActionRequest(id: number): Promise<ActionRequest> {
  return (await aiRequest<One>(`/action-requests/${id}/claim`, 'POST')).request
}

export async function completeActionRequest(id: number, ok: boolean, message: string): Promise<ActionRequest> {
  return (await aiRequest<One>(`/action-requests/${id}/complete`, 'POST', { ok, message })).request
}

export async function cancelActionRequest(id: number): Promise<ActionRequest> {
  return (await aiRequest<One>(`/action-requests/${id}/cancel`, 'POST')).request
}
