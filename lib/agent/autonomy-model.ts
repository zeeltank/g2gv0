import { formatWhen, NETWORK_TEXT, NO_VALUE } from '@/lib/agent/model'
import type { AutonomyAction, AutonomyCounts, AutonomyLastChange, KillSwitch } from '@/services/agent/types'

/**
 * What the Autonomy tab says, decided in one place and tested without a browser (the components render these, they do not invent words). The rules the
 * words keep: a level is a WORD with its effect in a sentence, never a colour or a number; `applied` already INCLUDES `accepted`, so the two are never added;
 * a cost, a name or a date that is not known is said not to be, never guessed; and what lets the agent act without asking carries a warning.
 */

/** The longest reason an administrator may give (the server accepts 300). */
export const MAX_AUTONOMY_REASON = 300

// ── The levels ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface LevelWords {
  label: string
  /** What the level means for the agent, in a sentence. */
  effect: string
}

const WAITS = 'The agent proposes it and waits for a person to accept or dismiss it.'

const LEVEL_WORDS: Record<string, LevelWords> = {
  off: { label: 'Off', effect: 'The agent does not do this at all. If it asks for it, the request is refused and nothing is stored.' },
  suggest: { label: 'Suggest', effect: WAITS },
  draft: { label: 'Draft', effect: WAITS },
  approval: { label: 'Needs approval', effect: WAITS },
  alone: { label: 'On its own', effect: 'The agent does it without asking, and the record is marked Agent.' },
}

/** What the three levels that wait for a person have in common today: said once on the tab, so a person is not left to guess why there are three. */
export const WAITING_LEVELS_NOTE = 'Suggest, Draft and Needs approval all work the same way today: the agent proposes and a person decides. They are kept apart for features that will tell them apart.'

/** A level this screen knows by its name; one it does not know (a newer server) by its own key made readable, never guessed at. */
export function levelLabel(level: string): string {
  if (level in LEVEL_WORDS) return LEVEL_WORDS[level].label
  const words = level.replace(/[_-]+/g, ' ').trim()
  return words === '' ? 'Unknown level' : words.charAt(0).toUpperCase() + words.slice(1)
}

export function levelEffect(level: string): string {
  return LEVEL_WORDS[level]?.effect ?? 'A level this screen has no words for. The server applies it as it is.'
}

/** Whether choosing this level needs a second, deliberate click: only the one that lets the agent act without anyone seeing the thing first. */
export function needsSecondClick(level: string): boolean {
  return level === 'alone'
}

/** The warning shown before the agent is allowed to do something on its own. */
export function aloneWarning(actionLabel: string): string {
  return `If you choose this, the agent does “${actionLabel}” without asking: nobody accepts it first, and the record it creates is marked Agent. You can set a lower level again at any time.`
}

export const ALONE_CONFIRM_TEXT = 'Let the agent do this on its own'

/** The words on the button that saves a staged level. The level that needs a second click names what the click does. */
export function saveText(level: string): string {
  return needsSecondClick(level) ? ALONE_CONFIRM_TEXT : `Save: ${levelLabel(level)}`
}

/** The levels to offer for an action: the ones the server lists, in its order, and always the one it is at now. */
export function levelOptions(action: Pick<AutonomyAction, 'levels' | 'level'>): Array<{ value: string; label: string }> {
  const values = action.levels.map(String)
  if (!values.includes(action.level)) values.push(action.level)
  return values.map((value) => ({ value, label: levelLabel(value) }))
}

export function defaultText(action: Pick<AutonomyAction, 'default' | 'overridden'>): string {
  return `Default: ${levelLabel(action.default)}. ${action.overridden ? 'Your organisation has changed it.' : 'Your organisation has not changed it.'}`
}

// ── The counters ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const COUNTS_HEADING = 'Last 30 days'
export const NO_PROPOSALS_TEXT = 'The agent made no proposal of this kind in the last 30 days.'

export const AUTONOMY_INTRO = 'Choose how much the agent may do for each kind of action. The counts under each one are what happened to its proposals in the last 30 days: if people accept nearly everything, it may be safe to let the agent do it on its own; if they dismiss it or it fails, ask first or switch it off.'

export interface CounterLine {
  key: 'proposed' | 'applied' | 'dismissed' | 'failed' | 'waiting'
  label: string
  value: number
  /** Said beside the number when it needs saying: `applied` already includes the ones a person accepted. */
  note: string | null
}

/**
 * The counters as lines. `applied` INCLUDES `accepted` (a person accepted it and it was applied): the accepted ones are said INSIDE the applied line and are
 * never a line of their own, so nobody adds them. A proposal that is not applied, dismissed or failed is still waiting for a person (the status is one of
 * those four), so `proposed` minus the three is how many are still waiting; that line is left out when none is, and when the numbers cannot be so (a count
 * that does not add up is the server's, not something to show a made-up number for).
 */
export function counterLines(counts: AutonomyCounts): CounterLine[] {
  const lines: CounterLine[] = [
    { key: 'proposed', label: 'Proposed', value: counts.proposed, note: null },
    { key: 'applied', label: 'Applied', value: counts.applied, note: counts.applied > 0 ? `including ${counts.accepted} accepted by a person` : null },
    { key: 'dismissed', label: 'Dismissed', value: counts.dismissed, note: null },
    { key: 'failed', label: 'Failed', value: counts.failed, note: null },
  ]
  const waiting = counts.proposed - counts.applied - counts.dismissed - counts.failed
  if (waiting > 0) lines.push({ key: 'waiting', label: 'Still waiting', value: waiting, note: null })
  return lines
}

