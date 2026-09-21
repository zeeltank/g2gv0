'use client'

/**
 * Client for Conversational AI — `/api/ai/ask` and the transcript reads.
 *
 * ── WHY THIS EXISTS BESIDE `app/api/ai/chat/route.ts` ───────────────────────
 *
 * That route is the assistant panel's own chat, and it holds its own Gemini key and
 * keeps its transcripts in a module-level `Map` — so nothing an administrator
 * configures under AI Providers affects it, and nothing it says survives a restart.
 *
 * This client talks to the Laravel endpoints instead, which resolve the provider
 * through the central configuration and store every turn as a row. The existing
 * route is deliberately left alone: it is on a live path, and replacing it is a
 * migration to make once this side is proven rather than a change to bundle in.
 */

import { aiRequest } from './client'

export interface ConversationSummary {
  id: number
  session_key: string
  title: string | null
  module_key: string | null
  turn_count: number
  status: string
  last_turn_at: string | null
  created_at: string | null
}

export interface ConversationTurn {
  id: number
  turn_index: number
  role: 'user' | 'assistant'
  content: string
  provider: string | null
  model: string | null
  input_tokens: number | null
  output_tokens: number | null
  latency_ms: number | null
  /** Set when this turn failed. The transcript keeps it rather than hiding it. */
  error: string | null
  created_at: string | null
}

export interface AskResult {
  conversation_id: number
  session_key: string
  /** Null when the assistant could not answer — `error` then says why. */
  answer: string | null
  /** False when the organisation has no figures, so the answer rests on nothing. */
  grounded?: boolean
  truncated?: boolean
  usage?: {
    provider: string
    model: string | null
    input_tokens: number
    output_tokens: number
    latency_ms: number
    finish_reason: string | null
    truncated: boolean
  }
  error?: string
  /**
   * False means no credential is configured — a normal state with a known fix,
   * not a fault. The screen uses it to choose between "add a key" and "try again".
   */
  configured?: boolean
}

/** One fact the assistant was given about this organisation. */
export interface GroundingFact {
  label: string
  value: string
}

export function askAssistant(input: {
  message: string
  session_key?: string
  module_key?: string | null
}): Promise<AskResult> {
  return aiRequest<AskResult>('/ask', 'POST', input)
}

export function fetchGroundingContext(): Promise<{
  sub_institute_id: string | number
  grounded: boolean
  facts: GroundingFact[]
}> {
  return aiRequest('/grounding-context')
}

export function fetchConversations(): Promise<{
  sub_institute_id: string | number
  conversations: ConversationSummary[]
}> {
  return aiRequest('/conversations')
}

export function fetchConversation(id: number): Promise<{
  conversation: ConversationSummary
  turns: ConversationTurn[]
}> {
  return aiRequest(`/conversations/${id}`)
}
