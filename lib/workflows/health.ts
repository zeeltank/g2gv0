/**
 * The one-line status strip of the Automations tab: is the clock that starts automations running? It is honest about timing ("Checked about every 10
 * minutes", never "instant") and says "Not known" when it cannot tell, never "running".
 *
 * Pure: no React, no network. Tested in lib/workflows/health.test.ts.
 */
import type { WorkflowHealth } from '@/services/gtm/workflows'
import { relativeTime } from './time'

export interface HealthLine {
  tone: 'info' | 'caution'
  text: string
}

const DEFAULT_MINUTES = 10

/** The server's own sentence, unless it claims something instant or says nothing. */
function usable(message: string | undefined): string | null {
  const text = (message ?? '').trim()
  return text === '' || /instant/i.test(text) ? null : text
}

export function healthLine(health: WorkflowHealth | null, now: Date = new Date()): HealthLine {
  if (!health) return { tone: 'info', text: 'Not known: the scheduler’s status could not be read. Automations start when the scheduler checks for new events, about every 10 minutes.' }
  const minutes = Number.isFinite(health.expected_every_minutes) && health.expected_every_minutes > 0 ? health.expected_every_minutes : DEFAULT_MINUTES
  const message = usable(health.message)

  if (health.state === 'running') {
    const last = health.last_tick_at ? ` Last check ${relativeTime(health.last_tick_at, now)}.` : ''
    return { tone: 'info', text: `Checked about every ${minutes} minutes.${last}` }
  }
  if (health.state === 'stale') {
    const lead = 'The scheduler is off, so automations wait.'
    // The server's reason usually already says "so automations wait" (and how long the scheduler has been silent): say it once, not twice.
    return { tone: 'caution', text: message ? (/automations wait/i.test(message) ? message : `${lead} ${message}`) : lead }
  }
  return { tone: 'info', text: `Not known: ${message ?? 'no record of the scheduler running was found.'}` }
}
