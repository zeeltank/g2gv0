/**
 * Chat actions: what the assistant can DO from the page the user has open.
 *
 * Application-agnostic. This file names no module, route, table or endpoint. An application
 * supplies a registry of action definitions - what exists, where it applies, what it needs and
 * how to carry it out against its own backend - and the same flow, confirmation and result
 * handling run for every one of them.
 *
 * THE RULES THE FLOW ENFORCES (see `flow.ts`)
 *
 *   - A write action never runs from a sentence. It runs only after the user has seen a preview
 *     of exactly what will be written and pressed Confirm - a structured decision, never
 *     inferred from words like "yes".
 *   - It runs at most once per proposal.
 *   - It runs as the signed-in user, through the application's own client, so the permissions
 *     the application already enforces apply unchanged; a refusal is shown, not hidden.
 */

import type { PageSnapshot } from '@/lib/page-context/dom-snapshot'

/** `draft` produces text for the user to use; `write` changes the application's data. */
export type ActionRisk = 'draft' | 'write'

export interface ActionOption {
  value: string
  label: string
}

export interface ActionInput<App = unknown> {
  key: string
  label: string
  /**
   * `multiselect` lets the user tick several of the same live choices. Its value is the chosen
   * option values joined by `,` (so option values must not contain a comma), and its label in
   * `ActionLabels` is the chosen labels joined by `\n`. See `splitMulti`.
   */
  type: 'text' | 'textarea' | 'select' | 'multiselect'
  required?: boolean
  maxLength?: number
  placeholder?: string
  /** Choices for a `select` / `multiselect`, read from the application's real data when asked for. */
  options?: (context: ActionContext<App>) => Promise<ActionOption[]>
}

/** Where the user is, as the application resolved it. `App` is whatever the application adds. */
export interface ActionContext<App = unknown> {
  pathname: string
  menuId: number | null
  /** The module the page belongs to, when the application resolved one. */
  moduleKey: string | null
  snapshot: PageSnapshot | null
  app: App
}

export interface ActionPreview {
  title: string
  /** Exactly what will be written, field by field. */
  lines: Array<{ label: string; value: string }>
  warning?: string
}

export interface ActionResult {
  ok: boolean
  message: string
  link?: { label: string; href: string }
}

export type ActionValues = Record<string, string>

/** The label shown for each chosen value of a `select` input, keyed by input key. */
export type ActionLabels = Record<string, string>

export interface ChatActionDefinition<App = unknown> {
  key: string
  label: string
  description: string
  risk: ActionRisk
  /**
   * When true, Confirm does not run the action: it sends it for approval, and it runs only after
   * an administrator (never the requester) approves. Absent/false keeps the original behaviour.
   */
  requiresApproval?: boolean
  /** Lower-case phrases that ask for this action: "create department", "add a department". */
  phrases: string[]
  /** Whether this action belongs on the page the user is on. */
  appliesTo: (context: ActionContext<App>) => boolean
  inputs: ActionInput<App>[]
  /** Field-level problems, keyed by input key. Empty means the values are acceptable. */
  validate?: (values: ActionValues) => Record<string, string>
  preview: (values: ActionValues, context: ActionContext<App>, labels: ActionLabels) => ActionPreview
  execute: (values: ActionValues, context: ActionContext<App>) => Promise<ActionResult>
  /**
   * Optional read-back after a SUCCESSFUL execute: ask the application's own API whether the
   * change is really there (the department exists, the course is gone, the head is the new
   * person). It receives what execute returned. If it reports `ok: false` the action is shown as
   * failed - "it ran, but the result could not be confirmed" - rather than as done. It must only
   * read; it never writes.
   */
  verify?: (values: ActionValues, context: ActionContext<App>, result: ActionResult) => Promise<{ ok: boolean; message?: string }>
}

/** Where one proposal is. `confirming` is the only state from which a request or run can start. */
export type FlowState =
  | { phase: 'collecting'; values: ActionValues; errors: Record<string, string> }
  | { phase: 'confirming'; values: ActionValues; preview: ActionPreview }
  | { phase: 'requesting'; values: ActionValues; preview: ActionPreview }
  | { phase: 'awaiting_approval'; values: ActionValues; preview: ActionPreview; requestId: number }
  | { phase: 'approved'; values: ActionValues; preview: ActionPreview; requestId: number; note?: string | null }
  | { phase: 'rejected'; values: ActionValues; preview: ActionPreview; requestId: number; note?: string | null }
  | { phase: 'executing'; values: ActionValues; preview: ActionPreview; requestId?: number }
  | { phase: 'done'; values: ActionValues; preview: ActionPreview; result: ActionResult; requestId?: number }
  | { phase: 'failed'; values: ActionValues; preview: ActionPreview; result: ActionResult; requestId?: number }
  | { phase: 'cancelled'; values: ActionValues }

/** The chosen values of a `multiselect` input (comma-joined), without blanks or repeats. */
export function splitMulti(value: string | undefined): string[] {
  return Array.from(new Set((value ?? '').split(',').map((part) => part.trim()).filter(Boolean)))
}
