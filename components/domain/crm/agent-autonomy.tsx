'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AUTONOMY_INTRO, changeFailureText, isNotAdministrator, killSavedNotice, LEVELS_UNUSED_WHILE_STOPPED, levelSavedNotice, NOT_ADMINISTRATOR_TEXT, REFRESH_FAILED_TEXT, shouldReadAgainAfter,
  WAITING_LEVELS_NOTE,
} from '@/lib/agent/autonomy-model'
import { returnFocusTo } from '@/lib/agent/focus'
import type { Notice } from '@/lib/agent/model'
import { BANNER_TONE } from '@/lib/agent/tones'
import { cn } from '@/lib/utils'
import type { AgentApi } from '@/services/agent/api-types'
import { agentService } from '@/services/agent/agent-service'
import type { AutonomyAction } from '@/services/agent/types'
import type { AutonomyStore } from './agent-autonomy-state'
import { ActionRow, KillSwitchCard } from './agent-autonomy-parts'

/** The row of the kill switch in the per-row state (an action key can never be `*`: the server refuses it). */
const KILL = '*'

/** A copy of the record without one key. */
function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key))
}

export interface AgentAutonomyProps {
  /** The settings as the screen read them (the screen reads them once: they also decide whether this tab exists). */
  store: AutonomyStore
  /** For tests and for a page that already has one. */
  service?: AgentApi
  className?: string
}

/**
 * The Autonomy tab of Agent Run History (administrators only: the screen does not list it for anybody else): how much the agent may do on its own for each
 * kind of action, with what happened to its proposals in the last 30 days beside each level as the evidence for raising or lowering it, and the organisation's
 * kill switch. A change is staged by choosing it, then saved with one button (the reason is optional); the level that lets the agent act alone shows a warning
 * first, and its button is the deliberate second click. A change is audited by the server and answers with the action as it now stands, which replaces that
 * action here. One change in flight at a time, also within one tick. Nothing here can create an action: the list is what the server sends.
 */
