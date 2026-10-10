'use client'

/**
 * Client for the AI Stack "Example" panels - `/api/ai/modules/{key}/examples`.
 *
 * One live, runnable example per tab, built by the backend from the module's own records,
 * configuration and ledger at request time. Nothing here carries a number or a sentence about
 * data of its own: the types admit absence (`status: 'empty'`, a `run` of kind `none` with a
 * reason) because the backend says so when a module has nothing to show.
 */

import { aiRequest } from './client'

/** The tabs an example exists for. Matches the ids in `build-ai-stack-screens`. */
export type AiExampleTab =
  | 'policies'
  | 'models'
  | 'prompts'
  | 'templates'
  | 'knowledge-base'
  | 'automations'
  | 'usage-cost'
  | 'guardrails'
  | 'activity'
  | 'approvals'

export interface AiExampleFact {
  label: string
  value: string | number | boolean | null
  detail?: string | null
}

export interface AiExampleItem {
  title: string
  detail?: string | null
  meta?: string | null
  status?: 'ok' | 'off' | 'pending' | string | null
  /** The detail is preformatted text (a rendered prompt) and keeps its line breaks. */
  mono?: boolean
}

/** What the primary button does. The browser performs it with calls the app already makes. */
export type AiExampleRun =
  | { kind: 'chat'; label: string; message: string }
  | {
      kind: 'report'
      label: string
      module_key: string
      message: string
      template_id: number
      data_source: string
      expected_rows: number
    }
  | { kind: 'agent'; label: string; agent_id: string; tool: string }
  | {
      kind: 'agent_create'
      label: string
      tool: string
      create: {
        name: string
        description: string
        module: string
        tools_allowed: string[]
        instructions: string
        status: 'active' | 'draft'
      }
    }
  | { kind: 'guardrail'; label: string }
  | { kind: 'none'; label: string; reason: string }

export interface AiModuleExample {
  tab: AiExampleTab
  /** `ready`: built from live records. `empty`: nothing configured yet, explained. `attention`: needs a fix. */
  status: 'ready' | 'empty' | 'attention'
  title: string
  explanation: string
  facts: AiExampleFact[]
  items: AiExampleItem[]
  run: AiExampleRun
  note: string | null
}

export interface AiModuleExamples {
  module: { key: string; label: string }
  rollup: boolean
  generated_at: string
  tabs: Record<AiExampleTab, AiModuleExample>
}

export interface AiGuardrailGate {
  gate: string
  passed: boolean | null
  status: number | null
  message: string
  meaning: string
}

export interface AiGuardrailCheckResult {
  allowed: boolean
  summary: string
  action: { key: string; label: string }
  result: {
    allowed: boolean
    route: string
    gates: AiGuardrailGate[]
    gate_free: boolean
    gate_free_note: string | null
    policy: { allowed: boolean; policy: string | null; message: string }
  }
  /** The `ai_audit_logs` row written for this check, or null if the ledger could not be written. */
  audit_id: number | null
  recorded: boolean
}

export function fetchModuleExamples(moduleKey: string, options: { rollup?: boolean } = {}): Promise<AiModuleExamples> {
  return aiRequest<AiModuleExamples>(
    `/modules/${encodeURIComponent(moduleKey)}/examples${options.rollup ? '?rollup=1' : ''}`,
  )
}

export function runGuardrailCheck(moduleKey: string): Promise<AiGuardrailCheckResult> {
  return aiRequest<AiGuardrailCheckResult>(
    `/modules/${encodeURIComponent(moduleKey)}/examples/guardrail-check`,
    'POST',
    {},
  )
}

/**
 * Put a question to the module chat: opens the assistant drawer and sends it, exactly as if
 * typed. The shell listens for this event; where no chat is mounted, nothing happens and this
 * returns false so the caller can say so.
 */
export function sendToChat(message: string, moduleKey?: string): boolean {
  if (typeof window === 'undefined') return false
  window.dispatchEvent(new CustomEvent('g2g:chat-send', { detail: { message, moduleKey } }))
  return true
}

// ---- one example per PAGE of a module -------------------------------------------------------------------

export interface AiPageSource {
  name: string
  label: string
  description: string
  /** Records the source holds for the caller's organisation right now. */
  rows: number
  truncated: boolean
  columns: string[]
  /** "status: PENDING 110, COMPLETED 5" - how the records split, or '' when they do not. */
  breakdown: string
  facet: string | null
  error: string | null
}

export type AiPageExampleStatus = 'ready' | 'empty' | 'no_data' | 'unmapped'

export interface AiPageExample {
  page: { id: number; title: string; route: string; breadcrumb: string[] }
  module_key: string
  status: AiPageExampleStatus
  purpose: string | null
  sources: AiPageSource[]
  no_data_reason: string | null
  example: {
    title: string
    explanation: string
    question: string
    run: { kind: 'chat'; label: string; message: string }
    report_run: { kind: 'report'; label: string; module_key: string; message: string } | null
  } | null
  /** A chat action key that works on this page (the chat knows its label and wording). */
  action: string | null
  steps: string[]
}

export interface AiPageExamples {
  module: { key: string; label: string }
  generated_at: string
  coverage: { pages: number; ready: number; empty: number; no_data: number; unmapped: number }
  pages: AiPageExample[]
}

export function fetchPageExamples(moduleKey: string): Promise<AiPageExamples> {
  return aiRequest<AiPageExamples>(`/modules/${encodeURIComponent(moduleKey)}/page-examples`)
}