// ── Who changed it and when ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function lastChangedText(change: AutonomyLastChange | null, timeZone?: string): string {
  if (change === null) return 'No change is on record.'
  // formatWhen answers a dash for a date it cannot read: that is "not known", not a date to print.
  const formatted = change.at ? formatWhen(change.at, timeZone) : null
  const when = formatted !== null && formatted !== NO_VALUE ? formatted : null
  const who = change.by_name && change.by_name.trim() !== '' ? change.by_name : null
  if (who && when) return `Last changed by ${who} on ${when}.`
  if (when) return `Last changed on ${when}. Who changed it is not on record.`
  if (who) return `Last changed by ${who}. When is not on record.`
  return 'A change is on record, but not who made it or when.'
}

// ── The kill switch ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type KillState = 'running' | 'stopped' | 'platform' | 'unknown'

export interface KillView {
  state: KillState
  title: string
  text: string
  /** Whether "Stop all agent actions for this organisation" is offered. */
  canStop: boolean
  /** Whether "Resume" is offered: only for the organisation's OWN switch. The platform's cannot be changed from a screen. */
  canResume: boolean
}

export const STOP_TEXT = 'Stop all agent actions for this organisation'
export const RESUME_TEXT = 'Resume'
export const STOP_CONFIRM_TEXT = 'Stop the agent'
export const RESUME_CONFIRM_TEXT = 'Resume the agent'
export const STOP_WARNING = 'While it is stopped the agent starts no new run and applies nothing, including what people accept. Proposals that are already waiting stay in the list and can still be dismissed.'
export const RESUME_WARNING = 'When it is resumed the agent can run again, and it does what each level below allows, including the actions you have set to run on their own.'
export const LEVELS_UNUSED_WHILE_STOPPED = 'The agent is switched off, so none of these levels applies until it is switched on again.'

export function killView(kill: KillSwitch): KillView {
  if (!kill.on) {
    return { state: 'running', title: 'The agent is running', text: 'It does what each level below allows.', canStop: true, canResume: false }
  }
  if (kill.scope === 'organisation') {
    return {
      state: 'stopped', title: 'The agent is switched off for your organisation',
      text: 'It starts no new run and applies nothing, including what people accept. Proposals that are already waiting stay in the list and can still be dismissed.',
      canStop: false, canResume: true,
    }
  }
  if (kill.scope === 'platform') {
    return {
      state: 'platform', title: 'The agent is switched off for every organisation',
      text: 'The platform has stopped it. That switch cannot be changed from this screen; the agent works again when the platform switches it back on.',
      canStop: false, canResume: false,
    }
  }
  return {
    state: 'unknown', title: 'The agent is switched off',
    text: 'This screen cannot tell who switched it off, so it offers no way to switch it back on.',
    canStop: false, canResume: false,
  }
}

// ── What a change answers with ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The sentence after a level was saved, from the action as the server now has it. */
export function levelSavedNotice(action: Pick<AutonomyAction, 'label' | 'level' | 'overridden'>): string {
  const state = action.overridden ? 'set to' : 'back at the default,'
  return `Saved. “${action.label}” is now ${state} ${levelLabel(action.level)}. ${levelEffect(action.level)}`
}

/** The sentence after the switch was changed, from the switch as the server now has it. */
export function killSavedNotice(kill: KillSwitch, asked: boolean): string {
  if (kill.on && kill.scope === 'platform') {
    return asked
      ? 'Saved. The platform has also switched the agent off for every organisation, and that switch cannot be changed here.'
      : 'Your organisation’s own switch is off, but the platform’s switch still keeps the agent stopped for everybody. It cannot be changed here.'
  }
  if (kill.on) return 'Saved. The agent is switched off for your organisation: no new run starts and nothing is applied until you resume it.'
  return 'Saved. The agent is running again and does what each level allows.'
}

const statusOf = (error: unknown): number | null => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}
const codeOf = (error: unknown): string | null => {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : null
}
const messageOf = (error: unknown): string | null => {
  const message = (error as { message?: unknown } | null)?.message
  return typeof message === 'string' && message.trim() !== '' ? message : null
}

export const REFRESH_FAILED_TEXT = 'The settings could not be read again. What is shown may be out of date.'
export const NOT_ADMINISTRATOR_TEXT = 'Only an administrator can change these settings. Nothing was changed.'
export const SERVER_LACKS_AUTONOMY_TEXT = 'This server does not have the autonomy settings yet.'
export const ACTION_GONE_TEXT = 'The server no longer has this kind of action. Nothing was changed, and the list was read again.'

/** Why a change was refused, in a sentence: the server's own when it gave one, otherwise a plain one for the status. */
export function changeFailureText(error: unknown, fallback: string): string {
  const status = statusOf(error)
  if (status === 403) return NOT_ADMINISTRATOR_TEXT
  if (status === 404) return codeOf(error) === 'unknown_action' ? ACTION_GONE_TEXT : SERVER_LACKS_AUTONOMY_TEXT
  if (status !== null) return messageOf(error) ?? `The server answered ${status}.`
  if (error instanceof TypeError) return NETWORK_TEXT
  return messageOf(error) ?? fallback
}

/** Whether the person may not change settings at all (the server says they are not an administrator): the controls go and a sentence says why. */
export function isNotAdministrator(error: unknown): boolean {
  return statusOf(error) === 403
}

/** Whether the list should be read again after a refusal, so the screen shows what the server now has: not after a lost connection, where a read would fail too. */
export function shouldReadAgainAfter(error: unknown): boolean {
  return statusOf(error) !== null && !isNotAdministrator(error)
}
