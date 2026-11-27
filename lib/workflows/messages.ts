/**
 * The words of an error, and of the server's refusals, in the language of the screen: "step 2", "automation", "turn on", never "Action 2", "workflow",
 * "activate" or a snake_case name. A message says what went wrong and how to fix it, and never apologises.
 *
 * Pure apart from reading an ApiError. Tested in lib/workflows/messages.test.ts.
 */
import { ApiError } from '@/services/core'
import type { WorkflowCatalog } from '@/services/gtm/workflows'
import { capitalize, humanize, stripParenthetical } from './labels'

const NO_RIGHT = 'Only administrators can change automations. Ask an administrator to do this.'

/** The server's text, put into the screen's own words. */
export function plainMessage(text: string, catalog?: WorkflowCatalog | null): string {
  let out = text.trim()

  // Keep the details of the record (written in double curly brackets) exactly as they are while the rest is rewritten.
  const kept: string[] = []
  out = out.replace(/\{\{[^}]*\}\}/g, (match) => {
    kept.push(match)
    return `\u0000${kept.length - 1}\u0000`
  })

  if (catalog) {
    for (const [key, action] of Object.entries(catalog.actions)) {
      const label = stripParenthetical(action.label)
      out = out.replace(new RegExp(`\\s*\\(${key}\\)`, 'g'), '').replace(new RegExp(`\\b${key}\\b`, 'g'), label)
    }
  }

  out = out
    .replace(/\bAction (\d+)\b/g, 'Step $1')
    .replace(/\bWorkflows\b/g, 'Automations')
    .replace(/\bworkflows\b/g, 'automations')
    .replace(/\bWorkflow\b/g, 'Automation')
    .replace(/\bworkflow\b/g, 'automation')
    .replace(/\btriggers\b/g, 'events')
    .replace(/\btrigger\b/g, 'event')
    .replace(/\bactivated\b/gi, 'turned on')
    .replace(/\bactivate\b/gi, 'turn on')
    .replace(/\b[a-z]+(?:_[a-z]+)+\b/g, (word) => humanize(word))

  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[Number(i)] ?? '')
}

/** What a failed call says, in one sentence for a notice. */
export function workflowErrorMessage(error: unknown, fallback: string, catalog?: WorkflowCatalog | null): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return NO_RIGHT
    const text = error.detail ? `${error.message} ${error.detail}` : error.message
    return text.trim() === '' ? fallback : plainMessage(text, catalog)
  }
  return error instanceof Error && error.message ? plainMessage(error.message, catalog) : fallback
}

export interface ServerProblems {
  /** Messages for a field of the form, by the field's name (name, description, max_runs_per_day ...). */
  fields: Record<string, string[]>
  /** Messages about one step, by its position (0 is the first step). */
  steps: Record<number, string[]>
  /** Messages about one condition, by its position. */
  conditions: Record<number, string[]>
  /** Messages about the automation as a whole. */
  general: string[]
}

const POSITIONAL = /^(Action|Step|Condition) (\d+)\b/

/** Sorts what a refused save says into the field, step or condition it is about. */
export function readServerProblems(error: unknown, catalog: WorkflowCatalog | null): ServerProblems {
  const out: ServerProblems = { fields: {}, steps: {}, conditions: {}, general: [] }
  const add = (target: string[], message: string) => { if (!target.includes(message)) target.push(message) }

  if (!(error instanceof ApiError)) {
    add(out.general, workflowErrorMessage(error, 'The automation could not be saved. Check your connection and try again.', catalog))
    return out
  }
  if (error.status === 403) {
    add(out.general, NO_RIGHT)
    return out
  }

  for (const [key, messages] of Object.entries(error.errors ?? {})) {
    for (const raw of messages) {
      const message = plainMessage(raw, catalog)
      const match = POSITIONAL.exec(raw)
      if (key === 'definition' && match) {
        const index = Number(match[2]) - 1
        const bucket = match[1] === 'Condition' ? out.conditions : out.steps
        add((bucket[index] ??= []), capitalize(message.replace(/^(Step|Condition) \d+\s*[:,]?\s*/, '')))
      } else if (key === 'definition') {
        add(out.general, message)
      } else {
        add((out.fields[key] ??= []), message)
      }
    }
  }

  const hasDetail = Object.keys(out.fields).length + Object.keys(out.steps).length + Object.keys(out.conditions).length + out.general.length > 0
  if (!hasDetail) add(out.general, workflowErrorMessage(error, 'The automation could not be saved. Check the fields and try again.', catalog))
  return out
}
