'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { useAccount } from '@/hooks/use-account'
import type { AccountPreferences } from '@/services/account'
import { SectionBlock, SectionHint, ToggleRow } from './section-primitives'
import { ErrorState } from '@/components/ui/error-state'

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
  /*
   * ═══════════════════════════════════════════════════════════════════════════
   * EVERY SWITCH PERSISTS THE MOMENT IT IS THROWN
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * This held a `draft`, a `dirty` memo, a render-phase sync from the server and
   * a footer Save — the same shape as Preferences, and the same trap: twelve
   * switches that visibly moved and quietly did not persist until a button below
   * the fold was pressed. On a page whose whole job is "which of these should
   * email me", a half-applied answer is worse than no answer.
   *
   * `account.preferences` is now the only state. A refresh cannot lose anything
   * because there is nothing local to lose.
   */
  const stored = account.preferences

  /*
   * THREE OF THE TEN EVENTS CANNOT BE EMAILED AT ALL.
   *
   * `g2g_notification_template` holds ten in-app templates and only seven email
   * ones - the HRIT leave events have no email template, and the composer
   * returns null without one, which `sendEmail()` correctly treats as "do not
   * send". So a switch beside those three would change nothing; they are shown,
   * disabled, and labelled.
   */
  const emailable = useMemo(() => new Set(account.emailableEvents), [account.emailableEvents])

  const groups = useMemo(() => groupEvents(account.notifiableEvents), [account.notifiableEvents])

  if (!stored) {
    return (
      <ErrorState
        title="Your notification settings could not be loaded"
        description="The account service did not answer. Nothing has been changed — try again."
        retry={() => void account.reload()}
      />
    )
  }

  const draft = stored

  /**
   * One event switched.
   *
   * Only the event that changed is sent. The server merges it into the stored
   * map, so a flip does not rewrite the other nine rows — and two switches
   * thrown quickly cannot overwrite one another with a stale copy of the map.
   */
  function setEvent(event: string, wanted: boolean) {
    void account.saveNow('notify_events', { [event]: wanted } as never)
  }

  const emailOff = !draft.notify_email

  return (
    <div className="space-y-6">
      {/*
        * A green "Saved." banner fired on every switch once these autosaved,
        * which on a page of twelve toggles is pure noise. Only a failure earns
        * the width of the pane.
        */}
      {account.saveError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{account.saveError}</AlertDescription>
        </Alert>
      )}

      {/*
        * A CONTROL THAT EXISTS TO BE UN-TOUCHABLE IS NOT A CONTROL.
        *
        * This was a whole SectionBlock containing one permanently disabled
        * switch — `checked disabled onChange={() => {}}`. It offered a decision
        * it would never accept. The fact it was trying to state is now stated,
        * as the description of the section that actually has choices in it.
        */}

      <SectionBlock
        title="Email"
        description="Notifications inside the product are always on — that is how you find out something in your own workspace needs you. These control email only."
        badge={emailOff ? 'Email off' : undefined}
        badgeTitle="Your per-event choices below are kept and apply again when you turn email back on."
      >
        <ToggleRow
          label="Email me about anything"
          description="Off means no email at all, whatever the choices below say."
          checked={draft.notify_email}
          onChange={(value) => void account.saveNow('notify_email', value)}
        />


        {/*
          * ═══════════════════════════════════════════════════════════════════
          * GROUPED INTO CARDS, NOT A CAPTION OVER A FLAT LIST
          * ═══════════════════════════════════════════════════════════════════
          *
          * Twelve switches ran down one column, separated only by a 12px
          * uppercase caption — and each row was a 14px label over a 14px
          * description, so the group headings, the labels and the descriptions
          * were all the same weight of text. Nothing read as a boundary.
          *
          * The groups were already computed (`groupEvents`); they just had no
          * container. A bordered panel per area gives the list the structure the
          * data always had.
          */}
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {groups.map((group) => (
            <div
              key={group.title}
              className="overflow-hidden rounded-lg border border-border bg-surface-muted/40"
            >
              <p className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              <div className="divide-y divide-border/60">
                {group.events.map((event) => {
                  const canEmail = emailable.has(event.key)

                  return (
                    <ToggleRow
                      key={event.key}
                      label={event.label}
                      description={canEmail ? event.blurb : 'In-product only — no email yet.'}
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
