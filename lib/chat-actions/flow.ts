import type {
  ActionContext,
  ActionLabels,
  ActionResult,
  ActionValues,
  ChatActionDefinition,
  FlowState,
} from './types'

/**
 * The life of one proposed action, as plain functions on a state value.
 *
 * Kept free of React and of any backend so the rules below can be tested directly - they are
 * the safety property of the whole feature:
 *
 *   collecting -> confirming   only through `submit`, and only when the values are valid
 *   confirming -> executing    only through `beginExecution` (the Confirm press)
 *   executing  -> done|failed  only through `finish`
 *
 * There is no path from `collecting` to `executing`, none back into `executing` once it has
 * run, and `cancel` is final. A second Confirm - a double click, a stale button - finds the
 * state no longer `confirming` and does nothing, so an action cannot run twice.
 */

export function start<App>(definition: ChatActionDefinition<App>, prefill: ActionValues = {}): FlowState {
  const values: ActionValues = {}

  for (const input of definition.inputs) {
    values[input.key] = (prefill[input.key] ?? '').trim()
  }

  return { phase: 'collecting', values, errors: {} }
}

/** Trimmed values, with required and length rules applied before the action's own `validate`. */
export function problems<App>(definition: ChatActionDefinition<App>, values: ActionValues): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const input of definition.inputs) {
    const value = (values[input.key] ?? '').trim()

    if (input.required && value === '') {
      errors[input.key] = `${input.label} is required.`
    } else if (input.maxLength !== undefined && value.length > input.maxLength) {
      errors[input.key] = `${input.label} must be at most ${input.maxLength} characters.`
    }
  }

  return { ...(definition.validate?.(values) ?? {}), ...errors }
}

/** Collecting -> confirming, or stay collecting with the problems. Any other state is unchanged. */
export function submit<App>(
  state: FlowState,
  definition: ChatActionDefinition<App>,
  values: ActionValues,
  context: ActionContext<App>,
  labels: ActionLabels = {},
): FlowState {
  if (state.phase !== 'collecting') return state

  const trimmed: ActionValues = {}
  for (const input of definition.inputs) trimmed[input.key] = (values[input.key] ?? '').trim()

  const errors = problems(definition, trimmed)

  if (Object.keys(errors).length > 0) {
    return { phase: 'collecting', values: trimmed, errors }
  }

  return { phase: 'confirming', values: trimmed, preview: definition.preview(trimmed, context, labels) }
}

/**
 * The Confirm press. Returns the executing state, or null when execution must NOT start -
 * because the proposal is not awaiting confirmation (already running, finished, cancelled).
 */
export function beginExecution(state: FlowState): Extract<FlowState, { phase: 'executing' }> | null {
  if (state.phase !== 'confirming') return null

  return { phase: 'executing', values: state.values, preview: state.preview }
}

/**
 * Confirm on an action that needs approval: confirming -> requesting. Null when the proposal is
 * not awaiting confirmation, so a second press cannot send a second request.
 */
export function beginApproval(state: FlowState): Extract<FlowState, { phase: 'requesting' }> | null {
  if (state.phase !== 'confirming') return null

  return { phase: 'requesting', values: state.values, preview: state.preview }
}

/** The request was recorded: requesting -> awaiting_approval. */
export function requested(state: FlowState, requestId: number): FlowState {
  return state.phase === 'requesting'
    ? { phase: 'awaiting_approval', values: state.values, preview: state.preview, requestId }
    : state
}

/** Recording the request failed: nothing was sent, so show why. */
export function requestFailed(state: FlowState, result: ActionResult): FlowState {
  return state.phase === 'requesting'
    ? { phase: 'failed', values: state.values, preview: state.preview, result }
    : state
}

/**
 * The server's verdict on a request we are waiting on. Only `awaiting_approval` reacts, and only
 * to approved/rejected - any other status (still pending, or one we already passed) changes nothing.
 */
export function decided(state: FlowState, status: string, note?: string | null): FlowState {
  if (state.phase !== 'awaiting_approval') return state

  if (status === 'approved') {
    return { phase: 'approved', values: state.values, preview: state.preview, requestId: state.requestId, note }
  }
  if (status === 'rejected') {
    return { phase: 'rejected', values: state.values, preview: state.preview, requestId: state.requestId, note }
  }

  return state
}

/**
 * Start running an APPROVED action: approved -> executing. Reachable only from `approved`, so an
 * action that was never approved - or was already claimed - cannot run.
 */
export function beginApprovedExecution(state: FlowState): Extract<FlowState, { phase: 'executing' }> | null {
  if (state.phase !== 'approved') return null

  return { phase: 'executing', values: state.values, preview: state.preview, requestId: state.requestId }
}

/** The result of an execution, as the state the card shows. */
export function finish(
  state: Extract<FlowState, { phase: 'executing' }>,
  result: ActionResult,
): FlowState {
  return result.ok
    ? { phase: 'done', values: state.values, preview: state.preview, result, requestId: state.requestId }
    : { phase: 'failed', values: state.values, preview: state.preview, result, requestId: state.requestId }
}

/** Back from the preview to the form, keeping what was typed. Only possible before execution. */
export function edit(state: FlowState): FlowState {
  return state.phase === 'confirming' ? { phase: 'collecting', values: state.values, errors: {} } : state
}

/** Cancelling is possible until execution starts (including while waiting for approval), and final. */
export function cancel(state: FlowState): FlowState {
  return state.phase === 'collecting' || state.phase === 'confirming' || state.phase === 'awaiting_approval'
    ? { phase: 'cancelled', values: state.values }
    : state
}

/** Whether the proposal has reached an end and can no longer change. */
export function isFinal(state: FlowState): boolean {
  return (
    state.phase === 'done' || state.phase === 'failed' || state.phase === 'cancelled' || state.phase === 'rejected'
  )
}