export function AgentAutonomy({ store, service = agentService, className }: AgentAutonomyProps) {
  const titleId = useId()
  const { phase, data, error } = store

  /** Levels chosen and not yet saved, by action key. */
  const [staged, setStaged] = useState<Record<string, string>>({})
  const [killStaged, setKillStaged] = useState<'stop' | 'resume' | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Record<string, Notice | null>>({})
  /** The key (or the kill switch) whose save is in flight. */
  const [busy, setBusy] = useState<string | null>(null)
  /** A refusal said this person may not change settings: the controls are off and a sentence says why. */
  const [denied, setDenied] = useState(false)
  /** The last Refresh could not read the settings: what is shown may be out of date. */
  const [refreshFailed, setRefreshFailed] = useState(false)

  const inFlight = useRef(false)
  const selects = useRef<Record<string, HTMLSelectElement | null>>({})
  const killToggle = useRef<HTMLButtonElement | null>(null)

  const say = useCallback((key: string, message: Notice | null) => setMessages((current) => ({ ...current, [key]: message })), [])
  const forgetStage = useCallback((key: string) => {
    setStaged((current) => omit(current, key))
    setReasons((current) => omit(current, key))
  }, [])
  const focusSelect = (key: string) => returnFocusTo(selects.current[key])

  const stage = (action: AutonomyAction, level: string) => {
    if (inFlight.current) return
    say(action.key, null)
    // Choosing the level the action is at already is choosing nothing: the row goes back to how it was.
    if (level === action.level) forgetStage(action.key)
    else setStaged((current) => ({ ...current, [action.key]: level }))
  }

  const cancel = (action: AutonomyAction) => {
    if (inFlight.current) return
    forgetStage(action.key)
    focusSelect(action.key)
  }

  const save = async (action: AutonomyAction) => {
    const level = staged[action.key]
    if (inFlight.current || level === undefined) return
    inFlight.current = true
    setBusy(action.key)
    say(action.key, null)
    try {
      const response = await service.setAutonomy(action.key, level, reasons[action.key])
      store.applyAction(response.data)
      forgetStage(action.key)
      say(action.key, { tone: 'success', text: levelSavedNotice(response.data) })
      focusSelect(action.key)
    } catch (cause) {
      if (isNotAdministrator(cause)) {
        setDenied(true)
        forgetStage(action.key)
      } else if (shouldReadAgainAfter(cause)) {
        // The server said something about what it has now (the action is gone, the request was refused): read it again, so the screen shows the truth. A
        // lost connection keeps what was chosen and typed, so it can be saved again.
        await store.load(true)
      }
      say(action.key, { tone: 'error', text: changeFailureText(cause, 'The level could not be saved.') })
      focusSelect(action.key)
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  const stageKill = (kind: 'stop' | 'resume') => {
    if (inFlight.current) return
    say(KILL, null)
    setKillStaged(kind)
  }

  const cancelKill = () => {
    if (inFlight.current) return
    setKillStaged(null)
    setReasons((current) => omit(current, KILL))
    returnFocusTo(killToggle.current)
  }

  const saveKill = async () => {
    if (inFlight.current || killStaged === null) return
    const asked = killStaged === 'stop'
    inFlight.current = true
    setBusy(KILL)
    say(KILL, null)
    try {
      const response = await service.setKillSwitch(asked, reasons[KILL])
      store.applyKillSwitch(response.data.kill_switch)
      setKillStaged(null)
      setReasons((current) => omit(current, KILL))
      say(KILL, { tone: 'success', text: killSavedNotice(response.data.kill_switch, asked) })
      returnFocusTo(killToggle.current)
    } catch (cause) {
      if (isNotAdministrator(cause)) {
        setDenied(true)
        setKillStaged(null)
      } else if (shouldReadAgainAfter(cause)) {
        await store.load(true)
      }
      say(KILL, { tone: 'error', text: changeFailureText(cause, 'The switch could not be changed.') })
      returnFocusTo(killToggle.current)
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  const heading = (
    <div className="space-y-1">
      <h2 id={titleId} className="text-base font-semibold text-foreground">Autonomy</h2>
      <p className="text-sm text-muted-foreground">{AUTONOMY_INTRO}</p>
      <p className="text-sm text-muted-foreground">{WAITING_LEVELS_NOTE}</p>
    </div>
  )

  if (phase === 'loading' || (phase === 'ready' && !data)) {
    return (
      <section aria-labelledby={titleId} aria-busy="true" className={cn('space-y-4', className)} data-autonomy-state="loading">
        {heading}
        <p role="status" className="text-sm text-muted-foreground">Opening the autonomy settings…</p>
      </section>
    )
  }

  if (phase === 'forbidden' || phase === 'unavailable') {
    return (
      <section aria-labelledby={titleId} className={cn('space-y-4', className)} data-autonomy-state={phase}>
        {heading}
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">{error}</p>
      </section>
    )
  }

  if (phase === 'error' || !data) {
    return (
      <section aria-labelledby={titleId} className={cn('space-y-4', className)} data-autonomy-state="error">
        {heading}
        <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm', BANNER_TONE.error)}>
          <span><strong>The autonomy settings could not be opened.</strong> {error}</span>
          <Button size="sm" variant="outline" onClick={() => { void store.load() }}><RefreshCw aria-hidden /> Retry</Button>
        </div>
      </section>
    )
  }

  const anyBusy = busy !== null || store.refreshing
  return (
    <section aria-labelledby={titleId} aria-busy={anyBusy} className={cn('space-y-4', className)} data-autonomy-state="ready">
      {heading}

      <p className="sr-only" role="status" aria-live="polite">{busy !== null ? 'Saving…' : store.refreshing ? 'Reading the settings again…' : ''}</p>

      {denied && <p role="alert" data-denied className={cn('rounded-lg border p-3 text-sm', BANNER_TONE.error)}>{NOT_ADMINISTRATOR_TEXT}</p>}
      {refreshFailed && <p role="alert" data-refresh-failed className={cn('rounded-lg border p-3 text-sm', BANNER_TONE.error)}>{REFRESH_FAILED_TEXT}</p>}

      <KillSwitchCard
        kill={data.kill_switch} staged={killStaged} reason={reasons[KILL] ?? ''} message={messages[KILL] ?? null} busy={busy === KILL} anyBusy={anyBusy} locked={denied}
        toggleRef={killToggle} onStage={stageKill} onReason={(text) => setReasons((current) => ({ ...current, [KILL]: text }))} onSave={() => { void saveKill() }} onCancel={cancelKill}
      />

      {data.kill_switch.on && <p className="text-sm text-muted-foreground" data-levels-unused>{LEVELS_UNUSED_WHILE_STOPPED}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Actions and their levels</h3>
        <Button
          variant="outline" size="sm" disabled={anyBusy} className="gap-1.5 text-xs"
          onClick={() => { void store.load(true).then((worked) => setRefreshFailed(!worked)) }}
        >
          <RefreshCw aria-hidden className={cn('size-3.5', store.refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <ul className="space-y-3" aria-label="Actions and their levels">
        {data.actions.map((action) => (
          <ActionRow
            key={action.key} action={action} staged={staged[action.key] ?? null} reason={reasons[action.key] ?? ''} message={messages[action.key] ?? null}
            busy={busy === action.key} anyBusy={anyBusy} locked={denied} selectRef={(element) => { selects.current[action.key] = element }}
            onStage={(level) => stage(action, level)} onReason={(text) => setReasons((current) => ({ ...current, [action.key]: text }))}
            onSave={() => { void save(action) }} onCancel={() => cancel(action)}
          />
        ))}
      </ul>
    </section>
  )
}
