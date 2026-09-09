'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { useAccount } from '@/hooks/use-account'
import type { AccountPreferences } from '@/services/account'
import { SaveButton } from '@/components/settings/settings-shell'
import { SectionBlock, SectionHint, ToggleRow } from './section-primitives'

/**
 * NOTIFICATIONS — the first opt-out of any kind in this product.
 *
 * `NotificationSender::send()` consults no preference whatsoever: there is no
 * mute, no channel choice, and no way to stop being emailed about anything. The
 * ten events below are read from `NotificationDispatcher::NOTIFIES` and returned
 * by `/account/me`, so an eleventh event appears here the day it is added rather
 * than being silently un-mutable.
 *
 * ── IN-APP IS NOT SWITCHABLE, AND THE SCREEN SAYS WHY ───────────────────────
 *
 * It is the product telling you something happened in your own workspace. A
 * silent inbox is how an approval sits unseen for a week, and the person who
 * muted it six months ago will not remember they did.
 *
 * ── THE MASTER SWITCH WINS ──────────────────────────────────────────────────
 *
 * Turning email off greys every row rather than hiding them, so the per-event
 * choices are still visible and come back exactly as they were. Hiding them
 * would make switching email back on feel like a reset.
 */
export function NotificationsSection({ account }: { account: ReturnType<typeof useAccount> }) {
  const [draft, setDraft] = useState<AccountPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stored = account.preferences

  /*
   * SYNC FROM THE SERVER'S COPY, DURING RENDER.
   *
   * Not in an effect. React's own guidance for "adjust state when a prop
   * changes" is to compare against the last value seen and set during render:
   * the component re-renders immediately with the right value and the browser
   * never paints the stale one. An effect would paint an empty form first, and
   * `react-hooks/set-state-in-effect` flags it for exactly that reason.
   */
  const [syncedFrom, setSyncedFrom] = useState<AccountPreferences | null>(null)

  if (stored && stored !== syncedFrom) {
    setSyncedFrom(stored)
    setDraft(stored)
  }

  const dirty = useMemo(() => {
    if (!draft || !stored) return false
    if (draft.notify_email !== stored.notify_email) return true

    return Object.keys(draft.notify_events).some(
      (event) => draft.notify_events[event] !== stored.notify_events[event],
    )
  }, [draft, stored])

  /*
   * THREE OF THE TEN EVENTS CANNOT BE EMAILED AT ALL.
   *
   * `g2g_notification_template` holds ten in-app templates and only seven email
   * ones - the HRIT leave events have no email template, and
   * `NotificationComposer::compose()` returns null without one, which
   * `sendEmail()` correctly treats as "do not send".
   *
   * So an email switch beside those three would be a control that does nothing,
   * and somebody who turned it off would believe they had stopped an email that
   * was never going to arrive. They are shown, disabled, and labelled.
   */
  const emailable = useMemo(
    () => new Set(account.emailableEvents),
    [account.emailableEvents],
  )

  const groups = useMemo(() => groupEvents(account.notifiableEvents), [account.notifiableEvents])

  if (!draft || !stored) {
    return <SectionHint>Your notification settings could not be loaded.</SectionHint>
  }

  function setEvent(event: string, wanted: boolean) {
    setSaved(false)
    setDraft((current) =>
      current
        ? { ...current, notify_events: { ...current.notify_events, [event]: wanted } }
        : current,
    )
  }

  async function save() {
    if (!draft) return

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      // Only the events that actually changed, so a save does not write ten rows
      // every time somebody flips one switch.
      const changedEvents: Record<string, boolean> = {}

      for (const [event, wanted] of Object.entries(draft.notify_events)) {
        if (wanted !== stored?.notify_events[event]) changedEvents[event] = wanted
      }

      await account.savePreferences({
        ...(draft.notify_email !== stored?.notify_email
          ? { notify_email: draft.notify_email }
          : {}),
        ...(Object.keys(changedEvents).length > 0 ? { notify_events: changedEvents } : {}),
      })

      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your choices could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const emailOff = !draft.notify_email

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert variant="success">
          <Check className="size-4" aria-hidden="true" />
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      )}

      <SectionBlock
        title="In the product"
        description="What appears in your notification bell while you are working."
      >
        <ToggleRow
          label="Notifications inside the product"
          description="Always on. This is how you find out something in your own workspace needs you."
          checked
          disabled
          onChange={() => {}}
        />
      </SectionBlock>

      <SectionBlock title="Email" description="Turn the lot off, or choose event by event.">
        <ToggleRow
          label="Email me about anything"
          description="Off means no email at all, whatever the choices below say."
          checked={draft.notify_email}
          onChange={(value) => {
            setSaved(false)
            setDraft((current) => (current ? { ...current, notify_email: value } : current))
          }}
        />

        {emailOff && (
          <Alert className="mt-3">
            <Info className="size-4" aria-hidden="true" />
            <AlertDescription>
              Email is off. Your choices below are kept and will apply again if you turn it back
              on.
            </AlertDescription>
          </Alert>
        )}

        {emailable.size < account.notifiableEvents.length && (
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {account.notifiableEvents.length - emailable.size} of these cannot be emailed yet and
            are shown greyed out. You still get them inside the product.
          </p>
        )}

        <div className="mt-4 space-y-5 border-t border-border pt-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              <div className="mt-1 space-y-0.5">
                {group.events.map((event) => {
                  const canEmail = emailable.has(event.key)

                  return (
                    <ToggleRow
                      key={event.key}
                      label={event.label}
                      description={
                        canEmail
                          ? event.blurb
                          : 'There is no email for this one yet — you are told inside the product instead.'
                      }
                      checked={canEmail ? (draft.notify_events[event.key] ?? true) : false}
                      disabled={emailOff || !canEmail}
                      onChange={(value) => setEvent(event.key, value)}
                    />
                  )
                })}
              </div>
            </div>
          ))}

          {groups.length === 0 && (
            <SectionHint>
              No notifiable events were reported by the server, so there is nothing to choose from
              yet.
            </SectionHint>
          )}
        </div>
      </SectionBlock>

      <div className="flex justify-end border-t border-border pt-5">
        <SaveButton dirty={dirty} saving={saving} onClick={save} />
      </div>
    </div>
  )
}

/**
 * Plain-English names for the dispatcher's event keys.
 *
 * Anything the server sends that is not listed here still appears, titled from
 * its own key — a new event must never be invisible just because this map has
 * not been updated.
 */
const EVENT_LABELS: Record<string, { label: string; blurb: string; group: string }> = {
  // Leave — the three HRIT added in Sprint 7. Before them the module sent
  // nothing at all: an approver found out a request existed by opening the
  // screen, and the employee found out it was decided the same way.
  'leave.submitted': {
    label: 'A leave request needs your decision',
    blurb: 'You are named as an approver for it.',
    group: 'Leave',
  },
  'leave.decided': {
    label: 'A leave request is approved or declined',
    blurb: 'Yours, or one you were involved in.',
    group: 'Leave',
  },
  'leave.escalated': {
    label: 'A leave request is escalated to you',
    blurb: 'It waited too long at an earlier step.',
    group: 'Leave',
  },

  // Tasks
  'task.rejected': {
    label: 'A task of yours is sent back',
    blurb: 'It was reviewed and needs more work.',
    group: 'Tasks',
  },

  // Learning and competency
  'assessment.completed': {
    label: 'An assessment is completed',
    blurb: 'Yours, or one you set.',
    group: 'Learning',
  },
  'certification.issued': {
    label: 'A certificate is issued',
    blurb: '',
    group: 'Learning',
  },
  'certification.expiring': {
    label: 'A certificate is about to expire',
    blurb: 'Worth keeping on — an expired certification can stop somebody working.',
    group: 'Learning',
  },
  'development_plan.approved': {
    label: 'A development plan is approved',
    blurb: '',
    group: 'Learning',
  },

  // People and access
  'employee.offboarded': {
    label: 'Somebody leaves the organisation',
    blurb: 'For people who keep the directory.',
    group: 'People and access',
  },
  'rights.changed': {
    label: 'Your access changes',
    blurb: 'Somebody changed what your role can reach.',
    group: 'People and access',
  },
}

const GROUP_ORDER = ['Leave', 'Tasks', 'Learning', 'People and access', 'Other']

function groupEvents(events: string[]) {
  const buckets = new Map<string, { key: string; label: string; blurb: string }[]>()

  for (const key of events) {
    const known = EVENT_LABELS[key]
    const group = known?.group ?? 'Other'

    if (!buckets.has(group)) buckets.set(group, [])

    buckets.get(group)!.push({
      key,
      // Unknown events read as `Leave submitted` rather than vanishing.
      label: known?.label ?? sentenceCase(key),
      blurb: known?.blurb ?? '',
    })
  }

  return GROUP_ORDER.filter((group) => buckets.has(group)).map((title) => ({
    title,
    events: buckets.get(title)!,
  }))
}

function sentenceCase(key: string) {
  const words = key.replace(/[._]/g, ' ')

  return words.charAt(0).toUpperCase() + words.slice(1)
}
